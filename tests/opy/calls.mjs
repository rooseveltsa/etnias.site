import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import * as calls from '../../preview/server/calls.mjs';
import * as chat from '../../preview/server/chat.mjs';

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana' };
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Beto' };
const caio = { id: '33333333-3333-4333-8333-333333333333', name: 'Caio' };
const key = p => 'id:' + p.id;
const offer = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n' };
const answer = { type: 'answer', sdp: 'v=0\r\no=- 3 4 IN IP4 127.0.0.1\r\n' };
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);
const dm = (s, from, to) => chat.chatAction(s, from, { action: 'dm', toKey: key(to), text: 'Oi', clientId: randomUUID() });
// Ana e Beto já trocaram mensagens; Caio nunca escreveu para Ana.
function fresh() { const s = { accounts: [alice, bob, caio], dms: [] }; dm(s, alice, bob); dm(s, bob, alice); return s; }
const start = (s, who = alice, to = bob, now = 1000, kind = 'video') => calls.callAction(s, who, { action: 'call_start', toKey: key(to), kind, offer }, now);
const view = (s, who, now, id = '') => calls.callsView(s, who, new URLSearchParams(id ? { id } : {}), {}, now);

test('só liga para quem já escreveu, nunca para si, bloqueados ou contas inexistentes', () => {
  const s = fresh();
  rejects(() => start(s, alice, caio), 403);
  rejects(() => start(s, alice, alice), 400);
  rejects(() => calls.callAction(s, alice, { action: 'call_start', toKey: 'name:Acervo', kind: 'audio', offer }), 404);
  rejects(() => calls.callAction(s, alice, { action: 'call_start', toKey: key(bob), kind: 'tela', offer }), 400);
  rejects(() => calls.callAction(s, alice, { action: 'call_start', toKey: key(bob), kind: 'audio', offer: { type: 'offer', sdp: 'x'.repeat(30000) } }), 400);
  s.chatBlocks = { [key(bob)]: [key(alice)] };
  rejects(() => start(s, alice, bob), 403);
});

test('fluxo completo: toca, atende, troca SDP só com a pessoa certa e registra a duração', () => {
  const s = fresh();
  const { callId } = start(s, alice, bob, 1000);
  const incoming = view(s, bob, 2000).call;
  assert.equal(incoming.status, 'ringing'); assert.equal(incoming.role, 'callee'); assert.deepEqual(incoming.offer, offer);
  assert.equal(view(s, alice, 2000).call.offer, undefined, 'quem liga não recebe a própria oferta de volta');
  assert.equal(view(s, caio, 2000).call, null, 'terceiros não veem a chamada');
  rejects(() => calls.callAction(s, caio, { action: 'call_accept', callId, answer }, 2000), 404);
  rejects(() => calls.callAction(s, alice, { action: 'call_accept', callId, answer }, 2000), 403);
  calls.callAction(s, bob, { action: 'call_accept', callId, answer }, 3000);
  assert.deepEqual(view(s, alice, 3500).call.answer, answer);
  assert.equal(view(s, bob, 3500).call.answer, undefined);
  calls.callAction(s, bob, { action: 'call_end', callId }, 3000 + 125000);
  const ended = view(s, alice, 130000, callId).call;
  assert.equal(ended.status, 'ended'); assert.equal(ended.answer, undefined);
  const record = s.dms.at(-1);
  assert.equal(record.text, 'Chamada de vídeo · 2 min 5 s');
  assert.deepEqual(record.call, { kind: 'video', status: 'ended', duration: 125, callId });
  assert.equal(s.calls[0].offer, undefined, 'SDP não fica guardado depois do fim');
});

test('ocupado, recusa, cancelamento e chamada perdida por tempo', () => {
  const s = fresh();
  dm(s, bob, caio); dm(s, caio, bob);
  const { callId } = start(s, alice, bob, 1000, 'audio');
  rejects(() => start(s, caio, bob, 2000), 409);
  rejects(() => start(s, alice, bob, 2000), 409);
  calls.callAction(s, bob, { action: 'call_decline', callId }, 3000);
  assert.equal(s.dms.at(-1).text, 'Chamada de voz recusada');
  const second = start(s, alice, bob, 4000, 'audio').callId;
  calls.callAction(s, alice, { action: 'call_end', callId: second }, 5000);
  assert.equal(s.dms.at(-1).text, 'Chamada de voz perdida');
  start(s, alice, bob, 10000, 'audio');
  assert.equal(view(s, bob, 10000 + calls.RING_MS + 1).call, null, 'chamada vencida some da tela de quem recebe');
  calls.settleCalls(s, 10000 + calls.RING_MS + 1);
  assert.equal(s.dms.at(-1).text, 'Chamada de voz perdida');
  assert.doesNotThrow(() => start(s, alice, bob, 10000 + calls.RING_MS + 2), 'depois de vencer, é possível ligar de novo');
});

test('registro de chamada não aceita edição, reação nem resposta', () => {
  const s = fresh();
  const { callId } = start(s, alice, bob);
  calls.callAction(s, alice, { action: 'call_end', callId }, 2000);
  const id = s.dms.at(-1).id;
  rejects(() => chat.chatAction(s, alice, { action: 'chat_edit', messageId: id, text: 'falso' }), 400);
  rejects(() => chat.chatAction(s, bob, { action: 'chat_react', messageId: id, reaction: '👍' }), 400);
  rejects(() => chat.chatAction(s, bob, { action: 'dm', toKey: key(alice), text: 'r', replyTo: id, clientId: randomUUID() }), 400);
  assert.doesNotThrow(() => chat.chatAction(s, bob, { action: 'chat_delete', messageId: id, scope: 'me' }));
  const projected = chat.chatSnapshot(s, alice, new URLSearchParams({ key: key(bob) })).messages.at(-1);
  assert.deepEqual(projected.call, { kind: 'video', status: 'missed', duration: 0 });
});

test('credenciais TURN efêmeras no formato do coturn (use-auth-secret)', () => {
  const env = { OPY_TURN_URLS: 'turn:turn.exemplo.org:3478?transport=udp,turns:turn.exemplo.org:5349, javascript:alert(1)', OPY_TURN_SECRET: 's'.repeat(32), OPY_STUN_URLS: 'stun:turn.exemplo.org:3478' };
  const [stun, turn] = calls.iceServers(alice, env, 1_000_000);
  assert.deepEqual(stun.urls, ['stun:turn.exemplo.org:3478']);
  assert.deepEqual(turn.urls, ['turn:turn.exemplo.org:3478?transport=udp', 'turns:turn.exemplo.org:5349']);
  assert.equal(turn.username, `${1000 + 6 * 3600}:${alice.id}`);
  assert.equal(turn.credential, createHmac('sha1', env.OPY_TURN_SECRET).update(turn.username).digest('base64'));
  assert.deepEqual(calls.iceServers(alice, { OPY_TURN_URLS: 'turn:x', OPY_TURN_SECRET: 'curto' }), [{ urls: ['stun:stun.l.google.com:19302'] }], 'segredo fraco não gera credencial');
});
