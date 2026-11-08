// Mídia herdada do Etnias antigo servida em /legado/: só com sessão, só dentro da pasta, com Range para vídeo.
// Sobe o servidor real (scripts/opy-preview-server.mjs) numa porta livre com dados descartáveis.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

const directory = await mkdtemp(join(tmpdir(), 'opy-legacy-media-'));
const media = join(directory, 'media');
await mkdir(join(media, 'upload', 'photos'), { recursive: true });
await writeFile(join(media, 'upload', 'photos', 'foto.jpg'), Buffer.from('0123456789'));
await writeFile(join(media, 'upload', 'photos', 'segredo.txt'), 'nao servir');
await writeFile(join(media, 'upload', 'photos', 'grande.jpg'), 'original-sem-miniatura');
await mkdir(join(media, 'thumbs', 'upload', 'photos'), { recursive: true });
await writeFile(join(media, 'thumbs', 'upload', 'photos', 'foto.jpg'), 'mini');
await writeFile(join(directory, 'fora.jpg'), 'fora');
const port = await new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/opy-preview-server.mjs'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', OPY_LOCAL_DATA_DIR: join(directory, 'data'), OPY_LEGACY_MEDIA_DIR: media, OPY_SESSION_SECRET: 'legacy-media-test-isolated-secret-2026' }, stdio: ['ignore', 'pipe', 'inherit'] });
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', chunk => { if (String(chunk).includes('ouvindo')) resolve(); }); server.on('exit', code => reject(new Error('servidor saiu ' + code))); setTimeout(() => reject(new Error('servidor não subiu')), 10000); });
  assert.equal((await fetch(base + '/legado/upload/photos/foto.jpg')).status, 401, 'sem sessão não vê');
  const reg = await fetch(base + '/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify({ action: 'register', name: 'Mídia Teste', username: 'midiateste', password: 'Test-only-2026', googleKey: 'midia@example.com', phone: '11912345678' }) });
  assert.equal(reg.status, 200);
  const cookie = reg.headers.get('set-cookie').split(';')[0];
  const ok = await fetch(base + '/legado/upload/photos/foto.jpg', { headers: { cookie } });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg'); assert.equal(await ok.text(), '0123456789');
  assert.match(ok.headers.get('cache-control'), /immutable/);
  const part = await fetch(base + '/legado/upload/photos/foto.jpg', { headers: { cookie, range: 'bytes=2-4' } });
  assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 2-4/10'); assert.equal(await part.text(), '234');
  const tail = await fetch(base + '/legado/upload/photos/foto.jpg', { headers: { cookie, range: 'bytes=7-' } });
  assert.equal(tail.status, 206); assert.equal(await tail.text(), '789');
  assert.equal((await fetch(base + '/legado/upload/photos/foto.jpg', { headers: { cookie, range: 'bytes=50-60' } })).status, 416);
  assert.equal((await fetch(base + '/legado/upload/photos/segredo.txt', { headers: { cookie } })).status, 404, 'só tipos de mídia');
  assert.equal((await fetch(base + '/legado/upload/photos/%2e%2e/%2e%2e/fora.jpg', { headers: { cookie } })).status, 404, 'não sai da pasta');
  assert.equal((await fetch(base + '/legado/upload/photos/nao-existe.jpg', { headers: { cookie } })).status, 404);
  assert.equal(await (await fetch(base + '/legado/thumbs/upload/photos/foto.jpg', { headers: { cookie } })).text(), 'mini', 'miniatura quando existe');
  assert.equal(await (await fetch(base + '/legado/thumbs/upload/photos/grande.jpg', { headers: { cookie } })).text(), 'original-sem-miniatura', 'sem miniatura, serve o original');
  assert.equal((await fetch(base + '/legado/thumbs/upload/photos/%2e%2e/%2e%2e/%2e%2e/fora.jpg', { headers: { cookie } })).status, 404, 'miniaturas também não saem da pasta');
  assert.equal((await fetch(base + '/legado/thumbs/upload/photos/segredo.txt', { headers: { cookie } })).status, 404);
  console.log('PASS /legado/: sessão obrigatória, tipos permitidos, Range 206/416, pasta fechada e miniaturas com reserva no original.');
} finally { server.kill(); await rm(directory, { recursive: true, force: true }); }
