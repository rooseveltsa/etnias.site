// Saberes (trilhas) e Mercado (anúncios dos membros) pelo handler real, com estado e mídia em memória.
// Uso: node --test tests/opy/saberes-mercado.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { initialState } from '../../preview/server/store.mjs';

let state = initialState();
const media = new Map();
globalThis.opyModulesStore = {
  readState: async () => ({ data: structuredClone(state) }),
  transact: async update => { const draft = structuredClone(state); const result = update(draft); state = draft; return { data: structuredClone(state), result }; },
  saveMedia: async (id, bytes, type) => media.set(id, { bytes, type }),
  readMedia: async id => { const v = media.get(id); return v && { statusCode: 200, stream: new Blob([v.bytes]).stream(), blob: { contentType: v.type } }; },
  deleteMedia: async id => media.delete(id),
  archiveAvatar: () => ''
};
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/preview/server/community.mjs') && specifier === './store.mjs') return { url: 'opy-test:modules-store', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'opy-test:modules-store') return { format: 'module', source: 'export const {readState,transact,saveMedia,readMedia,deleteMedia,archiveAvatar}=globalThis.opyModulesStore;', shortCircuit: true };
    return next(url, context);
  }
});
process.env.OPY_SESSION_SECRET = 'modules-test-secret-isolated-2026-only';
process.env.OPY_ADMIN_USERNAMES = 'equipe';
const { default: handler } = await import('../../preview/server/community.mjs');
const host = '127.0.0.1:8199', origin = 'http://' + host;
async function call(method, url, body, cookie = '') {
  const headers = {};
  const res = { statusCode: 200, setHeader: (n, v) => { headers[n.toLowerCase()] = v; }, end(v) { this.output = v; } };
  await handler({ method, url, headers: { cookie, origin, host }, body }, res);
  return { status: res.statusCode, cookie: headers['set-cookie']?.split(';')[0] || '', type: headers['content-type'], raw: res.output };
}
const json = r => ({ ...r, data: JSON.parse(r.raw) });
const post = async (body, cookie) => json(await call('POST', '/api/community', body, cookie));
const get = async (params, cookie) => json(await call('GET', '/api/community?' + new URLSearchParams(params), null, cookie));
const register = async name => (await post({ action: 'register', username: name, name, password: 'Test-only-2026', googleKey: name + '@example.com', phone: '11912345678' })).cookie;
// PNG 1×1 válido.
const png = { name: 'capa.png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' };

const equipe = await register('equipe');
const ana = await register('ana');

test('saberes: só a equipe publica; membro acompanha e conclui aulas; remoção apaga capa e progresso', async () => {
  const draft = { action: 'trilha_save', title: 'Grafismos do Povo', summary: 'Uma introdução respeitosa.', povo: 'Kayapó', cover: png,
    lessons: [{ title: 'Origem', text: 'Primeira aula.' }, { title: 'Pintura', text: 'Segunda aula.', video: 'https://youtu.be/dQw4w9WgXcQ' }] };
  const denied = await post(draft, ana);
  assert.equal(denied.status, 403, 'membro não cria trilha');
  assert.equal(media.size, 0, 'capa enviada por quem não pode é descartada');
  assert.equal((await post({ ...draft, lessons: [] }, equipe)).status, 400, 'trilha sem aula');
  assert.equal((await post({ ...draft, lessons: [{ title: 'X', video: 'https://exemplo.com/v' }] }, equipe)).status, 400, 'vídeo só do YouTube');
  const made = await post(draft, equipe);
  assert.equal(made.status, 200);
  const t = made.data.trilha;
  assert.equal(t.lessons.length, 2);
  assert.equal(t.lessons[1].youtube, 'dQw4w9WgXcQ');
  assert.match(t.cover, /^\/api\/media\?id=/);
  const cover = await call('GET', t.cover, null, ana);
  assert.equal(cover.status, 200, 'capa visível para membros');

  const list = await get({ view: 'saberes' }, ana);
  assert.equal(list.data.staff, false);
  assert.equal(list.data.trilhas[0].doneCount, 0);
  assert.equal(list.data.trilhas[0].started, false);
  assert.equal((await get({ view: 'saberes' }, equipe)).data.staff, true);

  const started = await post({ action: 'trilha_start', id: t.id }, ana);
  assert.equal(started.data.trilha.started, true);
  assert.equal(started.data.trilha.nextLessonId, t.lessons[0].id);
  const done = await post({ action: 'trilha_lesson', id: t.id, lessonId: t.lessons[0].id, done: true }, ana);
  assert.equal(done.data.trilha.doneCount, 1);
  assert.equal(done.data.trilha.nextLessonId, t.lessons[1].id, 'continuar de onde parou');
  assert.equal((await post({ action: 'trilha_lesson', id: t.id, lessonId: 'nao-existe', done: true }, ana)).status, 404);
  assert.equal((await post({ action: 'trilha_delete', id: t.id }, ana)).status, 403, 'membro não remove');

  // Edição mantém os ids das aulas (e o progresso) e troca a capa, apagando a anterior.
  const edited = await post({ action: 'trilha_save', id: t.id, title: 'Grafismos', summary: 'Resumo novo.', cover: png, lessons: t.lessons.map(l => ({ id: l.id, title: l.title, text: l.text, video: l.video })) }, equipe);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.trilha.lessons[0].id, t.lessons[0].id);
  assert.equal(media.size, 1, 'capa antiga removida');
  assert.equal((await get({ view: 'saberes', id: t.id }, ana)).data.trilha.doneCount, 1, 'progresso preservado');

  const removed = await post({ action: 'trilha_delete', id: t.id }, equipe);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.data.trilhas, []);
  assert.equal(media.size, 0, 'capa apagada com a trilha');
  assert.equal(state.trilhaProgress[Object.keys(state.trilhaProgress)[0]][t.id], undefined, 'progresso removido');
  assert.equal((await get({ view: 'saberes', id: t.id }, ana)).status, 404);
});

test('mercado: membro anuncia, edita só o seu, avalia uma vez, bloqueio esconde e remoção apaga as fotos', async () => {
  const beto = await register('beto'), caio = await register('caio');
  const item = { action: 'market_save', title: 'Cesto de palha', description: 'Feito à mão.', price: 'R$ 80', category: 'Artesanato', location: 'Manaus/AM', photos: [png, png] };
  assert.equal((await post({ ...item, category: 'Carros' }, ana)).status, 400, 'categoria fora da lista');
  assert.equal((await post({ ...item, photos: [png, png, png, png, png] }, ana)).status, 400, 'até 4 fotos');
  assert.equal((await post({ ...item, price: '' }, ana)).status, 400, 'preço em texto é obrigatório');
  assert.equal(media.size, 0, 'fotos de um anúncio recusado são descartadas');
  const made = await post(item, ana);
  assert.equal(made.status, 200);
  const x = made.data.item;
  assert.equal(made.data.own, true);
  assert.equal(x.images.length, 2);
  assert.equal((await call('GET', x.images[0], null, beto)).status, 200, 'foto visível para membros');

  const list = await get({ view: 'area', type: 'mercado' }, beto);
  assert.equal(list.data.items[0].id, x.id, 'anúncio de membro vem primeiro');
  assert.equal(list.data.items[0].price, 'R$ 80');
  assert.ok(list.data.categories.includes('Arte e grafismo'));
  assert.equal((await get({ view: 'area', type: 'mercado', q: 'palha' }, beto)).data.items[0].id, x.id, 'busca encontra');
  assert.ok(!(await get({ view: 'area', type: 'mercado', category: 'Alimentos' }, beto)).data.items.some(i => i.id === x.id), 'filtro de categoria');

  assert.equal((await post({ ...item, id: x.id, title: 'Outro', photos: [] }, beto)).status, 403, 'só o dono edita');
  const edited = await post({ action: 'market_save', id: x.id, title: 'Cesto grande', description: 'Feito à mão.', price: 'A combinar', category: 'Artesanato', keepPhotos: [made.data.item.photoIds[1]] }, ana);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.item.price, 'A combinar');
  assert.equal(edited.data.item.images.length, 1);
  assert.equal(media.size, 1, 'foto tirada na edição é apagada');

  assert.equal((await post({ action: 'market_review', id: x.id, stars: 5 }, ana)).status, 400, 'dono não avalia');
  assert.equal((await post({ action: 'market_review', id: x.id, stars: 6 }, beto)).status, 400);
  await post({ action: 'market_review', id: x.id, stars: 2, text: 'Demorou.' }, beto);
  const reviewed = await post({ action: 'market_review', id: x.id, stars: 4, text: 'Chegou bem.' }, beto);
  assert.deepEqual(reviewed.data.rating, { avg: 4, count: 1 }, 'uma avaliação por conta, editável');
  assert.equal(reviewed.data.myReview.text, 'Chegou bem.');
  await post({ action: 'market_review', id: x.id, stars: 5 }, caio);
  assert.deepEqual((await get({ view: 'area', type: 'mercado' }, beto)).data.items[0].rating, { avg: 4.5, count: 2 });

  const anaKey = 'id:' + state.accounts.find(a => a.username === 'ana').id;
  assert.equal((await post({ action: 'block_set', key: anaKey, blocked: true }, caio)).status, 200);
  assert.ok(!(await get({ view: 'area', type: 'mercado' }, caio)).data.items.some(i => i.id === x.id), 'bloqueado não vê o anúncio');
  assert.equal((await get({ view: 'area', type: 'mercado', id: x.id }, caio)).status, 404);
  assert.equal((await call('GET', edited.data.item.images[0], null, caio)).status, 404, 'nem a foto');
  assert.equal((await get({ view: 'area', type: 'mercado', id: x.id }, ana)).data.reviews.length, 1, 'quem foi bloqueada não vê a avaliação de quem bloqueou');

  assert.equal((await post({ action: 'market_delete', id: x.id }, beto)).status, 403, 'outro membro não remove');
  const second = (await post({ ...item, photos: [png] }, ana)).data.item;
  const moderated = await post({ action: 'market_delete', id: second.id, reason: 'Teste de moderação' }, equipe);
  assert.equal(moderated.status, 200);
  assert.ok(state.adminLog.some(l => l.action === 'Anúncio removido do Mercado'), 'remoção pela equipe fica no registro');
  const gone = await post({ action: 'market_delete', id: x.id }, ana);
  assert.equal(gone.status, 200);
  assert.equal(media.size, 0, 'fotos apagadas com os anúncios');
  assert.equal((await get({ view: 'area', type: 'mercado', id: x.id }, beto)).status, 404);
});
