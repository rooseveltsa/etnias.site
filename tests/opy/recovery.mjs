import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './helpers-server.mjs';

async function webhook() {
  const calls = [];
  const server = http.createServer((req, res) => { let raw = ''; req.on('data', d => raw += d); req.on('end', () => { calls.push({ auth: req.headers.authorization, body: JSON.parse(raw) }); res.end('{}'); }); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { calls, url: `http://127.0.0.1:${server.address().port}/enviar`, close: () => server.close() };
}
const waitFor = async fn => { for (let i = 0; i < 50; i++) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 50)); } return null; };
const pw = 'Senha-de-teste-2026';

test('cadastro com um só contato, sem duplicar, e entrada por e-mail ou celular', async () => {
  const s = await startServer();
  try {
    const sem = await s.api({ action: 'register', acceptTerms: true, username: 'noi', name: 'Noi', password: pw });
    assert.equal(sem.status, 400); assert.match(sem.data.error, /e-mail ou um celular/);
    const a = await s.api({ action: 'register', acceptTerms: true, username: 'noi', name: 'Noi', password: pw, contact: 'Noi@Exemplo.com' });
    assert.equal(a.status, 200);
    const b = await s.api({ action: 'register', acceptTerms: true, username: 'poti', name: 'Poti', password: pw, contact: '(11) 91234-5678' });
    assert.equal(b.status, 200);
    assert.equal((await s.api({ action: 'login', username: '+55 11 91234-5678', password: pw })).status, 200, 'celular único entra');
    assert.equal((await s.api({ action: 'register', acceptTerms: true, username: 'outro', name: 'Outro', password: pw, contact: 'noi@exemplo.com' })).status, 409);
    assert.equal((await s.api({ action: 'register', acceptTerms: true, username: 'outro', name: 'Outro', password: pw, contact: '11912345678' })).status, 200, 'celular compartilhado é permitido');
    assert.equal((await s.api({ action: 'login', username: '11912345678', password: pw })).status, 401, 'celular de duas contas não identifica ninguém');
    assert.equal((await s.api({ action: 'login', username: 'noi@exemplo.com', password: pw })).status, 200);

  } finally { await s.stop(); }
});

test('recuperação por código: sem provedor fica desligada; com provedor só vale para contato confirmado e é igual para quem não existe', async () => {
  const off = await startServer();
  try {
    const r = await off.api({ action: 'recover_request', identity: 'qualquer' });
    assert.equal(r.status, 200); assert.equal(r.data.available, false);
  } finally { await off.stop(); }

  const hook = await webhook();
  const s = await startServer({ env: { OPY_CODE_WEBHOOK_URL: hook.url, OPY_CODE_WEBHOOK_TOKEN: 'segredo-do-webhook' } });
  try {
    const reg = await s.api({ action: 'register', acceptTerms: true, username: 'tuira', name: 'Tuira', password: pw, contact: 'tuira@exemplo.com' });
    assert.equal(reg.status, 200);
    // Contato ainda não confirmado: nenhum código sai.
    assert.equal((await s.api({ action: 'recover_request', identity: 'tuira' })).data.ok, true);
    await new Promise(r => setTimeout(r, 300)); assert.equal(hook.calls.length, 0, 'contato não confirmado não recebe código');
    // Confirma o contato com um código.
    assert.equal((await s.api({ action: 'contact_verify_request' }, { cookie: reg.cookie })).status, 200);
    const vcall = await waitFor(() => hook.calls[0]); assert.equal(vcall.auth, 'Bearer segredo-do-webhook'); assert.equal(vcall.body.channel, 'email'); assert.equal(vcall.body.to, 'tuira@exemplo.com');
    assert.equal((await s.api({ action: 'contact_verify_confirm', code: '000000' }, { cookie: reg.cookie })).status, 400);
    assert.equal((await s.api({ action: 'contact_verify_confirm', code: vcall.body.code }, { cookie: reg.cookie })).status, 200);
    // Agora a recuperação funciona; conta inexistente responde igual e não envia nada.
    const ghost = await s.api({ action: 'recover_request', identity: 'fantasma' }, { ip: '8.8.8.8' }); assert.deepEqual(ghost.data, { ok: true, available: true });
    const real = await s.api({ action: 'recover_request', identity: 'tuira@exemplo.com' }, { ip: '8.8.8.8' }); assert.deepEqual(real.data, { ok: true, available: true });
    const rcall = await waitFor(() => hook.calls[1]); assert.match(rcall.body.code, /^\d{6}$/); assert.equal(hook.calls.length, 2);
    const ruim = await s.api({ action: 'recover_confirm', identity: 'tuira', code: '111111', newPassword: 'Outra-senha-2026' }); assert.equal(ruim.status, 400);
    const bom = await s.api({ action: 'recover_confirm', identity: 'tuira', code: rcall.body.code, newPassword: 'Outra-senha-2026' }); assert.equal(bom.status, 200);
    assert.equal((await s.api({ action: 'login', username: 'tuira', password: pw })).status, 401, 'senha antiga não vale mais');
    assert.equal((await s.api({ action: 'login', username: 'tuira', password: 'Outra-senha-2026' })).status, 200);
    assert.equal((await s.api({ action: 'recover_confirm', identity: 'tuira', code: rcall.body.code, newPassword: 'Terceira-senha-2026' })).status, 400, 'o código só vale uma vez');
    assert.ok(!JSON.stringify(JSON.parse(await s.file())).includes(rcall.body.code), 'o código em si não fica guardado');
  } finally { await s.stop(); hook.close(); }
});

test('código errado 5 vezes trava o código', async () => {
  const hook = await webhook();
  const s = await startServer({ env: { OPY_CODE_WEBHOOK_URL: hook.url } });
  try {
    const seed = await s.api({ action: 'register', acceptTerms: true, username: 'ira', name: 'Ira', password: pw, contact: 'ira@exemplo.com' });
    await s.api({ action: 'contact_verify_request' }, { cookie: seed.cookie });
    const v = await waitFor(() => hook.calls[0]);
    await s.api({ action: 'contact_verify_confirm', code: v.body.code }, { cookie: seed.cookie });
    await s.api({ action: 'recover_request', identity: 'ira' }); const c = await waitFor(() => hook.calls[1]);
    for (let i = 0; i < 5; i++) await s.api({ action: 'recover_confirm', identity: 'ira', code: '999999', newPassword: 'Outra-senha-2026' });
    assert.equal((await s.api({ action: 'recover_confirm', identity: 'ira', code: c.body.code, newPassword: 'Outra-senha-2026' })).status, 400, 'travado depois de 5 erros');
  } finally { await s.stop(); hook.close(); }
});

test('telas públicas: disponibilidade de @ e configuração', async () => {
  const s = await startServer();
  try {
    const get = async q => (await fetch(`${s.base}/api/community?${q}`)).json();
    assert.deepEqual(Object.keys(await get('view=public')).sort(), ['recoveryAvailable', 'termsVersion']);
    assert.equal((await get('view=username_available&u=livre.2026')).ok, true);
    assert.equal((await get('view=username_available&u=a')).ok, false);
    await s.api({ action: 'register', acceptTerms: true, username: 'ocupado', name: 'Ocupado', password: pw, contact: 'o@exemplo.com' });
    const r = await get('view=username_available&u=ocupado'); assert.equal(r.ok, false); assert.match(r.reason, /em uso/);
  } finally { await s.stop(); }
});
