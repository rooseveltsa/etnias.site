import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLocalStore } from '../../preview/server/local-store.mjs';

const directory = await mkdtemp(join(tmpdir(), 'opy-local-store-'));
try {
  const store = createLocalStore(directory, () => ({ count: 0 }));
  await Promise.all(Array.from({ length: 20 }, () => store.transact(data => { data.count++; })));
  assert.equal((await store.readState()).data.count, 20);
  const reopened = createLocalStore(directory, () => ({ count: 0 }));
  assert.equal((await reopened.readState()).data.count, 20);
  await assert.rejects(store.transact(data => { data.count = 0; throw new Error('Cancelado'); }), /Cancelado/);
  assert.equal((await reopened.readState()).data.count, 20);
  assert.equal((await stat(join(directory, 'community.json'))).mode & 0o777, 0o600);
  const id = randomUUID(), bytes = Buffer.from('%PDF-1.4\nlocal');
  await store.saveMedia(id, bytes, 'application/pdf');
  const media = await reopened.readMedia(id);
  assert.equal(media.blob.contentType, 'application/pdf');
  assert.deepEqual(Buffer.from(await new Response(media.stream).arrayBuffer()), bytes);
  await assert.rejects(store.readMedia('../session-secret'));
  await reopened.deleteMedia(id);
  assert.equal(await store.readMedia(id), null);
  // Arquivo corrompido fora do processo: um store novo (sem cache) recusa a escrita e preserva o arquivo.
  await writeFile(join(directory, 'community.json'), '{invalid');
  const corrupted = createLocalStore(directory, () => ({ count: 0 }));
  await assert.rejects(corrupted.transact(data => { data.count++; }));
  assert.equal(await readFile(join(directory, 'community.json'), 'utf8'), '{invalid');
  await writeFile(join(directory, 'community.json'), JSON.stringify({ count: 20 }));

  process.env.OPY_LOCAL_DATA_DIR = join(directory, 'community');
  process.env.OPY_SESSION_SECRET = 'local-store-test-isolated-secret-2026';
  const { default: handler } = await import('../../preview/server/community.mjs');
  async function api(body, cookie = '') {
    const headers = {};
    const response = { statusCode: 200, setHeader: (name, value) => { headers[name.toLowerCase()] = value; }, end: value => { response.output = value; } };
    await handler({ method: body ? 'POST' : 'GET', url: '/api/community', headers: { cookie, origin: 'http://127.0.0.1:8101', host: '127.0.0.1:8101' }, body }, response);
    return { status: response.statusCode, cookie: headers['set-cookie']?.split(';')[0], data: JSON.parse(response.output) };
  }
  const registered = await api({ action: 'register', username: 'localteste', name: 'Teste local', password: 'Somente-local-2026', googleKey: 'localteste@example.com', phone: '11912345678' });
  assert.equal(registered.status, 200);
  const created = await api({ action: 'iara_request', text: 'Preciso de um card para o curso' }, registered.cookie);
  assert.equal(created.status, 200);
  assert.equal(created.data.iaraTickets[0].sector, 'conteudo-estatico');
  const saved = JSON.parse(await readFile(join(process.env.OPY_LOCAL_DATA_DIR, 'community.json'), 'utf8'));
  assert.equal(saved.accounts.length, 1);
  assert.equal(saved.iaraTickets.length, 1);
  assert.equal((await api(null, registered.cookie)).data.iaraTickets.length, 1);
  assert.equal((await api({ action: 'logout' }, registered.cookie)).status, 200);
  assert.equal((await api(null, registered.cookie)).status, 401);
  console.log('PASS disco local: API real, cadastro, IAra, sessão/revogação persistidas, 20 escritas concorrentes, reabertura, anexo e preservação de arquivo corrompido.');
} finally { await rm(directory, { recursive: true, force: true }); }
