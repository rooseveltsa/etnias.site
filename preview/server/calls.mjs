import { createHmac, randomUUID } from 'node:crypto';

// Chamadas 1:1 por WebRTC. O servidor só troca a oferta e a resposta SDP (sem trickle ICE)
// e registra o resultado na conversa; áudio e vídeo trafegam direto entre as pessoas ou pelo TURN próprio.
export const callActions = ['call_start', 'call_accept', 'call_decline', 'call_end'];
export const RING_MS = 45000;
const MAX_ACTIVE_MS = 4 * 60 * 60 * 1000;
const SDP_MAX = 20000;
const TURN_TTL_S = 6 * 60 * 60;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const keyOf = me => `id:${me.id}`;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function person(state, key) {
  const account = typeof key === 'string' && key.startsWith('id:') && state.accounts?.find(a => `id:${a.id}` === key);
  if (!account) fail(404, 'Esta pessoa não tem conta nesta prévia.');
  return account;
}
function blocked(state, a, b) { return !!(state.chatBlocks?.[a]?.includes(b) || state.chatBlocks?.[b]?.includes(a)); }
function description(value, type) {
  if (!value || typeof value !== 'object' || value.type !== type || typeof value.sdp !== 'string' || !value.sdp.startsWith('v=0') || value.sdp.length > SDP_MAX) fail(400, 'Sinal de chamada inválido. Tente ligar de novo.');
  return { type, sdp: value.sdp };
}
const live = c => c.status === 'ringing' || c.status === 'active';
function duration(seconds) {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
export function callLabel(call) {
  const kind = call.kind === 'video' ? 'Chamada de vídeo' : 'Chamada de voz';
  if (call.status === 'ended') return `${kind} · ${duration(call.duration)}`;
  return `${kind} ${{ missed: 'perdida', declined: 'recusada', failed: 'sem conexão' }[call.status] || 'encerrada'}`;
}
function finish(state, call, status, now) {
  call.status = status;
  call.endedAt = now;
  delete call.offer;
  delete call.answer;
  const record = { kind: call.kind, status, duration: call.answeredAt ? Math.max(0, Math.round((now - call.answeredAt) / 1000)) : 0 };
  state.dms ||= [];
  state.dms.push({ id: randomUUID(), clientId: randomUUID(), digest: '', fromKey: call.fromKey, fromName: call.fromName, toKey: call.toKey, toName: call.toName,
    text: callLabel(record), createdAt: now, replyTo: null, call: { ...record, callId: call.id } });
}
// Encerra chamadas que tocaram demais ou ficaram presas. Roda em toda escrita.
export function settleCalls(state, now = Date.now()) {
  if (!Array.isArray(state.calls)) return;
  for (const call of state.calls) {
    if (call.status === 'ringing' && now - call.createdAt > RING_MS) finish(state, call, 'missed', now);
    else if (call.status === 'active' && now - call.answeredAt > MAX_ACTIVE_MS) finish(state, call, 'ended', now);
  }
  const done = state.calls.filter(c => !live(c));
  if (done.length > 200) { const drop = new Set(done.slice(0, done.length - 200)); state.calls = state.calls.filter(c => !drop.has(c)); }
}
function inCall(state, key, now) {
  return (state.calls || []).some(c => (c.fromKey === key || c.toKey === key) && live(c) && !(c.status === 'ringing' && now - c.createdAt > RING_MS));
}
function callOf(state, me, id) {
  const call = uuid.test(id || '') && state.calls?.find(c => c.id === id);
  if (!call || ![call.fromKey, call.toKey].includes(keyOf(me))) fail(404, 'Chamada não encontrada.');
  return call;
}
export function callAction(state, me, body, now = Date.now()) {
  const mine = keyOf(me);
  state.calls ||= [];
  settleCalls(state, now);
  if (body.action === 'call_start') {
    if (!['audio', 'video'].includes(body.kind)) fail(400, 'Escolha chamada de voz ou de vídeo.');
    if (body.toKey === mine) fail(400, 'Escolha outra pessoa para ligar.');
    const other = person(state, body.toKey);
    if (blocked(state, mine, body.toKey)) fail(403, 'Conversa bloqueada. Não é possível ligar.');
    // Só liga para quem já escreveu para você: evita chamadas de desconhecidos.
    if (!(state.dms || []).some(m => m.fromKey === body.toKey && m.toKey === mine && !m.call && !m.deleted)) fail(403, 'Você poderá ligar depois que esta pessoa responder a uma mensagem sua.');
    if (inCall(state, mine, now)) fail(409, 'Você já está em uma chamada.');
    if (inCall(state, body.toKey, now)) fail(409, `${other.name} está em outra chamada. Tente mais tarde.`);
    const offer = description(body.offer, 'offer');
    const call = { id: randomUUID(), kind: body.kind, fromKey: mine, fromName: me.name, toKey: body.toKey, toName: other.name, status: 'ringing', createdAt: now, answeredAt: 0, endedAt: 0, offer };
    state.calls.push(call);
    return { callId: call.id };
  }
  const call = callOf(state, me, body.callId);
  if (body.action === 'call_accept') {
    if (call.toKey !== mine) fail(403, 'Só quem recebe a chamada pode atender.');
    if (call.status !== 'ringing') fail(409, 'Esta chamada já terminou.');
    call.answer = description(body.answer, 'answer');
    call.status = 'active';
    call.answeredAt = now;
    delete call.offer;
    return { callId: call.id };
  }
  if (!live(call)) return { callId: call.id };
  if (body.action === 'call_decline') {
    if (call.toKey !== mine || call.status !== 'ringing') fail(409, 'Não há chamada para recusar.');
    finish(state, call, 'declined', now);
  } else if (body.action === 'call_end') {
    finish(state, call, call.status === 'ringing' ? (call.toKey === mine ? 'declined' : 'missed') : body.failed === true && now - call.answeredAt < 30000 ? 'failed' : 'ended', now);
  }
  return { callId: call.id };
}
export function iceServers(me, env = process.env, now = Date.now()) {
  const list = value => String(value || '').split(',').map(v => v.trim()).filter(v => /^(stun|turns?):/.test(v));
  const turn = list(env.OPY_TURN_URLS), secret = env.OPY_TURN_SECRET || '';
  const stun = list(env.OPY_STUN_URLS);
  const servers = [];
  if (stun.length) servers.push({ urls: stun });
  if (turn.length && secret.length >= 16) {
    const username = `${Math.floor(now / 1000) + TURN_TTL_S}:${me.id}`;
    servers.push({ urls: turn, username, credential: createHmac('sha1', secret).update(username).digest('base64') });
  }
  // shortcut: sem STUN/TURN configurado, usa o STUN público do Google; funciona na maioria das redes, mas não atravessa CGNAT. Configure o coturn da VPS.
  if (!servers.length) servers.push({ urls: ['stun:stun.l.google.com:19302'] });
  return servers;
}
export function callsView(state, me, params = new URLSearchParams(), env = process.env, now = Date.now()) {
  const mine = keyOf(me), id = params.get('id') || '';
  const mineCalls = (state.calls || []).filter(c => c.fromKey === mine || c.toKey === mine);
  const call = (id && mineCalls.find(c => c.id === id)) || mineCalls.filter(c => live(c) && !(c.status === 'ringing' && now - c.createdAt > RING_MS)).at(-1);
  const project = c => {
    const caller = c.fromKey === mine, expired = c.status === 'ringing' && now - c.createdAt > RING_MS;
    return { id: c.id, kind: c.kind, role: caller ? 'caller' : 'callee', status: expired ? 'missed' : c.status,
      peer: { key: caller ? c.toKey : c.fromKey, name: caller ? c.toName : c.fromName },
      createdAt: c.createdAt, answeredAt: c.answeredAt || 0,
      ...(!caller && c.status === 'ringing' && !expired && c.offer ? { offer: c.offer } : {}),
      ...(caller && c.status === 'active' && c.answer ? { answer: c.answer } : {}) };
  };
  return { call: call ? project(call) : null, iceServers: iceServers(me, env, now), ringMs: RING_MS };
}
