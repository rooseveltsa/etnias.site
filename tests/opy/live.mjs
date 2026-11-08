import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { liveAction, liveAuth, settleLives, projectLive, attachRecordings, recordingFile } from '../../preview/server/live.mjs';

const env = { OPY_LIVE_URL: 'http://live:8889' };
const ana = { id: 'a0000000-0000-4000-8000-000000000001', name: 'Ana' };
const beto = { id: 'a0000000-0000-4000-8000-000000000002', name: 'Beto' };
const fresh = () => ({ posts: [], follows: { [beto.id]: [`id:${ana.id}`] } });
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);

test('iniciar cria a publicação ao vivo, avisa quem segue e impede duas lives da mesma pessoa', () => {
  const s = fresh();
  const started = liveAction(s, ana, { action: 'live_start', text: 'Roda de conversa' }, env, 1000);
  assert.equal(s.posts.length, 1);
  assert.equal(s.posts[0].id, started.postId);
  assert.equal(s.posts[0].audience, 'public');
  assert.match(started.key, /^[a-f0-9]{48}$/);
  assert.deepEqual(started.notify, [beto.id], 'só quem segue a autora recebe o aviso');
  assert.equal(started.push.title, 'Ana está ao vivo');
  assert.deepEqual(projectLive(s.posts[0]), { active: true, startedAt: 1000, endedAt: 0, recording: '' });
  rejects(() => liveAction(s, ana, { action: 'live_start' }, env, 2000), 409);
  rejects(() => liveAction(s, beto, { action: 'live_start', text: 'x'.repeat(301) }, env, 2000), 400);
  rejects(() => liveAction(s, beto, { action: 'live_start' }, {}, 2000), 503, 'sem servidor de live a ação é recusada');
});

test('publicar exige a chave da live; assistir exige live ativa; encerrar é só de quem transmite', () => {
  const s = fresh();
  const { postId, key } = liveAction(s, ana, { action: 'live_start' }, env, 1000);
  assert.equal(liveAuth(s, { action: 'publish', path: postId, token: key }), true);
  assert.equal(liveAuth(s, { action: 'publish', path: postId, token: 'errada' }), false);
  assert.equal(liveAuth(s, { action: 'publish', path: postId, token: '' }), false);
  assert.equal(liveAuth(s, { action: 'read', path: postId }), true);
  assert.equal(liveAuth(s, { action: 'read', path: 'nao-existe' }), false);
  assert.equal(liveAuth(s, { action: 'api', path: postId }), false);
  rejects(() => liveAction(s, beto, { action: 'live_stop', postId }, env, 3000), 403);
  rejects(() => liveAction(s, ana, { action: 'live_stop', postId: 'outra' }, env, 3000), 404);
  liveAction(s, ana, { action: 'live_stop', postId }, env, 3000);
  assert.equal(s.posts[0].live.endedAt, 3000);
  assert.equal(s.posts[0].live.key, undefined, 'a chave some ao encerrar');
  assert.equal(liveAuth(s, { action: 'read', path: postId }), false, 'live encerrada não aceita mais espectadores');
  assert.equal(liveAuth(s, { action: 'publish', path: postId, token: key }), false);
  liveAction(s, ana, { action: 'live_stop', postId }, env, 4000);
  assert.equal(s.posts[0].live.endedAt, 3000, 'encerrar de novo não muda a hora');
});

test('live sem encerramento é fechada sozinha depois de 6 horas', () => {
  const s = fresh();
  liveAction(s, ana, { action: 'live_start' }, env, 0);
  settleLives(s, 5 * 3600 * 1000);
  assert.equal(projectLive(s.posts[0]).active, true);
  settleLives(s, 6 * 3600 * 1000 + 1);
  assert.equal(projectLive(s.posts[0]).active, false);
});

test('a gravação vira o vídeo da publicação; sem arquivo depois de 2 minutos, desiste', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opy-live-'));
  const s = fresh();
  const { postId } = liveAction(s, ana, { action: 'live_start' }, env, 1000);
  liveAction(s, beto, { action: 'live_start' }, env, 1000);
  const other = s.posts.find(p => p.authorId === beto.id);
  liveAction(s, ana, { action: 'live_stop', postId }, env, 2000);
  liveAction(s, beto, { action: 'live_stop', postId: other.id }, env, 2000);
  await mkdir(join(dir, postId));
  await writeFile(join(dir, postId, '2026-11-08_12-00-00-000000.mp4'), 'x');
  const store = { readState: async () => ({ data: s }), transact: async update => { update(s); return { data: s }; } };
  const recEnv = { ...env, OPY_LIVE_RECORDINGS_DIR: dir };
  await attachRecordings(store, recEnv, 3000);
  assert.deepEqual(s.posts.find(p => p.id === postId).media, { url: `/live/recordings/${postId}/2026-11-08_12-00-00-000000.mp4`, kind: 'video', name: 'live.mp4' });
  assert.equal(other.live.recording, undefined, 'ainda procurando');
  await attachRecordings(store, recEnv, 2000 + 2 * 60 * 1000 + 1);
  assert.equal(other.live.recording, 'none');
  assert.equal(other.media, undefined);
  const post = s.posts.find(p => p.id === postId);
  assert.ok(await recordingFile(post, post.media.url, recEnv), 'o arquivo gravado na publicação é servido');
  assert.equal(await recordingFile(post, `/live/recordings/${postId}/../../etc/passwd`, recEnv), null, 'só o caminho da própria publicação');
  await attachRecordings({ readState: async () => { throw new Error('não deve ler'); } }, env, 0);
});
