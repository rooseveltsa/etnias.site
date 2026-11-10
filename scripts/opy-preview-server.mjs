import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import handler from '../preview/server/community.mjs';
import middleware from '../preview/middleware.js';
import { verifySession, sessionCookie } from '../preview/server/session.mjs';
import { sendFile } from '../preview/server/files.mjs';
const root = resolve('preview/dist/public');
// Live (Fase 4): a sinalização WHIP/WHEP do navegador vai por aqui ao MediaMTX (OPY_LIVE_URL), com sessão obrigatória.
// A mídia em si não passa pelo app (UDP/TCP 8189 direto no MediaMTX). Sem OPY_LIVE_URL o recurso fica desligado.
const liveUrl = process.env.OPY_LIVE_URL || '';
const livePath = /^\/live\/[a-f0-9-]{36}\/(?:whip|whep)(?:\/[A-Za-z0-9_-]{1,120})?$/;
async function proxyLive(req, res, pathname) {
  if (!liveUrl || !livePath.test(pathname) || !['POST', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method)) { res.writeHead(404); return res.end(); }
  if (!await verifySession(sessionCookie(req), process.env.OPY_SESSION_SECRET)) { res.writeHead(401); return res.end(); }
  const headers = {};
  for (const name of ['content-type', 'authorization', 'if-match']) if (req.headers[name]) headers[name] = req.headers[name];
  const upstream = http.request(new URL(pathname.slice('/live'.length), liveUrl), { method: req.method, headers }, up => {
    const out = {};
    for (const name of ['content-type', 'location', 'etag', 'accept-patch']) if (up.headers[name]) out[name] = up.headers[name];
    // O MediaMTX devolve o endereço da sessão sem o prefixo do proxy.
    if (out.location && !/^https?:/.test(out.location)) out.location = out.location.startsWith('/') ? '/live' + out.location : pathname + '/' + out.location;
    res.writeHead(up.statusCode, out);
    up.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
}
// Fotos, vídeos e arquivos herdados do Etnias antigo, no disco em OPY_LEGACY_MEDIA_DIR (contém a pasta upload/).
const legacyRoot = process.env.OPY_LEGACY_MEDIA_DIR ? resolve(process.env.OPY_LEGACY_MEDIA_DIR) : '';
// Miniaturas geradas por scripts/opy-legacy-derivados.sh ficam em OPY_LEGACY_THUMBS_DIR (padrão: pasta thumbs/ dentro da mídia).
// /legado/thumbs/<caminho> serve a miniatura e, quando ela não existe (foto já leve ou ainda não gerada), o original.
const thumbsRoot = legacyRoot ? resolve(process.env.OPY_LEGACY_THUMBS_DIR || join(legacyRoot, 'thumbs')) : '';
const legacyTypes = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.pdf':'application/pdf' };
async function serveLegacy(req, res, pathname) {
  const notFound = () => { res.writeHead(404); res.end(); };
  if (!legacyRoot) return notFound();
  // As páginas eram públicas no site antigo, mas a rede nova pede entrada: só quem tem sessão vê a mídia.
  if (!await verifySession(sessionCookie(req), process.env.OPY_SESSION_SECRET)) { res.writeHead(401); return res.end(); }
  const relative = decodeURIComponent(pathname.slice('/legado'.length));
  const thumb = relative.startsWith('/thumbs/');
  const candidates = thumb ? [[thumbsRoot, relative.slice('/thumbs'.length)], [legacyRoot, relative.slice('/thumbs'.length)]] : [[legacyRoot, relative]];
  let file, info;
  for (const [base, path] of candidates) {
    const candidate = resolve(base, '.' + path);
    if (!candidate.startsWith(base + sep) || !legacyTypes[extname(candidate).toLowerCase()]) return notFound();
    try { const found = await stat(candidate); if (found.isFile()) { file = candidate; info = found; break; } } catch {}
  }
  if (!file) return notFound();
  sendFile(req, res, file, info, legacyTypes[extname(file).toLowerCase()]);
}
// Respostas de texto (JSON da API, JS, CSS, HTML) saem comprimidas quando o navegador aceita: o snapshot do feed cai de ~250 KB
// para ~40 KB, o que em rede lenta é a diferença entre a tela aparecer em 6 s ou em 2 s. Arquivos de mídia seguem como estão.
function compressText(req, res) {
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return;
  const end = res.end.bind(res);
  res.end = (body, ...rest) => {
    const type = String(res.getHeader('content-type') || '');
    if (body && (typeof body === 'string' || Buffer.isBuffer(body)) && Buffer.byteLength(body) > 1024 && !res.getHeader('content-encoding') && /json|javascript|css|html|text|svg|manifest/.test(type)) {
      res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); res.removeHeader('Content-Length');
      return end(gzipSync(body), ...rest);
    }
    return end(body, ...rest);
  };
}
const types = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ttf':'font/ttf','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.json':'application/json; charset=utf-8','.apk':'application/vnd.android.package-archive' };
const port = Number(process.env.PORT) || 8101;
// Na VPS o container precisa ouvir 0.0.0.0; o proxy HTTPS do host fica na frente. Localmente segue em 127.0.0.1.
const host = process.env.HOST || '127.0.0.1';
// Mesmos cabeçalhos de preview/dist/vercel.json, mais câmera e microfone só para o próprio site (chamadas e gravação de áudio).
const security = {
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob: https://i.ytimg.com; media-src 'self' blob: data:; connect-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
};
http.createServer(async (req, res) => {
 for (const [name, value] of Object.entries(security)) res.setHeader(name, value);
 try {
  // Atrás do Caddy o navegador usa HTTPS; sem isso os redirecionamentos voltariam para http://.
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = new URL(req.url, `${proto}://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  const path = pathname.replace(/\/$/, '') || '/';
  if (pathname.startsWith('/legado/')) return await serveLegacy(req, res, pathname);
  compressText(req, res);
  if (pathname.startsWith('/live/') && !pathname.startsWith('/live/recordings/')) return await proxyLive(req, res, pathname);
  if (path === '/api/community' || path === '/api/media' || path === '/api/live/auth' || pathname.startsWith('/live/recordings/')) {
    if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 20*1024*1024) { res.writeHead(413); return res.end(); } }
      try { req.body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
    }
    return handler(req, res);
  }
  const gate = await middleware(new Request(url, { headers: req.headers }));
  // Busca: só a apresentação pública ("/" para quem não entrou, /entrar/, robots e sitemap) é indexável; o resto da rede segue noindex e atrás do login.
  const indexable = path === '/' || path === '/entrar' || path === '/robots.txt' || path === '/sitemap.xml' || pathname.startsWith('/assets/');
  if (gate && path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
    res.removeHeader('X-Robots-Tag'); res.setHeader('Content-Type', types['.html']); res.setHeader('Cache-Control', 'no-cache');
    return res.end(await readFile(join(root, 'entrar', 'index.html')));
  }
  if (gate) { res.writeHead(gate.status, Object.fromEntries(gate.headers)); return res.end(); }
  if (indexable) res.removeHeader('X-Robots-Tag');
  const file = resolve(root, '.' + decodeURIComponent(pathname) + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404); return res.end(); }
  // Assets com versão na URL (?v=) nunca mudam: o navegador guarda por um ano e as páginas seguintes não baixam 1,8 MB de novo.
  // Páginas HTML são revalidadas a cada visita; o resto fica uma hora.
  const cache = url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600';
  try { res.setHeader('Content-Type', types[extname(file)]); res.setHeader('Cache-Control', cache); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
 } catch { if (!res.headersSent) res.writeHead(400); res.end('Requisição inválida.'); }
}).on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} está ocupada. Feche a outra prévia ou use PORT=8102 node scripts/dev-opy.mjs.` : error.message);
  process.exitCode = 1;
}).listen(port, host, () => console.log(`Etnias ouvindo em http://${host}:${port}`));
