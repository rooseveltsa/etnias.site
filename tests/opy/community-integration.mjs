import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createSession, verifySession } from '../../preview/server/session.mjs';
import { triageIara } from '../../preview/server/iara.mjs';
import { initialState } from '../../preview/server/store.mjs';

// Exercise the real handler without any remote storage or recovered database.
let state = initialState();
const media = new Map();
globalThis.opyIntegrationStore = {
  readState: async () => ({ data: structuredClone(state) }),
  transact: async update => { const draft = structuredClone(state); const result = update(draft); state = draft; return { data: structuredClone(state), result }; },
  saveMedia: async (id, bytes, type) => media.set(id, { bytes, type }),
  readMedia: async id => { const value = media.get(id); return value && { statusCode: 200, stream: new Blob([value.bytes]).stream(), blob: { contentType: value.type } }; },
  deleteMedia: async id => media.delete(id),
  archiveAvatar: post => post.avatar || ''
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/preview/server/community.mjs') && specifier === './store.mjs') return { url: 'opy-test:store', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'opy-test:store') return { format: 'module', source: 'export const {readState,transact,saveMedia,readMedia,deleteMedia,archiveAvatar}=globalThis.opyIntegrationStore;', shortCircuit: true };
    return next(url, context);
  }
});
process.env.OPY_SESSION_SECRET = 'integration-test-secret-isolated-2026-only';
const { default: handler } = await import('../../preview/server/community.mjs');
const { default: middleware } = await import('../../preview/middleware.js');
const root = resolve('preview/dist/public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.replace(/\/$/, '').startsWith('/api/')) {
    if (req.method === 'POST') { let raw = ''; for await (const chunk of req) raw += chunk; try { req.body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{}'); } }
    return handler(req, res);
  }
  const request = new Request(url, { headers: req.headers });
  const gate = await middleware(request);
  if (gate) { res.writeHead(gate.status, Object.fromEntries(gate.headers)); return res.end(); }
  const file = resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404); return res.end(); }
  try { res.setHeader('Content-Type', types[extname(file)]); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
const port = Number(process.env.OPY_TEST_PORT || 8101);
const base = 'http://127.0.0.1:' + port;
async function api(body, cookie = '', origin = base) {
  const headers = {};
  const response = { statusCode: 200, setHeader: (name, value) => { headers[name.toLowerCase()] = value; }, end: value => { response.output = value; } };
  await handler({ method: body ? 'POST' : 'GET', url: '/api/community', headers: { cookie, origin, host: '127.0.0.1:' + port }, body }, response);
  return { status: response.statusCode, cookie: headers['set-cookie']?.split(';')[0] || '', data: JSON.parse(response.output) };
}
const profile = name => ({ action: 'register', username: name, name, password: 'Test-only-2026', googleKey: name + '@example.com', phone: '11912345678' });
async function getMedia(url, cookie = '') {
  const response = { statusCode: 200, setHeader() {}, end(value) { this.output = value; } };
  await handler({ method: 'GET', url, headers: { cookie } }, response);
  return response;
}
try {
  assert.equal((await api()).status, 401);
  const first = await api(profile('primeiro'));
  const second = await api(profile('segundo'));
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  const story = await api({ action: 'story_create', text: 'Olá, comunidade!' }, first.cookie);
  assert.equal(story.status, 200);
  assert.equal(story.data.stories[0].text, 'Olá, comunidade!');
  const storyId = story.data.stories[0].id;
  assert.equal((await api(null, second.cookie)).data.stories[0].own, false);
  assert.equal((await api({ action: 'story_delete', storyId }, second.cookie)).status, 403);
  state.stories[0].expiresAt = Date.now() - 1;
  assert.equal((await api(null, first.cookie)).data.stories.length, 0);
  assert.equal((await api({ action: 'story_create', text: '   ' }, first.cookie)).status, 400);
  const anotherStory = await api({ action: 'story_create', text: 'Outro story' }, first.cookie);
  assert.equal(anotherStory.data.stories.length, 1);
  assert.equal((await api({ action: 'story_delete', storyId: anotherStory.data.stories[0].id }, first.cookie)).data.stories.length, 0);
  const png = { name: 'story.png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=' };
  for (const invalid of [
    { name: 'arquivo.txt', data: 'data:text/plain;base64,b2xh' },
    { name: 'falsa.png', data: 'data:image/png;base64,b2xh' },
    { name: 'grande.png', data: 'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64') }
  ]) assert.ok((await api({ action: 'story_create', media: invalid }, first.cookie)).status >= 400);
  assert.equal(media.size, 0, 'Arquivos inválidos não devem ser armazenados');
  const photo = (await api({ action: 'story_create', media: png }, first.cookie)).data.stories[0];
  assert.equal(photo.media.kind, 'image');
  assert.equal((await getMedia(photo.media.url)).statusCode, 401);
  assert.deepEqual((await getMedia(photo.media.url, second.cookie)).output, Buffer.from(png.data.split(',')[1], 'base64'));
  assert.equal((await api({ action: 'story_delete', storyId: photo.id }, second.cookie)).status, 403);
  assert.equal(media.size, 1);
  state.stories[0].expiresAt = Date.now() - 1;
  assert.equal((await getMedia(photo.media.url, first.cookie)).statusCode, 404);
  const video = (await api({ action: 'story_create', text: 'Vídeo', media: { name: 'story.mp4', data: 'data:video/mp4;base64,' + Buffer.from('0000ftypisom').toString('base64') } }, first.cookie)).data.stories[0];
  assert.equal(video.media.kind, 'video');
  assert.equal(media.size, 1, 'Nova criação remove arquivo do story expirado');
  assert.equal((await getMedia(video.media.url, second.cookie)).statusCode, 200);
  await api({ action: 'story_delete', storyId: video.id }, first.cookie);
  assert.equal(media.size, 0);
  assert.equal((await getMedia(video.media.url, first.cookie)).statusCode, 404);
  state.stories = Array.from({ length: 5 }, (_, n) => ({ id: String(n), authorId: first.data.me.id, expiresAt: Date.now() + 86400000 }));
  assert.equal((await api({ action: 'story_create', media: png }, first.cookie)).status, 409);
  assert.equal(media.size, 0, 'Falha na transação remove o novo upload');
  state.stories = [];
  state.limits = {};
  assert.equal(JSON.stringify(first.data).includes('sessions'), false);
  const token = first.cookie.slice(12);
  const session = await verifySession(token, process.env.OPY_SESSION_SECRET);
  assert.ok(session);
  assert.equal(await verifySession(token, process.env.OPY_SESSION_SECRET, session.expiresAt), null);
  assert.equal(await verifySession(token + '0', process.env.OPY_SESSION_SECRET), null);
  const expired = await createSession(first.data.me.id, process.env.OPY_SESSION_SECRET, Date.now() - 8 * 86400000);
  assert.equal((await api(null, 'opy_visitor=' + expired.token)).status, 401);
  assert.equal((await middleware(new Request(base + '/iara/', { headers: { cookie: 'opy_visitor=' + expired.token } }))).status, 307);
  assert.equal(await middleware(new Request(base + '/iara/', { headers: { cookie: first.cookie } })), undefined);
  const request = { action: 'iara_request', text: 'Preciso de um card para divulgar o curso de letramento' };
  assert.equal((await api(request, first.cookie, 'https://evil.example')).status, 403);
  const created = await api(request, first.cookie);
  assert.equal(created.status, 200);
  const ticket = created.data.iaraTickets[0];
  assert.equal(ticket.sector, 'conteudo-estatico');
  assert.equal(ticket.status, 'aguardando_equipe');
  assert.equal((await api(request, first.cookie)).data.iaraTickets.length, 1);
  assert.deepEqual((await api(null, second.cookie)).data.iaraTickets, []);
  assert.equal((await api({ action: 'iara_cancel', ticketId: ticket.id }, second.cookie)).status, 404);
  assert.equal((await api({ action: 'iara_cancel', ticketId: ticket.id }, first.cookie)).data.iaraTickets[0].status, 'cancelado');
  for (const text of ['Crie um card com contato pessoa@example.com', 'Crie um card para contato (11) 91234-5678', 'Crie um card com um ritual de cura']) assert.equal((await api({ action: 'iara_request', text }, first.cookie)).status, 400);
  assert.equal(triageIara('preciso de ajuda para o projeto').sector, 'central-solicitacoes');
  assert.equal(triageIara('preciso de card e vídeo').sector, 'central-solicitacoes');
  for (let n = 0; n < 4; n++) assert.equal((await api({ action: 'iara_request', text: 'Preciso de um card número ' + n }, first.cookie)).status, 200);
  assert.equal((await api({ action: 'iara_request', text: 'Preciso de mais um card agora' }, first.cookie)).status, 429);
  state.submissions = Array.from({ length: 100 }, (_, n) => ({ id: String(n), authorId: first.data.me.id, audience: 'private' }));
  const before = structuredClone(state.submissions);
  const full = await api({ action: 'module_submit', module: 'guardiao', category: 'Teste', community: 'Equipe', title: 'Registro de teste', details: 'Detalhes de teste', audience: 'private' }, first.cookie);
  assert.equal(full.status, 409);
  assert.deepEqual(state.submissions, before);
  state.submissions = [];
  const login = await api({ action: 'login', username: 'primeiro', password: 'Test-only-2026' });
  assert.equal(login.status, 200);
  assert.notEqual(login.cookie, first.cookie);
  assert.equal((await api({ action: 'logout' }, first.cookie)).status, 200);
  assert.equal((await api(null, first.cookie)).status, 401);
  assert.equal((await api({ action: 'iara_request', text: 'Preciso de outro card' }, first.cookie)).status, 401);
  assert.equal((await api(null, login.cookie)).status, 200);
  assert.equal((await api(null, second.cookie)).status, 200);
  const pub = await api({ action: 'publish', text: 'Post original para repostar', audience: 'public' }, login.cookie);
  assert.equal(pub.status, 200);
  const origPost = pub.data.posts[0];
  const repostRes = await api({ action: 'repost', postId: origPost.id, text: 'Repostando na comunidade!' }, second.cookie);
  assert.equal(repostRes.status, 200);
  assert.equal(repostRes.data.posts[0].repostOf.id, origPost.id);
  assert.equal(repostRes.data.posts.find(p => p.id === origPost.id).shares, 1);
  const firstKey = 'id:' + login.data.me.id;
  const secondKey = 'id:' + second.data.me.id;
  const friendReq = await api({ action: 'friend', authorKey: firstKey }, second.cookie);
  assert.equal(friendReq.status, 200);
  assert.equal(friendReq.data.directory.find(d => d.key === firstKey).friendStatus, 'outgoing');
  const friendIncoming = await api(null, login.cookie);
  assert.equal(friendIncoming.data.directory.find(d => d.key === secondKey).friendStatus, 'incoming');
  const friendAccept = await api({ action: 'friend', authorKey: secondKey }, login.cookie);
  assert.equal(friendAccept.data.directory.find(d => d.key === secondKey).friendStatus, 'friends');
  const third = await api(profile('terceiro'));
  const dmSent = await api({ action: 'dm', toKey: firstKey, text: 'Oi no privado!' }, second.cookie);
  assert.equal(dmSent.status, 200);
  assert.equal(dmSent.data.dms.length, 1);
  assert.equal((await api(null, login.cookie)).data.dms.length, 1);
  assert.equal((await api(null, third.cookie)).data.dms.length, 0, 'Terceiro usuário não vê mensagem privada alheia');
  assert.equal((await api({ action: 'dm', toKey: 'name:Acervo', text: 'não pode' }, second.cookie)).status, 404);
  assert.equal((await api({action:'friend',authorKey:'name:Acervo'},second.cookie)).status,404);
  const privateFile = await api({ action:'dm', toKey:firstKey, text:'Anexo privado', media:png, clientId:crypto.randomUUID() },second.cookie);
  assert.equal(privateFile.status,200);
  const attachment = state.dms.at(-1).media;
  assert.equal((await getMedia('/api/media?id='+attachment.id,third.cookie)).statusCode,404);
  assert.equal((await getMedia('/api/media?id='+attachment.id,login.cookie)).statusCode,200);
  assert.equal((await api({action:'chat_delete',messageId:state.dms.at(-1).id,scope:'all'},login.cookie)).status,403);
  // Comentários em conversa, curtidas, permissões e edição de publicação
  assert.equal((await api({ action:'publish', text:'Post para comentários', audience:'public' }, login.cookie)).status, 200);
  const cPost = state.posts.find(p => p.text === 'Post para comentários');
  assert.equal((await api({ action:'comment', postId:cPost.id, text:'Comentário principal' }, second.cookie)).status, 200);
  const top = state.posts.find(p => p.id === cPost.id).comments.at(-1);
  assert.equal((await api({ action:'comment', postId:cPost.id, text:'Resposta', replyTo:top.id }, third.cookie)).status, 200);
  const reply = state.posts.find(p => p.id === cPost.id).comments.at(-1);
  assert.equal(reply.parentId, top.id);
  assert.equal((await api({ action:'comment', postId:cPost.id, text:'Resposta da resposta', replyTo:reply.id }, login.cookie)).status, 200);
  assert.equal(state.posts.find(p => p.id === cPost.id).comments.at(-1).parentId, top.id, 'resposta de resposta fica no mesmo nível');
  await api({ action:'comment_like', postId:cPost.id, commentId:top.id }, third.cookie);
  let seen = (await api(null, third.cookie)).data.posts.find(p => p.id === cPost.id).comments.find(c => c.id === top.id);
  assert.equal(seen.likes, 1); assert.equal(seen.liked, true); assert.equal('likesBy' in seen || Array.isArray(seen.likes), false, 'lista de quem curtiu não vaza');
  await api({ action:'comment_like', postId:cPost.id, commentId:top.id }, third.cookie);
  assert.equal((await api(null, third.cookie)).data.posts.find(p => p.id === cPost.id).comments.find(c => c.id === top.id).likes, 0);
  assert.equal((await api({ action:'comment_delete', postId:cPost.id, commentId:top.id }, third.cookie)).status, 403);
  assert.equal((await api({ action:'post_edit', postId:cPost.id, text:'invasão' }, second.cookie)).status, 403);
  assert.equal((await api({ action:'post_edit', postId:cPost.id, text:'Post corrigido' }, login.cookie)).status, 200);
  assert.ok(state.posts.find(p => p.id === cPost.id).editedAt > 0);
  assert.equal((await api({ action:'comment_delete', postId:cPost.id, commentId:top.id }, login.cookie)).status, 200);
  assert.equal(state.posts.find(p => p.id === cPost.id).comments.length, 0, 'apagar o principal leva as respostas');
  // Foto de perfil: envio, visibilidade na rede e remoção da anterior
  assert.equal((await api({ action:'profile_media', kind:'avatar', media:png }, login.cookie)).status, 200);
  const firstAvatar = (await api(null, login.cookie)).data.me.avatar;
  assert.match(firstAvatar, /^\/api\/media\?id=/);
  assert.equal((await getMedia(firstAvatar, third.cookie)).statusCode, 200);
  assert.equal((await api({ action:'profile_media', kind:'avatar', media:png }, login.cookie)).status, 200);
  assert.equal((await getMedia(firstAvatar, third.cookie)).statusCode, 404, 'foto anterior é apagada');
  assert.equal((await api({ action:'profile_media', kind:'banner', media:png }, login.cookie)).status, 400);
  console.log('PASS API: sessões com expiração/revogação, dispositivos independentes, CSRF, IAra privada, duplicação, limite, cancelamento, PII, repost, amizade, DM privada, comentários em conversa, edição de publicação, foto de perfil e preservação dos registros.');
  if (process.argv.includes('--serve')) { await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); }); console.log('Test server: ' + base); await new Promise(() => {}); }
} finally { server.close(); }
