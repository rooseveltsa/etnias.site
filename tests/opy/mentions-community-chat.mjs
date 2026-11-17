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
const ana = await api(profile('ana.tupi')), bia = await api(profile('bia_guarani')), caio = await api(profile('caio'));

// @menção: só contas existentes, nunca o próprio autor; vira link (mentions) e notificação.
const pub = await api({ action: 'publish', text: 'Oi @bia_guarani e @ninguem_aqui, olhem #Forró! @ana.tupi', audience: 'public' }, ana.cookie);
assert.equal(pub.status, 200);
const post = pub.data.posts.find(p => p.text.startsWith('Oi @bia'));
assert.deepEqual(Object.keys(post.mentions), ['bia_guarani'], 'só a conta que existe e não é a autora');
const notes = await get('view=notifications', bia.cookie);
assert.ok(notes.items.some(i => i.kind === 'mention' && i.href === `/#post-${post.id}`), 'quem foi mencionada recebe aviso');
assert.ok(!(await get('view=notifications', caio.cookie)).items.some(i => i.kind === 'mention'));
// Menção em publicação "Somente eu" não avisa ninguém.
const priv = await api({ action: 'publish', text: 'nota @caio', audience: 'private' }, ana.cookie);
assert.deepEqual(priv.data.posts.find(p => p.text === 'nota @caio').mentions, {});
// Menção em comentário.
assert.equal((await api({ action: 'comment', postId: post.id, text: 'valeu @caio.' }, bia.cookie)).status, 200);
assert.ok((await get('view=notifications', caio.cookie)).items.some(i => i.kind === 'mention'), 'menção em comentário avisa');
// #hashtag: a busca encontra pelo termo com #.
assert.ok((await get('view=search&q=%23forr', caio.cookie)).posts.some(p => p.id === post.id));

// Vídeo: acima de 2 MB passa (até 40 MB); outros arquivos seguem em 2 MB; .mov do iPhone vira MP4.
const mp4 = n => { const b = Buffer.alloc(n); b.write('ftypisom', 4); return b.toString('base64'); };
const big = await api({ action: 'publish', text: 'video grande', audience: 'public', media: { name: 'filme.mov', data: 'data:video/quicktime;base64,' + mp4(5 * 1024 * 1024) } }, ana.cookie);
assert.equal(big.status, 200, big.data.error);
assert.equal(big.data.posts.find(p => p.text === 'video grande').media.kind, 'video');
assert.equal(media.get(state.posts.find(p => p.text === 'video grande').media.id).type, 'video/mp4');
const png = Buffer.alloc(3 * 1024 * 1024); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
assert.equal((await api({ action: 'publish', text: 'foto', audience: 'public', media: { name: 'a.png', data: 'data:image/png;base64,' + png.toString('base64') } }, bia.cookie)).status, 413);
assert.equal((await api({ action: 'publish', text: 'enorme', audience: 'public', media: { name: 'b.mp4', data: 'data:video/mp4;base64,' + mp4(41 * 1024 * 1024) } }, caio.cookie)).status, 413);

// Comunidade: qualquer pessoa cria; a conversa do grupo segue os membros.
const made = await api({ action: 'community_create', name: 'Forró do Norte', category: 'Cultura & Audiovisual', visibility: 'public', description: 'x'.repeat(550) }, ana.cookie);
assert.equal(made.status, 200, made.data.error);
const cid = state.communities.find(c => c.name === 'Forró do Norte').id;
assert.equal((await api({ action: 'community_chat', communityId: cid }, bia.cookie)).status, 403, 'quem não é membro não abre a conversa');
const opened = await api({ action: 'community_chat', communityId: cid }, ana.cookie);
const chatKey = opened.data.communities.find(c => c.id === cid).chatKey;
assert.match(chatKey, /^group:/);
await api({ action: 'community_join', communityId: cid }, bia.cookie);
assert.equal((await api({ action: 'dm', toKey: chatKey, text: 'Bem-vinda!', clientId: crypto.randomUUID() }, ana.cookie)).status, 200);
assert.equal((await api({ action: 'dm', toKey: chatKey, text: 'Obrigada!', clientId: crypto.randomUUID() }, bia.cookie)).status, 200, 'quem entrou na comunidade já fala no grupo');
assert.equal((await api({ action: 'dm', toKey: chatKey, text: 'oi', clientId: crypto.randomUUID() }, caio.cookie)).status, 404, 'quem não é membro não fala');
assert.equal((await api({ action: 'chat_group_leave', key: chatKey }, bia.cookie)).status, 409, 'sai-se pela comunidade');
await api({ action: 'community_leave', communityId: cid }, bia.cookie);
assert.equal((await api({ action: 'dm', toKey: chatKey, text: 'ainda?', clientId: crypto.randomUUID() }, bia.cookie)).status, 404, 'saiu da comunidade, saiu da conversa');
console.log('PASS menções, hashtags, vídeo até 40 MB e conversa da comunidade');
