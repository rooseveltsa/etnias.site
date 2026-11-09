import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { liveAction, liveAuth, settleLives, projectLive, attachRecordings, recordingFile, liveView, liveNow } from '../../preview/server/live.mjs';

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
  assert.equal(started.push.title, '🔴 Ana está ao vivo no Etnias');
  assert.deepEqual(projectLive(s.posts[0], 1000), { active: true, startedAt: 1000, endedAt: 0, recording: '', format: 'portrait', viewers: 0, guest: '' });
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

const carla = { id: 'a0000000-0000-4000-8000-000000000003', name: 'Carla' };
const withAccounts = s => { s.accounts = [ana, beto, carla].map(a => ({ ...a })); return s; };
const view = (s, who, postId, extra = {}) => liveView(s, who, new URLSearchParams({ id: postId, ...extra }), env, extra.now ? Number(extra.now) : 5000);

test('formato, audiência, bate-papo com modo lento, silenciar, fixar e apagar', () => {
  const s = withAccounts(fresh());
  const { postId } = liveAction(s, ana, { action: 'live_start', format: 'landscape', text: 'Entrevista' }, env, 1000);
  assert.equal(projectLive(s.posts[0], 1000).format, 'landscape');
  liveAction(s, beto, { action: 'live_watch', postId }, env, 2000);
  liveAction(s, carla, { action: 'live_watch', postId }, env, 2000);
  assert.equal(view(s, ana, postId).live.viewers, 2);
  assert.equal(view(s, ana, postId, { now: '40000' }).live.viewers, 0, 'quem parou de bater sai da contagem');
  liveAction(s, beto, { action: 'live_chat', postId, text: 'Oi!' }, env, 3000);
  liveAction(s, beto, { action: 'live_chat', postId, text: 'Oi!' }, env, 3500);
  assert.equal(view(s, ana, postId).chat.length, 1, 'mensagem repetida em 5 s é ignorada');
  liveAction(s, ana, { action: 'live_slow', postId, seconds: 10 }, env, 4000);
  liveAction(s, beto, { action: 'live_chat', postId, text: 'Segunda' }, env, 13500);
  rejects(() => liveAction(s, beto, { action: 'live_chat', postId, text: 'Terceira' }, env, 14000), 429, 'modo lento: 10 s entre mensagens');
  liveAction(s, ana, { action: 'live_chat', postId, text: 'Anfitrião não espera' }, env, 14100);
  const msg = view(s, ana, postId).chat[0];
  liveAction(s, ana, { action: 'live_pin', postId, msgId: msg.id }, env, 13000);
  assert.equal(view(s, carla, postId).live.pinned.text, 'Oi!');
  rejects(() => liveAction(s, carla, { action: 'live_chat_delete', postId, msgId: msg.id }, env, 13000), 403);
  liveAction(s, ana, { action: 'live_chat_delete', postId, msgId: msg.id }, env, 13000);
  assert.equal(view(s, carla, postId).live.pinned, null, 'apagar a fixada solta o destaque');
  liveAction(s, ana, { action: 'live_mute', postId, userId: carla.id }, env, 14000);
  rejects(() => liveAction(s, carla, { action: 'live_chat', postId, text: 'bloqueada' }, env, 14000), 403);
  assert.equal(view(s, carla, postId).live.muted, true);
  rejects(() => liveAction(s, beto, { action: 'live_pin', postId, msgId: '' }, env, 15000), 403, 'só o anfitrião modera');
  liveAction(s, beto, { action: 'live_react', postId, emoji: '🔥' }, env, 15000);
  liveAction(s, beto, { action: 'live_react', postId, emoji: '🔥' }, env, 15200);
  assert.deepEqual(view(s, ana, postId, { now: '15500' }).quick.counts, { '🔥': 1 }, 'reação rápida repetida em menos de 0,7 s não conta');
  assert.equal(view(s, beto, postId).chat.some(m => m.own), true);
});

test('convite, pedido, participação com chave e sinalização só entre anfitrião e convidado', () => {
  const s = withAccounts(fresh());
  const { postId } = liveAction(s, ana, { action: 'live_start' }, env, 1000);
  rejects(() => liveAction(s, beto, { action: 'live_invite', postId, userId: carla.id }, env, 1000), 403);
  const inv = liveAction(s, ana, { action: 'live_invite', postId, userId: beto.id }, env, 1000);
  assert.deepEqual(inv.notify, [beto.id]);
  assert.equal(view(s, beto, postId).live.myInvite, 'pending');
  assert.equal(liveNow(s, carla, 1000)[0].invited, false); assert.equal(liveNow(s, beto, 1000)[0].invited, true);
  settleLives(s, 1000 + 3 * 60 * 1000);
  rejects(() => liveAction(s, beto, { action: 'live_invite_respond', postId, accept: true }, env, 1000 + 3 * 60 * 1000), 404, 'convite vencido não entra');
  liveAction(s, ana, { action: 'live_invite', postId, userId: beto.id }, env, 200000);
  const joined = liveAction(s, beto, { action: 'live_invite_respond', postId, accept: true }, env, 200500);
  assert.match(joined.guestToken, /^[a-f0-9]{36}$/);
  assert.equal(view(s, carla, postId).live.guest.name, 'Beto');
  assert.equal(view(s, carla, postId).guestToken, undefined, 'espectador não vê a chave');
  rejects(() => liveAction(s, ana, { action: 'live_invite', postId, userId: carla.id }, env, 201000), 409, 'um convidado por vez');
  // Sinalização: anfitrião oferece, convidado responde com a chave; sem a chave, nada.
  liveAction(s, ana, { action: 'live_signal', postId, offer: { type: 'offer', sdp: 'v=0 oferta' } }, env, 202000);
  assert.equal(view(s, beto, postId).signal.offer.sdp, 'v=0 oferta');
  rejects(() => liveAction(s, beto, { action: 'live_signal', postId, token: 'errada', answer: { type: 'answer', sdp: 'v=0 resp' } }, env, 202500), 403);
  rejects(() => liveAction(s, carla, { action: 'live_signal', postId, token: joined.guestToken, answer: { type: 'answer', sdp: 'v=0 resp' } }, env, 202500), 403, 'quem não é convidado não sinaliza nem com a chave');
  liveAction(s, beto, { action: 'live_signal', postId, token: joined.guestToken, answer: { type: 'answer', sdp: 'v=0 resp' }, candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } }, env, 203000);
  const hostSide = view(s, ana, postId).signal;
  assert.equal(hostSide.answer.sdp, 'v=0 resp'); assert.equal(hostSide.candidates.length, 1);
  liveAction(s, beto, { action: 'live_guest_media', postId, mic: false }, env, 204000);
  assert.equal(view(s, carla, postId).live.guest.mic, false);
  liveAction(s, ana, { action: 'live_guest_remove', postId }, env, 205000);
  assert.equal(view(s, carla, postId).live.guest, null);
  assert.equal(view(s, carla, postId).live.active, true, 'a live continua sem o convidado');
  // Pedido de participação: espectador pede, anfitrião aceita, convidado entra e sai sozinho.
  liveAction(s, carla, { action: 'live_request', postId }, env, 206000);
  assert.equal(view(s, ana, postId).requests[0].name, 'Carla');
  liveAction(s, ana, { action: 'live_requests', postId, open: false }, env, 206500);
  assert.equal(view(s, ana, postId).requests.length, 0, 'fechar pedidos limpa a fila');
  rejects(() => liveAction(s, carla, { action: 'live_request', postId }, env, 207000), 403);
  liveAction(s, ana, { action: 'live_requests', postId, open: true }, env, 207500);
  liveAction(s, carla, { action: 'live_request', postId }, env, 208000);
  liveAction(s, ana, { action: 'live_request_respond', postId, userId: carla.id, accept: true }, env, 208500);
  assert.equal(view(s, carla, postId).live.myInvite, 'pending');
  liveAction(s, carla, { action: 'live_invite_respond', postId, accept: true }, env, 209000);
  assert.equal(view(s, ana, postId).live.guest.name, 'Carla');
  liveAction(s, carla, { action: 'live_guest_leave', postId }, env, 210000);
  assert.equal(view(s, ana, postId).live.guest, null);
  liveAction(s, ana, { action: 'live_stop', postId }, env, 211000);
  rejects(() => liveAction(s, beto, { action: 'live_chat', postId, text: 'tarde' }, env, 212000), 409);
  assert.equal(liveNow(s, beto, 212000).length, 0);
});

// Queixa real: "só salvou 1 segundo de live". Cada queda de rede abre um arquivo novo no MediaMTX; todos entram, em ordem.
test('gravação em partes: guarda todas em ordem e só serve as partes da própria publicação', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'opy-rec-')), id = 'aaaaaaaa-1111-4111-8111-111111111111';
  mkdirSync(join(dir, id));
  writeFileSync(join(dir, id, '2026-11-08_22-00-00-000000_Z.mp4'), 'x'.repeat(10));
  writeFileSync(join(dir, id, '2026-11-08_22-00-01-000000_Z.mp4'), 'y'.repeat(5000));
  writeFileSync(join(dir, id, '2026-11-08_22-03-00-000000_Z.mp4'), 'z'.repeat(9000));
  let state = { posts: [{ id, live: { endedAt: 1000 } }] };
  const store = { readState: async () => ({ data: state }), transact: async fn => fn(state) };
  await attachRecordings(store, { OPY_LIVE_RECORDINGS_DIR: dir }, 2000);
  const media = state.posts[0].media;
  assert.equal(media.parts.length, 3);
  assert.equal(media.url, media.parts[0]);
  assert.ok(media.parts[2].endsWith('22-03-00-000000_Z.mp4'));
  assert.ok(await recordingFile(state.posts[0], media.parts[2], { OPY_LIVE_RECORDINGS_DIR: dir }));
  assert.equal(await recordingFile(state.posts[0], `/live/recordings/${id}/../outra.mp4`, { OPY_LIVE_RECORDINGS_DIR: dir }), null);
});
