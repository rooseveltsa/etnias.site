import { randomUUID } from 'node:crypto';
import { iceServers } from './calls.mjs';

// Chamada em grupo (até 6 pessoas) numa conversa de grupo. Malha WebRTC: cada participante se liga direto aos outros
// (ou pelo TURN próprio). O servidor só guarda quem está na sala e repassa ofertas/respostas SDP completas entre pares.
// Quem entra oferece a quem já está; presença por batimento (some quem fica 25 s sem sinal; sala vazia encerra).
export const groupCallActions = ['gcall_start', 'gcall_join', 'gcall_leave', 'gcall_signal', 'gcall_beat'];
export const GCALL_MAX = 6;
const STALE_MS = 25000, SIGNAL_TTL_MS = 60000, SDP_MAX = 20000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const keyOf = me => `id:${me.id}`;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const groupOf = (state, key) => state.chatGroups?.find(g => `group:${g.id}` === key);
const present = (c, now) => Object.entries(c.members).filter(([, m]) => now - m.seen < STALE_MS);

export function settleGroupCalls(state, now = Date.now()) {
  if (!Array.isArray(state.groupCalls)) return;
  for (const c of state.groupCalls) {
    if (c.endedAt) continue;
    for (const [k, m] of Object.entries(c.members)) if (now - m.seen >= STALE_MS) delete c.members[k];
    c.signals = c.signals.filter(s => now - s.at < SIGNAL_TTL_MS && c.members[s.to]);
    if (!Object.keys(c.members).length) { c.endedAt = now; c.signals = []; }
  }
  const ended = state.groupCalls.filter(c => c.endedAt);
  if (ended.length > 50) { const drop = new Set(ended.slice(0, ended.length - 50)); state.groupCalls = state.groupCalls.filter(c => !drop.has(c)); }
}
function activeFor(state, groupKey) { return (state.groupCalls || []).find(c => !c.endedAt && c.groupKey === groupKey); }
function join(c, me, now) {
  const mine = keyOf(me);
  if (!c.members[mine] && Object.keys(c.members).length >= GCALL_MAX) fail(409, `A chamada já tem ${GCALL_MAX} pessoas, o máximo nesta versão.`);
  c.members[mine] = { name: me.name, seen: now, joinedAt: c.members[mine]?.joinedAt || now };
  // Entrou de novo (recarregou a página): sinais antigos para e de mim não valem mais.
  c.signals = c.signals.filter(s => s.to !== mine && s.from !== mine);
}
export function groupCallAction(state, me, body, now = Date.now()) {
  const mine = keyOf(me);
  state.groupCalls ||= [];
  settleGroupCalls(state, now);
  if (body.action === 'gcall_start') {
    const g = groupOf(state, body.groupKey);
    if (!g?.members.includes(mine)) fail(404, 'Conversa de grupo não encontrada.');
    if (!['audio', 'video'].includes(body.kind)) fail(400, 'Escolha chamada de voz ou de vídeo.');
    let c = activeFor(state, body.groupKey), notify = [];
    if (!c) {
      c = { id: randomUUID(), groupKey: body.groupKey, groupName: g.name, kind: body.kind, startedBy: mine, createdAt: now, endedAt: 0, members: {}, signals: [], seq: 0 };
      state.groupCalls.push(c);
      state.dms ||= [];
      state.dms.push({ id: randomUUID(), clientId: randomUUID(), digest: '', fromKey: mine, fromName: me.name, toKey: body.groupKey, toName: g.name,
        text: `📞 ${me.name} começou uma chamada ${c.kind === 'video' ? 'de vídeo' : 'de voz'} em grupo. Entre pela conversa.`, createdAt: now, replyTo: null });
      notify = g.members.filter(k => k !== mine && k.startsWith('id:')).map(k => k.slice(3));
    }
    join(c, me, now);
    return { callId: c.id, notify, push: { title: `${me.name} · ${g.name}`, body: 'Chamada em grupo agora. Toque para entrar.', href: '/chat/?p=' + encodeURIComponent(body.groupKey) } };
  }
  const c = uuid.test(body.callId || '') && state.groupCalls.find(x => x.id === body.callId && !x.endedAt);
  if (!c) fail(404, 'Esta chamada em grupo já terminou.');
  if (!groupOf(state, c.groupKey)?.members.includes(mine)) fail(403, 'Você não participa deste grupo.');
  if (body.action === 'gcall_join') { join(c, me, now); return { callId: c.id }; }
  if (!c.members[mine]) fail(409, 'Entre na chamada antes.');
  if (body.action === 'gcall_beat') { c.members[mine].seen = now; return { callId: c.id }; }
  if (body.action === 'gcall_leave') {
    delete c.members[mine]; c.signals = c.signals.filter(s => s.to !== mine && s.from !== mine);
    if (!Object.keys(c.members).length) { c.endedAt = now; c.signals = []; }
    return { callId: c.id };
  }
  // gcall_signal: oferta ou resposta para outra pessoa da sala.
  if (!c.members[body.to] || body.to === mine) fail(404, 'Esta pessoa saiu da chamada.');
  if (!['offer', 'answer'].includes(body.type) || typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0') || body.sdp.length > SDP_MAX) fail(400, 'Sinal de chamada inválido.');
  c.members[mine].seen = now;
  c.signals = c.signals.filter(s => !(s.from === mine && s.to === body.to && s.type === body.type));
  c.signals.push({ seq: ++c.seq, from: mine, to: body.to, type: body.type, sdp: body.sdp, at: now });
  return { callId: c.id };
}
// Salas ativas dos meus grupos (para o aviso "chamada em andamento") e, na sala em que estou, os sinais para mim.
export function groupCallsView(state, me, params = new URLSearchParams(), env = process.env, now = Date.now()) {
  const mine = keyOf(me), since = Number(params.get('since')) || 0;
  const groups = new Set((state.chatGroups || []).filter(g => g.members.includes(mine)).map(g => `group:${g.id}`));
  const calls = (state.groupCalls || []).filter(c => !c.endedAt && groups.has(c.groupKey) && present(c, now).length).map(c => {
    const joined = !!c.members[mine] && now - c.members[mine].seen < STALE_MS;
    return { id: c.id, groupKey: c.groupKey, groupName: c.groupName, kind: c.kind, joined,
      members: present(c, now).map(([key, m]) => ({ key, name: m.name, joinedAt: m.joinedAt })),
      ...(joined ? { signals: c.signals.filter(s => s.to === mine && s.seq > since).map(({ seq, from, type, sdp }) => ({ seq, from, type, sdp })) } : {}) };
  });
  return { me: mine, calls, iceServers: iceServers(me, env, now), max: GCALL_MAX };
}
