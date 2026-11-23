import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { readState, transact, saveMedia as storeSaveMedia, readMedia, deleteMedia, archiveAvatar } from './store.mjs';
import { scheduleTranscode } from './transcode.mjs';
// Vídeo novo é guardado como veio e, em segundo plano, trocado por uma versão leve (720p, MP4 com início rápido) quando o ffmpeg existe.
const saveMedia = async (id, bytes, type) => { await storeSaveMedia(id, bytes, type); if (/^video\//.test(type)) scheduleTranscode(id, { readMedia, saveMedia: storeSaveMedia }); };
import { answerEtnia } from './etnia.mjs';
import { createIaraTicket, cancelIaraTicket, iaraTickets } from './iara.mjs';
import { createSession, renewSession, SESSION_DAYS, verifySession, sessionCookie, sessionAccount, addSession, hashPassword, checkPassword, hashPasswordAsync, checkPasswordAsync, needsRehash } from './session.mjs';
import { tooMany, note, clear, clientIp } from './throttle.mjs';
import { providerConfigured, eligibleForRecovery, contactOf, issueCode, checkCode, deliverCode } from './recovery.mjs';
import { recordConsent, sensitiveChange, purgeAccount, dueForPurge, TERMS_VERSION } from './lgpd.mjs';

import { chatActions, chatSnapshot, chatAction, chatMedia } from './chat.mjs';
import { callActions, callAction, callsView, settleCalls } from './calls.mjs';
import { groupCallActions, groupCallAction, groupCallsView, settleGroupCalls } from './groupcalls.mjs';
import { touchPresence, presenceMap, AVAILABILITY } from './presence.mjs';
import { adminActions, adminAction, adminView, announcementsFor, roleOf, isSuspended, suspensionMessage, log as adminLog } from './admin.mjs';
import { i18nActions, i18nAction, i18nView, i18nFor } from './i18n.mjs';
import { pushActions, pushAction, sendPush, pushPublicKey } from './push.mjs';
import { liveActions, liveAction, liveAuth, liveEnabled, settleLives, projectLive, attachRecordings, recordingFile, liveView, liveNow , setLiveVisibility } from './live.mjs';
import { sendFile, sendBuffer } from './files.mjs';
import { plainText } from './plain-text.mjs';
import { mp4Seconds, MAX_VIDEO_SECONDS } from './video-meta.mjs';
import { linkPreview, linkImage } from './link-preview.mjs';
import { postMediaIds, orphanMediaIds, findPostMedia } from './post-media.mjs';
import { planActions, planAction, plansView, planOf, planBadge, decidePlanRequest, decideVerification } from './planos.mjs';
import { boostActions, boostAction, sponsoredFor, financeView, settleBoosts } from './impulsos.mjs';
import { areaView } from './areas.mjs';
import { saberesActions, saberesAction, saberesView, saberMedia } from './saberes.mjs';
import { marketActions, marketAction, marketMedia, MAX_MARKET_PHOTOS } from './mercado.mjs';
import { pageActions, pageUploadActions, pageAction, pagesPrepareUpload, pagesList, pageView, pageMedia } from './pages.mjs';
import { markStaffUsername, extrasActions, extrasUploadActions, extrasAction, extrasPrepareUpload, extrasMedia, reactionConfig, reactionIds, reactionSet, reactionAllowed, usernameCheck, usernameCheckAllowed, usernameInfo, reverseGeocode, stickerCatalog, stickerById } from './extras.mjs';
import { verifyCode, useBackup } from './totp.mjs';
import { accountActions, accountAction, accountView, profileAccess, isBlockedPair, isInactive, stampSession, reactivateOnLogin, canComment, canSeeStory, canReplyStory, followNeedsApproval, wantsNotice, wantsPush } from './account.mjs';
import { communityActions, ensureCommunities, canViewCommunityContent, canPostInCommunity, projectCommunities, communityAction, syncCommunityChat } from './communities.mjs';

const reactions = ['like', 'heart', 'laugh', 'wow', 'sad'];
const feelings = ['feliz', 'agradecido', 'pensativo', 'animado'];
const saberTracks = ['saberes-comunicacao', 'saberes-territorio', 'saberes-economia'];
const musicTracks = ['canto-alvorada', 'floresta-viva', 'memoria-dos-rios'];
const moduleNames = ['saberes', 'guardiao', 'fotografos', 'musica', 'doar'];
const registerSlots = new Map();
function registerAllowed(req) {
  const max = Number(process.env.OPY_REGISTER_PER_HOUR ?? 30); if (!(max > 0)) return true;
  const ip = clientIp(req);
  const now = Date.now(); const hits = (registerSlots.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= max) { registerSlots.set(ip, hits); return false; }
  hits.push(now); registerSlots.set(ip, hits);
  if (registerSlots.size > 5000) for (const [k, v] of registerSlots) if (!v.some(t => now - t < 3600e3)) registerSlots.delete(k);
  return true;
}
// Tetos globais só como proteção do disco; o freio do dia a dia é por pessoa. Aviso no log (uma vez) ao passar de 70%.
const capacityWarned = new Set();
function capacity(name, used, max) {
  if (used >= max * 0.7 && !capacityWarned.has(name)) { capacityWarned.add(name); console.error(`AVISO capacidade: ${name} em ${used} de ${max} (${Math.round(used / max * 100)}%)`); }
  return used >= max;
}
const MAX_POSTS_PER_USER_DAY = () => Number(process.env.OPY_MAX_POSTS_PER_USER_DAY) || 60;
function postBudget(state, me) {
  const since = Date.now() - 864e5; let n = 0;
  for (const post of state.posts) if (post.authorId === me.id && post.createdAt >= since) n++;
  if (n >= MAX_POSTS_PER_USER_DAY()) fail(429, `Você já publicou ${n} vezes nas últimas 24 horas. Volte amanhã para publicar de novo.`);
}
// Índice id da mídia -> publicações, refeito quando a lista de publicações muda (tamanho, primeira ou última). Mídia de publicação não muda
// depois de criada; cada resultado ainda é conferido antes de ser entregue.
const mediaIndexes = new WeakMap();
function postsWithMedia(state, id) {
  let entry = mediaIndexes.get(state.posts);
  if (!entry || entry.size !== state.posts.length || entry.first !== state.posts[0] || entry.last !== state.posts.at(-1)) {
    entry = { size: state.posts.length, first: state.posts[0], last: state.posts.at(-1), map: new Map() };
    for (const post of state.posts) for (const mid of postMediaIds(post)) { const list = entry.map.get(mid); if (list) list.push(post); else entry.map.set(mid, [post]); }
    mediaIndexes.set(state.posts, entry);
  }
  const hits = (entry.map.get(id) || []).filter(post => postMediaIds(post).includes(id));
  return hits;
}
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function text(value, maximum, required = true) {
  if (typeof value !== 'string' || value.length > maximum || required && !value.trim()) fail(400, 'Confira o texto e o limite de caracteres.');
  return value.trim();
}
const dummyPassword = hashPassword('opy-preview-dummy-secret');
const dummyBcrypt = bcrypt.hashSync('opy-preview-dummy-secret', 10);
function sessionSecret() {
  const secret = process.env.OPY_SESSION_SECRET;
  if (!secret || secret.length < 32) fail(503, 'A comunidade está em preparação. Tente novamente em instantes.');
  return secret;
}
// Vercel e a VPS (NODE_ENV=production no Dockerfile) servem por HTTPS; o teste local em http fica sem Secure.
const secureCookie = () => process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
// Quem usa o Etnias não precisa entrar de novo: a sessão ganha mais 30 dias a cada dia de uso. O token antigo segue
// válido até a própria data (o servidor confere a sessão pelo id), então pedidos simultâneos não derrubam ninguém.
async function slideSession(res, session, secret) {
  const renewed = await renewSession(session, secret);
  if (!renewed) return;
  let kept = false;
  await transact(state => {
    const item = (state.accounts || []).find(a => a.id === session.accountId)?.sessions?.find(s => s.id === session.id && s.expiresAt > Date.now());
    if (item) { item.expiresAt = Math.max(item.expiresAt, renewed.session.expiresAt); kept = true; }
  });
  if (kept) res.setHeader('Set-Cookie', cookieHeader(renewed.token));
}
function cookieHeader(token) {
  return `opy_visitor=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureCookie()}`;
}
function accountsOf(state) {
  if (!Array.isArray(state.accounts)) state.accounts = [];
  return state.accounts;
}
function usernameOf(value) {
  // Muita gente digita o @ antes do usuário, como nas outras redes.
  const username = text(String(value || '').trim().replace(/^@+/, ''), 24).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(username)) fail(400, 'Use um usuário de 3 a 24 caracteres: letras, números, ponto ou _.');
  return username;
}
// Celular pode ser compartilhado (família, associação): só identifica a conta quando é de uma pessoa só e não é o @ de ninguém.
function findByIdentity(accounts, identity) {
  const direct = accounts.find(item => item.username === identity || item.googleKey === identity);
  if (direct || !/^\d{10,11}$/.test(identity)) return direct;
  const byPhone = accounts.filter(item => item.phone === identity);
  return byPhone.length === 1 ? byPhone[0] : undefined;
}
function loginIdentity(value) {
  const identity = text(String(value || '').trim(), 80).toLowerCase();
  // Celular com DDD (com ou sem +55, parênteses e traços) também identifica a conta.
  if (/^[+\d][\d\s().+-]{7,19}$/.test(identity)) {
    const digits = identity.replace(/\D/g, ''); const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    if (/^[1-9][0-9]9?[0-9]{8}$/.test(local)) return local;
  }
  if (!identity.includes('@') || identity.startsWith('@')) return usernameOf(identity);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity)) fail(400, 'Informe o usuário, o e-mail ou o celular da conta.');
  return identity;
}
function personName(value) {
  const name = text(String(value || ''), 40);
  if (name.length < 2) fail(400, 'Escreva seu nome, com pelo menos 2 caracteres.');
  return name;
}
function passwordOf(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72) fail(400, 'A senha precisa ter de 8 a 72 caracteres.');
  return value;
}
function googleKeyOf(value) {
  const key = text(String(value || ''), 80).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) fail(400, 'Informe um e-mail válido, como nome@exemplo.com.');
  return key;
}
function phoneOf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (!/^[1-9][0-9]9?[0-9]{8}$/.test(local)) fail(400, 'Informe o telefone com DDD, com 10 ou 11 dígitos.');
  return local;
}
const profileUrl = id => id ? `/api/media?id=${id}` : '';
function member(account) {
  return { consent: { sensitive: !!account.consent?.sensitive, location: !!account.consent?.location, terms: account.consent?.terms?.version || '' }, id: account.id, name: account.name, username: account.username, bio: account.bio || '', affiliation: account.affiliation || '', belonging: account.belonging || '', povo: account.povo || '', phone: account.phone || '', googleKey: account.googleKey || '',
    avatar: account.avatarUrl || profileUrl(account.avatarId), cover: account.coverUrl || profileUrl(account.coverId), joinedAt: account.createdAt || 0, location: account.location ? [account.location.city, account.location.uf].filter(Boolean).join(', ') : '', verified: !!account.verified, plan: planBadge(account), role: roleOf(account), mustChangePassword: !!account.mustChangePassword, videoAutoplay: account.videoAutoplay === 'on' ? 'on' : account.videoAutoplay === 'off' ? 'off' : '', pronouns: account.pronouns || '' };
}
function authorKeyOf(post) {
  return post.authorId ? `id:${post.authorId}` : `name:${post.author}`;
}
function visible(post, me, state) {
  if (post.audience === 'private' && post.authorId !== me.id) return false;
  if (state && post.authorId && post.authorId !== me.id && profileAccess(state, me.id, post.authorId) !== 'full') return false;
  // "Amigos": só o autor e quem tem amizade confirmada com ele.
  if (post.audience === 'friends' && post.authorId !== me.id && !(state?.friends?.['id:' + post.authorId] || []).includes('id:' + me.id)) return false;
  if (post.communityId && state && !canViewCommunityContent(state, me, post.communityId)) return false;
  return true;
}
function friendStatusOf(state, myKey, targetKey) {
  if (!targetKey || targetKey === myKey) return 'self';
  if ((state.friends?.[myKey] || []).includes(targetKey)) return 'friends';
  if ((state.friendRequests?.[myKey] || []).includes(targetKey)) return 'incoming';
  if ((state.friendRequests?.[targetKey] || []).includes(myKey)) return 'outgoing';
  return 'none';
}
const PAGE_SIZE = 30;
const plain = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mapMedia = m => m ? { url: m.url || `/api/media?id=${m.id}`, kind: m.kind, name: m.name || '', ...(m.parts ? { parts: m.parts } : {}), ...(m.posterId ? { poster: `/api/media?id=${m.posterId}` } : {}) } : null;
const personAvatar = acc => acc?.avatarUrl || profileUrl(acc?.avatarId);
// Povos já declarados na rede, para sugerir na edição do perfil (sem lista fechada: a pessoa escreve como se nomeia).
function povosOf(state) { const count = new Map(); for (const a of state.accounts || []) if (a.belonging === 'indigena' && a.povo) count.set(a.povo, (count.get(a.povo) || 0) + 1); return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([name]) => name); }
// Reações rápidas aos stories (como nas redes que as pessoas já usam); a resposta em texto vai pelo chat.
const storyReactions = ['❤️', '😂', '😮', '😢', '👏', '🙏'];
// Contexto por requisição: tudo que a projeção de um post ou de uma pessoa precisa, calculado uma vez.
function feedContext(state, me) {
  const myKey = `id:${me.id}`;
  const communities = projectCommunities(state, me);
  return {
    myKey, communities,
    communityNames: new Map(communities.map(c => [c.id, c.name])),
    reactionIds: reactionIds(state),
    followed: new Set(Array.isArray(state.follows?.[me.id]) ? state.follows[me.id] : []),
    friends: new Set(state.friends?.[myKey] || []),
    accountsById: new Map((state.accounts || []).map(a => [a.id, a]))
  };
}
const avatarOfKey = (ctx, key) => String(key || '').startsWith('id:') ? personAvatar(ctx.accountsById.get(key.slice(3))) : '';
// Quem reagiu, para a linha "Você, Ana e mais 12": até 3 nomes, a própria pessoa primeiro.
function reactorNames(p, me, ctx) {
  const ids = Object.entries(p.reactions || {}).filter(([, r]) => r).map(([id]) => id);
  const names = ids.includes(me.id) ? ['você'] : [];
  for (const id of ids) { if (names.length >= 3) break; if (id === me.id) continue; const name = ctx.accountsById.get(id)?.name; if (name) names.push(name); }
  return names;
}
// @usuario no texto marca a pessoa: guarda o id (o usuário pode mudar depois). Só contas que existem, até 10 por texto.
const MENTION_RE = /(^|[^\w@.])@([a-z0-9][a-z0-9._]{2,23})/gi;
function mentionsIn(state, value, authorId) {
  const names = new Set([...String(value || '').matchAll(MENTION_RE)].map(m => m[2].toLowerCase().replace(/\.+$/, '')));
  if (!names.size) return [];
  return (state.accounts || []).filter(a => a.username && names.has(a.username) && a.id !== authorId).slice(0, 10).map(a => a.id);
}
// Para o app transformar @usuario em link de perfil: { usuario: 'id:…' } só das menções gravadas.
function mentionKeys(ids, ctx) {
  const out = {};
  for (const id of ids || []) { const u = ctx.accountsById.get(id)?.username; if (u) out[u] = `id:${id}`; }
  return out;
}
function projectPost(p, me, state, ctx) {
  const aKey = authorKeyOf(p);
  const author = ctx.accountsById.get(p.authorId);
  return {
    id: p.id, text: p.text, mentions: mentionKeys(p.mentions, ctx), author: p.author, authorKey: aKey, following: ctx.followed.has(aKey), friendStatus: friendStatusOf(state, ctx.myKey, aKey),
    origin: p.origin || 'preview', createdAt: p.createdAt, alt: p.alt || '', image: p.image || '', images: p.photos?.length > 1 ? p.photos.map(m => `/api/media?id=${m.id}`) : Array.isArray(p.images) && p.images.length > 1 ? p.images : [],
    avatar: archiveAvatar(p) || personAvatar(author), verified: !!author?.verified, attachmentMissing: !!p.attachmentMissing,
    media: mapMedia(p.media), file: mapMedia(p.file), link: p.link || null, location: p.location || '', live: projectLive(p),
    communityId: p.communityId || '', communityName: p.communityId ? (ctx.communityNames.get(p.communityId) || p.communityName || '') : '',
    audience: p.audience, feeling: p.feeling || '', own: p.authorId === me.id,
    shares: p.shares || 0,
    repostOf: p.repostOf ? { ...p.repostOf, media: mapMedia(p.repostOf.media), file: mapMedia(p.repostOf.file), images: p.repostOf.photos?.length > 1 ? p.repostOf.photos.map(m => `/api/media?id=${m.id}`) : p.repostOf.images || [], photos: undefined } : null,
    reactions: Object.fromEntries(ctx.reactionIds.map(r => [r, Object.values(p.reactions || {}).filter(v => v === r).length])), reaction: p.reactions?.[me.id] || '',
    reactedBy: reactorNames(p, me, ctx),
    comments: (p.comments || []).map(c => ({ id: c.id, author: c.author, authorKey: c.authorKey, avatar: avatarOfKey(ctx, c.authorKey), text: c.text, media: c.media ? { url: `/api/media?id=${c.media.id}`, kind: 'image' } : null, sticker: c.sticker ? { id: c.sticker.id, name: c.sticker.name, url: `/api/media?id=${c.sticker.mediaId}` } : null, mentions: mentionKeys(c.mentions, ctx), createdAt: c.createdAt, editedAt: c.editedAt || 0,
      parentId: c.parentId || '', likes: (c.likes || []).length, liked: (c.likes || []).includes(ctx.myKey), own: c.authorKey === ctx.myKey })),
    editedAt: p.editedAt || 0, saved: (p.saves || []).includes(me.id), commentsClosed: !!p.authorId && !canComment(state, me.id, p.authorId),
    poll: p.poll ? { options: p.poll.options, counts: p.poll.options.map((_, i) => Object.values(p.poll.votes).filter(v => v === i).length), voted: p.poll.votes[me.id] ?? null } : null
  };
}
function matchesKind(p, kind) {
  const isImage = x => x?.media?.kind === 'image' || !!x?.image;
  const isKind = (x, k) => x?.media?.kind === k;
  if (kind === 'photos') return isImage(p) || isImage(p.repostOf);
  if (kind === 'videos') return isKind(p, 'video') || isKind(p.repostOf, 'video');
  if (kind === 'audio') return isKind(p, 'audio') || isKind(p.repostOf, 'audio');
  // Ao vivo: lives em andamento e gravações de lives. Rápidas: só texto curto, como um microblog.
  if (kind === 'live') return !!p.live;
  if (kind === 'text') return !p.media && !p.image && !p.photos?.length && !p.images?.length && !p.file && !p.repostOf && !p.poll && !p.live && String(p.text || '').length <= 500;
  if (kind === 'files') return isKind(p, 'file') || !!p.file || isKind(p.repostOf, 'file') || !!p.repostOf?.file;
  return true;
}
// Filtros do feed resolvidos no servidor: a rede tem milhares de publicações, o cliente recebe só uma página.
function postMatches(p, params, me, ctx) {
  const aKey = authorKeyOf(p);
  const isFollowing = ctx.followed.has(aKey) || ctx.friends.has(aKey);
  const feed = params.get('feed') || 'news';
  if (feed === 'following' && !isFollowing) return false;
  if (feed === 'discover' && (p.authorId === me.id || isFollowing)) return false;
  if (feed === 'saved' && !(p.saves || []).includes(me.id)) return false;
  if (feed === 'archive' && p.origin !== 'legacy') return false;
  const id = params.get('id'); if (id && p.id !== id) return false;
  const author = params.get('author'); if (author && aKey !== author) return false;
  const community = params.get('community'); if (community && p.communityId !== community) return false;
  const origin = params.get('origin'); if (origin && origin !== 'all' && (p.origin || 'preview') !== origin) return false;
  const kind = params.get('kind'); if (kind && !matchesKind(p, kind)) return false;
  if (params.has('location')) { const q = plain(params.get('location')); if (!p.location || (q && !plain(p.location).includes(q))) return false; }
  const q = plain(params.get('q')); if (q && !plain(`${p.text} ${p.author} ${p.communityName || ''}`).includes(q)) return false;
  return true;
}
function postsPage(state, me, params, ctx = feedContext(state, me)) {
  const before = Number(params.get('before')) || Infinity;
  const beforeId = params.get('beforeId') || '';
  const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || PAGE_SIZE));
  // Cursor por (createdAt, id): publicações do acervo têm precisão de segundos e podem empatar na data.
  const older = p => p.createdAt < before || (p.createdAt === before && beforeId && p.id < beforeId);
  // Silenciadas saem do feed geral, mas aparecem quando a pessoa abre o perfil, o post, uma busca ou os salvos.
  const muted = !params.get('author') && !params.get('id') && !params.get('q') && params.get('feed') !== 'saved' ? new Set(state.mutes?.[ctx.myKey] || []) : null;
  const list = state.posts.filter(p => older(p) && visible(p, me, state) && !(muted?.size && muted.has(authorKeyOf(p))) && postMatches(p, params, me, ctx))
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
  return { posts: list.slice(0, limit).map(p => projectPost(p, me, state, ctx)), hasMore: list.length > limit };
}
function socialCounts(state, me) {
  const followers = new Map();
  for (const list of Object.values(state.follows || {})) if (Array.isArray(list)) for (const k of list) followers.set(k, (followers.get(k) || 0) + 1);
  const posts = new Map();
  for (const p of state.posts) if (visible(p, me, state)) { const k = authorKeyOf(p); posts.set(k, (posts.get(k) || 0) + 1); }
  return { followers, posts };
}
// Presença: última leitura autenticada de cada conta (o cliente consulta a cada 4–20 s com a aba aberta).
// shortcut: só em memória e num processo; reiniciar zera e vários servidores exigiriam um store compartilhado.
const lastSeen = new Map();
const ONLINE_MS = 90_000;
// Como nas redes conhecidas, o "online" só aparece para amizades ou quem se segue mutuamente.
function onlineFor(state, ctx, acc, me) {
  if (acc.id === me.id || !(Date.now() - (lastSeen.get(acc.id) || 0) < ONLINE_MS)) return false;
  const key = `id:${acc.id}`;
  return friendStatusOf(state, ctx.myKey, key) === 'friends' || (ctx.followed.has(key) && Array.isArray(state.follows?.[acc.id]) && state.follows[acc.id].includes(ctx.myKey));
}
function personFor(state, me, ctx, key, counts) {
  const base = { key, following: ctx.followed.has(key), followRequested: (state.followRequests?.[key] || []).includes(ctx.myKey), friendStatus: friendStatusOf(state, ctx.myKey, key), followersCount: counts.followers.get(key) || 0, followingCount: key.startsWith('id:') && Array.isArray(state.follows?.[key.slice(3)]) ? state.follows[key.slice(3)].length : 0, friendsCount: (state.friends?.[key] || []).length, postsCount: counts.posts.get(key) || 0 };
  if (key.startsWith('id:')) {
    const acc = ctx.accountsById.get(key.slice(3));
    if (!acc) return null;
    const access = profileAccess(state, me.id, acc.id);
    if (access === 'none') return null;
    // Perfil só para amizades: quem não é amizade vê o cartão (nome, foto, apresentação) e o botão de pedir amizade.
    if (access === 'limited') return { ...base, postsCount: 0, name: acc.name, username: acc.username || '', bio: acc.bio || '', affiliation: '', belonging: '', povo: '', avatar: personAvatar(acc), cover: '', joinedAt: 0, verified: !!acc.verified, own: false, locked: true };
    return { ...base, location: acc.location ? [acc.location.city, acc.location.uf].filter(Boolean).join(', ') : '', online: onlineFor(state, ctx, acc, me), name: acc.name, username: acc.username || '', bio: acc.bio || '', affiliation: acc.affiliation || '', pronouns: acc.pronouns || '', belonging: acc.belonging || '', povo: acc.povo || '', avatar: personAvatar(acc), cover: acc.coverUrl || profileUrl(acc.coverId), joinedAt: acc.createdAt || 0, verified: !!acc.verified, plan: planBadge(acc), own: acc.id === me.id, blockedByMe: (state.chatBlocks?.[ctx.myKey] || []).includes(key) };
  }
  // Pessoa do acervo sem conta: só o nome e a foto que vieram com a publicação.
  const post = state.posts.find(p => authorKeyOf(p) === key && visible(p, me, state));
  return post ? { ...base, name: post.author, username: '', bio: '', affiliation: '', avatar: archiveAvatar(post), cover: '', joinedAt: 0, verified: false, own: false } : null;
}
// Texto de busca normalizado, guardado por conta (e refeito se o perfil mudar): sem normalizar 8 mil contas a cada tecla.
const searchText = new WeakMap();
function accountMatches(acc, q) {
  if (!q) return true;
  const raw = `${acc.name} ${acc.username || ''} ${acc.affiliation || ''} ${acc.bio || ''}`;
  let hit = searchText.get(acc);
  if (!hit || hit.raw !== raw) { hit = { raw, text: plain(raw) }; searchText.set(acc, hit); }
  return hit.text.includes(q);
}
function searchBudget(me) {
  if (tooMany('busca:' + me.id, 40, 60_000)) fail(429, 'Muitas buscas em pouco tempo. Espere alguns segundos e continue.');
  note('busca:' + me.id, 60_000);
}
// Pessoas que importam para quem está vendo: relações, autores da página e sugestões. O restante vem pela busca.
function peopleFor(state, me, ctx, pagePosts, counts) {
  const keys = new Set([ctx.myKey, ...ctx.friends, ...(state.friendRequests?.[ctx.myKey] || []), ...ctx.followed]);
  for (const [k, list] of Object.entries(state.friendRequests || {})) if (Array.isArray(list) && list.includes(ctx.myKey)) keys.add(k);
  for (const p of pagePosts) keys.add(p.authorKey);
  // Sugestões com motivo: quem divide comunidade comigo ou é amizade de amizade vem antes de quem só é popular.
  const reasons = new Map();
  for (const c of ctx.communities) if (c.joined) for (const m of c.members || []) if (!reasons.has(m.key)) reasons.set(m.key, `Na comunidade ${c.name}`);
  for (const f of ctx.friends) { const friend = ctx.accountsById.get(f.slice(3)); if (friend) for (const k of state.friends?.[f] || []) if (!reasons.has(k)) reasons.set(k, `Amizade de ${friend.name}`); }
  const followers = a => counts.followers.get(`id:${a.id}`) || 0;
  const featured = a => planOf(a).destaque;
  for (const a of state.accounts || []) if (featured(a) && !reasons.has(`id:${a.id}`)) reasons.set(`id:${a.id}`, 'Membro em destaque');
  const dismissed = new Set(state.dismissedSuggestions?.[me.id] || []);
  const suggestions = (state.accounts || []).filter(a => a.id !== me.id && !keys.has(`id:${a.id}`) && !dismissed.has(`id:${a.id}`) && (a.avatarUrl || a.avatarId) && !isSuspended(a) && !isInactive(state, a.id) && !isBlockedPair(state, ctx.myKey, `id:${a.id}`))
    .sort((a, b) => Number(featured(b)) - Number(featured(a)) || Number(reasons.has(`id:${b.id}`)) - Number(reasons.has(`id:${a.id}`)) || followers(b) - followers(a)).slice(0, 12);
  const suggested = new Map(suggestions.map(a => [`id:${a.id}`, reasons.get(`id:${a.id}`) || 'Popular na rede']));
  for (const key of suggested.keys()) keys.add(key);
  return [...keys].map(key => { const person = personFor(state, me, ctx, key, counts); if (person && suggested.has(key)) { person.suggested = true; person.reason = suggested.get(key); } return person; }).filter(Boolean);
}
// Notificações agregadas por publicação, como nas redes que as pessoas já usam.
// shortcut: reações e seguidores antigos não têm data gravada (entram pela data da publicação ou do evento de seguir); gravar datas em todas as reações quando houver banco relacional (Fase 3).
function notificationItems(state, me, ctx) {
  const seenAt = ctx.accountsById.get(me.id)?.notificationsSeenAt || 0;
  const nameOf = key => ctx.accountsById.get(String(key).slice(3))?.name || 'Alguém';
  const others = names => names.length <= 1 ? names[0] || 'Alguém' : names.length === 2 ? `${names[0]} e ${names[1]}` : `${names[0]} e mais ${names.length - 1}`;
  const excerpt = p => (p.text || '').replace(/\s+/g, ' ').trim().slice(0, 60) || (p.media ? 'sua foto' : 'sua publicação');
  const items = [];
  for (const k of state.friendRequests?.[ctx.myKey] || []) items.push({ id: `friend:${k}`, kind: 'friend', key: k, text: `${nameOf(k)} enviou uma solicitação de amizade.`, avatar: avatarOfKey(ctx, k), createdAt: Date.now(), actionable: true });
  for (const c of ctx.communities) {
    if (c.invited) items.push({ id: `invite:${c.id}`, kind: 'invite', communityId: c.id, text: `Você foi convidada(o) para a comunidade "${c.name}".`, href: `/grupos/?c=${encodeURIComponent(c.id)}`, createdAt: Date.now(), actionable: true });
    if (c.canModerate && c.pendingRequests?.length) items.push({ id: `pending:${c.id}`, kind: 'pending', communityId: c.id, text: `${c.pendingRequests.length} ${c.pendingRequests.length === 1 ? 'pedido de entrada pendente' : 'pedidos de entrada pendentes'} em "${c.name}".`, href: `/grupos/?c=${encodeURIComponent(c.id)}`, createdAt: Date.now(), actionable: true });
  }
  const pwAt = ctx.accountsById.get(me.id)?.passwordChangedAt;
  for (const ev of ctx.accountsById.get(me.id)?.securityEvents || []) if (Date.now() - ev.at < 30 * 864e5) items.push({ id: `access:${ev.at}`, kind: 'security', text: `Novo acesso à sua conta pelo ${ev.device}. Se não foi você, troque a senha e saia desse aparelho.`, href: '/configuracoes/#seguranca', createdAt: ev.at });
  if (pwAt && Date.now() - pwAt < 30 * 864e5) items.push({ id: `password:${pwAt}`, kind: 'security', text: 'Sua senha foi alterada. Se não foi você, fale com a equipe Etnias agora.', href: '/configuracoes/', createdAt: pwAt });
  for (const ev of (state.followEvents || [])) if (ev.to === ctx.myKey && profileAccess(state, me.id, ev.from) !== 'none') items.push({ id: `follow:${ev.from}:${ev.at}`, kind: 'follow', key: `id:${ev.from}`, following: ctx.followed.has(`id:${ev.from}`), canFollow: true, text: `${nameOf(`id:${ev.from}`)} começou a seguir você.`, avatar: avatarOfKey(ctx, `id:${ev.from}`), href: `/perfil/?u=${encodeURIComponent(`id:${ev.from}`)}`, createdAt: ev.at });
  for (const p of state.posts) if (p.live && !p.live.endedAt && p.authorId !== me.id && ctx.followed.has(authorKeyOf(p))) items.push({ id: `live:${p.id}`, kind: 'live', text: `${p.author} está ao vivo agora.`, avatar: avatarOfKey(ctx, authorKeyOf(p)), href: `/#post-${p.id}`, createdAt: p.live.startedAt });
  for (const p of state.posts) if (p.live && !p.live.endedAt && p.live.invites?.[me.id]?.status === 'pending') items.push({ id: `live-invite:${p.id}`, kind: 'live_invite', text: `${p.author} convidou você para participar da live.`, avatar: avatarOfKey(ctx, authorKeyOf(p)), href: `/#post-${p.id}`, createdAt: p.live.invites[me.id].at, actionable: true });
  for (const p of state.posts) {
    const mentioned = p.mentions?.includes(me.id);
    const mentionComment = (p.comments || []).filter(c => c.mentions?.includes(me.id)).at(-1);
    if ((mentioned || mentionComment) && visible(p, me, state)) {
      if (mentioned) items.push({ id: `mention:${p.id}`, kind: 'mention', text: `${p.author} mencionou você: "${excerpt(p)}"`, avatar: avatarOfKey(ctx, authorKeyOf(p)), href: `/#post-${p.id}`, createdAt: p.createdAt });
      if (mentionComment) items.push({ id: `mention-comment:${p.id}`, kind: 'mention', text: `${nameOf(mentionComment.authorKey)} mencionou você em um comentário: "${mentionComment.text.slice(0, 80)}"`, avatar: avatarOfKey(ctx, mentionComment.authorKey), href: `/#post-${p.id}`, createdAt: mentionComment.createdAt });
    }
    if (p.authorId !== me.id && !(p.comments || []).some(c => c.authorKey === ctx.myKey)) continue;
    if (!visible(p, me, state)) continue;
    const href = `/#post-${p.id}`;
    if (p.authorId === me.id) {
      const reactors = Object.entries(p.reactions || {}).filter(([id, r]) => r && id !== me.id).map(([id]) => `id:${id}`);
      if (reactors.length) items.push({ id: `react:${p.id}`, kind: 'react', text: `${others(reactors.slice(0, 2).map(nameOf).concat(reactors.length > 2 ? Array(reactors.length - 2).fill('') : []))} ${reactors.length === 1 ? 'reagiu' : 'reagiram'} a "${excerpt(p)}".`, avatar: avatarOfKey(ctx, reactors[0]), href, createdAt: p.reactedAt || p.createdAt });
      const comments = (p.comments || []).filter(c => c.authorKey !== ctx.myKey);
      if (comments.length) { const last = comments.at(-1); const authors = [...new Set(comments.map(c => c.authorKey))]; items.push({ id: `comment:${p.id}`, kind: 'comment', text: `${others(authors.slice(0, 2).map(nameOf).concat(authors.length > 2 ? Array(authors.length - 2).fill('') : []))} ${authors.length === 1 ? 'comentou' : 'comentaram'}: "${last.text.slice(0, 80)}"`, avatar: avatarOfKey(ctx, last.authorKey), href, createdAt: last.createdAt }); }
    } else {
      const mine = new Set((p.comments || []).filter(c => c.authorKey === ctx.myKey).map(c => c.id));
      const replies = (p.comments || []).filter(c => c.parentId && mine.has(c.parentId) && c.authorKey !== ctx.myKey);
      if (replies.length) { const last = replies.at(-1); items.push({ id: `reply:${p.id}`, kind: 'reply', text: `${nameOf(last.authorKey)} respondeu seu comentário: "${last.text.slice(0, 80)}"`, avatar: avatarOfKey(ctx, last.authorKey), href, createdAt: last.createdAt }); }
    }
  }
  const mine = ctx.accountsById.get(me.id);
  items.sort((a, b) => Number(!!b.actionable) - Number(!!a.actionable) || b.createdAt - a.createdAt);
  return items.filter(i => i.actionable || wantsNotice(mine, i.kind)).slice(0, 60).map(i => ({ ...i, unread: !!i.actionable || i.createdAt > seenAt }));
}
// Quem reagiu a uma publicação (ao tocar no número de reações), 40 por vez, com o vínculo de quem está vendo.
function reactorsView(state, me, params) {
  const post = state.posts.find(p => p.id === params.get('postId'));
  if (!post || !visible(post, me, state)) fail(404, 'Publicação não encontrada.');
  const ctx = feedContext(state, me);
  const all = Object.entries(post.reactions || {}).filter(([id, r]) => r && ctx.accountsById.has(id) && !isBlockedPair(state, ctx.myKey, `id:${id}`));
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const people = all.slice(offset, offset + 40).map(([id, reaction]) => {
    const acc = ctx.accountsById.get(id), key = `id:${id}`;
    return { key, name: acc.name, username: acc.username || '', avatar: personAvatar(acc), verified: !!acc.verified, reaction, me: id === me.id, following: ctx.followed.has(key), friendStatus: friendStatusOf(state, ctx.myKey, key) };
  });
  return { total: all.length, people, hasMore: offset + 40 < all.length };
}
function searchView(state, me, params) {
  const ctx = feedContext(state, me);
  const counts = socialCounts(state, me);
  const q = plain(params.get('q')).slice(0, 80);
  const exclude = params.get('excludeCommunity') ? new Set((state.communities || []).find(c => c.id === params.get('excludeCommunity'))?.members || []) : null;
  const people = q || exclude ? (state.accounts || []).filter(a => !isSuspended(a) && !isInactive(state, a.id) && !isBlockedPair(state, ctx.myKey, `id:${a.id}`) && accountMatches(a, q) && !(exclude && exclude.has(`id:${a.id}`)))
    .sort((a, b) => (counts.followers.get(`id:${b.id}`) || 0) - (counts.followers.get(`id:${a.id}`) || 0)).slice(0, 20).map(a => personFor(state, me, ctx, `id:${a.id}`, counts)).filter(Boolean) : [];
  const posts = q ? postsPage(state, me, new URLSearchParams({ q, limit: '30' }), ctx) : { posts: [], hasMore: false };
  return { people, posts: posts.posts, postsHasMore: posts.hasMore };
}
function profileView(state, me, params) {
  const ctx = feedContext(state, me);
  const key = String(params.get('key') || '');
  const person = /^(id:[a-f0-9-]{36}|name:.{1,80})$/.test(key) ? personFor(state, me, ctx, key, socialCounts(state, me)) : null;
  if (!person) fail(404, 'Pessoa não encontrada.');
  const page = postsPage(state, me, new URLSearchParams({ author: key, before: params.get('before') || '', beforeId: params.get('beforeId') || '' }), ctx);
  // Comunidades em que a pessoa participa (nome, categoria e nº de membros). Só aparecem as públicas e as que quem vê também integra
  // ou modera; perfil de pessoa bloqueada ou restrito a amizades já não chega até aqui.
  const myKey = `id:${me.id}`;
  const communities = !person.locked && key.startsWith('id:')
    ? ensureCommunities(state).filter(c => c.members.includes(key) && (c.visibility === 'public' || c.members.includes(myKey) || (c.admins || []).includes(myKey) || (c.moderators || []).includes(myKey)))
      .map(c => ({ id: c.id, name: c.name, category: c.category, visibility: c.visibility, membersCount: c.members.length })).sort((x, y) => y.membersCount - x.membersCount)
    : [];
  return { person, posts: page.posts, hasMore: page.hasMore, communities };
}
function snapshot(state, me) {
  const myKey = `id:${me.id}`;
  const ctx = feedContext(state, me);
  const communities = ctx.communities;
  const page = postsPage(state, me, new URLSearchParams(), ctx);
  const pick = sponsoredFor(state, me, new Set(page.posts.map(p => p.id)), p => visible(p, me, state));
  const tag = pick ? { boostId: pick.boostId, label: pick.label, test: pick.test } : null;
  const sponsored = pick && !pick.inPage ? { ...projectPost(pick.post, me, state, ctx), sponsored: tag } : null;
  const posts = page.posts;
  const directory = peopleFor(state, me, ctx, posts, socialCounts(state, me));
  const dms = (Array.isArray(state.dms) ? state.dms : []).filter(m => !m.toKey.startsWith('group:') && !m.hiddenFor?.includes(myKey) && (m.fromKey === myKey || m.toKey === myKey)).slice(-30).map(m => ({ id:m.id, fromKey:m.fromKey, fromName:m.fromName, toKey:m.toKey, text:m.deleted ? '' : m.text, createdAt:m.createdAt }));
  const saberes = Object.fromEntries(saberTracks.map(id => {
    const list = Array.isArray(state.saberes?.[id]) ? state.saberes[id] : [];
    return [id, { enrolled: list.includes(me.id), count: list.length }];
  }));
  const music = Object.fromEntries(musicTracks.map(id => {
    const list = Array.isArray(state.musicLikes?.[id]) ? state.musicLikes[id] : [];
    return [id, { liked: list.includes(me.id), count: list.length }];
  }));
  const submissions = (Array.isArray(state.submissions) ? state.submissions : [])
    .filter(s => s.audience !== 'private' || s.authorId === me.id)
    .map(s => ({
      id: s.id, module: s.module, protocol: s.protocol, category: s.category,
      community: s.community, title: s.title, details: s.details,
      audience: s.audience, author: s.author, own: s.authorId === me.id, createdAt: s.createdAt
    }));
  const etnia = (Array.isArray(state.etnia?.[me.id]) ? state.etnia[me.id] : []).map(item => ({
    role: item.role, text: item.text, sourceTitle: item.sourceTitle || '', revised: item.revised || '', at: item.createdAt
  }));
  // Stories seguem as mesmas regras de visibilidade do perfil (bloqueio, conta desativada, perfil só para amizades).
  const stories = (state.stories || []).filter(item => item.expiresAt > Date.now() && (!item.authorId || (profileAccess(state, me.id, item.authorId) === 'full' && canSeeStory(state, me.id, item.authorId)))).map(item => {
    const own = item.authorId === me.id, given = Object.values(item.reactions || {}), viewerIds = Object.keys(item.views || {});
    return { id: item.id, author: item.author, authorKey: item.authorId ? `id:${item.authorId}` : `name:${item.author}`, avatar: personAvatar(ctx.accountsById.get(item.authorId)), text: item.text, createdAt: item.createdAt, expiresAt: item.expiresAt, own, media: item.media ? { url: `/api/media?id=${item.media.id}`, kind: item.media.kind, name: item.media.name } : null,
      reactions: storyReactions.map(r => [r, given.filter(v => v === r).length]).filter(([, n]) => n), reaction: item.reactions?.[me.id] || '', canReply: !item.authorId || canReplyStory(state, me.id, item.authorId),
      // Quem viu só aparece para quem publicou.
      views: own ? viewerIds.length : 0, viewers: own ? viewerIds.slice(-10).reverse().map(id => ctx.accountsById.get(id)?.name).filter(Boolean) : [] };
  });
  const chatView = chatSnapshot(state, me);
  const unreadChatCount = (chatView.conversations || []).reduce((sum, c) => sum + (c.unread || 0), 0) + (chatView.invitations || []).length + (chatView.requests || []).length;
  const primaryGroup = communities.find(c => c.id === 'avaliacao-casa-opy');
  if (pick?.inPage) { const inPage = posts.find(p => p.id === pick.post.id); if (inPage) inPage.sponsored = tag; }
  const presence = presenceMap(new Set([myKey, ...posts.map(p => p.authorKey), ...(directory || []).map(d => d.key), ...(chatView.conversations || []).map(c => c.key)]), ctx.accountsById);
  return { presence, me: { ...me, availability: (ctx.accountsById.get(me.id)?.availability) || '', muted: state.mutes?.[myKey] || [] }, reactionSet: reactionSet(state), reactionAll: reactionConfig(state).map(r => ({ id: r.id, label: r.label, ...(r.mediaId ? { mediaId: r.mediaId } : {}) })), usernameInfo: usernameInfo((state.accounts || []).find(a => a.id === me.id) || {}, state), i18n: i18nFor(state, (state.accounts || []).find(a => a.id === me.id)), announcements: announcementsFor(state, me), posts, postsHasMore: page.hasMore, stories, dms, directory, communities, unreadChatCount, unreadNotifications: notificationItems(state, me, ctx).filter(i => i.unread).length, pushPublicKey: pushPublicKey(), liveEnabled: liveEnabled(), lives: liveNow(state, me), povos: povosOf(state), sponsored, group: { joined: primaryGroup ? primaryGroup.joined : !!state.interests[me.id], count: primaryGroup ? primaryGroup.membersCount : Object.values(state.interests).filter(Boolean).length }, saberes, music, submissions, etnia, iaraTickets: iaraTickets(state, me.id) };
}
function pdfAt(bytes) {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let index = bom;
  while (index < Math.min(bytes.length, bom + 8) && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[index])) index += 1;
  return bytes.subarray(index, index + 5).toString() === '%PDF-';
}
// Vídeo de celular passa fácil de 20 MB; o resto (fotos já reduzidas no aparelho, áudio, PDF) fica em 2 MB.
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_BODY_CHARS = Math.ceil(MAX_VIDEO_BYTES * 4 / 3) + 1024 * 1024;
function mediaInput(value) {
  if (!value) return null;
  if (typeof value.data !== 'string' || value.data.length > Math.ceil(MAX_VIDEO_BYTES * 4 / 3) + 200) fail(413, `Escolha um vídeo de até ${MAX_VIDEO_BYTES / 1048576} MB.`);
  const match = value.data.match(/^data:([^;,]+)?(?:;[^;,]*)*;base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) fail(400, 'Formato de arquivo não suportado.');
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES) fail(413, `Escolha um vídeo de até ${MAX_VIDEO_BYTES / 1048576} MB.`);
  const name = text(value.name || 'Anexo', 120).replace(/[\r\n"<>]/g, '');
  const ext = (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '').toLowerCase();
  let type = (match[1] || '').toLowerCase();
  const hex = bytes.subarray(0, 16).toString('hex');
  const zip = bytes.subarray(0, 2).toString() === 'PK';
  const ole = hex.startsWith('d0cf11e0a1b11ae1');
  const generic = type === '' || type === 'application/octet-stream' || type === 'application/x-pdf' || type === 'application/zip' || type === 'application/x-zip-compressed' || type === 'application/x-download';
  if (generic || (ext === 'pdf' && pdfAt(bytes)) || (ext === 'docx' && zip) || (ext === 'doc' && ole) || (ext === 'txt' && !bytes.includes(0))) {
    if (pdfAt(bytes)) type = 'application/pdf';
    else if (ext === 'txt' && !bytes.includes(0)) type = 'text/plain';
    else if (ext === 'docx' && zip) type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc' && ole) type = 'application/msword';
    else if (ext === 'png' && hex.startsWith('89504e470d0a1a0a')) type = 'image/png';
    else if ((ext === 'jpg' || ext === 'jpeg') && hex.startsWith('ffd8ff')) type = 'image/jpeg';
    else if (ext === 'gif' && bytes.subarray(0, 3).toString() === 'GIF') type = 'image/gif';
    else if (ext === 'webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') type = 'image/webp';
    else if ((ext === 'mp4' || ext === 'm4a' || ext === 'mov') && bytes.subarray(4, 8).toString() === 'ftyp') type = ext === 'm4a' ? 'audio/mp4' : 'video/mp4';
    else if (ext === 'webm' && hex.startsWith('1a45dfa3')) type = 'video/webm';
    else if (ext === 'mp3' && (bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224)) type = 'audio/mpeg';
  }
  if (type === 'video/quicktime') type = 'video/mp4'; // vídeo do iPhone (.mov): mesmo contêiner ISO, toca como MP4.
  const docx = type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const valid = type === 'image/png' ? hex.startsWith('89504e470d0a1a0a')
    : type === 'image/jpeg' ? hex.startsWith('ffd8ff')
    : type === 'image/gif' ? bytes.subarray(0, 3).toString() === 'GIF'
    : type === 'image/webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    : type === 'application/pdf' ? pdfAt(bytes)
    : type === 'text/plain' ? !bytes.includes(0)
    : docx ? zip && ext === 'docx'
    : type === 'application/msword' ? ole
    : type.endsWith('/webm') ? hex.startsWith('1a45dfa3')
    : type.endsWith('/ogg') ? bytes.subarray(0, 4).toString() === 'OggS'
    : type.endsWith('/mp4') ? bytes.subarray(4, 8).toString() === 'ftyp'
    : type === 'audio/mpeg' ? bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224 : false;
  if (!valid) fail(400, 'O conteúdo do arquivo não corresponde ao formato informado. Use foto, vídeo, áudio, PDF, TXT, DOC ou DOCX.');
  if (!type.startsWith('video/') && bytes.length > 2 * 1024 * 1024) {
    const mb = (bytes.length / 1048576).toFixed(1).replace('.', ',');
    fail(413, type.startsWith('image/') ? `A foto tem ${mb} MB e o limite é 2 MB. Escolha outra foto ou tire uma nova.`
      : type === 'application/pdf' ? `O PDF tem ${mb} MB e o limite é 2 MB. Comprima o PDF (há sites gratuitos para isso) ou envie só as páginas que importam.`
      : type.startsWith('audio/') ? `O áudio tem ${mb} MB e o limite é 2 MB. Grave um áudio mais curto (até 1 minuto) ou use o botão do microfone.`
      : `O arquivo tem ${mb} MB e o limite é 2 MB. Reduza o arquivo e tente de novo.`);
  }
  return { id: randomUUID(), bytes, type, kind: type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'file', name };
}
setLiveVisibility((post, me, state) => visible(post, me, state));
// Proxy WHEP (assistir): a sessão precisa existir, não estar revogada, e a pessoa precisa poder ver a live.
export async function canWatchLive(session, postId) {
  const state = (await readState()).data;
  const account = sessionAccount(state, session);
  const post = account && (state.posts || []).find(p => p.id === postId && p.live);
  return !!post && visible(post, member(account), state);
}
export { mediaInput, googleKeyOf, phoneOf };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let upload, fileUpload, posterUpload = null, photoUploads = [];
  try {
    const secret = sessionSecret();
    const pathname = new URL(req.url, 'http://local').pathname;
    // Webhook do MediaMTX, que só chega pela rede interna do Docker (pelo Caddy viria com X-Forwarded-For).
    if (pathname === '/api/live/auth') {
      if (req.method !== 'POST' || req.headers['x-forwarded-for']) fail(404, 'Não encontrado.');
      res.statusCode = liveAuth((await readState()).data, req.body) ? 200 : 401;
      return res.end();
    }
    const session = await verifySession(sessionCookie(req), secret);
    await slideSession(res, session, secret);
    if (session) touchPresence(session.accountId);
    // Telas públicas de entrada: o que o servidor oferece e se um @ está livre (com limite por endereço).
    if (req.method === 'GET' && pathname.replace(/\/$/, '') === '/api/community') {
      const sp = new URL(req.url, 'http://local').searchParams, view = sp.get('view');
      if (view === 'public' || view === 'username_available') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (view === 'public') return res.end(JSON.stringify({ recoveryAvailable: providerConfigured(), termsVersion: TERMS_VERSION }));
        const ip = clientIp(req);
        if (tooMany('ua:' + ip, 60, 60_000)) fail(429, 'Muitas verificações. Espere um instante.');
        note('ua:' + ip, 60_000);
        const check = usernameCheck((await readState()).data, null, sp.get('u'));
        return res.end(JSON.stringify({ ok: !!check.ok, reason: check.ok ? '' : check.reason }));
      }
    }
    if (req.method === 'GET' || (req.method === 'HEAD' && pathname.startsWith('/live/recordings/'))) {
      const state = (await readState()).data;
      const account = sessionAccount(state, session);
      if (!account) fail(401, 'Entre para ver o Etnias.');
      if (isSuspended(account)) fail(403, suspensionMessage(account));
      const me = member(account);
      lastSeen.set(me.id, Date.now());
      const path = new URL(req.url, 'http://local');
      if (pathname.startsWith('/live/recordings/')) {
        const post = state.posts.find(p => (p.media?.url === pathname || p.media?.parts?.includes(pathname)) && visible(p, me, state));
        const found = await recordingFile(post, pathname);
        if (!found) fail(404, 'Gravação não encontrada.');
        return sendFile(req, res, found.file, found.info, 'video/mp4');
      }
      if (path.searchParams.get('view') === 'i18n' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(i18nView(state, account)));
      }
      if (path.searchParams.get('view') === 'admin' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(adminView(state, account, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'area' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(areaView(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'saberes' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(saberesView(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'plans' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ ...plansView(state, account), finance: financeView(state, me) }));
      }
      if (path.searchParams.get('view') === 'account' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(accountView(state, account, session.id)));
      }
      if (path.searchParams.get('view') === 'chat' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(chatSnapshot(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'live' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(liveView(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'gcalls' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(groupCallsView(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'calls' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(callsView(state, me, path.searchParams)));
      }
      if (['posts', 'search', 'profile', 'notifications', 'reactors', 'link', 'username_check', 'geo', 'stickers', 'extras', 'pages', 'page'].includes(path.searchParams.get('view')) && path.pathname.replace(/\/$/, '') === '/api/community') {
        const view = path.searchParams.get('view');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (view === 'username_check') { if (!usernameCheckAllowed(me.id)) fail(429, 'Muitas verificações. Aguarde um minuto.'); const acc = (state.accounts || []).find(a => a.id === me.id); return res.end(JSON.stringify({ ...usernameCheck(state, acc, path.searchParams.get('u')), ...usernameInfo(acc, state) })); }
        if (view === 'geo') return res.end(JSON.stringify(await reverseGeocode(me.id, path.searchParams.get('lat'), path.searchParams.get('lon'))));
        if (view === 'pages') return res.end(JSON.stringify(pagesList(state, me, path.searchParams)));
        if (view === 'page') return res.end(JSON.stringify(pageView(state, me, String(path.searchParams.get('id') || ''))));
        if (view === 'stickers') return res.end(JSON.stringify(stickerCatalog(state, path.searchParams.get('all') === '1' && roleOf((state.accounts || []).find(a => a.id === me.id)) === 'admin')));
        if (view === 'extras') { const acc = (state.accounts || []).find(a => a.id === me.id); return res.end(JSON.stringify({ usernameInfo: usernameInfo(acc, state), location: acc.location || null, reactions: roleOf(acc) === 'admin' ? reactionConfig(state) : undefined })); }
        if (view === 'link') return res.end(JSON.stringify({ preview: await linkPreview(me.id, path.searchParams.get('url')) }));
        if (view === 'reactors') return res.end(JSON.stringify(reactorsView(state, me, path.searchParams)));
        if (view === 'notifications') return res.end(JSON.stringify({ items: notificationItems(state, me, feedContext(state, me)) }));
        return res.end(JSON.stringify(view === 'posts' ? postsPage(state, me, path.searchParams) : view === 'search' ? (searchBudget(me), searchView(state, me, path.searchParams)) : profileView(state, me, path.searchParams)));
      }
      if (path.pathname.replace(/\/$/, '') === '/api/link-image') {
        let image = null; try { image = await linkImage(path.searchParams.get('u')); } catch { image = null; }
        if (!image) fail(404, 'Imagem não encontrada.');
        res.setHeader('Content-Type', image.type); res.setHeader('Cache-Control', 'private, max-age=86400'); res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.end(image.buffer);
      }
      if (path.pathname.replace(/\/$/, '') === '/api/media') {
        const id = path.searchParams.get('id');
        const post = postsWithMedia(state, id).find(p => visible(p, me, state));
        // Story: só quem pode ver o perfil do autor (mesma regra do feed de stories).
        const story = (state.stories || []).find(item => item.expiresAt > Date.now() && item.media?.id === id && (!item.authorId || item.authorId === me.id || (profileAccess(state, me.id, item.authorId) === 'full' && canSeeStory(state, me.id, item.authorId))));
        // Foto de perfil e capa são visíveis para quem está na rede, como em qualquer rede social.
        const profileOwner = (state.accounts || []).find(a => a.avatarId === id || a.coverId === id);
        const named = (extrasMedia(state, id)) || pageMedia(state, id) || profileOwner ? { kind: 'image', name: 'perfil' } : ((post && findPostMedia(post, id)) || story?.media || chatMedia(state, me, id) || saberMedia(state, id) || marketMedia(state, me, id));
        if (!named || !/^[a-f0-9-]{36}$/.test(id || '')) fail(404, 'Anexo não encontrado.');
        const media = await readMedia(id);
        if (!media || media.statusCode !== 200) fail(404, 'Anexo não encontrado.');
        if (named.kind === 'file') res.setHeader('Content-Disposition', `attachment; filename="${named.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
        if (media.blob.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'none'");
        return sendBuffer(req, res, media.buffer || Buffer.from(await new Response(media.stream).arrayBuffer()), media.blob.contentType, id);
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(snapshot(state, me)));
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); fail(405, 'Operação não permitida.'); }
    const origin = req.headers.origin;
    let sameOrigin = false;
    try { const parsed = new URL(origin); sameOrigin = ['https:', 'http:'].includes(parsed.protocol) && parsed.host === req.headers.host; } catch (_) {}
    if (!sameOrigin) fail(403, 'Recarregue a página antes de enviar sua alteração.');
    const body = req.body;
    if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY_CHARS) fail(413, 'Conteúdo muito grande. Escolha um arquivo menor.');
    // Limite por pessoa em memória, antes de gravar mídia ou o banco (AUD-20): uma ação que falha também conta,
    // e um 429 não regrava nem invalida o estado. Ações frequentes por natureza (live, chamada) têm cota própria.
    if (session) {
      const frequent = ['live_watch', 'live_react', 'live_signal', 'boost_seen', 'gcall_beat', 'gcall_signal', 'chat_typing'].includes(body.action);
      const rateKey = `act:${session.accountId}${frequent ? ':f' : ''}`;
      if (tooMany(rateKey, frequent ? 240 : 30, 60_000)) fail(429, 'Você enviou muitas ações. Aguarde um minuto para continuar.');
      note(rateKey, 60_000);
    }
    if (body.action === 'logout') {
      if (session) await transact(state => {
        const account = sessionAccount(state, session);
        if (account) account.sessions = account.sessions.filter(item => item.id !== session.id);
      });
      res.setHeader('Set-Cookie', `opy_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie()}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end('{}');
    }
    // Recuperação de senha por código (sem sessão). Sempre responde igual, exista a conta ou não, para não revelar quem tem conta.
    if (body.action === 'recover_request' || body.action === 'recover_confirm') {
      const identity = loginIdentity(body.identity ?? body.username);
      const ip = clientIp(req), WIN = 3600e3;
      if (tooMany('rcip:' + ip, 20, WIN) || tooMany('rcid:' + identity, 8, WIN)) fail(429, 'Muitos pedidos. Tente de novo daqui a pouco.');
      note('rcip:' + ip, WIN); note('rcid:' + identity, WIN);
      const accountsNow = (await readState()).data.accounts || [];
      const found = findByIdentity(accountsNow, identity);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (body.action === 'recover_request') {
        if (providerConfigured() && found && eligibleForRecovery(found)) {
          let code = '';
          await transact(state => { const a = accountsOf(state).find(x => x.id === found.id); if (a && Date.now() - (a.codes?.recover?.sentAt || 0) >= 60e3) code = issueCode(a, 'recover', secret); });
          if (code) deliverCode({ ...contactOf(found), code, purpose: 'recover' }).catch(() => {});
        }
        return res.end(JSON.stringify({ ok: true, available: providerConfigured() }));
      }
      const newPassword = passwordOf(body.newPassword);
      const hashed = await hashPasswordAsync(newPassword);
      let outcome = 'none';
      if (found && eligibleForRecovery(found)) {
        await transact(state => {
          const a = accountsOf(state).find(x => x.id === found.id); if (!a) return;
          outcome = checkCode(a, 'recover', body.code, secret);
          if (outcome !== 'ok') return;
          a.password = hashed; delete a.legacyPassword; delete a.mustChangePassword; delete a.tempPasswordExpiresAt; a.sessions = []; a.contactVerified = true; a.passwordChangedAt = Date.now();
        });
      }
      if (outcome !== 'ok') fail(400, 'Código inválido ou vencido. Peça um código novo.');
      return res.end(JSON.stringify({ ok: true }));
    }
    if (body.action === 'register' || body.action === 'login') {
      const password = passwordOf(body.password);
      if (body.action === 'register') {
        const username = usernameOf(body.username);
        const name = personName(body.name);
        // Um só campo de contato (e-mail ou celular) basta; os campos antigos googleKey e phone seguem aceitos.
        const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
        let googleKey = '', phone = '';
        if (contact) { if (contact.includes('@')) googleKey = googleKeyOf(contact); else phone = phoneOf(contact); }
        if (body.googleKey) googleKey = googleKeyOf(body.googleKey);
        if (body.phone) phone = phoneOf(body.phone);
        if (!googleKey && !phone) fail(400, 'Informe um e-mail ou um celular. É por ele que você recupera a senha.');
        if (process.env.OPY_REQUIRE_CONSENT !== '0' && body.acceptTerms !== true) fail(400, 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.');
        // Contas em massa: no máximo N cadastros por hora por endereço (Caddy grava o IP real no fim de X-Forwarded-For).
        if (!registerAllowed(req)) fail(429, 'Muitos cadastros deste endereço. Tente de novo mais tarde.');
        const accountId = randomUUID();
        const passwordHash = await hashPasswordAsync(password);
        const issued = await createSession(accountId, secret);
        stampSession(issued.session, req.headers['user-agent']);
        const { data, result } = await transact(state => {
          const accounts = accountsOf(state);
          if (capacity('contas', accounts.length, Number(process.env.OPY_MAX_ACCOUNTS) || 100000)) fail(429, 'A rede chegou ao limite de contas deste servidor. Entre com uma conta já criada.');
          if (accounts.some(item => item.username === username)) fail(409, 'Esse usuário já existe. Entre ou escolha outro.');
          if (googleKey && accounts.some(item => item.googleKey === googleKey)) fail(409, 'Esse e-mail já tem conta. Entre, ou recupere a senha.');
          if (!usernameCheck(state, null, username).ok) fail(409, 'Esse usuário não está disponível. Escolha outro.');
          const account = { id: accountId, username, name, password: passwordHash, googleKey, phone, createdAt: Date.now() };
          markStaffUsername(state, username);
          recordConsent(account, 'terms', true, account.createdAt);
          addSession(account, issued.session);
          accounts.push(account);
          return account;
        });
        res.setHeader('Set-Cookie', cookieHeader(issued.token));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(snapshot(data, member(result))));
      }
      const identity = loginIdentity(body.username);
      const ip = clientIp(req);
      const ipKey = 'lgip:' + ip, pairKey = 'lgpar:' + identity + '|' + ip, idKey = 'lgid:' + identity;
      const WINDOW = 10 * 60 * 1000;
      // Limites em memória (não gravam no banco): por endereço, por conta+endereço e, mais folgado, só por conta
      // (quem trava a conta de outra pessoa a partir do próprio endereço não impede a pessoa de entrar do dela).
      if (tooMany(ipKey, 30, WINDOW) || tooMany(pairKey, 8, WINDOW) || tooMany(idKey, 80, WINDOW)) fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      const current = (await readState()).data;
      const accounts = Array.isArray(current.accounts) ? current.accounts : [];
      const account = findByIdentity(accounts, identity);
      // Tempo constante: sempre confere scrypt e bcrypt (contra valores falsos quando a conta não existe), para o tempo não revelar quem tem conta.
      const legacyHash = account && !account.password && typeof account.legacyPassword === 'string' ? account.legacyPassword : dummyBcrypt;
      const [scryptOk, bcryptOk] = await Promise.all([checkPasswordAsync(password, account?.password || dummyPassword), bcrypt.compare(password, legacyHash)]);
      const legacyOk = !!account && !account.password && legacyHash !== dummyBcrypt && bcryptOk;
      if (!account || !(legacyOk || (account.password && scryptOk))) {
        note(ipKey, WINDOW); note(pairKey, WINDOW); note(idKey, WINDOW);
        console.error(`AUTH_FALHA ip=${ip} conta=${createHash('sha256').update(identity).digest('hex').slice(0, 8)}`);
        fail(401, 'Usuário ou senha não conferem.');
      }
      if (account.mustChangePassword && account.tempPasswordExpiresAt && Date.now() > account.tempPasswordExpiresAt) fail(401, 'A senha provisória expirou. Peça outra à administração.');
      if (isSuspended(account)) fail(403, suspensionMessage(account));
      // Conta com exclusão pedida: entrar NÃO cancela sozinho. A senha já conferiu; a pessoa precisa confirmar que quer cancelar.
      if (account.deletionRequestedAt && body.cancelDeletion !== true) {
        throw Object.assign(new Error('Esta conta está marcada para exclusão definitiva. Para cancelar a exclusão e entrar, confirme.'), { status: 409, extra: { deletionPending: true, deletionDueAt: account.deletionDueAt || account.deletionRequestedAt + 30 * 864e5 } });
      }
      // Duas etapas: com a senha certa, pede o código do app (ou um código reserva). Erros contam no mesmo limite de tentativas.
      let totpStep = -1, backupLeft = null;
      if (account.totp?.enabledAt) {
        if (!body.code) throw Object.assign(new Error('Digite o código do app autenticador.'), { status: 401, extra: { needsCode: true } });
        totpStep = verifyCode(account.totp.secret, body.code, account.totp.lastStep ?? -1);
        if (totpStep < 0) backupLeft = useBackup(account.totp.backup, body.code);
        if (totpStep < 0 && !backupLeft) { note(ipKey, WINDOW); note(pairKey, WINDOW); note(idKey, WINDOW); throw Object.assign(new Error('Código incorreto.'), { status: 401, extra: { needsCode: true } }); }
      }
      const issued = await createSession(account.id, secret);
      stampSession(issued.session, req.headers['user-agent']);
      let newDevice = '';
      // Hash novo (custo atual) calculado antes da transação: contas do Etnias 1.0 migram do bcrypt; contas com scrypt antigo sobem de custo.
      const upgraded = legacyOk || needsRehash(account.password) ? await hashPasswordAsync(password) : null;
      const { data } = await transact(state => {
        const stored = accountsOf(state).find(item => item.id === account.id);
        if (!stored) fail(401, 'Entre novamente para continuar.');
        if (legacyOk) { stored.password = upgraded; delete stored.legacyPassword; }
        else if (stored.password?.hash !== account.password?.hash) fail(401, 'Entre novamente para continuar.');
        else if (upgraded) stored.password = upgraded;
        delete state.authFailures; // contadores antigos que ficavam gravados no banco
        if (stored.totp) { if (totpStep >= 0) stored.totp.lastStep = totpStep; else if (backupLeft) stored.totp.backup = backupLeft; }
        reactivateOnLogin(stored);
        // Acesso de aparelho novo: avisa no Maracá e no celular. Guarda só o rótulo (navegador · sistema), nunca o IP.
        const known = new Set([...(stored.knownDevices || []), ...(stored.sessions || []).map(x => x.device)].filter(Boolean));
        const device = issued.session.device;
        if (known.size && device && !known.has(device)) { stored.securityEvents = [...(stored.securityEvents || []), { at: Date.now(), device }].slice(-20); newDevice = device; }
        stored.knownDevices = [...new Set([...known, device].filter(Boolean))].slice(-20);
        addSession(stored, issued.session);
      });
      if (newDevice) sendPush({ readState, transact }, [account.id], { title: 'Novo acesso à sua conta', body: `Entraram pelo ${newDevice}. Se não foi você, troque a senha e saia do aparelho em Configurações.`, href: '/configuracoes/#seguranca', tag: 'acesso' }).catch(error => console.error('push:', error.message));
      clear(pairKey);
      res.setHeader('Set-Cookie', cookieHeader(issued.token));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(snapshot(data, member(account))));
    }
    const signedIn = sessionAccount((await readState()).data, session);
    if (!signedIn) fail(401, 'Entre para ver o Etnias.');
    if (isSuspended(signedIn)) fail(403, suspensionMessage(signedIn));
    // Senha provisória emitida pela administração: nada funciona até a pessoa trocá-la (a regra vale no servidor, não só na tela).
    if (signedIn.mustChangePassword && body.action !== 'password_change') fail(403, 'Troque a senha provisória para continuar.');
    let activeMe = member(signedIn);
    if (!chatActions.includes(body.action) && !extrasActions.includes(body.action) && !pageActions.includes(body.action) && !communityActions.includes(body.action) && !callActions.includes(body.action) && !groupCallActions.includes(body.action) && !adminActions.includes(body.action) && !i18nActions.includes(body.action) && !pushActions.includes(body.action) && !liveActions.includes(body.action) && !accountActions.includes(body.action) && !planActions.includes(body.action) && !boostActions.includes(body.action) && !saberesActions.includes(body.action) && !marketActions.includes(body.action) && !['announcement_dismiss', 'notifications_seen', 'password_change', 'publish', 'repost', 'react', 'comment', 'vote', 'save', 'delete', 'dm', 'join', 'follow', 'friend', 'friend_decline', 'profile_update', 'enroll_saber', 'like_music', 'module_submit', 'module_delete', 'etnia', 'iara_request', 'iara_cancel', 'story_create', 'story_delete', 'story_report', 'story_seen', 'story_react', 'story_reply', 'profile_media', 'comment_like', 'comment_delete', 'post_edit', 'post_report', 'availability_set'].includes(body.action)) fail(400, 'Ação desconhecida.');
    if (body.action === 'publish') {
      body.text = text(plainText(body.text || ''), 5000, false);
      if (!['public', 'friends', 'private'].includes(body.audience)) fail(400, 'Escolha quem pode ver a publicação.');
      if (body.feeling && !feelings.includes(body.feeling)) fail(400, 'Sentimento inválido.');
      if (body.poll && (!Array.isArray(body.poll) || body.poll.length < 2 || body.poll.length > 4 || body.poll.some(v => typeof v !== 'string' || !v.trim() || v.length > 100))) fail(400, 'Preencha de duas a quatro opções da enquete.');
      if (typeof body.location === 'string' && body.location.trim()) {
        body.location = text(body.location, 120).replace(/[\r\n]+/g, ' ');
        if (body.location.length < 2) fail(400, 'Escreva a localização com pelo menos 2 caracteres.');
      } else body.location = '';
      // Carrossel: até 10 fotos; a primeira vira o media da publicação (filtros, miniaturas e reposts seguem iguais).
      if (body.photos != null && (!Array.isArray(body.photos) || body.photos.length > 10)) fail(400, 'Escolha até 10 fotos por publicação.');
      if (body.photos?.length && (body.media || body.file)) fail(400, 'Uma publicação com várias fotos não leva vídeo nem arquivo.');
      if (!body.text?.trim() && !body.media && !body.file && !body.photos?.length) fail(400, 'Escreva o que fica visível para quem vê a publicação.');
      photoUploads = (body.photos || []).map(mediaInput);
      if (photoUploads.some(p => p?.kind !== 'image')) fail(400, 'No carrossel, todas precisam ser fotos PNG, JPG, GIF ou WebP.');
      upload = photoUploads[0] || mediaInput(body.media);
      // MOMENTOS: vídeo de até 4 minutos. Em MP4 a duração vem do próprio arquivo; a capa (primeiro quadro) é opcional.
      if (upload?.kind === 'video' && mp4Seconds(upload.bytes) > MAX_VIDEO_SECONDS + 1) fail(400, 'O vídeo passa de 4 minutos. Escolha um vídeo de até 4 minutos (240 segundos).');
      if (upload?.kind === 'video' && body.poster) {
        try { posterUpload = mediaInput(body.poster); } catch { posterUpload = null; }
        if (posterUpload && (posterUpload.kind !== 'image' || posterUpload.bytes.length > 400 * 1024)) posterUpload = null;
        if (posterUpload) await saveMedia(posterUpload.id, posterUpload.bytes, posterUpload.type);
      }
      for (const p of photoUploads.slice(1)) await saveMedia(p.id, p.bytes, p.type);
      fileUpload = mediaInput(body.file);
      if (fileUpload && fileUpload.kind !== 'file') fail(400, 'O arquivo precisa ser PDF, TXT, DOC ou DOCX.');
      if (upload?.kind === 'file' && fileUpload) fail(400, 'A publicação leva um único arquivo.');
      if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
      if (fileUpload) await saveMedia(fileUpload.id, fileUpload.bytes, fileUpload.type);
    }
    if (pageUploadActions.includes(body.action)) upload = await pagesPrepareUpload(body, signedIn, { mediaInput, saveMedia });
    if (extrasUploadActions.includes(body.action)) upload = await extrasPrepareUpload(body, signedIn, { mediaInput, saveMedia });
    if (body.action === 'comment' && body.media) {
      // COMENT-003: foto no comentário (o app já reduz a foto; aqui só imagem de até 2 MB).
      upload = mediaInput(body.media);
      if (!upload || upload.kind !== 'image') fail(400, 'No comentário, envie uma foto PNG, JPG, GIF ou WebP.');
      await saveMedia(upload.id, upload.bytes, upload.type);
    }
    if (body.action === 'dm') {
      upload = mediaInput(body.media);
      if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
    }
    if (body.action === 'profile_media') {
      if (!['avatar', 'cover'].includes(body.kind)) fail(400, 'Escolha foto de perfil ou capa.');
      if (body.media !== null) {
        upload = mediaInput(body.media);
        if (!upload || upload.kind !== 'image') fail(400, 'Escolha uma imagem PNG, JPG ou WebP de até 2 MB.');
        await saveMedia(upload.id, upload.bytes, upload.type);
      }
    }
    if (body.action === 'trilha_save' && body.cover) {
      upload = mediaInput(body.cover);
      if (upload.kind !== 'image') fail(400, 'A capa precisa ser uma foto PNG, JPG, GIF ou WebP.');
      await saveMedia(upload.id, upload.bytes, upload.type);
    }
    if (body.action === 'market_save') {
      if (body.photos != null && (!Array.isArray(body.photos) || body.photos.length > MAX_MARKET_PHOTOS)) fail(400, `Escolha até ${MAX_MARKET_PHOTOS} fotos por anúncio.`);
      photoUploads = (body.photos || []).map(mediaInput);
      if (photoUploads.some(p => p?.kind !== 'image')) fail(400, 'As fotos precisam ser PNG, JPG, GIF ou WebP.');
      for (const p of photoUploads) await saveMedia(p.id, p.bytes, p.type);
    }
    if (body.action === 'story_create') {
      body.text = text(body.text ?? '', 280, false);
      upload = mediaInput(body.media);
      if (upload && !['image', 'video'].includes(upload.kind)) fail(400, 'Escolha uma foto ou um vídeo para o story.');
      if (!body.text && !upload) fail(400, 'Escreva um texto ou escolha uma foto ou um vídeo.');
      if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
    }
    let removedIds = [], saberResult = null, marketResult = null, callResult = null, adminResult = null, pushNotice = null, mentionNotice = null, liveResult = null, accountResult = null, boostResult = null, followResult = null;
    const idOf = key => /^id:/.test(key || '') ? key.slice(3) : null;
    const { data } = await transact(state => {
      removedIds = [];
      const currentAccount = sessionAccount(state, session);
      if (!currentAccount) fail(401, 'Entre novamente para continuar.');
      const me = member(currentAccount);
      activeMe = me;
      if (state.limits) delete state.limits; // limite por minuto agora fica em memória (antes do transact)
      settleCalls(state);
      settleGroupCalls(state);
      settleLives(state);
      if (callActions.includes(body.action)) { callResult = callAction(state, me, body); return; }
      if (groupCallActions.includes(body.action)) { const r = groupCallAction(state, me, body); if (r.notify?.length) pushNotice = { to: r.notify, payload: r.push }; return; }
      if (liveActions.includes(body.action)) { liveResult = liveAction(state, me, body); if (liveResult.notify?.length) pushNotice = { to: liveResult.notify, payload: liveResult.push }; return; }
      if (adminActions.includes(body.action)) { adminResult = adminAction(state, currentAccount, body); if (adminResult.removedIds) removedIds.push(...adminResult.removedIds); return; }
      if (i18nActions.includes(body.action)) { i18nAction(state, currentAccount, body); return; }
      if (pushActions.includes(body.action)) { pushAction(state, me, body); return; }
      if (pageActions.includes(body.action)) { const r = pageAction(state, currentAccount, body, upload); if (r.removedIds) removedIds.push(...r.removedIds); return; }
      if (extrasActions.includes(body.action)) { const r = extrasAction(state, currentAccount, body, upload); if (r.removedIds) removedIds.push(...r.removedIds); activeMe = member(currentAccount); return; }
      if (accountActions.includes(body.action)) { accountResult = accountAction(state, currentAccount, body, session.id); activeMe = member(currentAccount); return; }
      if (planActions.includes(body.action)) { planAction(state, currentAccount, body); return; }
      if (boostActions.includes(body.action)) { boostResult = boostAction(state, me, currentAccount, body); return; }
      if (saberesActions.includes(body.action)) { saberResult = saberesAction(state, me, body, upload); removedIds.push(...saberResult.removedIds); return; }
      if (marketActions.includes(body.action)) { marketResult = marketAction(state, me, body, photoUploads); removedIds.push(...marketResult.removedIds); return; }
      if (body.action === 'announcement_dismiss') {
        if (!(state.announcements || []).some(a => a.id === body.id)) fail(404, 'Comunicado não encontrado.');
        state.announcementDismiss ||= {}; state.announcementDismiss[me.id] = [...new Set([...(state.announcementDismiss[me.id] || []), body.id])].slice(-100);
        return;
      }
      if (chatActions.includes(body.action)) {
        const result = chatAction(state, me, body, upload);
        if (result.removedId) removedIds.push(result.removedId);
        if (result.duplicate && upload) removedIds.push(upload.id);
        if (result.notify?.length) pushNotice = { to: result.notify, payload: result.push };
        return;
      }
      if (communityActions.includes(body.action)) {
        const result = communityAction(state, me, body);
        if (result.removedIds) removedIds.push(...result.removedIds);
        const changed = (state.communities || []).find(c => c.id === body.communityId);
        if (changed) syncCommunityChat(state, changed);
        return;
      }
      const post = state.posts.find(p => p.id === body.postId);
      if (['repost', 'react', 'comment', 'vote', 'save', 'delete', 'comment_like', 'comment_delete', 'post_edit', 'post_report'].includes(body.action) && (!post || !visible(post, me, state))) fail(404, 'Publicação não encontrada.');
      switch (body.action) {
        case 'profile_update': {
          const nextName = personName(body.name);
          const nextBio = text(String(body.bio ?? ''), 280, false);
          const nextAffiliation = text(String(body.affiliation ?? ''), 80, false);
          // Pronomes (ela/dela, ele/dele, elu/delu…): campo livre e opcional, mostrado no perfil.
          const nextPronouns = body.pronouns === undefined ? currentAccount.pronouns || '' : text(plainText(String(body.pronouns)).replace(/\s+/g, ' '), 30, false);
          // Pertencimento é autodeclarado e opcional; o povo só faz sentido para quem se declara indígena.
          if (body.belonging !== undefined && !['indigena', 'nao_indigena', ''].includes(body.belonging)) fail(400, 'Opção de pertencimento inválida.');
          const nextPovo = text(String(body.povo ?? ''), 80, false);
          // Povo e pertencimento são dados sensíveis (LGPD art. 11): só com consentimento específico, registrado e revogável.
          if (sensitiveChange(currentAccount, body.belonging, body.belonging === 'indigena' ? nextPovo : '')) {
            if (body.consentSensitive !== true && !currentAccount.consent?.sensitive) fail(400, 'Para informar seu povo ou pertencimento, marque o consentimento: são dados sensíveis e só aparecem se você quiser.');
            recordConsent(currentAccount, 'sensitive', true);
          }
          currentAccount.name = nextName;
          currentAccount.bio = nextBio;
          currentAccount.affiliation = nextAffiliation;
          currentAccount.pronouns = nextPronouns;
          if (body.belonging !== undefined) { currentAccount.belonging = body.belonging; currentAccount.povo = body.belonging === 'indigena' ? nextPovo : ''; }
          for (const p of state.posts || []) {
            if (p.authorId === me.id) p.author = nextName;
          }
          activeMe = member(currentAccount);
          break;
        }
        case 'profile_media': {
          const field = body.kind === 'avatar' ? 'avatarId' : 'coverId';
          if (currentAccount[field]) removedIds.push(currentAccount[field]);
          if (upload) currentAccount[field] = upload.id; else delete currentAccount[field];
          activeMe = member(currentAccount);
          break;
        }
        case 'story_create': {
          // shortcut: limpeza física ocorre ao criar outro story; usar coleta agendada em produção.
          removedIds = (state.stories || []).filter(item => item.expiresAt <= Date.now()).map(item => item.media?.id).filter(Boolean);
          state.stories = (state.stories || []).filter(item => item.expiresAt > Date.now());
          if (state.stories.filter(item => item.authorId === me.id).length >= 5) fail(409, 'Você já tem 5 stories ativos. Apague um ou espere um expirar (eles somem em 24 horas).');
          if (capacity('stories', state.stories.length, Number(process.env.OPY_MAX_STORIES) || 5000)) fail(409, 'O Etnias está com muitos stories agora. Tente de novo em instantes.');
          const createdAt = Date.now();
          state.stories.unshift({ id: randomUUID(), authorId: me.id, author: me.name, text: body.text, createdAt, expiresAt: createdAt + 86400000, ...(upload ? { media: { id: upload.id, kind: upload.kind, name: upload.name } } : {}) });
          break;
        }
        case 'story_delete': {
          const story = (state.stories || []).find(item => item.id === body.storyId && item.expiresAt > Date.now());
          if (!story) fail(404, 'Story não encontrado.');
          if (story.authorId !== me.id) fail(403, 'Somente quem criou pode excluir este story.');
          removedIds = [story.media?.id].filter(Boolean);
          state.stories = state.stories.filter(item => item.id !== story.id);
          break;
        }
        case 'story_seen': case 'story_react': case 'story_reply': case 'story_report': {
          const story = (state.stories || []).find(item => item.id === body.storyId && item.expiresAt > Date.now());
          if (!story || (story.authorId && (profileAccess(state, me.id, story.authorId) !== 'full' || !canSeeStory(state, me.id, story.authorId)))) fail(404, 'Story não encontrado.');
          if (['story_react', 'story_reply'].includes(body.action) && story.authorId && !canReplyStory(state, me.id, story.authorId)) fail(403, 'Quem publicou não recebe respostas neste story.');
          if (body.action === 'story_report') {
            if (story.authorId === me.id) fail(400, 'Você não pode denunciar o próprio story.');
            const reason = text(String(body.reason || 'Conteúdo impróprio'), 300, false);
            state.storyReports ||= [];
            if (state.storyReports.filter(r => r.authorKey === `id:${me.id}`).length >= 30) fail(409, 'Limite de denúncias atingido.');
            if (!state.storyReports.some(r => r.authorKey === `id:${me.id}` && r.storyId === story.id)) state.storyReports.push({ id: randomUUID(), authorKey: `id:${me.id}`, storyId: story.id, targetKey: `id:${story.authorId}`, excerpt: (story.text || (story.media ? 'Story com mídia' : '')).slice(0, 200), reason, createdAt: Date.now() });
            break;
          }
          if (body.action === 'story_seen') { if (story.authorId !== me.id) { story.views ||= {}; story.views[me.id] ||= Date.now(); } break; }
          if (story.authorId === me.id) fail(400, 'Reaja e responda aos stories de outras pessoas.');
          if (body.action === 'story_react') {
            if (body.reaction !== '' && !storyReactions.includes(body.reaction)) fail(400, 'Reação inválida.');
            story.reactions ||= {};
            if (!body.reaction || story.reactions[me.id] === body.reaction) delete story.reactions[me.id];
            else { story.reactions[me.id] = body.reaction; pushNotice = { to: [story.authorId], payload: { title: `${me.name} reagiu ao seu story`, body: `${body.reaction}${story.text ? ' ' + story.text.slice(0, 60) : ''}`, href: '/', tag: `story-${story.id}` } }; }
            break;
          }
          // A resposta vai como mensagem privada, com as mesmas regras do chat (solicitação quando ainda não há vínculo).
          const reply = text(body.text, 500);
          const result = chatAction(state, me, { action: 'dm', toKey: `id:${story.authorId}`, text: `📸 Sobre seu story${story.text ? ` "${story.text.slice(0, 60)}"` : ''}: ${reply}`, clientId: randomUUID() });
          if (result.notify?.length) pushNotice = { to: result.notify, payload: result.push };
          break;
        }
        case 'publish': {
          if (capacity('publicações', state.posts.length, Number(process.env.OPY_MAX_POSTS) || 500000)) fail(409, 'A rede atingiu o limite de publicações deste servidor. Remova uma publicação sua para continuar.');
          postBudget(state, me);
          let targetCommunity = null;
          if (typeof body.communityId === 'string' && body.communityId.trim()) {
            targetCommunity = canPostInCommunity(state, me, body.communityId.trim());
          }
          state.posts.unshift({ id: randomUUID(), authorId: me.id, author: me.name, text: body.text.trim(), origin: 'preview', createdAt: Date.now(), audience: targetCommunity ? 'public' : body.audience, communityId: targetCommunity?.id || '', communityName: targetCommunity?.name || '', feeling: body.feeling || '', location: body.location || '', reactions: {}, comments: [], saves: [], shares: 0, ...(typeof body.alt === 'string' && body.alt.trim() && ((upload && upload.kind === 'image') || photoUploads.length) ? { alt: body.alt.trim().slice(0, 300) } : {}), ...(upload ? { media: { id: upload.id, kind: upload.kind, name: upload.name, ...(posterUpload ? { posterId: posterUpload.id } : {}) } } : {}), ...(photoUploads.length > 1 ? { photos: photoUploads.map(u => ({ id: u.id, kind: u.kind, name: u.name })) } : {}), ...(fileUpload ? { file: { id: fileUpload.id, kind: fileUpload.kind, name: fileUpload.name } } : {}), ...(body.poll ? { poll: { options: body.poll.map(v => v.trim()), votes: {} } } : {}) });
          { const created = state.posts[0]; const ids = mentionsIn(state, created.text, me.id).filter(id => visible(created, { id }, state));
            if (ids.length) { created.mentions = ids; mentionNotice = { to: ids, payload: { title: `${me.name} mencionou você`, body: created.text.slice(0, 120), href: `/#post-${created.id}`, tag: `mention-${created.id}` } }; } }
          break;
        }
        case 'repost': {
          if (post.audience === 'private' || post.audience === 'friends' || (post.communityId && !canViewCommunityContent(state, null, post.communityId))) fail(400, 'Publicações privadas não podem ser repostadas.');
          if (capacity('publicações', state.posts.length, Number(process.env.OPY_MAX_POSTS) || 500000)) fail(409, 'A rede atingiu o limite de publicações deste servidor. Remova uma publicação sua para continuar.');
          postBudget(state, me);
          const note = text(body.text || '', 1000, false);
          const source = post.repostOf || {
            id: post.id, author: post.author, authorKey: authorKeyOf(post), createdAt: post.createdAt,
            text: post.text || '', image: post.image || '', avatar: archiveAvatar(post),
            media: post.media || null, file: post.file || null, ...(post.photos ? { photos: post.photos } : {}), location: post.location || ''
          };
          post.shares = (post.shares || 0) + 1;
          if (post.repostOf) {
            const root = state.posts.find(p => p.id === post.repostOf.id);
            if (root && root !== post) root.shares = (root.shares || 0) + 1;
          }
          state.posts.unshift({ id: randomUUID(), authorId: me.id, author: me.name, text: note, origin: 'preview', createdAt: Date.now(), audience: 'public', feeling: '', location: '', reactions: {}, comments: [], saves: [], shares: 0, repostOf: source });
          break;
        }
        case 'react':
          if (typeof body.reaction !== 'string' || !reactionAllowed(state, body.reaction, post.reactions[me.id])) fail(400, 'Reação inválida.');
          post.reactions[me.id] = body.reaction; if (body.reaction && post.authorId !== me.id) post.reactedAt = Date.now(); break;
        case 'notifications_seen':
          currentAccount.notificationsSeenAt = Date.now(); break;
        case 'password_change': {
          const next = passwordOf(body.next);
          if (!checkPassword(passwordOf(body.current), currentAccount.password || dummyPassword)) fail(403, 'A senha atual não confere.');
          if (next === body.current) fail(400, 'Escolha uma senha diferente da atual.');
          currentAccount.password = hashPassword(next); delete currentAccount.legacyPassword; delete currentAccount.mustChangePassword; delete currentAccount.tempPasswordExpiresAt;
          // Os outros aparelhos saem: só este continua, já com a senha nova.
          currentAccount.sessions = (currentAccount.sessions || []).filter(item => item.id === session.id);
          // Aviso de segurança (cadastro): notificação no Maracá e push nos aparelhos da pessoa.
          currentAccount.passwordChangedAt = Date.now();
          pushNotice = { to: [me.id], payload: { title: 'Sua senha foi alterada', body: 'Se não foi você, fale com a equipe Etnias agora.', href: '/configuracoes/', tag: 'senha' } };
          activeMe = member(currentAccount);
          break;
        }
        case 'comment':
          { const cc = post.communityId && (state.communities || []).find(x => x.id === post.communityId);
            if (cc?.commentsOff && !(cc.admins || []).includes(`id:${me.id}`) && !(cc.moderators || []).includes(`id:${me.id}`)) fail(403, 'Os comentários estão desligados nesta comunidade.'); }
          if (post.authorId && !canComment(state, me.id, post.authorId)) fail(403, 'Quem publicou limitou quem pode comentar.');
          if (post.comments.length >= 60) fail(409, 'Esta publicação atingiu o limite de comentários na homologação.');
          {
            // Respostas ficam em um nível só, presas ao comentário principal, como nas redes sociais.
            let parentId = '';
            if (body.replyTo) { const parent = post.comments.find(c => c.id === body.replyTo); if (!parent) fail(404, 'Comentário não encontrado.'); parentId = parent.parentId || parent.id; }
            const sticker = body.stickerId ? stickerById(state, String(body.stickerId)) : null;
            if (body.stickerId && !sticker) fail(404, 'Figurinha não encontrada.');
            const comment = { id: randomUUID(), author: me.name, authorKey: `id:${me.id}`, text: (sticker || upload) && !String(body.text || '').trim() ? '' : text(plainText(body.text), 500), createdAt: Date.now(), ...(upload ? { media: { id: upload.id, kind: 'image', type: upload.type, name: upload.name } } : {}), ...(sticker ? { sticker: { id: sticker.id, mediaId: sticker.mediaId, name: sticker.name } } : {}), ...(parentId ? { parentId } : {}) };
            post.comments.push(comment);
            const to = [post.authorId, idOf(post.comments.find(c => c.id === parentId)?.authorKey)].filter(id => id && id !== me.id);
            if (to.length) pushNotice = { to, payload: { title: `${me.name} comentou`, body: comment.text.slice(0, 120), href: `/#post-${post.id}`, tag: `post-${post.id}` } };
            const tagged = mentionsIn(state, comment.text, me.id).filter(id => visible(post, { id }, state));
            if (tagged.length) comment.mentions = tagged;
            const onlyTagged = tagged.filter(id => !to.includes(id));
            if (onlyTagged.length) mentionNotice = { to: onlyTagged, payload: { title: `${me.name} mencionou você`, body: comment.text.slice(0, 120), href: `/#post-${post.id}`, tag: `post-${post.id}` } };
          }
          break;
        case 'comment_like': {
          const c = post.comments.find(item => item.id === body.commentId); if (!c) fail(404, 'Comentário não encontrado.');
          const mine = `id:${me.id}`; c.likes = (c.likes || []).includes(mine) ? c.likes.filter(k => k !== mine) : [...(c.likes || []), mine];
          break;
        }
        case 'comment_delete': {
          const c = post.comments.find(item => item.id === body.commentId); if (!c) fail(404, 'Comentário não encontrado.');
          const staffComment = c.authorKey !== `id:${me.id}` && post.authorId !== me.id && roleOf(currentAccount);
          if (c.authorKey !== `id:${me.id}` && post.authorId !== me.id && !staffComment) fail(403, 'Só quem comentou ou quem publicou pode apagar.');
          if (staffComment) adminLog(state, currentAccount, 'Comentário excluído pela moderação', c.author, '', { postId: post.id, excerpt: c.text.slice(0, 280) });
          removedIds = post.comments.filter(item => item.id === c.id || item.parentId === c.id).map(item => item.media?.id).filter(Boolean);
          post.comments = post.comments.filter(item => item.id !== c.id && item.parentId !== c.id);
          break;
        }
        case 'availability_set':
          if (!AVAILABILITY.includes(body.availability)) fail(400, 'Escolha disponível, ocupado ou não incomodar.');
          if (body.availability) currentAccount.availability = body.availability; else delete currentAccount.availability;
          break;
        case 'post_report': {
          // Denúncia de publicação ou de comentário: vai para os alertas do Centro de gestão.
          const comment = body.commentId ? post.comments.find(c => c.id === body.commentId) : null;
          if (body.commentId && !comment) fail(404, 'Comentário não encontrado.');
          const targetKey = comment ? comment.authorKey : `id:${post.authorId}`;
          if (targetKey === `id:${me.id}`) fail(400, 'Você não pode denunciar o que você mesmo publicou.');
          state.postReports ||= [];
          const mine = state.postReports.filter(r => r.authorKey === `id:${me.id}`);
          if (mine.length >= 50) fail(409, 'Limite de denúncias atingido. A equipe já está analisando as anteriores.');
          if (!mine.some(r => r.postId === post.id && (r.commentId || '') === (comment?.id || ''))) state.postReports.push({ id: randomUUID(), authorKey: `id:${me.id}`, postId: post.id, commentId: comment?.id || '', targetKey, reason: text(String(body.reason || 'Conteúdo impróprio'), 300, false) || 'Conteúdo impróprio', excerpt: (comment ? comment.text : post.text || 'Publicação com mídia').slice(0, 280), createdAt: Date.now() });
          break;
        }
        case 'post_edit': {
          if (post.authorId !== me.id) fail(403, 'Só quem publicou pode editar.');
          const next = text(plainText(String(body.text ?? '')), 5000, false);
          if (!next && !post.media && !post.file && !post.repostOf) fail(400, 'A publicação não pode ficar vazia.');
          post.text = next; post.editedAt = Date.now();
          { const ids = mentionsIn(state, next, me.id).filter(id => visible(post, { id }, state)); if (ids.length) post.mentions = ids; else delete post.mentions; }
          break;
        }
        case 'vote':
          if (!post.poll || !Number.isInteger(body.option) || body.option < 0 || body.option >= post.poll.options.length) fail(400, 'Escolha uma opção válida.');
          post.poll.votes[me.id] = body.option; break;
        case 'save':
          post.saves = post.saves.includes(me.id) ? post.saves.filter(id => id !== me.id) : [...post.saves, me.id]; break;
        case 'delete': {
          // Quem publicou ou a equipe (administração/moderação, validado aqui no servidor); a ação da equipe fica no histórico.
          const staff = post.authorId !== me.id && roleOf(currentAccount);
          if (post.authorId !== me.id && !staff) fail(403, 'Somente quem publicou pode excluir esta publicação.');
          if (staff) adminLog(state, currentAccount, 'Publicação excluída pela moderação', post.author, text(String(body.reason || ''), 300, false), { postId: post.id, excerpt: (post.text || 'Publicação com mídia').slice(0, 280) });
          const remaining = state.posts.filter(p => p.id !== post.id);
          removedIds = orphanMediaIds(post, remaining);
          state.posts = remaining; break;
        }
        case 'join': {
          ensureCommunities(state);
          communityAction(state, me, { action: 'community_join', communityId: 'avaliacao-casa-opy' });
          break;
        }
        case 'follow': {
          const key = text(body.authorKey, 90);
          if (!/^(id:[a-f0-9-]{36}|name:.+)$/.test(key)) fail(400, 'Não foi possível seguir esta pessoa.');
          if (key === `id:${me.id}`) fail(400, 'Você já vê as próprias publicações em Notícias.');
          if (key.startsWith('id:') && profileAccess(state, me.id, key.slice(3)) === 'none') fail(403, 'Não é possível seguir esta pessoa.');
          state.follows ||= {};
          const list = Array.isArray(state.follows[me.id]) ? state.follows[me.id] : [];
          // O aparelho manda o estado que a pessoa quer (seguir ou deixar de seguir): repetir o pedido, por rede ruim, não desfaz o que ela fez.
          const want = typeof body.following === 'boolean' ? body.following : !list.includes(key);
          const was = list.includes(key);
          // Conta que aprova seguidores: vira pedido; tocar de novo cancela o pedido.
          if (!was && key.startsWith('id:') && followNeedsApproval(state, key.slice(3))) {
            state.followRequests ||= {};
            const pending = state.followRequests[key] || [];
            const mine = `id:${me.id}`, asked = pending.includes(mine);
            if (want && !asked && pending.length >= 500) fail(409, 'Esta pessoa tem muitos pedidos pendentes. Tente mais tarde.');
            state.followRequests[key] = want && !asked ? [...pending, mine] : pending.filter(k => k !== mine);
            if (want && !asked) pushNotice = { to: [key.slice(3)], payload: { title: 'Pedido para seguir', body: `${me.name} quer seguir você`, href: '/configuracoes/#seguidores', tag: `follow-req-${me.id}` } };
            followResult = { requested: want && !asked };
            break;
          }
          state.follows[me.id] = want ? (was ? list : [...list, key].slice(-2000)) : list.filter(item => item !== key);
          if (want && !was && key.startsWith('id:')) {
            state.followEvents = [...(state.followEvents || []), { from: me.id, to: key, at: Date.now() }].slice(-5000);
            pushNotice = { to: [key.slice(3)], payload: { title: 'Novo seguidor', body: `${me.name} começou a seguir você`, href: `/perfil/?u=id:${me.id}`, tag: `follow-${me.id}` } };
          }
          break;
        }
        case 'friend_decline': {
          // Recusar um pedido de amizade: some da lista de quem recebeu; quem pediu não é avisado.
          const key = text(body.authorKey, 90), myKey = `id:${me.id}`;
          const incoming = Array.isArray(state.friendRequests?.[myKey]) ? state.friendRequests[myKey] : [];
          if (!incoming.includes(key)) fail(404, 'Este pedido de amizade não existe mais.');
          state.friendRequests[myKey] = incoming.filter(k => k !== key);
          break;
        }
        case 'friend': {
          const key = text(body.authorKey, 90);
          const myKey = `id:${me.id}`;
          if (key === myKey) fail(400, 'Não foi possível atualizar esta amizade.');
          if (!/^id:[a-f0-9-]{36}$/.test(key) || !state.accounts?.some(a => `id:${a.id}` === key)) fail(404, 'Esta pessoa não tem conta nesta prévia.');
          if (profileAccess(state, me.id, key.slice(3)) === 'none') fail(403, 'Não é possível pedir amizade a esta pessoa.');
          state.friends ||= {};
          state.friendRequests ||= {};
          const myFriends = Array.isArray(state.friends[myKey]) ? state.friends[myKey] : [];
          const theirFriends = Array.isArray(state.friends[key]) ? state.friends[key] : [];
          const incoming = Array.isArray(state.friendRequests[myKey]) ? state.friendRequests[myKey] : [];
          const outgoing = Array.isArray(state.friendRequests[key]) ? state.friendRequests[key] : [];
          if (myFriends.includes(key)) {
            state.friends[myKey] = myFriends.filter(k => k !== key);
            state.friends[key] = theirFriends.filter(k => k !== myKey);
          } else if (incoming.includes(key)) {
            state.friendRequests[myKey] = incoming.filter(k => k !== key);
            if (!myFriends.includes(key)) state.friends[myKey] = [...myFriends, key].slice(-200);
            if (!theirFriends.includes(myKey)) state.friends[key] = [...theirFriends, myKey].slice(-200);
            pushNotice = { to: [key.slice(3)], payload: { title: 'Amizade aceita', body: `${me.name} aceitou sua amizade`, href: `/perfil/?u=${myKey}`, tag: `friend-${me.id}` } };
          } else if (outgoing.includes(myKey)) {
            state.friendRequests[key] = outgoing.filter(k => k !== myKey);
          } else {
            state.friendRequests[key] = [...outgoing, myKey].slice(-200);
            pushNotice = { to: [key.slice(3)], payload: { title: 'Pedido de amizade', body: `${me.name} pediu sua amizade`, href: '/notificacoes/', tag: `friend-${me.id}` } };
          }
          break;
        }
        case 'enroll_saber': {
          if (!saberTracks.includes(body.trackId)) fail(400, 'Trilha inválida.');
          state.saberes ||= {};
          const list = Array.isArray(state.saberes[body.trackId]) ? state.saberes[body.trackId] : [];
          state.saberes[body.trackId] = list.includes(me.id) ? list.filter(id => id !== me.id) : [...list, me.id];
          break;
        }
        case 'like_music': {
          if (!musicTracks.includes(body.trackId)) fail(400, 'Faixa inválida.');
          state.musicLikes ||= {};
          const list = Array.isArray(state.musicLikes[body.trackId]) ? state.musicLikes[body.trackId] : [];
          state.musicLikes[body.trackId] = list.includes(me.id) ? list.filter(id => id !== me.id) : [...list, me.id];
          break;
        }
        case 'module_submit': {
          if (!moduleNames.includes(body.module)) fail(400, 'Módulo inválido.');
          const audience = body.audience === 'private' ? 'private' : 'public';
          const category = text(body.category, 120);
          const community = text(body.community, 160);
          const title = text(body.title, 160);
          const details = text(body.details, 2000);
          state.submissions = Array.isArray(state.submissions) ? state.submissions : [];
          if (state.submissions.length >= 100) fail(409, 'Esta homologação atingiu o limite de registros. Seus registros anteriores foram preservados.');
          const id = randomUUID();
          const protocol = `OPY-${body.module.slice(0, 3).toUpperCase()}-${id.slice(0, 6).toUpperCase()}`;
          state.submissions.unshift({
            id, module: body.module, protocol, category, community, title, details,
            audience, authorId: me.id, author: me.name, createdAt: Date.now()
          });
          break;
        }
        case 'iara_request': createIaraTicket(state, me.id, body.text); break;
        case 'iara_cancel': cancelIaraTicket(state, me.id, body.ticketId); break;
        case 'etnia': {
          const question = text(body.text, 1000);
          if (!state.etnia || typeof state.etnia !== 'object' || Array.isArray(state.etnia)) state.etnia = {};
          const thread = Array.isArray(state.etnia[me.id]) ? state.etnia[me.id] : [];
          const earlier = [...thread].reverse().find(item => item.role === 'user')?.text || '';
          const answer = answerEtnia(question, earlier);
          const at = Date.now();
          thread.push({ role: 'user', text: question, createdAt: at });
          thread.push({ role: 'etnia', text: answer.text, sourceTitle: answer.sourceTitle, revised: answer.revised, createdAt: at + 1 });
          state.etnia[me.id] = thread.slice(-40);
          break;
        }
        case 'module_delete': {
          state.submissions = Array.isArray(state.submissions) ? state.submissions : [];
          const sub = state.submissions.find(s => s.id === body.submissionId);
          if (!sub || (sub.audience === 'private' && sub.authorId !== me.id)) fail(404, 'Registro não encontrado.');
          if (sub.authorId !== me.id) fail(403, 'Somente quem enviou pode remover este registro.');
          state.submissions = state.submissions.filter(s => s.id !== sub.id);
          break;
        }
      }
    });
    upload = null;
    fileUpload = null;
    photoUploads = [];
    // Entrega em segundo plano: a resposta não espera os serviços de push.
    // Respeita os avisos que cada pessoa desligou em Configurações.
    const wants = (notice, cat) => notice && { ...notice, to: notice.to.filter(id => wantsPush(data.accounts.find(a => a.id === id), notice.payload.tag, cat)) };
    for (const notice of [wants(pushNotice), wants(mentionNotice, 'mentions')]) if (notice?.to.length) sendPush({ readState, transact }, notice.to, notice.payload).catch(error => console.error('push:', error.message));
    // Gravação da live encerrada entra na publicação assim que o MediaMTX fecha o arquivo (ao parar, e nas escritas seguintes).
    if (body.action === 'live_stop') await attachRecordings({ readState, transact }).catch(error => console.error('live:', error.message));
    else attachRecordings({ readState, transact }).catch(error => console.error('live:', error.message));
    for (const id of removedIds) await deleteMedia(id).catch(() => {});
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Desativar ou pedir exclusão encerra todas as sessões, inclusive esta.
    if (accountResult?.deliver) deliverCode(accountResult.deliver).catch(() => {});
    if (accountResult?.exportData) { res.setHeader('Cache-Control', 'no-store'); return res.end(JSON.stringify({ export: accountResult.exportData })); }
    if (accountResult?.signOut) { res.setHeader('Set-Cookie', `opy_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie()}`); return res.end(JSON.stringify({ signedOut: true })); }
    if (boostResult?.silent) return res.end('{"ok":true}');
    if (planActions.includes(body.action) || boostActions.includes(body.action)) { const acc = data.accounts.find(a => a.id === activeMe.id); return res.end(JSON.stringify({ ...snapshot(data, activeMe), plans: { ...plansView(data, acc), finance: financeView(data, activeMe) } })); }
    if (accountActions.includes(body.action)) return res.end(JSON.stringify({ ...snapshot(data, activeMe), ...(accountResult?.totp ? { totp: accountResult.totp } : {}), account: accountView(data, data.accounts.find(a => a.id === activeMe.id), session.id) }));
    if (i18nActions.includes(body.action) && body.action !== 'set_locale') return res.end(JSON.stringify(i18nView(data, data.accounts.find(a => a.id === activeMe.id))));
    // A senha provisória só existe nesta resposta: não fica no estado nem no registro.
    if (adminActions.includes(body.action)) return res.end(JSON.stringify({ ...adminView(data, data.accounts.find(a => a.id === activeMe.id), new URL(req.url, 'http://local').searchParams), ...(adminResult?.temporaryPassword ? { temporaryPassword: adminResult.temporaryPassword } : {}) }));
    if (marketActions.includes(body.action)) return res.end(JSON.stringify(areaView(data, activeMe, new URLSearchParams({ type: 'mercado', id: marketResult.id }))));
    if (saberesActions.includes(body.action)) return res.end(JSON.stringify(saberesView(data, activeMe, new URLSearchParams({ id: saberResult.id }))));
    if (callActions.includes(body.action)) return res.end(JSON.stringify(callsView(data, activeMe, new URLSearchParams({ id: callResult?.callId || '' }))));
    if (groupCallActions.includes(body.action)) return res.end(JSON.stringify(groupCallsView(data, activeMe, new URLSearchParams({ since: String(Number(body.since) || 0) }))));
    if (body.chatView) return res.end(JSON.stringify(chatSnapshot(data, activeMe, new URLSearchParams({ key: body.viewKey || '' }))));
    if (liveResult?.silent) return res.end(JSON.stringify({ ok: true, live: { postId: liveResult.postId, guestToken: liveResult.guestToken || '' } }));
    const fresh = body.action === 'live_stop' ? (await readState()).data : data;
    const out = snapshot(fresh, activeMe);
    if (followResult) out.follow = followResult;
    if (liveResult) out.live = { postId: liveResult.postId, key: liveResult.key || '', guestToken: liveResult.guestToken || '' };
    // A publicação alterada pode estar fora da primeira página do feed: devolvê-la mantém a tela do cliente atualizada.
    const touched = typeof body.postId === 'string' ? fresh.posts.find(p => p.id === body.postId) : null;
    if (touched && visible(touched, activeMe, fresh)) out.touched = projectPost(touched, activeMe, fresh, feedContext(fresh, activeMe));
    return res.end(JSON.stringify(out));
  } catch (error) {
    if (upload) await deleteMedia(upload.id).catch(() => {});
    if (posterUpload) await deleteMedia(posterUpload.id).catch(() => {});
    if (fileUpload) await deleteMedia(fileUpload.id).catch(() => {});
    for (const p of photoUploads) if (p) await deleteMedia(p.id).catch(() => {});
    res.statusCode = error.status || 503;
    if (res.statusCode >= 500) console.error(`ERRO ${res.statusCode} ${req.method} ${String(req.url).split('?')[0]}: ${error.message}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: error.status ? error.message : 'Não foi possível acessar a comunidade agora. Sua edição foi preservada; tente novamente.', ...(error.extra || {}) }));
  }
}

// Eliminação definitiva das contas cujo prazo de carência (30 dias) venceu. Chamada de hora em hora pelo servidor.
export async function purgeDueAccounts(now = Date.now()) {
  const { data } = await readState();
  if ((data.accounts || []).some(a => a.deletionRequestedAt && !a.deletionDueAt)) {
    await transact(state => { for (const a of state.accounts || []) if (a.deletionRequestedAt && !a.deletionDueAt) a.deletionDueAt = now + 30 * 864e5; });
  }
  const due = (data.accounts || []).filter(a => dueForPurge(a, now)).map(a => a.id);
  if (!due.length) return { purged: 0 };
  let media = [], recordings = [];
  await transact(state => { for (const id of due) { const r = purgeAccount(state, id); media.push(...r.mediaIds); recordings.push(...r.recordingPostIds); } });
  for (const id of media) await deleteMedia(id).catch(() => {});
  // Gravações de live ficam em /recordings/<id da publicação>/ (volume do MediaMTX).
  if (process.env.OPY_LIVE_RECORDINGS_DIR) for (const id of recordings) await rm(join(process.env.OPY_LIVE_RECORDINGS_DIR, id), { recursive: true, force: true }).catch(() => {});
  console.error(`LGPD: ${due.length} conta(s) excluída(s) definitivamente, ${media.length} arquivo(s) de mídia removido(s)`);
  return { purged: due.length };
}
