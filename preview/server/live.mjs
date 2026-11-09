import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { iceServers } from './calls.mjs';
import { canPostInCommunity } from './communities.mjs';

// Transmissão ao vivo (Fase 4 + Live Experience). O vídeo passa pelo MediaMTX (deploy/opy/mediamtx.yml); aqui ficam as regras:
// quem publica e assiste, formato (9:16 ou 16:9), audiência (batimentos de quem assiste), bate-papo da live com moderação
// (fixar, apagar, silenciar, modo lento), reações rápidas, convites e pedidos de participação, e a sinalização WebRTC entre
// anfitrião e convidado (o navegador do anfitrião compõe os dois vídeos e publica o quadro único no MediaMTX).
export const liveActions = ['live_start', 'live_stop', 'live_watch', 'live_chat', 'live_chat_delete', 'live_pin', 'live_mute', 'live_slow', 'live_requests', 'live_react',
  'live_invite', 'live_invite_cancel', 'live_invite_respond', 'live_request', 'live_request_respond', 'live_guest_leave', 'live_guest_remove', 'live_guest_media', 'live_signal'];
const MAX_LIVE_MS = 6 * 60 * 60 * 1000;
const RECORDING_WAIT_MS = 2 * 60 * 1000;
const WATCH_WINDOW_MS = 30 * 1000;
const INVITE_TTL_MS = 2 * 60 * 1000;
const CHAT_CAP = 400;
const REACTION_WINDOW_MS = 60 * 1000;
export const liveReactions = ['❤️', '👏', '🔥', '😂', '🙏', '😮'];
export const slowModes = [0, 5, 10, 30, 60];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SDP_MAX = 30000;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export const liveEnabled = (env = process.env) => !!env.OPY_LIVE_URL;
const active = p => !!p.live && !p.live.endedAt;
const isUuid = v => typeof v === 'string' && uuid.test(v);
function end(post, now) { post.live.endedAt = now; delete post.live.key; post.live.guest = null; post.live.invites = {}; post.live.watchers = {}; }
function text(value, max) { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, 'Confira o texto e o limite de caracteres.'); return value.trim(); }
function sdp(value, type) {
  if (!value || typeof value !== 'object' || value.type !== type || typeof value.sdp !== 'string' || !value.sdp.startsWith('v=0') || value.sdp.length > SDP_MAX) fail(400, 'Sinal inválido. Tente de novo.');
  return { type, sdp: value.sdp };
}
function candidate(value) {
  if (!value || typeof value !== 'object' || typeof value.candidate !== 'string' || value.candidate.length > 600) fail(400, 'Sinal inválido. Tente de novo.');
  return { candidate: value.candidate, sdpMid: typeof value.sdpMid === 'string' ? value.sdpMid.slice(0, 20) : null, sdpMLineIndex: Number.isInteger(value.sdpMLineIndex) ? value.sdpMLineIndex : null };
}

// Encerra lives cujo aparelho sumiu sem avisar e convites vencidos. Roda em toda escrita.
export function settleLives(state, now = Date.now()) {
  for (const p of state.posts || []) {
    if (!active(p)) continue;
    if (now - p.live.startedAt > MAX_LIVE_MS) { end(p, now); continue; }
    for (const [id, inv] of Object.entries(p.live.invites || {})) if (inv.status === 'pending' && inv.expiresAt && inv.expiresAt < now) p.live.invites[id] = { ...inv, status: 'expired' };
  }
}

function liveOf(state, body, me, { host = false, mustBeActive = true } = {}) {
  const post = (state.posts || []).find(p => p.id === body.postId && p.live);
  if (!post) fail(404, 'Live não encontrada.');
  if (mustBeActive && !active(post)) fail(409, 'Esta live já terminou.');
  if (host && post.authorId !== me.id) fail(403, 'Só quem transmite pode fazer isso.');
  return post;
}
const guestOf = post => post.live.guest || null;
const isGuest = (post, me) => guestOf(post)?.userId === me.id;
const personOf = (state, id) => (state.accounts || []).find(a => a.id === id);
const avatarOf = a => a?.avatarUrl || (a?.avatarId ? `/api/media?id=${a.avatarId}` : '');
const viewersOf = (post, now) => Object.values(post.live.watchers || {}).filter(ts => now - ts < WATCH_WINDOW_MS).length;
const followersOf = (state, id) => Object.entries(state.follows || {}).filter(([, list]) => Array.isArray(list) && list.includes(`id:${id}`)).map(([uid]) => uid);

export function liveAction(state, me, body, env = process.env, now = Date.now()) {
  if (!liveEnabled(env)) fail(503, 'A transmissão ao vivo ainda não está ativa neste servidor.');
  switch (body.action) {
    case 'live_start': {
      if ((state.posts || []).some(p => p.authorId === me.id && active(p))) fail(409, 'Você já está ao vivo. Encerre a live atual antes de começar outra.');
      if (body.text !== undefined && (typeof body.text !== 'string' || body.text.length > 300)) fail(400, 'A descrição da live tem no máximo 300 caracteres.');
      const format = body.format === 'landscape' ? 'landscape' : 'portrait';
      let community = null;
      if (typeof body.communityId === 'string' && body.communityId.trim()) community = canPostInCommunity(state, me, body.communityId.trim());
      const description = (body.text || '').trim();
      const post = { id: randomUUID(), authorId: me.id, author: me.name, text: description, origin: 'preview', createdAt: now, audience: 'public', communityId: community?.id || '', communityName: community?.name || '', feeling: '', location: '', reactions: {}, comments: [], saves: [], shares: 0,
        live: { key: randomBytes(24).toString('hex'), startedAt: now, format, chat: [], pinnedId: '', slowSeconds: 0, muted: [], requestsOpen: true, watchers: {}, quick: [], invites: {}, guest: null } };
      state.posts.unshift(post);
      return { postId: post.id, key: post.live.key, notify: followersOf(state, me.id), push: { title: `🔴 ${me.name} está ao vivo no Etnias`, body: description || 'Entre para acompanhar!', href: `/#post-${post.id}`, tag: `live-${post.id}` } };
    }
    case 'live_stop': {
      const post = liveOf(state, body, me, { host: true, mustBeActive: false });
      if (active(post)) end(post, now);
      return { postId: post.id };
    }
    case 'live_watch': {
      const post = liveOf(state, body, me);
      post.live.watchers ||= {}; post.live.watchers[me.id] = now;
      // Espectadores que sumiram não ficam ocupando o mapa.
      for (const [id, ts] of Object.entries(post.live.watchers)) if (now - ts > WATCH_WINDOW_MS * 2) delete post.live.watchers[id];
      return { postId: post.id, silent: true };
    }
    case 'live_chat': {
      const post = liveOf(state, body, me);
      if ((post.live.muted || []).includes(me.id)) fail(403, 'Quem transmite silenciou você nesta live.');
      const copy = text(body.text, 300);
      const slow = post.live.slowSeconds || 0;
      if (slow && post.authorId !== me.id) { const last = [...post.live.chat].reverse().find(m => m.authorId === me.id); if (last && now - last.createdAt < slow * 1000) fail(429, `Modo lento: espere ${Math.ceil((slow * 1000 - (now - last.createdAt)) / 1000)} s para enviar outra mensagem.`); }
      const last = post.live.chat.at(-1);
      if (last && last.authorId === me.id && last.text === copy && now - last.createdAt < 5000) return { postId: post.id, silent: true };
      post.live.chat.push({ id: randomUUID(), authorId: me.id, author: me.name, text: copy, createdAt: now });
      if (post.live.chat.length > CHAT_CAP) post.live.chat = post.live.chat.slice(-CHAT_CAP);
      return { postId: post.id, silent: true };
    }
    case 'live_chat_delete': {
      const post = liveOf(state, body, me);
      const m = post.live.chat.find(x => x.id === body.msgId); if (!m) fail(404, 'Mensagem não encontrada.');
      if (m.authorId !== me.id && post.authorId !== me.id) fail(403, 'Só quem escreveu ou quem transmite pode apagar.');
      post.live.chat = post.live.chat.filter(x => x.id !== m.id); if (post.live.pinnedId === m.id) post.live.pinnedId = '';
      return { postId: post.id, silent: true };
    }
    case 'live_pin': {
      const post = liveOf(state, body, me, { host: true });
      if (body.msgId && !post.live.chat.some(x => x.id === body.msgId)) fail(404, 'Mensagem não encontrada.');
      post.live.pinnedId = body.msgId || '';
      return { postId: post.id, silent: true };
    }
    case 'live_mute': {
      const post = liveOf(state, body, me, { host: true });
      if (!isUuid(body.userId) || body.userId === me.id) fail(400, 'Pessoa inválida.');
      post.live.muted = (post.live.muted || []).filter(id => id !== body.userId); if (body.on !== false) post.live.muted.push(body.userId);
      return { postId: post.id, silent: true };
    }
    case 'live_slow': {
      const post = liveOf(state, body, me, { host: true });
      if (!slowModes.includes(body.seconds)) fail(400, 'Modo lento inválido.');
      post.live.slowSeconds = body.seconds;
      return { postId: post.id, silent: true };
    }
    case 'live_requests': {
      const post = liveOf(state, body, me, { host: true });
      post.live.requestsOpen = body.open !== false;
      if (!post.live.requestsOpen) for (const [id, inv] of Object.entries(post.live.invites)) if (inv.status === 'requested') delete post.live.invites[id];
      return { postId: post.id, silent: true };
    }
    case 'live_react': {
      const post = liveOf(state, body, me);
      if (!liveReactions.includes(body.emoji)) fail(400, 'Reação inválida.');
      post.live.quick ||= [];
      const last = [...post.live.quick].reverse().find(r => r.authorId === me.id);
      if (last && now - last.at < 700) return { postId: post.id, silent: true };
      post.live.quick.push({ emoji: body.emoji, authorId: me.id, at: now });
      post.live.quick = post.live.quick.filter(r => now - r.at < REACTION_WINDOW_MS).slice(-300);
      // A reação rápida também conta como "Amei" na publicação da live (persistente).
      post.reactions ||= {}; if (!post.reactions[me.id]) post.reactions[me.id] = 'heart';
      return { postId: post.id, silent: true };
    }
    case 'live_invite': {
      const post = liveOf(state, body, me, { host: true });
      if (!isUuid(body.userId) || body.userId === me.id) fail(400, 'Pessoa inválida.');
      const person = personOf(state, body.userId); if (!person) fail(404, 'Pessoa não encontrada.');
      if (guestOf(post)) fail(409, 'Já há uma pessoa participando. Remova-a antes de convidar outra.');
      const pending = Object.values(post.live.invites).filter(i => i.status === 'pending').length; if (pending >= 5) fail(429, 'Muitos convites pendentes. Cancele algum antes.');
      post.live.invites[body.userId] = { status: 'pending', by: 'host', at: now, expiresAt: now + INVITE_TTL_MS, name: person.name };
      return { postId: post.id, silent: true, notify: [body.userId], push: { title: `${me.name} convidou você para a live`, body: 'Toque para entrar com câmera e microfone.', href: `/#post-${post.id}`, tag: `live-invite-${post.id}` } };
    }
    case 'live_invite_cancel': {
      const post = liveOf(state, body, me, { host: true });
      delete post.live.invites[body.userId];
      return { postId: post.id, silent: true };
    }
    case 'live_request': {
      const post = liveOf(state, body, me);
      if (post.authorId === me.id) fail(400, 'Você é quem transmite.');
      const mine = post.live.invites[me.id];
      if (mine?.status === 'requested') { delete post.live.invites[me.id]; return { postId: post.id, silent: true }; }
      if (!post.live.requestsOpen) fail(403, 'Quem transmite não está aceitando pedidos agora.');
      if (Object.values(post.live.invites).filter(i => i.status === 'requested').length >= 20) fail(429, 'Muitos pedidos na fila. Tente de novo em instantes.');
      post.live.invites[me.id] = { status: 'requested', by: 'viewer', at: now, name: me.name };
      return { postId: post.id, silent: true };
    }
    case 'live_request_respond': {
      const post = liveOf(state, body, me, { host: true });
      const inv = post.live.invites[body.userId]; if (!inv || inv.status !== 'requested') fail(404, 'Pedido não encontrado.');
      if (body.accept === false) { delete post.live.invites[body.userId]; return { postId: post.id, silent: true }; }
      if (guestOf(post)) fail(409, 'Já há uma pessoa participando.');
      post.live.invites[body.userId] = { ...inv, status: 'pending', by: 'request', at: now, expiresAt: now + INVITE_TTL_MS };
      return { postId: post.id, silent: true, notify: [body.userId], push: { title: `${me.name} aceitou seu pedido`, body: 'Entre na live com câmera e microfone.', href: `/#post-${post.id}`, tag: `live-invite-${post.id}` } };
    }
    case 'live_invite_respond': {
      const post = liveOf(state, body, me);
      const inv = post.live.invites[me.id]; if (!inv || inv.status !== 'pending') fail(404, 'Convite não encontrado ou vencido.');
      if (inv.expiresAt && inv.expiresAt < now) { post.live.invites[me.id] = { ...inv, status: 'expired' }; fail(410, 'Este convite venceu. Peça outro a quem transmite.'); }
      if (body.accept === false) { post.live.invites[me.id] = { ...inv, status: 'declined' }; return { postId: post.id, silent: true }; }
      if (guestOf(post)) fail(409, 'Já há uma pessoa participando desta live.');
      // Só quem aceitou um convite válido recebe a chave da participação; sem ela nenhum sinal WebRTC é aceito.
      post.live.guest = { userId: me.id, name: me.name, token: randomBytes(18).toString('hex'), joinedAt: now, mic: true, camera: true, signal: { offer: null, answer: null, hostCandidates: [], guestCandidates: [] } };
      post.live.invites[me.id] = { ...inv, status: 'accepted' };
      return { postId: post.id, guestToken: post.live.guest.token, silent: true };
    }
    case 'live_guest_leave': {
      const post = liveOf(state, body, me);
      if (!isGuest(post, me)) fail(404, 'Você não está participando desta live.');
      post.live.guest = null; delete post.live.invites[me.id];
      return { postId: post.id, silent: true };
    }
    case 'live_guest_remove': {
      const post = liveOf(state, body, me, { host: true });
      if (guestOf(post)) { delete post.live.invites[post.live.guest.userId]; post.live.guest = null; }
      return { postId: post.id, silent: true };
    }
    case 'live_guest_media': {
      const post = liveOf(state, body, me);
      if (!isGuest(post, me)) fail(404, 'Você não está participando desta live.');
      if (typeof body.mic === 'boolean') post.live.guest.mic = body.mic; if (typeof body.camera === 'boolean') post.live.guest.camera = body.camera;
      return { postId: post.id, silent: true };
    }
    case 'live_signal': {
      const post = liveOf(state, body, me);
      const guest = guestOf(post); if (!guest) fail(409, 'Nenhum convidado na live.');
      const asHost = post.authorId === me.id, asGuest = isGuest(post, me) && body.token === guest.token;
      if (!asHost && !asGuest) fail(403, 'Sem permissão para sinalizar nesta live.');
      if (body.offer !== undefined) { if (!asHost) fail(403, 'Só o anfitrião envia a oferta.'); guest.signal = { offer: sdp(body.offer, 'offer'), answer: null, hostCandidates: [], guestCandidates: [] }; }
      if (body.answer !== undefined) { if (!asGuest) fail(403, 'Só o convidado envia a resposta.'); guest.signal.answer = sdp(body.answer, 'answer'); }
      if (body.candidate !== undefined) { const list = asHost ? guest.signal.hostCandidates : guest.signal.guestCandidates; if (list.length < 60) list.push(candidate(body.candidate)); }
      return { postId: post.id, silent: true };
    }
  }
  fail(400, 'Ação desconhecida.');
}

// Webhook do MediaMTX (authMethod: http). Publicar exige a chave da live (Authorization: Bearer); assistir exige live ativa.
export function liveAuth(state, body) {
  const post = isUuid(body?.path || '') && (state.posts || []).find(p => p.id === body.path && p.live);
  if (!post || !active(post)) return false;
  if (body.action === 'publish') return typeof body.token === 'string' && body.token.length > 0 && body.token === post.live.key;
  return body.action === 'read';
}

export const projectLive = (p, now = Date.now()) => p.live ? { active: active(p), startedAt: p.live.startedAt, endedAt: p.live.endedAt || 0, recording: p.live.recording || '', format: p.live.format || 'portrait', viewers: active(p) ? viewersOf(p, now) : 0, guest: p.live.guest ? p.live.guest.name : '' } : null;

// Lives públicas ativas agora, para descoberta (anel de stories, perfil, seção "Ao vivo agora"). Quem a pessoa segue vem primeiro.
export function liveNow(state, me, now = Date.now()) {
  const followed = new Set(Array.isArray(state.follows?.[me.id]) ? state.follows[me.id] : []);
  return (state.posts || []).filter(active).map(p => { const a = personOf(state, p.authorId); const key = `id:${p.authorId}`; return { postId: p.id, authorKey: key, author: p.author, avatar: avatarOf(a), format: p.live.format || 'portrait', viewers: viewersOf(p, now), startedAt: p.live.startedAt, communityId: p.communityId || '', following: followed.has(key), own: p.authorId === me.id, invited: p.live.invites?.[me.id]?.status === 'pending' }; })
    .sort((a, b) => Number(b.own) - Number(a.own) || Number(b.following) - Number(a.following) || b.viewers - a.viewers);
}

// Estado completo de uma live para quem assiste, participa ou transmite (GET /api/community?view=live&id=…&since=…).
export function liveView(state, me, params, env = process.env, now = Date.now()) {
  const id = params.get('id') || '';
  if (!id) return { lives: liveNow(state, me, now) };
  const post = (state.posts || []).find(p => p.id === id && p.live); if (!post) fail(404, 'Live não encontrada.');
  const since = Number(params.get('since')) || 0;
  const host = post.authorId === me.id, guest = guestOf(post), amGuest = guest?.userId === me.id;
  const hostAccount = personOf(state, post.authorId), guestAccount = guest ? personOf(state, guest.userId) : null;
  const pinned = post.live.pinnedId ? post.live.chat.find(m => m.id === post.live.pinnedId) : null;
  const chat = post.live.chat.filter(m => m.createdAt > since).slice(-100).map(m => ({ ...m, avatar: avatarOf(personOf(state, m.authorId)), own: m.authorId === me.id, isHost: m.authorId === post.authorId }));
  const quick = (post.live.quick || []).filter(r => now - r.at < REACTION_WINDOW_MS);
  const counts = Object.fromEntries(liveReactions.map(e => [e, quick.filter(r => r.emoji === e).length]).filter(([, n]) => n));
  const myInvite = post.live.invites?.[me.id]?.status || '';
  const out = {
    live: { postId: post.id, active: active(post), format: post.live.format || 'portrait', startedAt: post.live.startedAt, endedAt: post.live.endedAt || 0, now, viewers: active(post) ? viewersOf(post, now) : 0, text: post.text,
      host: { key: `id:${post.authorId}`, name: post.author, avatar: avatarOf(hostAccount), following: (state.follows?.[me.id] || []).includes(`id:${post.authorId}`) },
      guest: guest ? { key: `id:${guest.userId}`, name: guest.name, avatar: avatarOf(guestAccount), mic: guest.mic, camera: guest.camera, joinedAt: guest.joinedAt } : null,
      pinned: pinned ? { ...pinned, avatar: avatarOf(personOf(state, pinned.authorId)) } : null, slowSeconds: post.live.slowSeconds || 0, requestsOpen: post.live.requestsOpen !== false,
      role: host ? 'host' : amGuest ? 'guest' : 'viewer', myInvite, muted: (post.live.muted || []).includes(me.id), recording: post.live.recording || '', media: post.media ? { url: post.media.url, kind: post.media.kind } : null },
    chat, quick: { counts, recent: quick.slice(-12).map(r => ({ emoji: r.emoji, at: r.at })) }
  };
  if (host) {
    out.requests = Object.entries(post.live.invites).filter(([, i]) => i.status === 'requested').map(([uid, i]) => ({ userId: uid, name: i.name, avatar: avatarOf(personOf(state, uid)), at: i.at }));
    out.invites = Object.entries(post.live.invites).filter(([, i]) => i.status !== 'requested').map(([uid, i]) => ({ userId: uid, name: i.name, status: i.status, expiresAt: i.expiresAt || 0 }));
    out.mutedPeople = (post.live.muted || []).map(uid => ({ userId: uid, name: personOf(state, uid)?.name || 'Pessoa' }));
    out.audience = Object.entries(post.live.watchers || {}).filter(([, ts]) => now - ts < WATCH_WINDOW_MS).map(([uid]) => ({ userId: uid, name: personOf(state, uid)?.name || 'Pessoa', avatar: avatarOf(personOf(state, uid)) })).slice(0, 60);
    if (guest) out.signal = { answer: guest.signal.answer, candidates: guest.signal.guestCandidates, hasOffer: !!guest.signal.offer };
  }
  if (amGuest) { out.guestToken = guest.token; out.signal = { offer: guest.signal.offer, candidates: guest.signal.hostCandidates }; }
  if (host || amGuest) out.iceServers = iceServers(me, env, now);
  return out;
}

// Quando a live termina, o MediaMTX fecha o arquivo em /recordings/<postId>/; ele vira o vídeo da publicação.
// Procura por até 2 minutos depois do fim; sem arquivo (navegador sem H.264, queda antes do primeiro quadro) marca 'none'.
export async function attachRecordings(store, env = process.env, now = Date.now()) {
  const dir = env.OPY_LIVE_RECORDINGS_DIR;
  if (!dir) return;
  const { data } = await store.readState();
  const pending = (data.posts || []).filter(p => p.live?.endedAt && !p.live.recording);
  if (!pending.length) return;
  const found = new Map();
  for (const p of pending) {
    // Cada queda de rede de quem transmite abre um arquivo novo: guarda todos, em ordem, e o player toca um depois do outro.
    try {
      const files = (await readdir(join(dir, p.id))).filter(f => f.endsWith('.mp4')).sort();
      const sized = await Promise.all(files.map(async f => ({ f, size: (await stat(join(dir, p.id, f))).size })));
      const parts = sized.filter(x => x.size > 0).map(x => x.f);
      if (parts.length) found.set(p.id, parts);
    } catch {}
  }
  const giveUp = new Set(pending.filter(p => !found.has(p.id) && now - p.live.endedAt > RECORDING_WAIT_MS).map(p => p.id));
  if (!found.size && !giveUp.size) return;
  await store.transact(state => {
    for (const p of state.posts || []) {
      if (!p.live) continue;
      if (found.has(p.id)) { const urls = found.get(p.id).map(f => `/live/recordings/${p.id}/${f}`); p.media = { url: urls[0], kind: 'video', name: 'live.mp4', ...(urls.length > 1 ? { parts: urls } : {}) }; p.live.recording = 'ok'; }
      else if (giveUp.has(p.id)) p.live.recording = 'none';
    }
  });
}

// Arquivo de gravação de uma publicação visível: só o caminho gravado na própria publicação é servido (sem travessia de pastas).
export async function recordingFile(post, pathname, env = process.env) {
  if (!env.OPY_LIVE_RECORDINGS_DIR || !post?.media?.url || (post.media.url !== pathname && !(post.media.parts || []).includes(pathname))) return null;
  const file = join(env.OPY_LIVE_RECORDINGS_DIR, pathname.slice('/live/recordings/'.length));
  try { const info = await stat(file); return info.isFile() ? { file, info } : null; } catch { return null; }
}
