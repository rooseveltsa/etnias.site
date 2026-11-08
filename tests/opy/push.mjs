import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { pushAction, sendPush, pushPublicKey } from '../../preview/server/push.mjs';

const me = { id: 'a0000000-0000-4000-8000-000000000001', name: 'Ana' };
const sub = n => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } });
const keys = webpush.generateVAPIDKeys();
const env = { OPY_VAPID_PUBLIC_KEY: keys.publicKey, OPY_VAPID_PRIVATE_KEY: keys.privateKey };
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);

test('inscrição: valida o formato, guarda no máximo 5 aparelhos e remove por endpoint', () => {
  const state = {};
  rejects(() => pushAction(state, me, { action: 'push_subscribe', subscription: { endpoint: 'http://inseguro', keys: sub(1).keys } }), 400);
  rejects(() => pushAction(state, me, { action: 'push_subscribe', subscription: { endpoint: 'https://ok', keys: { p256dh: 'x' } } }), 400);
  for (let i = 1; i <= 6; i++) pushAction(state, me, { action: 'push_subscribe', subscription: sub(i) });
  assert.equal(state.pushSubscriptions[me.id].length, 5);
  assert.equal(state.pushSubscriptions[me.id][0].endpoint, 'https://push.example/2', 'a mais antiga sai');
  pushAction(state, me, { action: 'push_subscribe', subscription: sub(6) });
  assert.equal(state.pushSubscriptions[me.id].length, 5, 'reinscrever o mesmo endpoint não duplica');
  pushAction(state, me, { action: 'push_unsubscribe', endpoint: 'https://push.example/6' });
  assert.equal(state.pushSubscriptions[me.id].some(s => s.endpoint.endsWith('/6')), false);
  assert.equal(pushPublicKey({}), ''); assert.equal(pushPublicKey(env), keys.publicKey);
});

test('envio: um pedido por aparelho, inscrições mortas (410) saem do estado, sem chaves nada é enviado', async () => {
  const state = { pushSubscriptions: { [me.id]: [sub(1), sub(2)], outro: [sub(3)] } };
  const store = { readState: async () => ({ data: structuredClone(state) }), transact: async fn => { fn(state); return { data: state }; } };
  const calls = [];
  const send = async (s, payload) => { calls.push([s.endpoint, JSON.parse(payload)]); if (s.endpoint.endsWith('/2')) throw Object.assign(new Error('Gone'), { statusCode: 410 }); };
  const out = await sendPush(store, [me.id, me.id, 'ninguem'], { title: 'Oi', body: 'x' }, env, send);
  assert.deepEqual(out, { sent: 1, removed: 1 });
  assert.deepEqual(calls.map(c => c[0]).sort(), ['https://push.example/1', 'https://push.example/2'], 'cada aparelho uma vez, só dos destinatários');
  assert.equal(calls[0][1].title, 'Oi');
  assert.deepEqual(state.pushSubscriptions[me.id].map(s => s.endpoint), ['https://push.example/1']);
  assert.deepEqual(await sendPush(store, [me.id], {}, {}, async () => { throw new Error('não deveria enviar'); }), { sent: 0, removed: 0 });
});
