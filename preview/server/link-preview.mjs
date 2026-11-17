// Prévia de link (título, texto e imagem da página), como WhatsApp e redes sociais mostram ao colar um endereço.
// O servidor busca a página por conta da pessoa, então a busca só vai a endereços públicos: nada de rede interna, localhost,
// metadados de nuvem ou IP privado (SSRF). O IP validado é o mesmo usado na conexão (não dá para trocar o DNS no meio) e cada
// redirecionamento passa pela mesma checagem.
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

const MAX_BYTES = 400 * 1024, MAX_REDIRECTS = 3, TIMEOUT_MS = 5000;
const HIT_MS = 6 * 36e5, MISS_MS = 10 * 6e4, CACHE_MAX = 500;
const cache = new Map();
const perUser = new Map();

export function isPublicIp(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPublicIp(mapped[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
    if (hex) { const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16); return isPublicIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`); }
    // '::' (não especificado, loopback, compatível com IPv4), 6to4, Teredo e NAT64 podem embutir um IPv4 interno: bloqueados por inteiro.
    if (v.startsWith('::') || v.startsWith('2002:') || v.startsWith('2001:0:') || v.startsWith('2001::')) return false;
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff') || v.startsWith('2001:db8') || v.startsWith('64:ff9b')) return false;
    return true;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

// Aceita só http(s) em porta padrão, sem usuário/senha, e devolve o endereço público já resolvido.
export async function resolvePublic(rawUrl, lookup = dns.lookup) {
  let url; try { url = new URL(rawUrl); } catch { throw new Error('Endereço inválido.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Só links http e https.');
  if (url.username || url.password) throw new Error('Link com senha não é aceito.');
  if (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80')) throw new Error('Porta não permitida.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Endereço não permitido.');
  const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicIp(a.address))) throw new Error('Endereço não permitido.');
  return { url, address: addresses[0].address, family: addresses[0].family };
}

function fetchHead(target) {
  return new Promise((resolve, reject) => {
    const client = target.url.protocol === 'https:' ? https : http;
    const req = client.request(target.url, {
      method: 'GET', timeout: TIMEOUT_MS, servername: net.isIP(target.url.hostname) ? undefined : target.url.hostname,
      lookup: (_h, options, cb) => options?.all ? cb(null, [{ address: target.address, family: target.family }]) : cb(null, target.address, target.family),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; EtniasLinkPreview/1.0; +https://etnias.site)', accept: 'text/html,application/xhtml+xml', 'accept-language': 'pt-BR,pt;q=0.9,en;q=0.5' }
    }, res => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, target.url).toString() }); }
      if (status !== 200) { res.resume(); return reject(new Error('A página não respondeu.')); }
      if (!/^(text\/html|application\/xhtml)/i.test(res.headers['content-type'] || '')) { res.resume(); return reject(new Error('Não é uma página.')); }
      const chunks = []; let size = 0;
      const finish = () => {
        const bytes = Buffer.concat(chunks);
        const charset = /charset=([\w-]+)/i.exec(res.headers['content-type'] || '')?.[1] || /<meta[^>]+charset=["']?([\w-]+)/i.exec(bytes.subarray(0, 4096).toString('latin1'))?.[1] || 'utf-8';
        let html; try { html = new TextDecoder(charset).decode(bytes); } catch { html = bytes.toString('utf8'); }
        resolve({ html });
      };
      res.on('data', chunk => { chunks.push(chunk); size += chunk.length; if (size >= MAX_BYTES || /<\/head>/i.test(chunk.toString('latin1'))) { res.destroy(); finish(); } });
      res.on('end', finish); res.on('error', () => finish());
    });
    req.on('timeout', () => req.destroy(new Error('A página demorou demais.')));
    req.on('error', reject);
    req.end();
  });
}

// Imagem da prévia: o servidor baixa e entrega por /api/link-image (o navegador não fala com sites de terceiros, o que também
// respeita a política de segurança do site). Só imagens de prévias que o próprio servidor montou; nada de proxy aberto.
const IMAGE_MAX = 1024 * 1024, IMAGE_CACHE_MAX = 40;
const allowedImages = new Set(), imageCache = new Map();
function fetchImageOnce(target) {
  return new Promise((resolve, reject) => {
    const client = target.url.protocol === 'https:' ? https : http;
    const req = client.request(target.url, {
      method: 'GET', timeout: TIMEOUT_MS, servername: net.isIP(target.url.hostname) ? undefined : target.url.hostname,
      lookup: (_h, options, cb) => options?.all ? cb(null, [{ address: target.address, family: target.family }]) : cb(null, target.address, target.family),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; EtniasLinkPreview/1.0; +https://etnias.site)', accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' }
    }, res => {
      const status = res.statusCode || 0, type = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, target.url).toString() }); }
      if (status !== 200 || !/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) { res.resume(); return reject(new Error('Não é uma imagem aceita.')); }
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > IMAGE_MAX) { res.destroy(new Error('Imagem grande demais.')); return; } chunks.push(chunk); });
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), type }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('A imagem demorou demais.')));
    req.on('error', reject);
    req.end();
  });
}
export async function linkImage(rawUrl, { lookup } = {}) {
  const asked = String(rawUrl || '').slice(0, 2000);
  if (!allowedImages.has(asked)) return null;
  const hit = imageCache.get(asked); if (hit) return hit;
  let current = asked, got;
  for (let hops = 0; ; hops++) {
    if (hops > MAX_REDIRECTS) return null;
    got = await fetchImageOnce(await resolvePublic(current, lookup));
    if (!got.redirect) break;
    current = got.redirect;
  }
  imageCache.set(asked, got);
  while (imageCache.size > IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value);
  return got;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); try { return String.fromCodePoint(code); } catch { return ''; } }
  return ENTITIES[e.toLowerCase()] ?? m;
});
const clean = (s, max) => decode(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function parseMeta(html, base) {
  const head = html.slice(0, MAX_BYTES).split(/<\/head>/i)[0];
  const meta = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
    const attr = name => { const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag); return m ? (m[2] ?? m[3] ?? m[4]) : ''; };
    const key = (attr('property') || attr('name')).toLowerCase(), content = attr('content');
    if (key && content && !(key in meta)) meta[key] = content;
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] || '';
  let image = '';
  const rawImage = meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'] || '';
  if (rawImage) { try { const u = new URL(decode(rawImage), base); if (['http:', 'https:'].includes(u.protocol)) image = u.toString(); } catch { /* sem imagem */ } }
  const title = clean(meta['og:title'] || meta['twitter:title'] || titleTag, 160);
  const description = clean(meta['og:description'] || meta['twitter:description'] || meta.description, 300);
  const site = clean(meta['og:site_name'], 80);
  return { title, description, image, site };
}

function remember(url, value, ms) {
  cache.delete(url); cache.set(url, { value, until: Date.now() + ms });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

export async function linkPreview(userId, rawUrl, { lookup } = {}) {
  const asked = String(rawUrl || '').slice(0, 2000);
  const hit = cache.get(asked);
  if (hit && hit.until > Date.now()) return hit.value;
  // No máximo 30 prévias novas por minuto por pessoa, para o servidor não virar ferramenta de varredura.
  const now = Date.now(); const recent = (perUser.get(userId) || []).filter(t => now - t < 6e4);
  if (recent.length >= 30) { const e = new Error('Muitos links de uma vez. Tente de novo em instantes.'); e.status = 429; throw e; }
  perUser.set(userId, [...recent, now]);
  try {
    let current = asked, page;
    for (let hops = 0; ; hops++) {
      if (hops > MAX_REDIRECTS) throw new Error('Redirecionamentos demais.');
      const target = await resolvePublic(current, lookup);
      page = await fetchHead(target);
      if (!page.redirect) { page.finalUrl = target.url; break; }
      current = page.redirect;
    }
    const meta = parseMeta(page.html, page.finalUrl);
    if (meta.image) { allowedImages.add(meta.image); if (allowedImages.size > 2000) allowedImages.delete(allowedImages.values().next().value); }
    const value = (meta.title || meta.description || meta.image) ? { url: asked, host: page.finalUrl.hostname.replace(/^www\./, ''), ...meta, image: meta.image ? `/api/link-image?u=${encodeURIComponent(meta.image)}` : '' } : null;
    remember(asked, value, value ? HIT_MS : MISS_MS);
    return value;
  } catch (error) {
    if (error.status) throw error;
    remember(asked, null, MISS_MS);
    return null;
  }
}
export const _test = { cache, fetchHead };
