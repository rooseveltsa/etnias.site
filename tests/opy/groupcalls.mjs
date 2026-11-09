import test from 'node:test';
import assert from 'node:assert/strict';
import * as gc from '../../preview/server/groupcalls.mjs';

const people = ['Ana', 'Beto', 'Caio', 'Dani', 'Edu', 'Fia', 'Gui'].map((name, i) => ({ id: `${i + 1}`.repeat(8) + '-1111-4111-8111-111111111111', name }));
const [ana, beto, caio, , , , gui] = people;
const key = p => 'id:' + p.id;
const groupKey = 'group:99999999-1111-4111-8111-111111111111';
const fresh = () => ({ accounts: people, dms: [], chatGroups: [{ id: groupKey.slice(6), name: 'Roda', members: people.slice(0, 6).map(key).concat(key(gui)), invited: [] }] });
const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n';
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);
const view = (s, who, now, since = 0) => gc.groupCallsView(s, who, new URLSearchParams({ since: String(since) }), {}, now);

test('começar cria uma sala por grupo, avisa o grupo e quem chega entra na mesma sala', () => {
  const s = fresh();
  const r = gc.groupCallAction(s, ana, { action: 'gcall_start', groupKey, kind: 'video' }, 1000);
  assert.equal(r.notify.length, 6); assert.match(s.dms.at(-1).text, /chamada de vídeo em grupo/);
  const again = gc.groupCallAction(s, beto, { action: 'gcall_start', groupKey, kind: 'audio' }, 1100);
  assert.equal(again.callId, r.callId); assert.equal(again.notify.length, 0);
  const v = view(s, caio, 1200);
  assert.equal(v.calls.length, 1); assert.equal(v.calls[0].joined, false); assert.equal(v.calls[0].members.length, 2); assert.equal(v.calls[0].signals, undefined);
});

test('quem não é do grupo não começa, não entra e não vê', () => {
  const s = fresh(); s.chatGroups[0].members = [key(ana), key(beto)];
  rejects(() => gc.groupCallAction(s, caio, { action: 'gcall_start', groupKey, kind: 'video' }, 1000), 404);
  const { callId } = gc.groupCallAction(s, ana, { action: 'gcall_start', groupKey, kind: 'video' }, 1000);
  rejects(() => gc.groupCallAction(s, caio, { action: 'gcall_join', callId }, 1000), 403);
  assert.equal(view(s, caio, 1000).calls.length, 0);
});

test('sinais só chegam ao destinatário, em ordem, e o limite de 6 pessoas vale', () => {
  const s = fresh();
  const { callId } = gc.groupCallAction(s, ana, { action: 'gcall_start', groupKey, kind: 'video' }, 1000);
  gc.groupCallAction(s, beto, { action: 'gcall_join', callId }, 1001);
  rejects(() => gc.groupCallAction(s, caio, { action: 'gcall_signal', callId, to: key(ana), type: 'offer', sdp }, 1002), 409);
  gc.groupCallAction(s, beto, { action: 'gcall_signal', callId, to: key(ana), type: 'offer', sdp }, 1002);
  rejects(() => gc.groupCallAction(s, beto, { action: 'gcall_signal', callId, to: key(ana), type: 'offer', sdp: '<script>' }, 1003), 400);
  const forAna = view(s, ana, 1004).calls[0].signals;
  assert.equal(forAna.length, 1); assert.equal(forAna[0].from, key(beto));
  assert.equal(view(s, beto, 1004).calls[0].signals.length, 0);
  assert.equal(view(s, ana, 1004, forAna[0].seq).calls[0].signals.length, 0);
  for (const p of people.slice(2, 6)) gc.groupCallAction(s, p, { action: 'gcall_join', callId }, 1005);
  rejects(() => gc.groupCallAction(s, gui, { action: 'gcall_join', callId }, 1006), 409);
});

test('quem para de dar sinal sai; sala vazia termina', () => {
  const s = fresh();
  const { callId } = gc.groupCallAction(s, ana, { action: 'gcall_start', groupKey, kind: 'video' }, 1000);
  gc.groupCallAction(s, beto, { action: 'gcall_join', callId }, 1000);
  gc.groupCallAction(s, beto, { action: 'gcall_beat', callId }, 20000);
  assert.deepEqual(view(s, beto, 30000).calls[0].members.map(m => m.key), [key(beto)]);
  gc.groupCallAction(s, beto, { action: 'gcall_leave', callId }, 30001);
  assert.equal(view(s, beto, 30002).calls.length, 0);
  rejects(() => gc.groupCallAction(s, ana, { action: 'gcall_join', callId }, 30003), 404);
});
