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
const ana = await api(profile('ana.tupi')), caio = await api(profile('caio.terena'));
// Página da Ana; Caio não administra.
assert.equal((await api({ action: 'page_create', name: 'Coletivo Raízes' }, ana.cookie)).status, 200);
const pageId = state.pages[0].id;
const snap = await get('', ana.cookie);
assert.deepEqual(snap.myPages, [{ id: pageId, name: 'Coletivo Raízes' }], 'Ana pode publicar como a Página');
assert.equal((await get('', caio.cookie)).myPages.length, 0);
assert.equal((await api({ action: 'publish', text: 'Caio tenta', audience: 'public', pageId }, caio.cookie)).status, 403, 'quem não administra não publica pela Página');
// Perfil fechado da Ana não esconde o que a Página publica.
await api({ action: 'privacy_update', profile: 'friends' }, ana.cookie);
const out = await api({ action: 'publish', text: 'Oficina sábado', audience: 'private', pageId }, ana.cookie);
assert.equal(out.status, 200);
assert.equal(state.posts[0].pageId, pageId); assert.equal(state.posts[0].audience, 'public', 'publicação da Página é sempre pública');
const seen = (await get('view=posts&page=' + pageId, caio.cookie)).posts;
assert.equal(seen.length, 1); assert.equal(seen[0].page.name, 'Coletivo Raízes');
const anaKey = `id:${state.accounts.find(a => a.username === 'ana.tupi').id}`;
assert.equal((await get('view=posts&author=' + encodeURIComponent(anaKey), ana.cookie)).posts.length, 0, 'não entra no perfil pessoal');
// Página suspensa: some para os outros.
state.pages[0].suspended = { reason: 'teste', at: 1 };
assert.equal((await get('view=posts&page=' + pageId, caio.cookie)).posts.length, 0);
assert.equal((await api({ action: 'publish', text: 'de novo', audience: 'public', pageId }, ana.cookie)).status, 403);
console.log('PASS publicar como Página: só dono/administração, sempre pública, feed próprio, fora do perfil pessoal, some se suspensa.');
