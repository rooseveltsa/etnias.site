// Extras sociais (fase 3): sugestões dispensadas, troca de @ com limite e histórico, localização opcional (cidade/UF),
// ícones de reação e figurinhas gerenciados pelo painel admin. Tudo é validado aqui; o cliente só mostra o que recebe.
import { randomUUID } from 'node:crypto';
import { roleOf } from './admin.mjs';
import { sanitizeSvg } from './svg-safe.mjs';

export const extrasActions = ['suggestion_dismiss', 'username_change', 'location_set', 'location_clear', 'reaction_save', 'reaction_reorder', 'reaction_delete', 'sticker_pack_save', 'sticker_pack_delete', 'sticker_add', 'sticker_delete'];
export const extrasUploadActions = ['reaction_save', 'sticker_add'];
const DAY = 864e5;
export const USERNAME_COOLDOWN_DAYS = 15;
export const USERNAME_HOLD_DAYS = 90;
export const MAX_ACTIVE_REACTIONS = 6;
const MAX_CUSTOM_REACTIONS = 12;
const MAX_STICKERS_PER_PACK = 60;
const STICKER_CATEGORIES = ['Celebridades indígenas', 'Política', 'Atualidades', 'Zé Monge', 'Outros'];
const RESERVED = new Set(['admin', 'administrador', 'administrator', 'root', 'etnias', 'etnia', 'opy', 'suporte', 'support', 'moderacao', 'moderador', 'api', 'www', 'sistema', 'system', 'ajuda', 'help', 'contato', 'oficial', 'equipe', 'null', 'undefined', 'entrar', 'sair', 'perfil', 'conta', 'configuracoes', 'grupos', 'paginas', 'chat', 'iara', 'etnia', 'staff', 'security', 'seguranca']);
export const BUILTIN_REACTIONS = [['like', 'Curti'], ['heart', 'Amei'], ['laugh', 'Haha'], ['wow', 'Surpresa'], ['sad', 'Triste']];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const cleanText = (value, max, required = true) => {
  const v = typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (required && !v) fail(400, 'Preencha o campo.');
  if (v.length > max) fail(400, `Use até ${max} caracteres.`);
  return v;
};
const isAdmin = account => roleOf(account) === 'admin';
const keyOf = id => `id:${id}`;

/* ---------- ícones de reação ---------- */
export function reactionConfig(state) {
  if (!Array.isArray(state.reactionConfig)) state.reactionConfig = BUILTIN_REACTIONS.map(([id, label], order) => ({ id, label, builtin: true, active: true, order }));
  return state.reactionConfig;
}
export const reactionIds = state => reactionConfig(state).map(r => r.id);
export function reactionSet(state) {
  return [...reactionConfig(state)].filter(r => r.active).sort((a, b) => a.order - b.order).slice(0, MAX_ACTIVE_REACTIONS)
    .map(r => ({ id: r.id, label: r.label, builtin: !!r.builtin, ...(r.mediaId ? { mediaId: r.mediaId } : {}) }));
}
export const reactionAllowed = (state, id, current) => id === '' || (reactionConfig(state).some(r => r.id === id && (r.active || id === current)));

/* ---------- mídia de ícones e figurinhas ---------- */
export function extrasMedia(state, id) {
  if ((state.reactionConfig || []).some(r => r.mediaId === id)) return { kind: 'image', name: 'reacao' };
  if ((state.stickers || []).some(s => s.mediaId === id)) return { kind: 'image', name: 'figurinha' };
  return null;
}
// SVG chega em body.svg (data URL); PNG/WebP/GIF segue o caminho normal de body.media. Papel de admin é conferido ANTES de gravar qualquer arquivo.
export async function extrasPrepareUpload(body, account, { mediaInput, saveMedia }) {
  if (!isAdmin(account)) fail(403, 'Só a administração gerencia ícones e figurinhas.');
  let upload = null;
  if (body.svg) {
    const m = typeof body.svg.data === 'string' && body.svg.data.match(/^data:image\/svg\+xml(?:;[^;,]*)*;base64,([a-zA-Z0-9+/=\r\n]+)$/);
    if (!m) fail(400, 'Envie o SVG como arquivo .svg.');
    const clean = sanitizeSvg(Buffer.from(m[1].replace(/\s/g, ''), 'base64'));
    upload = { id: randomUUID(), bytes: clean, type: 'image/svg+xml', kind: 'image', name: 'icone.svg' };
  } else if (body.media) {
    upload = mediaInput(body.media);
    if (!upload || upload.kind !== 'image' || !['image/png', 'image/webp', 'image/gif'].includes(upload.type)) fail(400, 'Use PNG, WebP, GIF ou SVG.');
    if (upload.bytes.length > 512 * 1024) fail(413, 'Escolha uma imagem de até 512 KB.');
  }
  if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
  return upload;
}

/* ---------- troca de @ ---------- */
export function usernameCheck(state, account, raw) {
  const username = String(raw || '').trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(username) || /[._]{2}/.test(username) || /[._]$/.test(username)) return { ok: false, reason: 'Use de 3 a 24 caracteres: letras, números, ponto ou _ (sem repetir símbolos nem terminar com eles).' };
  // Os @ da administração (OPY_ADMIN_USERNAMES) podem existir mesmo sendo reservados: é como a conta de gestão nasce.
  const staff = String(process.env.OPY_ADMIN_USERNAMES || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (RESERVED.has(username) && !staff.includes(username)) return { ok: false, reason: 'Este @ é reservado.' };
  if (account && username === account.username) return { ok: false, reason: 'Este já é o seu @.' };
  if ((state.accounts || []).some(a => a.username === username && a.id !== account?.id)) return { ok: false, reason: 'Este @ já está em uso.' };
  const held = (state.usernameHistory || []).find(h => h.username === username && h.accountId !== account?.id && h.changedAt + USERNAME_HOLD_DAYS * DAY > Date.now());
  if (held) return { ok: false, reason: 'Este @ foi usado há pouco e está reservado.' };
  return { ok: true, username };
}
const checkHits = new Map();
export function usernameCheckAllowed(accountId) {
  const now = Date.now(); const hits = (checkHits.get(accountId) || []).filter(t => t > now - 60000);
  if (hits.length >= 40) return false;
  hits.push(now); checkHits.set(accountId, hits);
  if (checkHits.size > 5000) for (const [k, v] of checkHits) if (!v.some(t => t > now - 60000)) checkHits.delete(k);
  return true;
}
export function usernameInfo(account, state) {
  const next = (account.usernameChangedAt || 0) + USERNAME_COOLDOWN_DAYS * DAY;
  return { username: account.username, canChange: next <= Date.now(), nextChangeAt: next > Date.now() ? next : 0, cooldownDays: USERNAME_COOLDOWN_DAYS, history: (state.usernameHistory || []).filter(h => h.accountId === account.id).slice(-10).map(h => ({ username: h.username, changedAt: h.changedAt })) };
}
export function usernameReservedFor(state, username) { return (state.usernameHistory || []).some(h => h.username === username && h.changedAt + USERNAME_HOLD_DAYS * DAY > Date.now()); }

/* ---------- ações ---------- */
export function extrasAction(state, account, body, upload) {
  const key = keyOf(account.id);
  const now = Date.now();
  switch (body.action) {
    case 'suggestion_dismiss': {
      const who = String(body.authorKey || '');
      if (!/^id:[a-f0-9-]{36}$/.test(who)) fail(400, 'Pessoa inválida.');
      state.dismissedSuggestions ||= {};
      state.dismissedSuggestions[account.id] = [...new Set([...(state.dismissedSuggestions[account.id] || []), who])].slice(-300);
      return {};
    }
    case 'username_change': {
      const next = (account.usernameChangedAt || 0) + USERNAME_COOLDOWN_DAYS * DAY;
      if (next > now) fail(429, `Você já trocou o @ há pouco. A próxima troca é possível em ${new Date(next).toLocaleDateString('pt-BR')}.`);
      const check = usernameCheck(state, account, body.username);
      if (!check.ok) fail(409, check.reason);
      state.usernameHistory ||= [];
      state.usernameHistory.push({ username: account.username, accountId: account.id, changedAt: now });
      state.usernameHistory = state.usernameHistory.filter(h => h.changedAt + USERNAME_HOLD_DAYS * DAY > now).slice(-5000);
      account.username = check.username; account.usernameChangedAt = now;
      return {};
    }
    case 'location_set': {
      if (body.consent !== true) fail(400, 'Confirme que aceita mostrar sua cidade no perfil.');
      const city = cleanText(body.city, 80), uf = cleanText(body.uf, 3, false).toUpperCase();
      if (uf && !/^[A-Z]{2,3}$/.test(uf)) fail(400, 'UF inválida.');
      account.location = { city, uf, setAt: now };
      return {};
    }
    case 'location_clear': delete account.location; return {};
  }
  if (!isAdmin(account)) fail(403, 'Só a administração pode fazer isso.');
  state.adminLog ||= [];
  const log = (action, target) => state.adminLog.push({ id: randomUUID(), at: now, by: key, byName: account.name, action, target, reason: '' });
  switch (body.action) {
    case 'reaction_save': {
      const items = reactionConfig(state);
      const label = cleanText(body.label, 24);
      let item = body.id ? items.find(r => r.id === body.id) : null;
      if (body.id && !item) fail(404, 'Reação não encontrada.');
      if (!item) {
        if (!upload) fail(400, 'Envie o ícone (SVG ou PNG).');
        if (items.filter(r => !r.builtin).length >= MAX_CUSTOM_REACTIONS) fail(409, `Limite de ${MAX_CUSTOM_REACTIONS} ícones próprios.`);
        item = { id: 'r_' + randomUUID().slice(0, 8), label, builtin: false, active: false, order: items.length, mediaId: upload.id }; items.push(item);
      } else { item.label = label; if (upload && !item.builtin) item.mediaId = upload.id; else if (upload) { item.mediaId = upload.id; } }
      if (typeof body.active === 'boolean') {
        if (body.active && !item.active && items.filter(r => r.active).length >= MAX_ACTIVE_REACTIONS) fail(409, `No máximo ${MAX_ACTIVE_REACTIONS} ícones ativos. Desative outro antes.`);
        if (!body.active && item.active && items.filter(r => r.active).length <= 1) fail(409, 'Deixe ao menos um ícone ativo.');
        item.active = body.active;
      }
      log('reaction_save', item.id);
      return {};
    }
    case 'reaction_reorder': {
      const items = reactionConfig(state);
      if (!Array.isArray(body.ids) || body.ids.some(id => !items.some(r => r.id === id))) fail(400, 'Ordem inválida.');
      body.ids.forEach((id, order) => { items.find(r => r.id === id).order = order; });
      items.filter(r => !body.ids.includes(r.id)).forEach((r, i) => { r.order = body.ids.length + i; });
      log('reaction_reorder', 'reactions');
      return {};
    }
    case 'reaction_delete': {
      const items = reactionConfig(state); const item = items.find(r => r.id === body.id);
      if (!item) fail(404, 'Reação não encontrada.');
      if (item.builtin) fail(400, 'Os ícones originais não podem ser apagados; desative-os.');
      if (item.active && items.filter(r => r.active).length <= 1) fail(409, 'Deixe ao menos um ícone ativo.');
      for (const p of state.posts || []) for (const [id, r] of Object.entries(p.reactions || {})) if (r === item.id) p.reactions[id] = 'like';
      state.reactionConfig = items.filter(r => r !== item);
      log('reaction_delete', item.id);
      return { removedIds: item.mediaId ? [item.mediaId] : [] };
    }
    case 'sticker_pack_save': {
      state.stickerPacks ||= [];
      const name = cleanText(body.name, 40); const category = STICKER_CATEGORIES.includes(body.category) ? body.category : 'Outros';
      let pack = body.id ? state.stickerPacks.find(p => p.id === body.id) : null;
      if (body.id && !pack) fail(404, 'Pacote não encontrado.');
      if (!pack) { if (state.stickerPacks.length >= 40) fail(409, 'Limite de 40 pacotes.'); pack = { id: 'p_' + randomUUID().slice(0, 8), order: state.stickerPacks.length, active: true }; state.stickerPacks.push(pack); }
      pack.name = name; pack.category = category; if (typeof body.active === 'boolean') pack.active = body.active;
      log('sticker_pack_save', pack.id);
      return {};
    }
    case 'sticker_pack_delete': {
      const pack = (state.stickerPacks || []).find(p => p.id === body.id); if (!pack) fail(404, 'Pacote não encontrado.');
      const removed = (state.stickers || []).filter(s => s.packId === pack.id).map(s => s.mediaId);
      state.stickers = (state.stickers || []).filter(s => s.packId !== pack.id); state.stickerPacks = state.stickerPacks.filter(p => p !== pack);
      log('sticker_pack_delete', pack.id);
      return { removedIds: removed };
    }
    case 'sticker_add': {
      const pack = (state.stickerPacks || []).find(p => p.id === body.packId); if (!pack) fail(404, 'Pacote não encontrado.');
      if (!upload) fail(400, 'Envie a figurinha (PNG, WebP, GIF ou SVG).');
      state.stickers ||= [];
      if (state.stickers.filter(s => s.packId === pack.id).length >= MAX_STICKERS_PER_PACK) fail(409, `Limite de ${MAX_STICKERS_PER_PACK} figurinhas por pacote.`);
      state.stickers.push({ id: 's_' + randomUUID().slice(0, 10), packId: pack.id, name: cleanText(body.name || 'Figurinha', 40), mediaId: upload.id, createdAt: now });
      log('sticker_add', pack.id);
      return {};
    }
    case 'sticker_delete': {
      const s = (state.stickers || []).find(x => x.id === body.id); if (!s) fail(404, 'Figurinha não encontrada.');
      state.stickers = state.stickers.filter(x => x !== s); log('sticker_delete', s.id);
      return { removedIds: [s.mediaId] };
    }
  }
  fail(400, 'Ação desconhecida.');
}

export function stickerCatalog(state, includeInactive = false) {
  const packs = (state.stickerPacks || []).filter(p => includeInactive || p.active).sort((a, b) => a.order - b.order);
  return { categories: STICKER_CATEGORIES, packs: packs.map(p => ({ id: p.id, name: p.name, category: p.category, active: p.active, items: (state.stickers || []).filter(s => s.packId === p.id).map(s => ({ id: s.id, name: s.name, mediaId: s.mediaId })) })) };
}
export const stickerById = (state, id) => (state.stickers || []).find(s => s.id === id && (state.stickerPacks || []).some(p => p.id === s.packId && p.active));

/* ---------- localização por geocodificação reversa (OpenStreetMap/Nominatim) ---------- */
const geoCache = new Map(); const geoUser = new Map(); let geoLast = 0;
export async function reverseGeocode(accountId, latRaw, lonRaw) {
  const lat = Number(latRaw), lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) fail(400, 'Coordenadas inválidas.');
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`; // ~1 km: não guarda nem envia o ponto exato
  const hit = geoCache.get(cacheKey); if (hit && hit.at > Date.now() - 7 * DAY) return hit.value;
  const now = Date.now(); const mine = (geoUser.get(accountId) || []).filter(t => t > now - 60000);
  if (mine.length >= 6) fail(429, 'Muitas consultas de localização. Tente de novo em um minuto.');
  mine.push(now); geoUser.set(accountId, mine);
  const wait = geoLast + 1100 - now; if (wait > 0) { if (wait > 3000) fail(429, 'Serviço de localização ocupado. Tente de novo.'); await new Promise(r => setTimeout(r, wait)); }
  geoLast = Date.now();
  const base = process.env.OPY_GEOCODER_URL || 'https://nominatim.openstreetmap.org/reverse';
  const url = `${base}?format=jsonv2&zoom=10&addressdetails=1&accept-language=pt-BR&lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
  let json;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'EtniasSite/1.0 (rede social; contato@etnias.site)', Accept: 'application/json' }, signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!r.ok) throw new Error('status ' + r.status);
    json = await r.json();
  } catch { fail(502, 'Não foi possível descobrir sua cidade agora. Digite o local manualmente.'); }
  const a = json?.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.county || '';
  const uf = String(a['ISO3166-2-lvl4'] || '').replace(/^[A-Z]{2}-/, '').slice(0, 3) || '';
  if (!city) fail(404, 'Não encontramos uma cidade para este ponto.');
  const value = { city: String(city).slice(0, 80), uf, country: String(a.country_code || '').toUpperCase().slice(0, 2) };
  geoCache.set(cacheKey, { at: Date.now(), value });
  if (geoCache.size > 2000) geoCache.delete(geoCache.keys().next().value);
  return value;
}
