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
const ana = await api(profile('ana.tupi')), bia = await api(profile('bia_guarani')), adm = await api(profile('gestao.teste'));
const post = (await api({ action: 'publish', text: 'post da ana', audience: 'public' }, ana.cookie)).data.posts.find(p => p.text === 'post da ana');
await api({ action: 'react', postId: post.id, reaction: 'like' }, bia.cookie);
await api({ action: 'comment', postId: post.id, text: 'comentário da bia' }, bia.cookie);
const commentId = state.posts.find(p => p.id === post.id).comments[0].id;

// CURTIDA-001: quem reagiu, com vínculo para seguir.
const r = await get(`view=reactors&postId=${post.id}`, ana.cookie);
assert.equal(r.total, 1); assert.equal(r.people[0].name, 'bia_guarani'); assert.equal(r.people[0].following, false);

// POST-001 / COMENT-001: denúncia de publicação e de comentário vira alerta; não se denuncia o próprio conteúdo.
assert.equal((await api({ action: 'post_report', postId: post.id, reason: 'spam' }, bia.cookie)).status, 200);
assert.equal((await api({ action: 'post_report', postId: post.id, commentId, reason: 'ofensa' }, ana.cookie)).status, 200);
assert.equal((await api({ action: 'post_report', postId: post.id }, ana.cookie)).status, 400);
assert.equal(state.postReports.length, 2);

// POST-002: conta comum não exclui o post alheio; a equipe exclui e fica registrado.
assert.equal((await api({ action: 'delete', postId: post.id }, bia.cookie)).status, 403);
assert.equal((await api({ action: 'comment_delete', postId: post.id, commentId }, adm.cookie)).status, 200);
assert.ok(state.adminLog.some(e => e.action === 'Comentário excluído pela moderação'));
assert.equal((await api({ action: 'delete', postId: post.id, reason: 'teste' }, adm.cookie)).status, 200);
assert.ok(!state.posts.some(p => p.id === post.id));
assert.ok(state.adminLog.some(e => e.action === 'Publicação excluída pela moderação' && e.reason === 'teste'));

// Segurança: o @ da administração, depois de usado, não pode ser registrado por outra pessoa.
assert.ok(state.staffUsernamesUsed.includes('gestao.teste'));
const usurper = await api({ ...profile('gestao.teste'), googleKey: 'outra@example.com' });
assert.equal(usurper.status, 409);
state.accounts = state.accounts.filter(a => a.username !== 'gestao.teste'); // conta de gestão excluída: o @ fica livre no banco
assert.equal((await api({ ...profile('gestao.teste'), googleKey: 'outra@example.com' })).status, 409, 'o @ de admin liberado não volta a ficar disponível');
// COMENT-003: foto em comentário (só imagem), servida pela mídia da publicação e apagada junto com o comentário.
const p2 = (await api({ action: 'publish', text: 'post 2', audience: 'public' }, ana.cookie)).data.posts.find(p => p.text === 'post 2');
const png = Buffer.alloc(2000); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
const withPhoto = await api({ action: 'comment', postId: p2.id, text: '', media: { name: 'f.png', data: 'data:image/png;base64,' + png.toString('base64') } }, bia.cookie);
assert.equal(withPhoto.status, 200, withPhoto.data.error);
const cm = withPhoto.data.posts.find(p => p.id === p2.id).comments[0];
assert.match(cm.media.url, /^\/api\/media\?id=/);
const mid = state.posts.find(p => p.id === p2.id).comments[0].media.id;
assert.ok(media.has(mid));
const pdf = await api({ action: 'comment', postId: p2.id, text: 'x', media: { name: 'a.pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 teste').toString('base64') } }, bia.cookie);
assert.equal(pdf.status, 400, 'comentário não aceita documento');
assert.equal((await api({ action: 'comment_delete', postId: p2.id, commentId: cm.id }, bia.cookie)).status, 200);
assert.ok(!media.has(mid), 'a foto sai junto com o comentário');

// Segurança (AUD-21): live só para amigos não aparece nem abre para quem não é amigo.
const anaId = state.accounts.find(a => a.username === 'ana.tupi').id;
state.posts.unshift({ id: crypto.randomUUID(), authorId: anaId, author: 'ana.tupi', text: 'live fechada', origin: 'preview', createdAt: Date.now(), audience: 'friends', reactions: {}, comments: [], saves: [], shares: 0, live: { startedAt: Date.now(), key: 'k', chat: [], viewers: {}, invites: {} } });
const liveId = state.posts[0].id;
assert.equal((await get('view=live', bia.cookie)).lives.some(l => l.postId === liveId), false);
assert.equal((await get(`view=live&id=${liveId}`, bia.cookie)).error, 'Live não encontrada.');
assert.equal((await get('view=live', ana.cookie)).lives.some(l => l.postId === liveId), true, 'quem transmite vê a própria live');
state.posts.shift();

// PRESENÇA-001: quem acabou de usar aparece online; ocupado e não incomodar são escolha da pessoa.
const snapA = (await api(null, ana.cookie)).data;
assert.equal(snapA.presence[`id:${snapA.me.id}`], 'online');
assert.equal((await api({ action: 'availability_set', availability: 'sumido' }, ana.cookie)).status, 400);
const busy = (await api({ action: 'availability_set', availability: 'dnd' }, ana.cookie)).data;
assert.equal(busy.me.availability, 'dnd'); assert.equal(busy.presence[`id:${busy.me.id}`], 'dnd');
assert.equal((await api({ action: 'availability_set', availability: '' }, ana.cookie)).data.me.availability, '');
// Comunidades: só o dono nomeia equipe; remover e bloquear impede voltar; histórico; fixar; desligar comentários.
const carla = await api(profile('carla.terena'));
assert.equal((await api({ action: 'community_create', name: 'Roda de Saberes', category: 'Saberes & Educação', visibility: 'public', description: 'Comunidade de teste para saberes.' }, ana.cookie)).status, 200);
const cid = state.communities.find(c => c.name === 'Roda de Saberes').id;
await api({ action: 'community_join', communityId: cid }, bia.cookie);
await api({ action: 'community_join', communityId: cid }, carla.cookie);
const biaKey = `id:${state.accounts.find(a => a.username === 'bia_guarani').id}`, carlaKey = `id:${state.accounts.find(a => a.username === 'carla.terena').id}`;
assert.equal((await api({ action: 'community_role', communityId: cid, memberKey: biaKey, role: 'admin' }, ana.cookie)).status, 200);
assert.equal((await api({ action: 'community_role', communityId: cid, memberKey: carlaKey, role: 'moderator' }, bia.cookie)).status, 403, 'admin que não criou não nomeia');
assert.equal((await api({ action: 'community_remove_member', communityId: cid, memberKey: carlaKey, ban: true }, bia.cookie)).status, 200);
assert.equal((await api({ action: 'community_join', communityId: cid }, carla.cookie)).status, 403, 'bloqueada não volta');
const cpost = (await api({ action: 'publish', text: 'aviso fixo', audience: 'public', communityId: cid }, ana.cookie)).data.posts.find(p => p.text === 'aviso fixo');
assert.equal((await api({ action: 'community_pin', communityId: cid, postId: cpost.id }, bia.cookie)).status, 200);
assert.equal((await api({ action: 'community_comments', communityId: cid, off: true }, ana.cookie)).status, 200);
const dani = await api(profile('dani.xavante'));
await api({ action: 'community_join', communityId: cid }, dani.cookie);
assert.equal((await api({ action: 'comment', postId: cpost.id, text: 'oi' }, dani.cookie)).status, 403, 'comentários desligados');
assert.equal((await api({ action: 'comment', postId: cpost.id, text: 'oi equipe' }, ana.cookie)).status, 200, 'a administração ainda comenta');
const view = (await api(null, ana.cookie)).data.communities.find(c => c.id === cid);
assert.equal(view.pinnedPostId, cpost.id); assert.equal(view.commentsOff, true); assert.equal(view.isOwner, true);
assert.deepEqual(view.history.map(h => h.type).sort(), ['ban', 'comments_off', 'pin', 'role'].sort());
assert.equal((await api(null, dani.cookie)).data.communities.find(c => c.id === cid).history.length, 0, 'histórico só para a equipe');

// Cadastro: trocar a senha gera aviso no Maracá.
assert.equal((await api({ action: 'password_change', current: 'Test-only-2026', next: 'Outra-senha-2026' }, dani.cookie)).status, 200);
assert.ok((await get('view=notifications', dani.cookie)).items.some(i => i.kind === 'security'));

// AUD-20: limite de 30 ações por minuto conta também as que falham e responde 429 sem gravar nada.
let last = 0;
for (let i = 0; i < 31; i++) last = (await api({ action: 'react', postId: 'nao-existe', reaction: 'like' }, bia.cookie)).status;
assert.equal(last, 429);
console.log('PASS correções: aviso de senha trocada, governança de comunidade, limite por minuto em memória, foto em comentário, presença, quem reagiu, denúncias, exclusão pela moderação com registro, @ de admin protegido');
