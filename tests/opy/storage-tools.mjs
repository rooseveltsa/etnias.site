import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createLocalStore } from '../../preview/server/local-store.mjs';

const ID = '11111111-1111-4111-8111-111111111111', ID2 = '22222222-2222-4222-8222-222222222222';
test('mídia nova vai em binário, a antiga (base64) continua legível e o conversor migra sem perder bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opy-store-'));
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 250, 251]);
  await writeFile(join(dir, `media-${ID}.json`), JSON.stringify({ type: 'image/jpeg', bytes: bytes.toString('base64') }));
  const store = createLocalStore(dir, () => ({}));
  assert.deepEqual((await store.readMedia(ID)).buffer, bytes, 'formato antigo ainda lê');
  await store.saveMedia(ID2, bytes, 'image/png');
  assert.ok((await readdir(dir)).includes(`media-${ID2}.bin`) && !(await readdir(dir)).includes(`media-${ID2}.json`));
  const r = await store.readMedia(ID2); assert.equal(r.blob.contentType, 'image/png'); assert.deepEqual(r.buffer, bytes);
  const ensaio = JSON.parse(execFileSync(process.execPath, ['scripts/opy-media-binarize.mjs', dir]).toString());
  assert.equal(ensaio.modo, 'ensaio'); assert.ok((await readdir(dir)).includes(`media-${ID}.json`), 'ensaio não mexe em nada');
  const real = JSON.parse(execFileSync(process.execPath, ['scripts/opy-media-binarize.mjs', dir, '--apply']).toString());
  assert.equal(real.falhas, 0);
  const files = await readdir(dir); assert.ok(files.includes(`media-${ID}.bin`) && !files.includes(`media-${ID}.json`));
  const fresh = createLocalStore(dir, () => ({})); assert.deepEqual((await fresh.readMedia(ID)).buffer, bytes);
  await store.deleteMedia(ID2); assert.equal(await store.readMedia(ID2), null);
});

test('ensaio de SQLite: ida e volta idêntica ao JSON original', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'opy-sql-'));
  const data = { version: 2, accounts: [{ id: 'a', username: 'ana', password: { hash: 'x' } }, { id: 'b', username: 'beto' }], posts: [{ id: 'p1', authorId: 'a', createdAt: 5, comments: [{ id: 'c', text: 'olá ✓' }] }, { id: 'p2' }], limits: { a: { minute: 1 } }, dms: [], extra: [1, 2, { k: null }], nada: null };
  await writeFile(join(dir, 'community.json'), JSON.stringify(data));
  let out;
  try { out = execFileSync(process.execPath, ['scripts/opy-migrar-sqlite.mjs', join(dir, 'community.json'), join(dir, 'x.sqlite')], { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
  catch (e) { if (/node:sqlite/.test(String(e.stderr))) return t.skip('sem node:sqlite'); throw e; }
  const rel = JSON.parse(out); assert.equal(rel['idêntico'], true); assert.equal(rel.integrity, 'ok'); assert.equal(rel.itens.posts, 2);
  assert.equal(await readFile(join(dir, 'community.json'), 'utf8'), JSON.stringify(data), 'origem intocada');
});
