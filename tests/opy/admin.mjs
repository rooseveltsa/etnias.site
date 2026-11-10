import test from 'node:test';
import assert from 'node:assert/strict';
import * as admin from '../../preview/server/admin.mjs';

const env = { OPY_ADMIN_USERNAMES: 'chefe' };
const boss = { id: 'a0000000-0000-4000-8000-000000000001', name: 'Chefe', username: 'chefe', createdAt: 1 };
const mod = { id: 'a0000000-0000-4000-8000-000000000002', name: 'Moderadora', username: 'mod', role: 'moderator', createdAt: 1 };
const ana = { id: 'a0000000-0000-4000-8000-000000000003', name: 'Ana', username: 'ana', createdAt: 1, sessions: [{ id: 's' }] };
const beto = { id: 'a0000000-0000-4000-8000-000000000004', name: 'Beto', username: 'beto', createdAt: 1 };
const key = a => 'id:' + a.id;
const fresh = () => ({ accounts: [structuredClone(boss), structuredClone(mod), structuredClone(ana), structuredClone(beto)], posts: [{ id: 'p1', authorId: ana.id, author: 'Ana', text: 'Post', createdAt: 5, origin: 'preview', comments: [] }], dms: [], communities: [] });
const acc = (s, a) => s.accounts.find(x => x.id === a.id);
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);
const act = (s, who, body) => admin.adminAction(s, acc(s, who), body, env, 1000);

test('só quem tem papel acessa o painel; administradores do servidor não dependem do banco', () => {
  const s = fresh();
  assert.equal(admin.roleOf(acc(s, boss), env), 'admin');
  assert.equal(admin.roleOf(acc(s, mod), env), 'moderator');
  assert.equal(admin.roleOf(acc(s, ana), env), '');
  rejects(() => admin.adminView(s, acc(s, ana), undefined, env), 403);
  rejects(() => act(s, ana, { action: 'admin_suspend', userKey: key(beto), days: 1, reason: 'x' }), 403);
  const v = admin.adminView(s, acc(s, mod), undefined, env, 1000);
  assert.equal(v.role, 'moderator'); assert.equal(v.kpis.members.total, 4);
  // Prestação de contas do contrato: só administração vê.
  assert.equal(v.development, undefined);
  const dev = admin.adminView(s, acc(s, boss), undefined, env, 1000).development;
  assert.ok(dev.contrato.assinatura && dev.escopo.length >= 8 && dev.entregas.length && dev.pendencias.length && dev.lgpd.length && dev.acessos.length);
});

test('moderação tem limites: prazo obrigatório, sem papéis, sem comunicados, sem agir sobre administradores', () => {
  const s = fresh();
  rejects(() => act(s, mod, { action: 'admin_suspend', userKey: key(ana), days: 0, reason: 'grave' }), 403);
  rejects(() => act(s, mod, { action: 'admin_suspend', userKey: key(ana), days: 7, reason: '' }), 400);
  act(s, mod, { action: 'admin_suspend', userKey: key(ana), days: 7, reason: 'Ofensas repetidas' });
  assert.equal(admin.isSuspended(acc(s, ana), 1000 + 6 * 864e5), true);
  assert.equal(admin.isSuspended(acc(s, ana), 1000 + 8 * 864e5), false, 'suspensão vence sozinha');
  assert.deepEqual(acc(s, ana).sessions, [], 'sessões encerradas');
  rejects(() => act(s, mod, { action: 'admin_role', userKey: key(beto), role: 'moderator' }), 403);
  rejects(() => act(s, mod, { action: 'admin_announce', title: 'T', text: 'x', days: 3 }), 403);
  rejects(() => act(s, mod, { action: 'admin_suspend', userKey: key(boss), days: 1, reason: 'x' }), 403);
  rejects(() => act(s, mod, { action: 'admin_suspend', userKey: key(mod), days: 1, reason: 'x' }), 400);
});

test('administração: papéis, suspensão sem prazo, reativação, remoção com motivo e registro de transparência', () => {
  const s = fresh();
  act(s, boss, { action: 'admin_role', userKey: key(beto), role: 'moderator', reason: 'Escolhido pela comunidade' });
  assert.equal(admin.roleOf(acc(s, beto), env), 'moderator');
  rejects(() => act(s, boss, { action: 'admin_role', userKey: key(boss), role: '' }), 400);
  act(s, boss, { action: 'admin_suspend', userKey: key(ana), days: 0, reason: 'Ameaça' });
  assert.equal(admin.isSuspended(acc(s, ana), Date.now() + 1e12), true);
  assert.match(admin.suspensionMessage(acc(s, ana)), /Ameaça/);
  act(s, boss, { action: 'admin_reactivate', userKey: key(ana), reason: 'Acordo na comunidade' });
  assert.equal(admin.isSuspended(acc(s, ana)), false);
  rejects(() => act(s, boss, { action: 'admin_remove_post', postId: 'p1', reason: '' }), 400);
  act(s, boss, { action: 'admin_remove_post', postId: 'p1', reason: 'Conteúdo restrito exposto' });
  assert.equal(s.posts.length, 0);
  const actions = s.adminLog.map(l => l.action);
  assert.deepEqual(actions, ['Papel: moderação', 'Suspensão sem prazo', 'Conta reativada', 'Publicação removida']);
  assert.ok(s.adminLog.every(l => l.byName === 'Chefe' && l.at));
});

test('alertas: denúncias e sinais automáticos, com encerramento registrado', () => {
  const s = fresh();
  s.dms.push({ id: 'm1', fromKey: key(beto), toKey: key(ana), text: 'mensagem ofensiva', createdAt: 10 });
  s.chatReports = [{ id: 'r1', authorKey: key(ana), messageId: 'm1', reason: 'Ofensa', createdAt: 11 }];
  s.chatBlocks = { a: [key(beto)], b: [key(beto)], c: [key(beto)] };
  let v = admin.adminView(s, acc(s, mod), undefined, env, 1000);
  assert.equal(v.openAlerts, 2);
  const report = v.alerts.find(a => a.id === 'chat:r1');
  assert.equal(report.targetName, 'Beto'); assert.equal(report.excerpt, 'mensagem ofensiva');
  assert.ok(v.alerts.some(a => a.kind === 'Bloqueios de 3 pessoas'));
  assert.equal(v.people.find(p => p.key === key(beto)).reports, 1);
  act(s, mod, { action: 'admin_resolve_alert', alertId: 'chat:r1', status: 'resolvido', reason: 'Conversado' });
  v = admin.adminView(s, acc(s, mod), undefined, env, 1000);
  assert.equal(v.openAlerts, 1); assert.equal(v.alerts.find(a => a.id === 'chat:r1').resolvedBy, 'Moderadora');
});

test('comunicados: só administração publica, link interno, prazo e fechamento por pessoa', () => {
  const s = fresh();
  rejects(() => act(s, boss, { action: 'admin_announce', title: 'Assembleia', text: 'Sábado', link: 'https://golpe.example', days: 3 }), 400);
  act(s, boss, { action: 'admin_announce', title: 'Assembleia', text: 'Sábado no Etnias', link: '/grupos/', days: 3 });
  const id = s.announcements[0].id;
  assert.equal(admin.announcementsFor(s, acc(s, ana), 2000).length, 1);
  s.announcementDismiss = { [ana.id]: [id] };
  assert.equal(admin.announcementsFor(s, acc(s, ana), 2000).length, 0, 'quem fechou não vê mais');
  assert.equal(admin.announcementsFor(s, acc(s, beto), 2000).length, 1);
  assert.equal(admin.announcementsFor(s, acc(s, beto), 1000 + 4 * 864e5).length, 0, 'expira no prazo');
  act(s, boss, { action: 'admin_announce_end', id });
  assert.equal(admin.announcementsFor(s, acc(s, beto), 2000).length, 0);
});

test('senha provisória: só administração, com motivo, derruba sessões e obriga a trocar; não vale para administradores do servidor', async () => {
  const { checkPassword } = await import('../../preview/server/session.mjs');
  const s = fresh();
  rejects(() => act(s, mod, { action: 'admin_reset_password', userKey: key(ana), reason: 'pediu' }), 403);
  rejects(() => act(s, boss, { action: 'admin_reset_password', userKey: key(ana), reason: '' }), 400);
  rejects(() => act(s, boss, { action: 'admin_reset_password', userKey: key(boss), reason: 'eu' }), 400);
  acc(s, ana).legacyPassword = '$2y$10$' + 'a'.repeat(53);
  const out = act(s, boss, { action: 'admin_reset_password', userKey: key(ana), reason: 'pediu pelo WhatsApp' });
  assert.match(out.temporaryPassword, /^Opy-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const a = acc(s, ana);
  assert.ok(checkPassword(out.temporaryPassword, a.password)); assert.equal(a.legacyPassword, undefined);
  assert.equal(a.mustChangePassword, true); assert.deepEqual(a.sessions, []);
  const entry = s.adminLog.at(-1);
  assert.equal(entry.action, 'Senha provisória emitida'); assert.equal(JSON.stringify(entry).includes(out.temporaryPassword), false, 'a senha não fica no registro');
  const other = fresh(); other.accounts.push({ id: 'a0000000-0000-4000-8000-000000000009', name: 'Servidor', username: 'chefe2', createdAt: 1 });
  rejects(() => admin.adminAction(other, acc(other, boss), { action: 'admin_reset_password', userKey: 'id:a0000000-0000-4000-8000-000000000009', reason: 'x' }, { OPY_ADMIN_USERNAMES: 'chefe,chefe2' }, 1000), 403);
});
