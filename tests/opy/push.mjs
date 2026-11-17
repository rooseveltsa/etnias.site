import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { pushAction, sendPush, pushPublicKey } from '../../preview/server/push.mjs';

const me = { id: 'a0000000-0000-4000-8000-000000000001', name: 'Ana' };
const sub = n => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } });
const keys = webpush.generateVAPIDKeys();
const env = { OPY_VAPID_PUBLIC_KEY: keys.publicKey, OPY_VAPID_PRIVATE_KEY: keys.privateKey };
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);

test('inscrição: valida o formato, guarda no máximo 5 aparelhos e remove por endpoint', () => {
  const state = {};
  rejects(() => pushAction(state, me, { action: 'push_subscribe', subscription: { endpoint: 'http://inseguro', keys: sub(1).keys } }), 400);
  rejects(() => pushAction(state, me, { action: 'push_subscribe', subscription: { endpoint: 'https://ok', keys: { p256dh: 'x' } } }), 400);
  for (let i = 1; i <= 6; i++) pushAction(state, me, { action: 'push_subscribe', subscription: sub(i) });
  assert.equal(state.pushSubscriptions[me.id].length, 5);
  assert.equal(state.pushSubscriptions[me.id][0].endpoint, 'https://fcm.googleapis.com/fcm/send/2', 'a mais antiga sai');
  pushAction(state, me, { action: 'push_subscribe', subscription: sub(6) });
  assert.equal(state.pushSubscriptions[me.id].length, 5, 'reinscrever o mesmo endpoint não duplica');
  pushAction(state, me, { action: 'push_unsubscribe', endpoint: 'https://fcm.googleapis.com/fcm/send/6' });
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
  assert.deepEqual(calls.map(c => c[0]).sort(), ['https://fcm.googleapis.com/fcm/send/1', 'https://fcm.googleapis.com/fcm/send/2'], 'cada aparelho uma vez, só dos destinatários');
  assert.equal(calls[0][1].title, 'Oi');
  assert.deepEqual(state.pushSubscriptions[me.id].map(s => s.endpoint), ['https://fcm.googleapis.com/fcm/send/1']);
  assert.deepEqual(await sendPush(store, [me.id], {}, {}, async () => { throw new Error('não deveria enviar'); }), { sent: 0, removed: 0 });
});

test('SSRF: só endereços de push de navegadores são aceitos', async () => {
  const { pushEndpointAllowed } = await import('../../preview/server/push.mjs');
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=1'])
    assert.equal(pushEndpointAllowed(ok), true, ok);
  for (const bad of ['https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.example/x', 'https://evil.example/push.services.mozilla.com', 'http://fcm.googleapis.com/x', 'https://u:p@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'https://internal:8101/', 'nao-e-url'])
    assert.equal(pushEndpointAllowed(bad), false, bad);
  const state = {}; const me = { id: 'x' };
  assert.throws(() => pushAction(state, me, { action: 'push_subscribe', subscription: { endpoint: 'https://127.0.0.1/x', keys: sub(1).keys } }), e => e.status === 400);
});
