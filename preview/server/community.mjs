import { randomUUID, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { readState, transact, saveMedia, readMedia, deleteMedia, archiveAvatar } from './store.mjs';
import { answerEtnia } from './etnia.mjs';
import { createIaraTicket, cancelIaraTicket, iaraTickets } from './iara.mjs';
import { createSession, verifySession, sessionCookie, sessionAccount, addSession } from './session.mjs';

import { chatActions, chatSnapshot, chatAction, chatMedia } from './chat.mjs';
import { callActions, callAction, callsView, settleCalls } from './calls.mjs';
import { adminActions, adminAction, adminView, announcementsFor, roleOf, isSuspended, suspensionMessage } from './admin.mjs';
import { i18nActions, i18nAction, i18nView, i18nFor } from './i18n.mjs';
import { communityActions, ensureCommunities, canViewCommunityContent, canPostInCommunity, projectCommunities, communityAction } from './communities.mjs';

const reactions = ['like', 'heart', 'laugh', 'wow', 'sad'];
const feelings = ['feliz', 'agradecido', 'pensativo', 'animado'];
const saberTracks = ['saberes-comunicacao', 'saberes-territorio', 'saberes-economia'];
const musicTracks = ['canto-alvorada', 'floresta-viva', 'memoria-dos-rios'];
const moduleNames = ['saberes', 'guardiao', 'fotografos', 'musica', 'doar'];
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function text(value, maximum, required = true) {
  if (typeof value !== 'string' || value.length > maximum || required && !value.trim()) fail(400, 'Confira o texto e o limite de caracteres.');
  return value.trim();
}
const dummyPassword = hashPassword('opy-preview-dummy-secret');
function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
function checkPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const actual = scryptSync(password, Buffer.from(stored.salt, 'hex'), 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(stored.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function sessionSecret() {
  const secret = process.env.OPY_SESSION_SECRET;
  if (!secret || secret.length < 32) fail(503, 'A comunidade está em preparação. Tente novamente em instantes.');
  return secret;
}
function cookieHeader(token) {
  return `opy_visitor=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.VERCEL ? '; Secure' : ''}`;
}
function accountsOf(state) {
  if (!Array.isArray(state.accounts)) state.accounts = [];
  return state.accounts;
}
function usernameOf(value) {
  const username = text(String(value || ''), 24).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,23}$/.test(username)) fail(400, 'Use um usuário de 3 a 24 caracteres: letras, números, ponto ou _.');
  return username;
}
function loginIdentity(value) {
  const identity = text(String(value || ''), 80).toLowerCase();
  if (!identity.includes('@')) return usernameOf(identity);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity)) fail(400, 'Informe o usuário ou o e-mail da conta Google.');
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) fail(400, 'Informe a chave Google: o e-mail da conta Google.');
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
  return { id: account.id, name: account.name, username: account.username, bio: account.bio || '', affiliation: account.affiliation || '', phone: account.phone || '', googleKey: account.googleKey || '',
    avatar: account.avatarUrl || profileUrl(account.avatarId), cover: account.coverUrl || profileUrl(account.coverId), joinedAt: account.createdAt || 0, verified: !!account.verified, role: roleOf(account) };
}
function authorKeyOf(post) {
  return post.authorId ? `id:${post.authorId}` : `name:${post.author}`;
}
function visible(post, me, state) {
  if (post.audience === 'private' && post.authorId !== me.id) return false;
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
const mapMedia = m => m ? { url: m.url || `/api/media?id=${m.id}`, kind: m.kind, name: m.name || '' } : null;
const personAvatar = acc => acc?.avatarUrl || profileUrl(acc?.avatarId);
// Contexto por requisição: tudo que a projeção de um post ou de uma pessoa precisa, calculado uma vez.
function feedContext(state, me) {
  const myKey = `id:${me.id}`;
  const communities = projectCommunities(state, me);
  return {
    myKey, communities,
    communityNames: new Map(communities.map(c => [c.id, c.name])),
    followed: new Set(Array.isArray(state.follows?.[me.id]) ? state.follows[me.id] : []),
    friends: new Set(state.friends?.[myKey] || []),
    accountsById: new Map((state.accounts || []).map(a => [a.id, a]))
  };
}
function projectPost(p, me, state, ctx) {
  const aKey = authorKeyOf(p);
  const author = ctx.accountsById.get(p.authorId);
  return {
    id: p.id, text: p.text, author: p.author, authorKey: aKey, following: ctx.followed.has(aKey), friendStatus: friendStatusOf(state, ctx.myKey, aKey),
    origin: p.origin || 'preview', createdAt: p.createdAt, image: p.image || '', images: Array.isArray(p.images) && p.images.length > 1 ? p.images : [],
    avatar: archiveAvatar(p) || personAvatar(author), verified: !!author?.verified, attachmentMissing: !!p.attachmentMissing,
    media: mapMedia(p.media), file: mapMedia(p.file), link: p.link || null, location: p.location || '',
    communityId: p.communityId || '', communityName: p.communityId ? (ctx.communityNames.get(p.communityId) || p.communityName || '') : '',
    audience: p.audience, feeling: p.feeling || '', own: p.authorId === me.id,
    shares: p.shares || 0,
    repostOf: p.repostOf ? { ...p.repostOf, media: mapMedia(p.repostOf.media), file: mapMedia(p.repostOf.file) } : null,
    reactions: Object.fromEntries(reactions.map(r => [r, Object.values(p.reactions || {}).filter(v => v === r).length])), reaction: p.reactions?.[me.id] || '',
    comments: (p.comments || []).map(c => ({ id: c.id, author: c.author, authorKey: c.authorKey, text: c.text, createdAt: c.createdAt, editedAt: c.editedAt || 0,
      parentId: c.parentId || '', likes: (c.likes || []).length, liked: (c.likes || []).includes(ctx.myKey), own: c.authorKey === ctx.myKey })),
    editedAt: p.editedAt || 0, saved: (p.saves || []).includes(me.id),
    poll: p.poll ? { options: p.poll.options, counts: p.poll.options.map((_, i) => Object.values(p.poll.votes).filter(v => v === i).length), voted: p.poll.votes[me.id] ?? null } : null
  };
}
function matchesKind(p, kind) {
  const isImage = x => x?.media?.kind === 'image' || !!x?.image;
  const isKind = (x, k) => x?.media?.kind === k;
  if (kind === 'photos') return isImage(p) || isImage(p.repostOf);
  if (kind === 'videos') return isKind(p, 'video') || isKind(p.repostOf, 'video');
  if (kind === 'audio') return isKind(p, 'audio') || isKind(p.repostOf, 'audio');
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
  const list = state.posts.filter(p => older(p) && visible(p, me, state) && postMatches(p, params, me, ctx))
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
function personFor(state, me, ctx, key, counts) {
  const base = { key, following: ctx.followed.has(key), friendStatus: friendStatusOf(state, ctx.myKey, key), followersCount: counts.followers.get(key) || 0, friendsCount: (state.friends?.[key] || []).length, postsCount: counts.posts.get(key) || 0 };
  if (key.startsWith('id:')) {
    const acc = ctx.accountsById.get(key.slice(3));
    if (!acc) return null;
    return { ...base, name: acc.name, username: acc.username || '', bio: acc.bio || '', affiliation: acc.affiliation || '', avatar: personAvatar(acc), cover: acc.coverUrl || profileUrl(acc.coverId), joinedAt: acc.createdAt || 0, verified: !!acc.verified, own: acc.id === me.id };
  }
  // Pessoa do acervo sem conta: só o nome e a foto que vieram com a publicação.
  const post = state.posts.find(p => authorKeyOf(p) === key && visible(p, me, state));
  return post ? { ...base, name: post.author, username: '', bio: '', affiliation: '', avatar: archiveAvatar(post), cover: '', joinedAt: 0, verified: false, own: false } : null;
}
function accountMatches(acc, q) { return !q || plain(`${acc.name} ${acc.username || ''} ${acc.affiliation || ''} ${acc.bio || ''}`).includes(q); }
// Pessoas que importam para quem está vendo: relações, autores da página e sugestões. O restante vem pela busca.
function peopleFor(state, me, ctx, pagePosts, counts) {
  const keys = new Set([ctx.myKey, ...ctx.friends, ...(state.friendRequests?.[ctx.myKey] || []), ...ctx.followed]);
  for (const [k, list] of Object.entries(state.friendRequests || {})) if (Array.isArray(list) && list.includes(ctx.myKey)) keys.add(k);
  for (const p of pagePosts) keys.add(p.authorKey);
  const suggestions = (state.accounts || []).filter(a => a.id !== me.id && !keys.has(`id:${a.id}`) && (a.avatarUrl || a.avatarId) && !isSuspended(a))
    .sort((a, b) => (counts.followers.get(`id:${b.id}`) || 0) - (counts.followers.get(`id:${a.id}`) || 0)).slice(0, 12);
  for (const a of suggestions) keys.add(`id:${a.id}`);
  return [...keys].map(key => personFor(state, me, ctx, key, counts)).filter(Boolean);
}
function searchView(state, me, params) {
  const ctx = feedContext(state, me);
  const counts = socialCounts(state, me);
  const q = plain(params.get('q')).slice(0, 80);
  const exclude = params.get('excludeCommunity') ? new Set((state.communities || []).find(c => c.id === params.get('excludeCommunity'))?.members || []) : null;
  const people = q || exclude ? (state.accounts || []).filter(a => !isSuspended(a) && accountMatches(a, q) && !(exclude && exclude.has(`id:${a.id}`)))
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
  return { person, posts: page.posts, hasMore: page.hasMore };
}
function snapshot(state, me) {
  const myKey = `id:${me.id}`;
  const ctx = feedContext(state, me);
  const communities = ctx.communities;
  const page = postsPage(state, me, new URLSearchParams(), ctx);
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
  const stories = (state.stories || []).filter(item => item.expiresAt > Date.now()).map(item => ({ id: item.id, author: item.author, authorKey: item.authorId ? `id:${item.authorId}` : `name:${item.author}`, avatar: personAvatar(ctx.accountsById.get(item.authorId)), text: item.text, createdAt: item.createdAt, expiresAt: item.expiresAt, own: item.authorId === me.id, media: item.media ? { url: `/api/media?id=${item.media.id}`, kind: item.media.kind, name: item.media.name } : null }));
  const chatView = chatSnapshot(state, me);
  const unreadChatCount = (chatView.conversations || []).reduce((sum, c) => sum + (c.unread || 0), 0) + (chatView.invitations || []).length + (chatView.requests || []).length;
  const primaryGroup = communities.find(c => c.id === 'avaliacao-casa-opy');
  return { me, i18n: i18nFor(state, (state.accounts || []).find(a => a.id === me.id)), announcements: announcementsFor(state, me), posts, postsHasMore: page.hasMore, stories, dms, directory, communities, unreadChatCount, group: { joined: primaryGroup ? primaryGroup.joined : !!state.interests[me.id], count: primaryGroup ? primaryGroup.membersCount : Object.values(state.interests).filter(Boolean).length }, saberes, music, submissions, etnia, iaraTickets: iaraTickets(state, me.id) };
}
function pdfAt(bytes) {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let index = bom;
  while (index < Math.min(bytes.length, bom + 8) && [0x20, 0x09, 0x0a, 0x0d].includes(bytes[index])) index += 1;
  return bytes.subarray(index, index + 5).toString() === '%PDF-';
}
function mediaInput(value) {
  if (!value) return null;
  if (typeof value.data !== 'string' || value.data.length > 3 * 1024 * 1024) fail(400, 'Formato de arquivo não suportado.');
  const match = value.data.match(/^data:([^;,]+)?(?:;[^;,]*)*;base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) fail(400, 'Formato de arquivo não suportado.');
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) fail(413, 'Escolha um arquivo de até 2 MB para a homologação.');
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
    else if ((ext === 'mp4' || ext === 'm4a') && bytes.subarray(4, 8).toString() === 'ftyp') type = ext === 'm4a' ? 'audio/mp4' : 'video/mp4';
    else if (ext === 'webm' && hex.startsWith('1a45dfa3')) type = 'video/webm';
    else if (ext === 'mp3' && (bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224)) type = 'audio/mpeg';
  }
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
  return { id: randomUUID(), bytes, type, kind: type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : 'file', name };
}
export { mediaInput, googleKeyOf, phoneOf };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let upload, fileUpload;
  try {
    const secret = sessionSecret();
    const session = await verifySession(sessionCookie(req), secret);
    if (req.method === 'GET') {
      const state = (await readState()).data;
      const account = sessionAccount(state, session);
      if (!account) fail(401, 'Entre para ver a Casa Opy.');
      if (isSuspended(account)) fail(403, suspensionMessage(account));
      const me = member(account);
      const path = new URL(req.url, 'http://local');
      if (path.searchParams.get('view') === 'i18n' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(i18nView(state, account)));
      }
      if (path.searchParams.get('view') === 'admin' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(adminView(state, account, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'chat' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(chatSnapshot(state, me, path.searchParams)));
      }
      if (path.searchParams.get('view') === 'calls' && path.pathname.replace(/\/$/, '') === '/api/community') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(callsView(state, me, path.searchParams)));
      }
      if (['posts', 'search', 'profile'].includes(path.searchParams.get('view')) && path.pathname.replace(/\/$/, '') === '/api/community') {
        const view = path.searchParams.get('view');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(view === 'posts' ? postsPage(state, me, path.searchParams) : view === 'search' ? searchView(state, me, path.searchParams) : profileView(state, me, path.searchParams)));
      }
      if (path.pathname.replace(/\/$/, '') === '/api/media') {
        const id = path.searchParams.get('id');
        const post = state.posts.find(p => visible(p, me, state) && (p.media?.id === id || p.file?.id === id || p.repostOf?.media?.id === id || p.repostOf?.file?.id === id));
        const story = (state.stories || []).find(item => item.expiresAt > Date.now() && item.media?.id === id);
        // Foto de perfil e capa são visíveis para quem está na rede, como em qualquer rede social.
        const profileOwner = (state.accounts || []).find(a => a.avatarId === id || a.coverId === id);
        const named = profileOwner ? { kind: 'image', name: 'perfil' } : ((post?.media?.id === id ? post.media : post?.file?.id === id ? post.file : post?.repostOf?.media?.id === id ? post.repostOf.media : post?.repostOf?.file) || story?.media || chatMedia(state, me, id));
        if (!named || !/^[a-f0-9-]{36}$/.test(id || '')) fail(404, 'Anexo não encontrado.');
        const media = await readMedia(id);
        if (!media || media.statusCode !== 200) fail(404, 'Anexo não encontrado.');
        res.setHeader('Content-Type', media.blob.contentType);
        if (named.kind === 'file') res.setHeader('Content-Disposition', `attachment; filename="${named.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
        return res.end(Buffer.from(await new Response(media.stream).arrayBuffer()));
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
    if (!body || typeof body !== 'object' || JSON.stringify(body).length > 4 * 1024 * 1024) fail(413, 'Conteúdo muito grande. Escolha um arquivo menor.');
    if (body.action === 'logout') {
      if (session) await transact(state => {
        const account = sessionAccount(state, session);
        if (account) account.sessions = account.sessions.filter(item => item.id !== session.id);
      });
      res.setHeader('Set-Cookie', `opy_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.VERCEL ? '; Secure' : ''}`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end('{}');
    }
    if (body.action === 'register' || body.action === 'login') {
      const password = passwordOf(body.password);
      if (body.action === 'register') {
        const username = usernameOf(body.username);
        const name = personName(body.name);
        const googleKey = googleKeyOf(body.googleKey);
        const phone = phoneOf(body.phone);
        const accountId = randomUUID();
        const issued = await createSession(accountId, secret);
        const { data, result } = await transact(state => {
          const accounts = accountsOf(state);
          if (accounts.length >= (Number(process.env.OPY_MAX_ACCOUNTS) || 20000)) fail(429, 'A rede chegou ao limite de contas deste servidor. Entre com uma conta já criada.');
          if (accounts.some(item => item.username === username)) fail(409, 'Esse usuário já existe. Entre ou escolha outro.');
          const account = { id: accountId, username, name, password: hashPassword(password), googleKey, phone, createdAt: Date.now() };
          addSession(account, issued.session);
          accounts.push(account);
          return account;
        });
        res.setHeader('Set-Cookie', cookieHeader(issued.token));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(snapshot(data, member(result))));
      }
      const identity = loginIdentity(body.username);
      const current = (await readState()).data;
      const accounts = Array.isArray(current.accounts) ? current.accounts : [];
      const slot = current.authFailures?.[identity];
      if (slot && slot.count >= 8 && Date.now() - slot.at < 10 * 60 * 1000) fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      const account = accounts.find(item => item.username === identity || item.googleKey === identity);
      // Contas do Etnias antigo chegam só com o bcrypt original; na primeira entrada a senha é conferida nele e migrada para o scrypt.
      const legacyOk = !!account && !account.password && typeof account.legacyPassword === 'string' && await bcrypt.compare(password, account.legacyPassword);
      if (!account || !(legacyOk || checkPassword(password, account.password || dummyPassword))) {
        await transact(state => {
          if (!state.authFailures) state.authFailures = {};
          const previous = state.authFailures[identity];
          const fresh = !previous || Date.now() - previous.at > 10 * 60 * 1000;
          state.authFailures[identity] = { count: fresh ? 1 : previous.count + 1, at: Date.now() };
        });
        fail(401, 'Usuário ou senha não conferem.');
      }
      if (isSuspended(account)) fail(403, suspensionMessage(account));
      const issued = await createSession(account.id, secret);
      const { data } = await transact(state => {
        const stored = accountsOf(state).find(item => item.id === account.id);
        if (!stored) fail(401, 'Entre novamente para continuar.');
        if (legacyOk) { stored.password = hashPassword(password); delete stored.legacyPassword; }
        else if (stored.password?.hash !== account.password?.hash) fail(401, 'Entre novamente para continuar.');
        if (state.authFailures) delete state.authFailures[identity];
        addSession(stored, issued.session);
      });
      res.setHeader('Set-Cookie', cookieHeader(issued.token));
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(snapshot(data, member(account))));
    }
    const signedIn = sessionAccount((await readState()).data, session);
    if (!signedIn) fail(401, 'Entre para ver a Casa Opy.');
    if (isSuspended(signedIn)) fail(403, suspensionMessage(signedIn));
    let activeMe = member(signedIn);
    if (!chatActions.includes(body.action) && !communityActions.includes(body.action) && !callActions.includes(body.action) && !adminActions.includes(body.action) && !i18nActions.includes(body.action) && !['announcement_dismiss', 'publish', 'repost', 'react', 'comment', 'vote', 'save', 'delete', 'dm', 'join', 'follow', 'friend', 'profile_update', 'enroll_saber', 'like_music', 'module_submit', 'module_delete', 'etnia', 'iara_request', 'iara_cancel', 'story_create', 'story_delete', 'profile_media', 'comment_like', 'comment_delete', 'post_edit'].includes(body.action)) fail(400, 'Ação desconhecida.');
    if (body.action === 'publish') {
      body.text = text(body.text || '', 5000, false);
      if (!['public', 'friends', 'private'].includes(body.audience)) fail(400, 'Escolha quem pode ver a publicação.');
      if (body.feeling && !feelings.includes(body.feeling)) fail(400, 'Sentimento inválido.');
      if (body.poll && (!Array.isArray(body.poll) || body.poll.length < 2 || body.poll.length > 4 || body.poll.some(v => typeof v !== 'string' || !v.trim() || v.length > 100))) fail(400, 'Preencha de duas a quatro opções da enquete.');
      if (typeof body.location === 'string' && body.location.trim()) {
        body.location = text(body.location, 120).replace(/[\r\n]+/g, ' ');
        if (body.location.length < 2) fail(400, 'Escreva a localização com pelo menos 2 caracteres.');
      } else body.location = '';
      if (!body.text?.trim() && !body.media && !body.file) fail(400, 'Escreva o que fica visível para quem vê a publicação.');
      upload = mediaInput(body.media);
      fileUpload = mediaInput(body.file);
      if (fileUpload && fileUpload.kind !== 'file') fail(400, 'O arquivo precisa ser PDF, TXT, DOC ou DOCX.');
      if (upload?.kind === 'file' && fileUpload) fail(400, 'A publicação leva um único arquivo.');
      if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
      if (fileUpload) await saveMedia(fileUpload.id, fileUpload.bytes, fileUpload.type);
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
    if (body.action === 'story_create') {
      body.text = text(body.text ?? '', 280, false);
      upload = mediaInput(body.media);
      if (upload && !['image', 'video'].includes(upload.kind)) fail(400, 'Escolha uma foto ou um vídeo para o story.');
      if (!body.text && !upload) fail(400, 'Escreva um texto ou escolha uma foto ou um vídeo.');
      if (upload) await saveMedia(upload.id, upload.bytes, upload.type);
    }
    let removedIds = [], callResult = null;
    const { data } = await transact(state => {
      removedIds = [];
      const currentAccount = sessionAccount(state, session);
      if (!currentAccount) fail(401, 'Entre novamente para continuar.');
      const me = member(currentAccount);
      activeMe = me;
      const minute = Math.floor(Date.now() / 60000);
      const limit = state.limits[me.id];
      if (limit?.minute === minute && limit.count >= 30) fail(429, 'Você enviou muitas ações. Aguarde um minuto para continuar.');
      state.limits[me.id] = { minute, count: limit?.minute === minute ? limit.count + 1 : 1 };
      for (const id of Object.keys(state.limits)) if (state.limits[id].minute < minute - 2) delete state.limits[id];
      settleCalls(state);
      if (callActions.includes(body.action)) { callResult = callAction(state, me, body); return; }
      if (adminActions.includes(body.action)) { const r = adminAction(state, currentAccount, body); if (r.removedIds) removedIds.push(...r.removedIds); return; }
      if (i18nActions.includes(body.action)) { i18nAction(state, currentAccount, body); return; }
      if (body.action === 'announcement_dismiss') {
        if (!(state.announcements || []).some(a => a.id === body.id)) fail(404, 'Comunicado não encontrado.');
        state.announcementDismiss ||= {}; state.announcementDismiss[me.id] = [...new Set([...(state.announcementDismiss[me.id] || []), body.id])].slice(-100);
        return;
      }
      if (chatActions.includes(body.action)) {
        const result = chatAction(state, me, body, upload);
        if (result.removedId) removedIds.push(result.removedId);
        if (result.duplicate && upload) removedIds.push(upload.id);
        return;
      }
      if (communityActions.includes(body.action)) {
        const result = communityAction(state, me, body);
        if (result.removedIds) removedIds.push(...result.removedIds);
        return;
      }
      const post = state.posts.find(p => p.id === body.postId);
      if (['repost', 'react', 'comment', 'vote', 'save', 'delete', 'comment_like', 'comment_delete', 'post_edit'].includes(body.action) && (!post || !visible(post, me, state))) fail(404, 'Publicação não encontrada.');
      switch (body.action) {
        case 'profile_update': {
          const nextName = personName(body.name);
          const nextBio = text(String(body.bio ?? ''), 280, false);
          const nextAffiliation = text(String(body.affiliation ?? ''), 80, false);
          currentAccount.name = nextName;
          currentAccount.bio = nextBio;
          currentAccount.affiliation = nextAffiliation;
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
          if (state.stories.length >= 100 || state.stories.filter(item => item.authorId === me.id).length >= 5) fail(409, 'Limite de stories ativos atingido nesta homologação.');
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
        case 'publish': {
          if (state.posts.filter(p => p.origin !== 'legacy').length >= (Number(process.env.OPY_MAX_POSTS) || 100000)) fail(409, 'A rede atingiu o limite de publicações deste servidor. Remova uma publicação sua para continuar.');
          let targetCommunity = null;
          if (typeof body.communityId === 'string' && body.communityId.trim()) {
            targetCommunity = canPostInCommunity(state, me, body.communityId.trim());
          }
          state.posts.unshift({ id: randomUUID(), authorId: me.id, author: me.name, text: body.text.trim(), origin: 'preview', createdAt: Date.now(), audience: targetCommunity ? 'public' : body.audience, communityId: targetCommunity?.id || '', communityName: targetCommunity?.name || '', feeling: body.feeling || '', location: body.location || '', reactions: {}, comments: [], saves: [], shares: 0, ...(upload ? { media: { id: upload.id, kind: upload.kind, name: upload.name } } : {}), ...(fileUpload ? { file: { id: fileUpload.id, kind: fileUpload.kind, name: fileUpload.name } } : {}), ...(body.poll ? { poll: { options: body.poll.map(v => v.trim()), votes: {} } } : {}) }); break;
        }
        case 'repost': {
          if (post.audience === 'private' || post.audience === 'friends' || (post.communityId && !canViewCommunityContent(state, null, post.communityId))) fail(400, 'Publicações privadas não podem ser repostadas.');
          if (state.posts.filter(p => p.origin !== 'legacy').length >= (Number(process.env.OPY_MAX_POSTS) || 100000)) fail(409, 'A rede atingiu o limite de publicações deste servidor. Remova uma publicação sua para continuar.');
          const note = text(body.text || '', 1000, false);
          const source = post.repostOf || {
            id: post.id, author: post.author, authorKey: authorKeyOf(post), createdAt: post.createdAt,
            text: post.text || '', image: post.image || '', avatar: archiveAvatar(post),
            media: post.media || null, file: post.file || null, location: post.location || ''
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
          if (!reactions.includes(body.reaction) && body.reaction !== '') fail(400, 'Reação inválida.');
          post.reactions[me.id] = body.reaction; break;
        case 'comment':
          if (post.comments.length >= 60) fail(409, 'Esta publicação atingiu o limite de comentários na homologação.');
          {
            // Respostas ficam em um nível só, presas ao comentário principal, como nas redes sociais.
            let parentId = '';
            if (body.replyTo) { const parent = post.comments.find(c => c.id === body.replyTo); if (!parent) fail(404, 'Comentário não encontrado.'); parentId = parent.parentId || parent.id; }
            post.comments.push({ id: randomUUID(), author: me.name, authorKey: `id:${me.id}`, text: text(body.text, 500), createdAt: Date.now(), ...(parentId ? { parentId } : {}) });
          }
          break;
        case 'comment_like': {
          const c = post.comments.find(item => item.id === body.commentId); if (!c) fail(404, 'Comentário não encontrado.');
          const mine = `id:${me.id}`; c.likes = (c.likes || []).includes(mine) ? c.likes.filter(k => k !== mine) : [...(c.likes || []), mine];
          break;
        }
        case 'comment_delete': {
          const c = post.comments.find(item => item.id === body.commentId); if (!c) fail(404, 'Comentário não encontrado.');
          if (c.authorKey !== `id:${me.id}` && post.authorId !== me.id) fail(403, 'Só quem comentou ou quem publicou pode apagar.');
          post.comments = post.comments.filter(item => item.id !== c.id && item.parentId !== c.id);
          break;
        }
        case 'post_edit': {
          if (post.authorId !== me.id) fail(403, 'Só quem publicou pode editar.');
          const next = text(String(body.text ?? ''), 5000, false);
          if (!next && !post.media && !post.file && !post.repostOf) fail(400, 'A publicação não pode ficar vazia.');
          post.text = next; post.editedAt = Date.now();
          break;
        }
        case 'vote':
          if (!post.poll || !Number.isInteger(body.option) || body.option < 0 || body.option >= post.poll.options.length) fail(400, 'Escolha uma opção válida.');
          post.poll.votes[me.id] = body.option; break;
        case 'save':
          post.saves = post.saves.includes(me.id) ? post.saves.filter(id => id !== me.id) : [...post.saves, me.id]; break;
        case 'delete': {
          if (post.authorId !== me.id) fail(403, 'Somente quem publicou pode excluir esta publicação.');
          const remaining = state.posts.filter(p => p.id !== post.id);
          removedIds = [post.media?.id, post.file?.id].filter(mid => mid && !remaining.some(p => p.media?.id === mid || p.file?.id === mid || p.repostOf?.media?.id === mid || p.repostOf?.file?.id === mid));
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
          state.follows ||= {};
          const list = Array.isArray(state.follows[me.id]) ? state.follows[me.id] : [];
          state.follows[me.id] = list.includes(key) ? list.filter(item => item !== key) : [...list, key].slice(-200);
          break;
        }
        case 'friend': {
          const key = text(body.authorKey, 90);
          const myKey = `id:${me.id}`;
          if (key === myKey) fail(400, 'Não foi possível atualizar esta amizade.');
          if (!/^id:[a-f0-9-]{36}$/.test(key) || !state.accounts?.some(a => `id:${a.id}` === key)) fail(404, 'Esta pessoa não tem conta nesta prévia.');
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
          } else if (outgoing.includes(myKey)) {
            state.friendRequests[key] = outgoing.filter(k => k !== myKey);
          } else {
            state.friendRequests[key] = [...outgoing, myKey].slice(-200);
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
    for (const id of removedIds) await deleteMedia(id).catch(() => {});
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (i18nActions.includes(body.action) && body.action !== 'set_locale') return res.end(JSON.stringify(i18nView(data, data.accounts.find(a => a.id === activeMe.id))));
    if (adminActions.includes(body.action)) return res.end(JSON.stringify(adminView(data, data.accounts.find(a => a.id === activeMe.id), new URLSearchParams())));
    if (callActions.includes(body.action)) return res.end(JSON.stringify(callsView(data, activeMe, new URLSearchParams({ id: callResult?.callId || '' }))));
    if (body.chatView) return res.end(JSON.stringify(chatSnapshot(data, activeMe, new URLSearchParams({ key: body.viewKey || '' }))));
    const out = snapshot(data, activeMe);
    // A publicação alterada pode estar fora da primeira página do feed: devolvê-la mantém a tela do cliente atualizada.
    const touched = typeof body.postId === 'string' ? data.posts.find(p => p.id === body.postId) : null;
    if (touched && visible(touched, activeMe, data)) out.touched = projectPost(touched, activeMe, data, feedContext(data, activeMe));
    return res.end(JSON.stringify(out));
  } catch (error) {
    if (upload) await deleteMedia(upload.id).catch(() => {});
    if (fileUpload) await deleteMedia(fileUpload.id).catch(() => {});
    res.statusCode = error.status || 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: error.status ? error.message : 'Não foi possível acessar a comunidade agora. Sua edição foi preservada; tente novamente.' }));
  }
}
