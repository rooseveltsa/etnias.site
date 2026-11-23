// Envios grandes simultâneos: no máximo 2 por conta; o terceiro recebe 429 com mensagem, e o limite libera quando um termina.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const directory = await mkdtemp(join(tmpdir(), 'opy-limite-envios-'));
const port = await new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/opy-preview-server.mjs'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', OPY_LOCAL_DATA_DIR: join(directory, 'data'), OPY_SESSION_SECRET: 'limite-envios-test-isolated-secret-2026' }, stdio: ['ignore', 'pipe', 'inherit'] });
// Abre um POST grande e deixa o corpo pela metade; devolve a função que termina o envio.
function slowPost(cookie, size = 200_000) {
  const req = http.request(base + '/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': size, origin: base, cookie } });
  const done = new Promise(resolve => req.on('response', r => { let t = ''; r.on('data', c => t += c); r.on('end', () => resolve({ status: r.statusCode, body: t })); }));
  req.on('error', () => {});
  const body = JSON.stringify({ action: 'nada', pad: '' }).slice(0, -2);
  const fill = 'x'.repeat(size - body.length - 2) + '"}';
  req.write(body);
  return { finish: () => { req.end(fill); return done; }, done };
}
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) resolve(); }); server.on('exit', code => reject(new Error('servidor saiu ' + code))); setTimeout(() => reject(new Error('servidor não subiu')), 10000); });
  const reg = await fetch(base + '/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ acceptTerms: true, action: 'register', name: 'Envio Teste', username: 'enviateste', password: 'Test-only-2026', googleKey: 'envio@example.com', phone: '11912345670' }) });
  assert.equal(reg.status, 200);
  const cookie = reg.headers.get('set-cookie').split(';')[0];
  const a = slowPost(cookie), b = slowPost(cookie);
  await new Promise(r => setTimeout(r, 200));
  const third = await slowPost(cookie).finish();
  assert.equal(third.status, 429, 'terceiro envio simultâneo recusado');
  assert.match(JSON.parse(third.body).error, /Espere o envio anterior/);
  await a.finish();
  const fourth = await slowPost(cookie).finish();
  assert.notEqual(fourth.status, 429, 'depois que um termina, libera');
  await b.finish();
  console.log('PASS envios: no máximo 2 grandes por conta ao mesmo tempo, com mensagem e liberação ao terminar.');
} finally { server.kill(); await rm(directory, { recursive: true, force: true }); }
