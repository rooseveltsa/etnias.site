import test from 'node:test';
import assert from 'node:assert/strict';
import { purgeAccount, exportAccountData, dueForPurge, sensitiveChange, DELETION_GRACE_DAYS } from '../../preview/server/lgpd.mjs';
import { startServer } from './helpers-server.mjs';

const A = 'a0000000-0000-4000-8000-00000000000a', B = 'b0000000-0000-4000-8000-00000000000b';
const MA = '11111111-1111-4111-8111-111111111111', MB = '22222222-2222-4222-8222-222222222222', MC = '33333333-3333-4333-8333-333333333333';
const fresh = () => ({
  accounts: [{ id: A, name: 'Ana', username: 'ana', password: { hash: 'x', salt: 'y' }, avatarId: MA, povo: 'Guarani', belonging: 'indigena', sessions: [{ id: 's', device: 'Chrome' }] }, { id: B, name: 'Beto', username: 'beto' }],
  posts: [
    { id: 'p1', authorId: A, text: 'da Ana', media: { id: MB }, comments: [{ id: 'c1', authorKey: 'id:' + B, text: 'oi' }], reactions: { [B]: 'like' } },
    { id: 'p2', authorId: B, text: 'do Beto', comments: [{ id: 'c2', authorKey: 'id:' + A, text: 'comentário da Ana' }, { id: 'c3', authorKey: 'id:' + B, text: 'meu', likes: ['id:' + A] }], reactions: { [A]: 'love' }, saves: [A], poll: { options: ['a', 'b'], votes: { [A]: 0 } } },
    { id: 'p3', authorId: B, text: 'repost', repostOf: { id: 'p1', author: 'Ana', authorKey: 'id:' + A, text: 'da Ana', media: { id: MB } } }
  ],
  dms: [{ id: 'd1', fromKey: 'id:' + A, toKey: 'id:' + B, text: 'segredo', media: { id: MC } }, { id: 'd2', fromKey: 'id:' + B, toKey: 'id:' + A, text: 'resposta' }, { id: 'd3', fromKey: 'id:' + B, toKey: 'id:c', text: 'outro' }],
  stories: [{ id: 's1', authorId: A, text: 'story', media: { id: '44444444-4444-4444-8444-444444444444' } }],
  follows: { [A]: ['id:' + B], [B]: ['id:' + A] }, friends: { ['id:' + A]: ['id:' + B], ['id:' + B]: ['id:' + A] }, friendRequests: {}, chatBlocks: { ['id:' + B]: ['id:' + A] },
  communities: [{ id: 'c', members: ['id:' + A, 'id:' + B], admins: ['id:' + A] }],
  pushSubscriptions: { [A]: [{ endpoint: 'x' }] }, etnia: { [A]: [{ role: 'user', text: 'oi Iara' }] }, limits: { [A]: {} },
  market: [{ id: 'm1', sellerId: A, title: 'Cesto', photos: ['55555555-5555-4555-8555-555555555555'] }],
  adminLog: [{ id: 'l1', by: A, byName: 'Ana', target: 'Beto' }, { id: 'l2', by: B, byName: 'Beto', target: 'Ana' }]
});

test('exportação traz os dados da pessoa e nunca a senha nem a sessão', () => {
  const s = fresh(); const e = exportAccountData(s, s.accounts[0]);
  assert.equal(e.conta.username, 'ana'); assert.equal(e.conta.password, undefined); assert.equal(e.conta.sessions, undefined);
  assert.equal(e.publicacoes.length, 1); assert.equal(e.comentarios[0].text, 'comentário da Ana'); assert.equal(e.mensagensDiretas.length, 2);
  assert.deepEqual(e.conversaComIara, [{ role: 'user', text: 'oi Iara' }]); assert.ok(e.arquivosDeMidia.includes(MA) && e.arquivosDeMidia.includes(MB));
  assert.ok(!JSON.stringify(e).includes('"hash"'));
});

test('exclusão definitiva apaga conta, publicações, comentários, mensagens, relações e devolve as mídias', () => {
  const s = fresh(); const { mediaIds } = purgeAccount(s, A);
  assert.equal(s.accounts.length, 1); assert.deepEqual(s.posts.map(p => p.id), ['p2', 'p3']);
  assert.ok(mediaIds.includes(MA) && mediaIds.includes(MB) && mediaIds.includes(MC) && mediaIds.includes('44444444-4444-4444-8444-444444444444') && mediaIds.includes('55555555-5555-4555-8555-555555555555'));
  const p2 = s.posts[0]; assert.deepEqual(p2.comments.map(c => c.id), ['c3']); assert.deepEqual(p2.comments[0].likes, []); assert.equal(p2.reactions[A], undefined); assert.deepEqual(p2.saves, []); assert.equal(p2.poll.votes[A], undefined);
  assert.equal(s.posts[1].repostOf.removed, true); assert.equal(s.posts[1].repostOf.media, undefined);
  assert.deepEqual(s.dms.map(d => d.id), ['d3']); assert.equal(s.stories.length, 0);
  assert.deepEqual(s.follows, { [B]: [] }); assert.deepEqual(s.friends, { ['id:' + B]: [] }); assert.deepEqual(s.chatBlocks, { ['id:' + B]: [] });
  assert.deepEqual(s.communities[0].members, ['id:' + B]); assert.equal(s.pushSubscriptions[A], undefined); assert.equal(s.etnia[A], undefined); assert.equal(s.market.length, 0);
  assert.equal(s.adminLog[0].byName, 'Conta excluída'); assert.equal(s.adminLog[1].target, 'Conta excluída');
  assert.equal(JSON.stringify(s).includes(A), false, 'vestígio: ' + JSON.stringify(s).match(/.{40}a0000000-0000-4000-8000-00000000000a.{20}/)?.[0]);
});

test('prazo de carência de 30 dias e consentimento sensível', () => {
  const now = Date.now();
  assert.equal(dueForPurge({ deletionRequestedAt: now - 29 * 864e5, deletionDueAt: now + 864e5 }, now), false);
  assert.equal(dueForPurge({ deletionRequestedAt: now - 31 * 864e5, deletionDueAt: now - 864e5 }, now), true);
  assert.equal(dueForPurge({}, now), false); assert.equal(dueForPurge({ deletionRequestedAt: 1 }, now), false, 'pedido antigo sem prazo não é apagado de surpresa'); assert.equal(DELETION_GRACE_DAYS, 30);
  assert.equal(sensitiveChange({ belonging: 'indigena', povo: 'X' }, 'indigena', 'X'), false, 'sem mudança não pede consentimento');
  assert.equal(sensitiveChange({}, 'indigena', 'X'), true); assert.equal(sensitiveChange({ belonging: 'indigena' }, '', ''), false, 'apagar não exige consentimento');
});

test('servidor: cadastro exige aceite, exportação e retirada de consentimento', async () => {
  const s = await startServer();
  try {
    const base = { action: 'register', username: 'lia', name: 'Lia', password: 'Senha-de-teste-2026', googleKey: 'lia@example.com', phone: '11912345678' };
    assert.equal((await s.api(base)).status, 400);
    const r = await s.api({ ...base, acceptTerms: true }); assert.equal(r.status, 200); assert.ok(r.data.me.consent.terms);
    assert.equal((await s.api({ action: 'profile_update', name: 'Lia', belonging: 'indigena', povo: 'Pataxó' }, { cookie: r.cookie })).status, 400);
    assert.equal((await s.api({ action: 'profile_update', name: 'Lia', belonging: 'indigena', povo: 'Pataxó', consentSensitive: true }, { cookie: r.cookie })).data.me.povo, 'Pataxó');
    const exp = await s.api({ action: 'data_export' }, { cookie: r.cookie });
    assert.equal(exp.status, 200); assert.equal(exp.data.export.conta.username, 'lia'); assert.equal(exp.data.export.conta.password, undefined); assert.equal(exp.data.export.consentimentos.sensitive !== undefined, true);
    const off = await s.api({ action: 'consent_update', sensitive: false }, { cookie: r.cookie });
    assert.equal(off.status, 200); assert.equal(off.data.me.povo, ''); assert.equal(off.data.me.consent.sensitive, false);
    // Exclusão: login comum avisa e não cancela.
    assert.equal((await s.api({ action: 'account_delete_request', password: base.password }, { cookie: r.cookie })).data.signedOut, true);
    const l = await s.api({ action: 'login', username: 'lia', password: base.password }); assert.equal(l.status, 409); assert.equal(l.data.deletionPending, true);
    assert.equal((await s.api({ action: 'login', username: 'lia', password: base.password, cancelDeletion: true })).status, 200);
  } finally { await s.stop(); }
});

test('servidor: a rotina apaga de verdade a conta com carência vencida e preserva as demais', async () => {
  const { initialState } = await import('../../preview/server/store.mjs');
  const velho = Date.now() - 31 * 864e5, recente = Date.now() - 5 * 864e5;
  const seed = { ...initialState(), posts: [], accounts: [
    { id: A, username: 'vencida', name: 'Vencida', createdAt: 1, sessions: [], deletionRequestedAt: velho, deletionDueAt: velho + 30 * 864e5 - 40 * 864e5, deactivatedAt: velho },
    { id: B, username: 'recente', name: 'Recente', createdAt: 1, sessions: [], deletionRequestedAt: recente, deactivatedAt: recente },
    { id: 'c0000000-0000-4000-8000-00000000000c', username: 'antiga', name: 'Antiga', createdAt: 1, sessions: [], deletionRequestedAt: velho, deactivatedAt: velho }] };
  const s = await startServer({ seed, env: { OPY_PURGE_FIRST_MS: '300' } });
  try {
    let accounts = [];
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); accounts = JSON.parse(await s.file()).accounts; if (accounts.length === 2) break; }
    assert.deepEqual(accounts.map(a => a.username).sort(), ['antiga', 'recente']);
    assert.ok(accounts.find(a => a.username === 'antiga').deletionDueAt > Date.now() + 29 * 864e5, 'pedido sem prazo ganha 30 dias novos');
    assert.match(s.logs(), /LGPD: 1 conta/);
  } finally { await s.stop(); }
});

test('páginas legais são públicas, marcadas como rascunho, e a tela offline existe', async () => {
  const s = await startServer();
  try {
    for (const [path, titulo] of [['/privacidade/', 'Política de Privacidade'], ['/termos/', 'Termos de Uso'], ['/offline/', 'sem internet']]) {
      const r = await fetch(s.base + path, { redirect: 'manual' }); assert.equal(r.status, 200, path);
      const html = await r.text(); assert.ok(html.includes(titulo), path);
      if (path !== '/offline/') assert.match(html, /RASCUNHO — revisão jurídica necessária/);
    }
    const entrar = await (await fetch(s.base + '/entrar/')).text();
    assert.match(entrar, /name="acceptTerms"/); assert.match(entrar, /\/privacidade\//); assert.doesNotMatch(entrar, /Chave Google/);
  } finally { await s.stop(); }
});
