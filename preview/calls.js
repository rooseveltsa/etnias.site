(() => {
'use strict';
// Chamadas 1:1 por WebRTC. Sinalização pela API (oferta/resposta SDP completas, sem trickle) com consulta periódica.
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
const svg = d => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
const icons = {
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3',
  cam: 'M2 7h14v10H2zM16 10l6-4v12l-6-4',
  flip: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5'
};
let call = null, pc = null, local = null, poller = 0, ringer = null, tick = 0, connectedAt = 0, disconnectTimer = 0, busy = false, facing = 'user';
const ui = {}, originalTitle = document.title;

async function api(body, params = {}) {
  const url = '/api/community?' + new URLSearchParams({ view: 'calls', ...params });
  const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(json.error || 'Não foi possível concluir a chamada.');
  return json;
}
function build() {
  if (ui.root) return;
  const root = node('dialog', undefined, 'call-screen'); root.id = 'call-screen'; root.setAttribute('aria-labelledby', 'call-name');
  const remote = node('video', undefined, 'call-remote'); remote.autoplay = true; remote.playsInline = true;
  const self = node('video', undefined, 'call-self'); self.autoplay = true; self.playsInline = true; self.muted = true;
  const audio = node('audio'); audio.autoplay = true;
  const top = node('div', undefined, 'call-top');
  const avatar = node('span', '', 'call-avatar'); avatar.setAttribute('aria-hidden', 'true');
  const name = node('h2', '', 'call-name'); name.id = 'call-name';
  const state = node('p', '', 'call-state'); state.setAttribute('role', 'status');
  top.append(avatar, name, state);
  const controls = node('div', undefined, 'call-controls');
  const control = (label, icon, cls, fn) => { const b = node('button', undefined, 'call-btn ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(svg(icons[icon]), node('span', label)); b.onclick = fn; controls.append(b); return b; };
  ui.mute = control('Microfone', 'mic', 'is-toggle', toggleMic);
  ui.camera = control('Câmera', 'cam', 'is-toggle', toggleCamera);
  ui.flip = control('Virar câmera', 'flip', 'is-toggle', flipCamera);
  ui.decline = control('Recusar', 'phone', 'is-end', () => hangup('call_decline'));
  ui.accept = control('Atender', 'phone', 'is-accept', accept);
  ui.end = control('Encerrar', 'phone', 'is-end', () => hangup('call_end'));
  root.append(remote, self, audio, top, controls);
  // Esc não fecha a tela sem encerrar a chamada.
  root.addEventListener('cancel', e => { e.preventDefault(); });
  document.body.append(root);
  Object.assign(ui, { root, remote, self, audio, avatar, name, state });
}
function show(mode) {
  build();
  const video = call.kind === 'video';
  ui.root.dataset.mode = mode; ui.root.dataset.kind = call.kind;
  ui.name.textContent = call.peer.name; ui.avatar.textContent = call.peer.name.slice(0, 1).toLocaleUpperCase('pt-BR');
  ui.accept.hidden = ui.decline.hidden = mode !== 'incoming';
  ui.end.hidden = mode === 'incoming';
  ui.mute.hidden = mode === 'incoming';
  ui.camera.hidden = ui.flip.hidden = mode === 'incoming' || !video;
  ui.state.textContent = { incoming: video ? 'Chamada de vídeo' : 'Chamada de voz', outgoing: 'Chamando…', connecting: 'Conectando…', active: '' }[mode];
  if (!ui.root.open) ui.root.showModal();
  (mode === 'incoming' ? ui.accept : ui.end).focus();
}
function ring(kind) {
  stopRing();
  try {
    const ctx = new AudioContext(); const gain = ctx.createGain(); gain.gain.value = 0.06; gain.connect(ctx.destination);
    const beep = () => { [0, 0.45].forEach(at => { const o = ctx.createOscillator(); o.frequency.value = kind === 'incoming' ? 660 : 440; o.connect(gain); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.3); }); if (kind === 'incoming') navigator.vibrate?.([300, 150, 300]); };
    beep(); const id = setInterval(beep, 2500); ringer = { ctx, id };
  } catch { /* sem áudio de toque: a tela continua visível */ }
}
function stopRing() { if (!ringer) return; clearInterval(ringer.id); ringer.ctx.close().catch(() => {}); ringer = null; navigator.vibrate?.(0); }
async function media(kind) {
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw Error('Este navegador não faz chamadas. Atualize o navegador ou use outro aparelho.');
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: kind === 'video' ? { facingMode: facing, width: { ideal: 960 }, height: { ideal: 540 } } : false });
  } catch (e) {
    throw Error(e.name === 'NotAllowedError' ? 'Permita o microfone' + (kind === 'video' ? ' e a câmera' : '') + ' no navegador para fazer a chamada.' : e.name === 'NotFoundError' ? 'Nenhum microfone ou câmera encontrado neste aparelho.' : 'Não foi possível abrir o microfone ou a câmera.');
  }
}
function gathered(peer) {
  return new Promise(resolve => {
    if (peer.iceGatheringState === 'complete') return resolve();
    const done = () => { if (peer.iceGatheringState === 'complete') { clearTimeout(t); peer.removeEventListener('icegatheringstatechange', done); resolve(); } };
    const t = setTimeout(resolve, 3000);
    peer.addEventListener('icegatheringstatechange', done);
  });
}
const clock = () => { const s = Math.floor((Date.now() - connectedAt) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function connect(iceServers) {
  pc = new RTCPeerConnection({ iceServers });
  local.getTracks().forEach(track => pc.addTrack(track, local));
  pc.ontrack = e => { const stream = e.streams[0]; if (call?.kind === 'video') ui.remote.srcObject = stream; ui.audio.srcObject = stream; ui.audio.play?.().catch(() => {}); };
  pc.onconnectionstatechange = () => {
    if (!pc) return;
    const s = pc.connectionState;
    if (s === 'connected') {
      clearTimeout(disconnectTimer);
      if (!connectedAt) { connectedAt = Date.now(); stopRing(); show('active'); clearInterval(tick); tick = setInterval(() => { if (connectedAt && pc?.connectionState === 'connected') ui.state.textContent = clock(); }, 1000); }
      ui.state.textContent = clock();
    } else if (s === 'disconnected') {
      ui.state.textContent = 'Reconectando…'; clearTimeout(disconnectTimer);
      disconnectTimer = setTimeout(() => { if (pc && pc.connectionState !== 'connected') hangup('call_end', true); }, 10000);
    } else if (s === 'failed') hangup('call_end', true);
  };
  if (call.kind === 'video') ui.self.srcObject = local;
}
function teardown(message) {
  stopRing(); clearInterval(tick); clearTimeout(disconnectTimer);
  pc?.close(); pc = null;
  local?.getTracks().forEach(t => t.stop()); local = null;
  if (ui.root) { ui.remote.srcObject = null; ui.self.srcObject = null; ui.audio.srcObject = null; }
  const ended = call; call = null; connectedAt = 0; document.title = originalTitle;
  if (ui.root?.open) {
    if (message) { ui.root.dataset.mode = 'ended'; ui.state.textContent = message; [ui.accept, ui.decline, ui.mute, ui.camera, ui.flip, ui.end].forEach(b => { b.hidden = true; }); setTimeout(() => { if (!call && ui.root.open) ui.root.close(); }, 1800); }
    else ui.root.close();
  }
  if (ended) window.dispatchEvent(new CustomEvent('opy:call-ended', { detail: { id: ended.id } }));
  schedule();
}
const endMessages = { declined: 'Chamada recusada', missed: 'Ninguém atendeu', ended: 'Chamada encerrada', failed: 'A conexão caiu' };
async function hangup(action, failed = false) {
  if (!call) return;
  const current = call;
  teardown(failed ? endMessages.failed : current.role === 'caller' && current.status === 'ringing' ? 'Chamada cancelada' : endMessages.ended);
  if (current.id) await api({ action, callId: current.id, ...(failed ? { failed: true } : {}) }).catch(() => {});
}
function toggleMic() { const track = local?.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; ui.mute.setAttribute('aria-pressed', String(!track.enabled)); ui.mute.querySelector('span').textContent = track.enabled ? 'Microfone' : 'Sem som'; }
function toggleCamera() { const track = local?.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; ui.camera.setAttribute('aria-pressed', String(!track.enabled)); ui.camera.querySelector('span').textContent = track.enabled ? 'Câmera' : 'Câmera desligada'; }
async function flipCamera() {
  if (!local || call?.kind !== 'video') return;
  facing = facing === 'user' ? 'environment' : 'user';
  try {
    const next = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })).getVideoTracks()[0];
    const old = local.getVideoTracks()[0];
    await pc?.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(next);
    local.removeTrack(old); old.stop(); local.addTrack(next); ui.self.srcObject = local;
  } catch { facing = facing === 'user' ? 'environment' : 'user'; }
}
async function start({ key, name, kind }) {
  if (call) throw Error('Você já está em uma chamada.');
  call = { id: '', kind, role: 'caller', status: 'ringing', peer: { key, name } };
  show('outgoing');
  try {
    const { iceServers } = await api();
    local = await media(kind);
    connect(iceServers);
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const result = await api({ action: 'call_start', toKey: key, kind, offer: { type: 'offer', sdp: pc.localDescription.sdp } });
    // Encerrada enquanto a oferta era enviada: avisa o servidor e para.
    if (!call) { if (result.call?.id) api({ action: 'call_end', callId: result.call.id }).catch(() => {}); return; }
    call = result.call;
    ring('outgoing');
    schedule(1000);
  } catch (e) { teardown(e.message); throw e; }
}
async function accept() {
  if (!call || call.role !== 'callee' || busy) return;
  busy = true; stopRing(); show('connecting');
  try {
    const { iceServers } = await api();
    local = await media(call.kind);
    connect(iceServers);
    await pc.setRemoteDescription(call.offer);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    const result = await api({ action: 'call_accept', callId: call.id, answer: { type: 'answer', sdp: pc.localDescription.sdp } });
    if (call) call.status = result.call?.status || 'active';
    schedule(2000);
  } catch (e) { const current = call; teardown(e.message); if (current) api({ action: 'call_end', callId: current.id, failed: true }).catch(() => {}); }
  finally { busy = false; }
}
async function poll() {
  if (busy) return;
  try {
    const { call: latest } = await api(null, call?.id ? { id: call.id } : {});
    if (!call) {
      // Chamada recebida em qualquer página do aplicativo.
      if (latest?.role === 'callee' && latest.status === 'ringing' && latest.offer) { call = latest; show('incoming'); ring('incoming'); document.title = '📞 ' + latest.peer.name; }
      return;
    }
    if (!call.id || !latest || latest.id !== call.id) return;
    if (['declined', 'missed', 'ended', 'failed'].includes(latest.status)) { teardown(call.role === 'callee' && latest.status === 'missed' ? 'Chamada perdida' : endMessages[latest.status]); return; }
    if (call.role === 'caller' && latest.status === 'active' && latest.answer && pc && !pc.currentRemoteDescription) {
      busy = true;
      try { stopRing(); show('connecting'); await pc.setRemoteDescription(latest.answer); call.status = 'active'; }
      finally { busy = false; }
    }
  } catch { /* rede instável: tenta de novo no próximo ciclo */ }
}
function schedule(ms) {
  clearTimeout(poller);
  // Em chamada: 1 a 2 s. Sem chamada: 3 s com a aba visível, 8 s em segundo plano.
  const wait = ms || (call ? (call.status === 'active' ? 2000 : 1000) : document.hidden ? 8000 : 3000);
  poller = setTimeout(async () => { await poll(); schedule(); }, wait);
}
window.addEventListener('beforeunload', e => { if (call?.status === 'active') { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('pagehide', () => {
  if (!call?.id) return;
  fetch('/api/community?view=calls', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: call.role === 'callee' && call.status === 'ringing' ? 'call_decline' : 'call_end', callId: call.id }) }).catch(() => {});
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && !call) schedule(200); });

// ---------- Chamada em grupo (malha, até 6 pessoas) ----------
// Cada pessoa se liga direto às outras. Quem entra depois oferece a quem já estava; sinais (SDP completo) pela API.
let gc = null, gcPoll = 0, gcBeat = 0, gcBusy = false;
const gui = {};
async function gapi(body, params = {}) {
  const url = '/api/community?' + new URLSearchParams({ view: 'gcalls', ...params });
  const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(json.error || 'Não foi possível concluir a chamada em grupo.');
  return json;
}
function gbuild() {
  if (gui.root) return;
  const root = node('dialog', undefined, 'call-screen gcall-screen'); root.setAttribute('aria-labelledby', 'gcall-name');
  const top = node('div', undefined, 'call-top'); const name = node('h2', '', 'call-name'); name.id = 'gcall-name'; const st = node('p', '', 'call-state'); st.setAttribute('role', 'status'); top.append(name, st);
  const grid = node('div', undefined, 'gcall-grid');
  const controls = node('div', undefined, 'call-controls');
  const control = (label, icon, cls, fn) => { const b = node('button', undefined, 'call-btn ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(svg(icons[icon]), node('span', label)); b.onclick = fn; controls.append(b); return b; };
  gui.mute = control('Microfone', 'mic', 'is-toggle', () => { const t = gc?.local.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; gui.mute.setAttribute('aria-pressed', String(!t.enabled)); gui.mute.querySelector('span').textContent = t.enabled ? 'Microfone' : 'Sem som'; });
  gui.camera = control('Câmera', 'cam', 'is-toggle', () => { const t = gc?.local.getVideoTracks()[0]; if (!t) return; t.enabled = !t.enabled; gui.camera.setAttribute('aria-pressed', String(!t.enabled)); gui.camera.querySelector('span').textContent = t.enabled ? 'Câmera' : 'Câmera desligada'; });
  control('Sair', 'phone', 'is-end', () => leaveGroup());
  root.append(top, grid, controls); root.addEventListener('cancel', e => e.preventDefault());
  document.body.append(root); Object.assign(gui, { root, name, st, grid });
}
function tile(key, name, stream, self) {
  let t = gui.grid.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (!t) {
    t = node('figure', undefined, 'gcall-tile' + (self ? ' is-self' : '')); t.dataset.key = key;
    const v = node('video'); v.autoplay = true; v.playsInline = true; v.muted = !!self;
    t.append(v, node('figcaption', self ? 'Você' : name)); gui.grid.append(t);
  }
  const v = t.querySelector('video'); if (stream && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
  gui.grid.dataset.count = String(gui.grid.children.length);
  return t;
}
function dropPeer(key) {
  const p = gc?.peers.get(key); if (!p) return;
  p.pc.close(); gc.peers.delete(key); gui.grid.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove(); gui.grid.dataset.count = String(gui.grid.children.length);
}
function peerFor(key, name) {
  dropPeer(key);
  const pc = new RTCPeerConnection({ iceServers: gc.iceServers });
  gc.local.getTracks().forEach(t => pc.addTrack(t, gc.local));
  const peer = { pc, name, at: Date.now() }; gc.peers.set(key, peer);
  tile(key, name, null, false);
  pc.ontrack = e => tile(key, name, e.streams[0], false);
  pc.onconnectionstatechange = () => { if (gc?.peers.get(key) === peer && pc.connectionState === 'failed') dropPeer(key); };
  return peer;
}
async function offerTo(key, name) {
  const peer = peerFor(key, name); peer.offered = true;
  await peer.pc.setLocalDescription(await peer.pc.createOffer()); await gathered(peer.pc);
  if (gc?.peers.get(key) !== peer) return;
  await gapi({ action: 'gcall_signal', callId: gc.id, to: key, type: 'offer', sdp: peer.pc.localDescription.sdp });
}
async function gsync(view) {
  if (!gc?.id) return;
  gc.iceServers = view.iceServers || gc.iceServers;
  const room = (view.calls || []).find(c => c.id === gc.id);
  if (!room || !room.joined) { gteardown(room ? 'Você saiu da chamada.' : 'A chamada em grupo terminou.'); return; }
  const me = room.members.find(m => m.key === view.me);
  const others = room.members.filter(m => m.key !== view.me);
  gui.st.textContent = others.length ? `${others.length + 1} pessoas na chamada` : 'Esperando o grupo entrar…';
  for (const s of (room.signals || []).sort((a, b) => a.seq - b.seq)) {
    gc.since = Math.max(gc.since, s.seq);
    const name = room.members.find(m => m.key === s.from)?.name || 'Participante';
    try {
      if (s.type === 'offer') {
        const peer = peerFor(s.from, name);
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        await peer.pc.setLocalDescription(await peer.pc.createAnswer()); await gathered(peer.pc);
        await gapi({ action: 'gcall_signal', callId: gc.id, to: s.from, type: 'answer', sdp: peer.pc.localDescription.sdp });
      } else if (s.type === 'answer') {
        const peer = gc.peers.get(s.from);
        if (peer?.pc.signalingState === 'have-local-offer') await peer.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
      }
    } catch { dropPeer(s.from); }
  }
  // Quem já estava antes de mim recebe a minha oferta; quem chegou depois me oferece.
  for (const m of others) {
    const earlier = m.joinedAt < me.joinedAt || (m.joinedAt === me.joinedAt && m.key < me.key);
    const p = gc.peers.get(m.key);
    // Oferta sem resposta em 15 s (a outra pessoa recarregou, rede caiu): tenta de novo.
    if (earlier && p?.offered && p.pc.connectionState !== 'connected' && Date.now() - p.at > 15000) dropPeer(m.key);
    if (earlier && !gc.peers.has(m.key)) offerTo(m.key, m.name).catch(() => dropPeer(m.key));
  }
  for (const key of [...gc.peers.keys()]) if (!others.some(m => m.key === key)) dropPeer(key);
}
async function gpoll() {
  clearTimeout(gcPoll);
  if (gcBusy) { gcPoll = setTimeout(gpoll, 500); return; }
  gcBusy = true;
  try {
    const view = await gapi(null, gc ? { since: String(gc.since) } : {});
    if (gc) await gsync(view); else paintGroupBanner(view);
  } catch { /* rede instável: tenta de novo */ }
  finally { gcBusy = false; }
  if (gc || document.body.dataset.previewRoute === 'messages') gcPoll = setTimeout(gpoll, gc ? 1500 : document.hidden ? 10000 : 5000);
}
async function enterGroup(opts) {
  if (call || gc) throw Error('Você já está em uma chamada.');
  const local = await media(opts.kind);
  gc = { id: '', groupKey: opts.groupKey, name: opts.name, kind: opts.kind, local, peers: new Map(), since: 0, iceServers: [] };
  gbuild(); gui.root.dataset.kind = opts.kind; gui.name.textContent = opts.name; gui.st.textContent = 'Entrando…';
  gui.camera.hidden = opts.kind !== 'video'; gui.grid.replaceChildren(); tile('self', 'Você', local, true);
  if (!gui.root.open) gui.root.showModal();
  try {
    const view = await gapi(opts.callId ? { action: 'gcall_join', callId: opts.callId } : { action: 'gcall_start', groupKey: opts.groupKey, kind: opts.kind });
    const room = view.calls.find(c => c.groupKey === opts.groupKey && c.joined);
    if (!room) throw Error('Não foi possível entrar na chamada.');
    gc.id = room.id; gc.kind = room.kind; await gsync(view);
    clearInterval(gcBeat); gcBeat = setInterval(() => { if (gc?.id) gapi({ action: 'gcall_beat', callId: gc.id }).catch(() => {}); }, 8000);
    gpoll();
  } catch (e) { gteardown(e.message); throw e; }
}
function gteardown(message) {
  clearInterval(gcBeat); if (!gc) return;
  for (const key of [...gc.peers.keys()]) dropPeer(key);
  gc.local.getTracks().forEach(t => t.stop()); gc = null;
  if (gui.root?.open) { gui.st.textContent = message || 'Chamada encerrada'; setTimeout(() => { if (!gc && gui.root.open) gui.root.close(); }, 1500); }
  window.dispatchEvent(new CustomEvent('opy:call-ended'));
  if (document.body.dataset.previewRoute === 'messages') gcPoll = setTimeout(gpoll, 3000);
}
async function leaveGroup() { const id = gc?.id; gteardown('Você saiu da chamada.'); if (id) await gapi({ action: 'gcall_leave', callId: id }).catch(() => {}); }
// Aviso de chamada em andamento nas conversas dos meus grupos (página de mensagens).
function paintGroupBanner(view) {
  let bar = document.getElementById('gcall-banner');
  const open = (view.calls || []).filter(c => !c.joined);
  if (!open.length) { bar?.remove(); return; }
  if (!bar) { bar = node('div', undefined, 'gcall-banner'); bar.id = 'gcall-banner'; bar.setAttribute('role', 'status'); (document.getElementById('chat-workspace') || document.body).prepend(bar); }
  bar.replaceChildren(...open.map(c => {
    const row = node('div', undefined, 'gcall-banner-row');
    row.append(node('span', `📞 Chamada ${c.kind === 'video' ? 'de vídeo' : 'de voz'} em ${c.groupName} · ${c.members.length} ${c.members.length === 1 ? 'pessoa' : 'pessoas'}`));
    const b = node('button', 'Entrar', 'opy-primary'); b.type = 'button'; b.onclick = () => enterGroup({ groupKey: c.groupKey, name: c.groupName, kind: c.kind, callId: c.id }).catch(e => alert(e.message));
    row.append(b); return row;
  }));
}
window.addEventListener('pagehide', () => { if (gc?.id) fetch('/api/community?view=gcalls', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'gcall_leave', callId: gc.id }) }).catch(() => {}); });
if (document.body.dataset.previewRoute === 'messages') gcPoll = setTimeout(gpoll, 800);

window.OpyCalls = { start, startGroup: opts => enterGroup(opts) };
schedule(500);
})();
