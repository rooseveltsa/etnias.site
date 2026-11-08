import webpush from 'web-push';

// Avisos no aparelho (Web Push com VAPID). Chaves em OPY_VAPID_PUBLIC_KEY / OPY_VAPID_PRIVATE_KEY (gerar com
// `npx web-push generate-vapid-keys`); sem elas o recurso fica desligado e o cliente não oferece o botão.
export const pushActions = ['push_subscribe', 'push_unsubscribe'];
const configured = env => !!(env.OPY_VAPID_PUBLIC_KEY && env.OPY_VAPID_PRIVATE_KEY);
function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export const pushPublicKey = (env = process.env) => configured(env) ? env.OPY_VAPID_PUBLIC_KEY : '';

export function pushAction(state, me, body) {
  state.pushSubscriptions ||= {};
  const list = state.pushSubscriptions[me.id] || [];
  if (body.action === 'push_unsubscribe') {
    state.pushSubscriptions[me.id] = list.filter(s => s.endpoint !== String(body.endpoint || ''));
    return {};
  }
  const sub = body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\/\S{1,1000}$/.test(sub.endpoint) || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string' || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) fail(400, 'Inscrição de avisos inválida.');
  // Até 5 aparelhos por pessoa; reinscrever o mesmo endpoint só o atualiza.
  state.pushSubscriptions[me.id] = [...list.filter(s => s.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, createdAt: Date.now() }].slice(-5);
  return {};
}

// Fora da transação da ação: uma falha de entrega nunca desfaz o comentário ou a mensagem. 404/410 = inscrição morta, sai do estado.
export async function sendPush(store, accountIds, payload, env = process.env, send = webpush.sendNotification.bind(webpush)) {
  if (!configured(env) || !accountIds.length) return { sent: 0, removed: 0 };
  webpush.setVapidDetails(env.OPY_VAPID_SUBJECT || 'https://etnias.site', env.OPY_VAPID_PUBLIC_KEY, env.OPY_VAPID_PRIVATE_KEY);
  const { data } = await store.readState();
  const dead = [];
  let sent = 0;
  await Promise.all([...new Set(accountIds)].flatMap(id => (data.pushSubscriptions?.[id] || []).map(async s => {
    try { await send({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 86400 }); sent++; }
    catch (error) { if (error.statusCode === 404 || error.statusCode === 410) dead.push([id, s.endpoint]); else console.error('push:', error.statusCode || '', error.message); }
  })));
  if (dead.length) await store.transact(state => { for (const [id, endpoint] of dead) if (state.pushSubscriptions?.[id]) state.pushSubscriptions[id] = state.pushSubscriptions[id].filter(s => s.endpoint !== endpoint); });
  return { sent, removed: dead.length };
}
