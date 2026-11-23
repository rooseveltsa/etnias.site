import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
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
process.env.OPY_ADMIN_USERNAMES = 'gestao.teste';
const { default: handler } = await import('../../preview/server/community.mjs');
const host = '127.0.0.1:8199';
async function api(body, cookie = '') {
  const headers = {};
  const response = { statusCode: 200, setHeader: (name, value) => { headers[name.toLowerCase()] = value; }, end: value => { response.output = value; } };
  await handler({ method: body ? 'POST' : 'GET', url: '/api/community' + (body?.query || ''), headers: { cookie, origin: 'http://' + host, host }, body }, response);
  return { status: response.statusCode, cookie: headers['set-cookie']?.split(';')[0] || '', data: JSON.parse(response.output) };
}
const get = async (query, cookie) => { const response = { statusCode: 200, setHeader() {}, end(v) { this.output = v; } }; await handler({ method: 'GET', url: '/api/community?' + query, headers: { cookie, host } }, response); return JSON.parse(response.output); };
const profile = name => ({ acceptTerms: true, action: 'register', username: name, name, password: 'Test-only-2026', googleKey: name + '@example.com', phone: '11912345678' });
const ana = await api(profile('ana.tupi')), bia = await api(profile('bia_guarani')), caio = await api(profile('caio.terena'));
const anaKey = `id:${state.accounts.find(a => a.username === 'ana.tupi').id}`, biaKey = `id:${state.accounts.find(a => a.username === 'bia_guarani').id}`;
const post = (await api({ action: 'publish', text: 'post privado', audience: 'public' }, ana.cookie)).data.posts.find(p => p.text === 'post privado');
// bia é amizade da ana; caio não.
await api({ action: 'friend', authorKey: anaKey }, bia.cookie); await api({ action: 'friend', authorKey: biaKey }, ana.cookie);
assert.ok(state.friends[anaKey]?.includes(biaKey), 'amizade criada');

// Quem pode comentar
assert.equal((await api({ action: 'privacy_update', comments: 'friends' }, ana.cookie)).status, 200);
assert.equal((await api({ action: 'comment', postId: post.id, text: 'oi' }, caio.cookie)).status, 403);
assert.equal((await api({ action: 'comment', postId: post.id, text: 'oi' }, bia.cookie)).status, 200);
const seenByCaio = (await api({ action: 'react', postId: post.id, reaction: 'like' }, caio.cookie)).data.touched;
assert.equal(seenByCaio.commentsClosed, true);
assert.equal((await api({ action: 'privacy_update', comments: 'off' }, ana.cookie)).status, 200);
assert.equal((await api({ action: 'comment', postId: post.id, text: 'oi' }, bia.cookie)).status, 403);
assert.equal((await api({ action: 'privacy_update', comments: 'talvez' }, ana.cookie)).status, 400);

// Stories: quem vê e quem responde
await api({ action: 'story_create', text: 'story da ana' }, ana.cookie);
const storyId = state.stories[0].id;
assert.equal((await api({ action: 'privacy_update', stories: 'friends', storyReplies: 'off' }, ana.cookie)).status, 200);
assert.ok(!(await get('', caio.cookie)).stories.some(s => s.id === storyId), 'caio não vê');
const biaStory = (await get('', bia.cookie)).stories.find(s => s.id === storyId);
assert.ok(biaStory && biaStory.canReply === false, 'bia vê, sem responder');
assert.equal((await api({ action: 'story_reply', storyId, text: 'oi' }, bia.cookie)).status, 403);
assert.equal((await api({ action: 'story_seen', storyId }, caio.cookie)).status, 404);
assert.equal((await api({ action: 'story_seen', storyId }, bia.cookie)).status, 200);

// Aprovar seguidores
assert.equal((await api({ action: 'privacy_update', follows: 'approve' }, ana.cookie)).status, 200);
const asked = await api({ action: 'follow', authorKey: anaKey, following: true }, caio.cookie);
assert.deepEqual(asked.data.follow, { requested: true });
assert.ok(!(state.follows[state.accounts.find(a => a.username === 'caio.terena').id] || []).includes(anaKey), 'ainda não segue');
const caioKey = `id:${state.accounts.find(a => a.username === 'caio.terena').id}`;
const view = (await api({ action: 'privacy_update' }, ana.cookie)).data.account;
assert.equal(view.followRequests[0].key, caioKey);
assert.equal((await api({ action: 'follow_request_accept', key: caioKey }, ana.cookie)).status, 200);
assert.ok(state.follows[caioKey.slice(3)].includes(anaKey), 'segue após aceitar');
// Recusar: some sem seguir; repetir pedido cancela.
await api({ action: 'follow', authorKey: anaKey, following: true }, bia.cookie);
assert.equal((await api({ action: 'follow_request_decline', key: biaKey }, ana.cookie)).status, 200);
assert.ok(!(state.follows[biaKey.slice(3)] || []).includes(anaKey));
await api({ action: 'follow', authorKey: anaKey, following: true }, bia.cookie);
assert.deepEqual((await api({ action: 'follow', authorKey: anaKey, following: true }, bia.cookie)).data.follow, { requested: false });
// Abrir os seguidores aprova quem estava esperando.
await api({ action: 'follow', authorKey: anaKey, following: true }, bia.cookie);
await api({ action: 'privacy_update', follows: 'open' }, ana.cookie);
assert.ok(state.follows[biaKey.slice(3)].includes(anaKey));
// Filtros do feed: Rápidas (só texto) e Ao vivo.
await api({ action: 'publish', text: 'texto curto', audience: 'public' }, caio.cookie);
await api({ action: 'publish', text: 'com enquete', audience: 'public', poll: ['a', 'b'] }, caio.cookie);
const rapidas = (await get('view=posts&kind=text', caio.cookie)).posts.map(p => p.text);
assert.ok(rapidas.includes('texto curto') && !rapidas.includes('com enquete'), 'rápidas = só texto');
assert.equal((await get('view=posts&kind=live', caio.cookie)).posts.length, 0);
// Avisos: desligar comentários tira o item do Maracá; opção inválida é recusada.
await api({ action: 'privacy_update', comments: 'everyone' }, ana.cookie);
await api({ action: 'comment', postId: post.id, text: 'novo comentário' }, caio.cookie);
const kindsOf = async () => (await get('view=notifications', ana.cookie)).items.map(i => i.kind);
assert.ok((await kindsOf()).includes('comment'));
assert.equal((await api({ action: 'notify_prefs', prefs: { comments: false } }, ana.cookie)).status, 200);
assert.ok(!(await kindsOf()).includes('comment'));
assert.equal((await api({ action: 'notify_prefs', prefs: { spam: true } }, ana.cookie)).status, 400);
const { wantsPush } = await import('../../preview/server/account.mjs');
assert.equal(wantsPush({ notifyPrefs: { comments: false } }, 'post-1'), false);
assert.equal(wantsPush({ notifyPrefs: { comments: false } }, 'senha'), true);
assert.equal(wantsPush({ notifyPrefs: { mentions: false } }, 'post-1', 'mentions'), false);
// Acesso de aparelho novo vira aviso de segurança; o mesmo aparelho não.
async function login(ua) { const headers = {}; const response = { statusCode: 200, setHeader: (n, v) => { headers[n.toLowerCase()] = v; }, end: v => { response.output = v; } };
  await handler({ method: 'POST', url: '/api/community', headers: { origin: 'http://' + host, host, 'user-agent': ua }, body: { action: 'login', username: 'caio.terena', password: 'Test-only-2026' } }, response); return headers['set-cookie']?.split(';')[0] || ''; }
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
await login(mac); const before = state.accounts.find(a => a.username === 'caio.terena').securityEvents?.length || 0;
const c2 = await login(mac);
assert.equal(state.accounts.find(a => a.username === 'caio.terena').securityEvents?.length || 0, before, 'mesmo aparelho não alerta');
await login('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Firefox/130.0');
assert.equal(state.accounts.find(a => a.username === 'caio.terena').securityEvents.length, before + 1);
assert.ok((await get('view=notifications', c2)).items.some(i => i.id.startsWith('access:') && i.text.includes('Android')));
// Duas etapas: liga com o código do app, login passa a pedir código, código reserva vale uma vez, desliga com senha + código.
const { codeAt } = await import('../../preview/server/totp.mjs');
const now = () => codeAt(state.accounts.find(a => a.username === 'caio.terena').totp?.secret || state.accounts.find(a => a.username === 'caio.terena').totpPending.secret, Math.floor(Date.now() / 30000));
const setup = (await api({ action: 'totp_setup' }, c2)).data.totp;
assert.ok(setup.secret && setup.uri.startsWith('otpauth://totp/'));
assert.equal((await api({ action: 'totp_enable', code: '000000' === now() ? '111111' : '000000' }, c2)).status, 400);
const enabled = (await api({ action: 'totp_enable', code: now() }, c2)).data;
assert.equal(enabled.totp.backupCodes.length, 8);
assert.ok(!JSON.stringify(enabled).includes(setup.secret), 'chave não volta depois de ligar');
async function login2(extra) { const response = { statusCode: 200, setHeader() {}, end(v) { this.output = v; } };
  await handler({ method: 'POST', url: '/api/community', headers: { origin: 'http://' + host, host, 'user-agent': mac }, body: { action: 'login', username: 'caio.terena', password: 'Test-only-2026', ...extra } }, response); return { status: response.statusCode, data: JSON.parse(response.output) }; }
const noCode = await login2({});
assert.equal(noCode.status, 401); assert.equal(noCode.data.needsCode, true);
assert.equal((await login2({ code: enabled.totp.backupCodes[0] })).status, 200);
assert.equal((await login2({ code: enabled.totp.backupCodes[0] })).status, 401, 'reserva vale uma vez');
assert.equal((await login2({ code: now() })).status, 401, 'código usado ao ligar não entra de novo');
const next = codeAt(state.accounts.find(a => a.username === 'caio.terena').totp.secret, Math.floor(Date.now() / 30000) + 1);
assert.equal((await login2({ code: next })).status, 200, 'código da janela seguinte (relógio adiantado) entra');
assert.equal((await login2({ code: next })).status, 401, 'mesmo código não entra duas vezes');
assert.equal((await api({ action: 'totp_disable', password: 'errada', code: now() }, c2)).status, 403);
console.log('PASS privacidade: comentários, stories (ver/responder), aprovar seguidores.');
