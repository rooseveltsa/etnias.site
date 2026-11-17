import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync, randomBytes } from 'node:crypto';
import { initialState } from '../../preview/server/store.mjs';
import { startServer } from './helpers-server.mjs';
import { hashPassword, checkPassword, needsRehash, PASSWORD_N } from '../../preview/server/session.mjs';
import * as throttle from '../../preview/server/throttle.mjs';

const pw = 'Senha-de-teste-2026';
const reg = n => ({ action: 'register', username: n, name: n, password: pw, googleKey: n + '@example.com', phone: '11912345678' });

test('scrypt: custo novo, hash antigo continua valendo e pede refazer', () => {
  const novo = hashPassword(pw);
  assert.equal(novo.n, PASSWORD_N); assert.ok(checkPassword(pw, novo)); assert.ok(!checkPassword('outra', novo)); assert.ok(!needsRehash(novo));
  const salt = randomBytes(16);
  const velho = { salt: salt.toString('hex'), hash: scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex') };
  assert.ok(checkPassword(pw, velho)); assert.ok(needsRehash(velho));
});

test('limitador em memória: janela deslizante e limpeza', () => {
  throttle._reset();
  for (let i = 0; i < 3; i++) throttle.note('k', 1000, 100 + i);
  assert.ok(throttle.tooMany('k', 3, 1000, 200)); assert.ok(!throttle.tooMany('k', 3, 1000, 1200));
  throttle.note('x', 1000, 1); throttle.clear('x'); assert.ok(!throttle.tooMany('x', 1, 1000, 2));
});

test('servidor: corpo grande sem sessão é recusado antes de ler; login errado não escreve no banco; limites por endereço', async () => {
  const s = await startServer();
  try {
    assert.equal((await fetch(s.base + '/api/health')).status, 200);
    const grande = await s.api(undefined, { raw: JSON.stringify({ action: 'login', username: 'a', password: 'x'.repeat(200_000) }) });
    assert.equal(grande.status, 413);
    const r = await s.api(reg('ana')); assert.equal(r.status, 200); assert.ok(r.cookie);
    const gravado = JSON.parse(await s.file()); assert.equal(gravado.accounts[0].password.n, PASSWORD_N);
    // Com sessão o limite maior vale (mensagem curta passa).
    const antes = await s.file();
    const e1 = await s.api({ action: 'login', username: 'ana', password: 'errada-errada' }, { ip: '9.9.9.1' });
    const e2 = await s.api({ action: 'login', username: 'naoexiste', password: 'errada-errada' }, { ip: '9.9.9.1' });
    assert.equal(e1.status, 401); assert.equal(e2.status, 401); assert.deepEqual(e1.data, e2.data, 'mesma resposta para conta existente ou não');
    assert.equal(await s.file(), antes, 'falha de login não regrava o banco');
    for (let i = 0; i < 8; i++) await s.api({ action: 'login', username: 'ana', password: 'errada-errada' }, { ip: '9.9.9.1' });
    assert.equal((await s.api({ action: 'login', username: 'ana', password: pw }, { ip: '9.9.9.1' })).status, 429);
    // Outro endereço não é bloqueado pela tentativa de terceiros.
    const ok = await s.api({ action: 'login', username: 'ana', password: pw }, { ip: '9.9.9.2' });
    assert.equal(ok.status, 200);
    assert.ok(s.logs().includes('AUTH_FALHA'));
  } finally { await s.stop(); }
});

test('login refaz o hash antigo com o custo atual', async () => {
  const salt = randomBytes(16);
  const seed = { ...initialState(), accounts: [{ id: '11111111-1111-4111-8111-111111111111', username: 'velha', name: 'Velha', createdAt: 1, sessions: [], password: { salt: salt.toString('hex'), hash: scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex') } }] };
  const s = await startServer({ seed });
  try {
    assert.equal((await s.api({ action: 'login', username: 'velha', password: pw })).status, 200);
    assert.equal(JSON.parse(await s.file()).accounts[0].password.n, PASSWORD_N);
    assert.equal((await s.api({ action: 'login', username: 'velha', password: pw })).status, 200);
  } finally { await s.stop(); }
});

test('senha provisória: expira em 48 h e bloqueia tudo, no servidor, até ser trocada', async () => {
  const s = await startServer({ env: { OPY_ADMIN_USERNAMES: 'chefe' } });
  try {
    const chefe = await s.api(reg('chefe')); const bia = await s.api(reg('bia'));
    const biaId = (JSON.parse(await s.file())).accounts.find(a => a.username === 'bia').id;
    const r = await s.api({ action: 'admin_reset_password', userKey: 'id:' + biaId, reason: 'Pediu pelo WhatsApp' }, { cookie: chefe.cookie });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const temp = JSON.stringify(r.data).match(/"temporaryPassword":"([^"]+)"/)[1];
    const conta = JSON.parse(await s.file()).accounts.find(a => a.username === 'bia');
    assert.ok(conta.tempPasswordExpiresAt > Date.now() + 47 * 3600e3 && conta.tempPasswordExpiresAt < Date.now() + 49 * 3600e3);
    const entrada = await s.api({ action: 'login', username: 'bia', password: temp });
    assert.equal(entrada.status, 200);
    const publicar = await s.api({ action: 'publish', text: 'oi', audience: 'public' }, { cookie: entrada.cookie });
    assert.equal(publicar.status, 403, 'qualquer ação é barrada com senha provisória');
    const troca = await s.api({ action: 'password_change', current: temp, next: 'Nova-senha-2026!' }, { cookie: entrada.cookie });
    assert.equal(troca.status, 200, JSON.stringify(troca.data));
    assert.equal((await s.api({ action: 'publish', text: 'oi', audience: 'public' }, { cookie: entrada.cookie })).status, 200);
  } finally { await s.stop(); }
});

test('limites por pessoa: publicações por dia e buscas por minuto (sem teto global de 100 stories)', async () => {
  const s = await startServer({ env: { OPY_MAX_POSTS_PER_USER_DAY: '2' } });
  try {
    const a = await s.api(reg('carla'));
    for (let i = 0; i < 2; i++) assert.equal((await s.api({ action: 'publish', text: 'oi ' + i, audience: 'public' }, { cookie: a.cookie })).status, 200);
    const terceira = await s.api({ action: 'publish', text: 'oi 3', audience: 'public' }, { cookie: a.cookie });
    assert.equal(terceira.status, 429); assert.match(terceira.data.error || JSON.stringify(terceira.data), /24 horas/);
    let ultimo = 200;
    for (let i = 0; i < 45 && ultimo !== 429; i++) ultimo = (await fetch(s.base + '/api/community?view=search&q=carla', { headers: { cookie: a.cookie } })).status;
    assert.equal(ultimo, 429, 'busca limitada a 40 por minuto por pessoa');
  } finally { await s.stop(); }
});

test('cabeçalhos: sw.js sem cache, security.txt público, COOP', async () => {
  const s = await startServer();
  try {
    const sw = await fetch(s.base + '/sw.js'); assert.equal(sw.headers.get('cache-control'), 'no-cache');
    const sec = await fetch(s.base + '/.well-known/security.txt', { redirect: 'manual' }); assert.equal(sec.status, 200); assert.match(await sec.text(), /^Contact: /);
    assert.equal(sw.headers.get('cross-origin-opener-policy'), 'same-origin');
  } finally { await s.stop(); }
});
