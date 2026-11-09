// Tela "Criar" em tela cheia, no padrão do Instagram: câmera com os modos Publicação · Story · Live embaixo,
// botão de captura no centro (toque = foto; segurar = vídeo), galeria à esquerda, virar câmera à direita e "Aa" para
// story só de texto. Envia pelas ações que já existem (publish, story_create). A live usa o motor de preview/live.js:
// esta tela só traz para dentro dela o palco, os controles e o painel de quem transmite (mesmos elementos, mesmos ids).
(function () {
'use strict';
const S = window.OpyShared, L = () => window.OpyLive;
const dlg = document.getElementById('opy-creator');
if (!S || !dlg) return;
const { $, all, make, change, toast, showError, startCamera, stopCamera } = S;
const MAX_REC_MS = 15000, HOLD_MS = 280;
const el = id => document.getElementById(id);
const video = el('creator-preview'), review = el('creator-review'), msg = el('creator-camera-msg');
const shutter = el('creator-shutter'), sendBtn = el('creator-send'), caption = el('creator-caption'), title = el('creator-title');
const textArea = el('creator-text'), status = el('creator-status');
let mode = 'story', step = 'camera', file = null, recorder = null, recTimer = 0, holdTimer = 0, pressAt = 0;
const moved = [];
const say = t => { status.textContent = t; };
// Emojis na legenda e no story de texto (o mesmo seletor das publicações e do chat).
for (const input of [caption, textArea]) {
  if (!window.OpyEmoji?.toggle) break;
  const [btn, box] = window.OpyEmoji.toggle(input); btn.classList.add('cr-emoji-btn'); box.classList.add('cr-emoji-box');
  input.parentElement.append(btn, box);
}
const setStep = s => { step = s; dlg.dataset.step = s; };
const isLive = () => !!S.liveSession;

// ---------- câmera ----------
async function openCamera() {
  msg.hidden = true;
  if (mode === 'live') return openLiveCamera();
  try { await startCamera(video, true); }
  catch (e) {
    try { await startCamera(video, false); } catch (err) { msg.textContent = err.message + ' Você ainda pode escolher da galeria ou criar com texto.'; msg.hidden = false; }
  }
  video.classList.toggle('is-mirror', S.cameraFacing === 'user');
}
function closeCamera() { if (!isLive()) stopCamera(); }

// ---------- modos ----------
function setMode(next) {
  if (isLive() && next !== 'live') return;
  if (mode === 'live' && next !== 'live') restoreLive();
  mode = next; dlg.dataset.mode = next;
  all('[data-cr-mode]', dlg).forEach(b => b.setAttribute('aria-current', String(b.dataset.crMode === next)));
  el('creator-top-title').textContent = next === 'post' ? 'Nova publicação' : next === 'story' ? 'Seu story' : '';
  shutter.setAttribute('aria-label', next === 'live' ? 'Começar a live' : 'Tirar foto (segure para gravar vídeo)');
  sendBtn.textContent = next === 'post' ? 'Publicar ›' : 'Seu story ›';
  caption.placeholder = next === 'post' ? 'Escreva uma legenda…' : 'Adicionar legenda…';
  discard(); openCamera();
}
// ---------- captura ----------
function discard() {
  file = null; review.replaceChildren(); caption.value = ''; textArea.value = '';
  setStep(dlg.dataset.textMode === '1' ? 'text' : 'camera');
}
function showReview(f) {
  file = f; review.replaceChildren();
  const isVideo = f.type.startsWith('video/');
  const m = make(isVideo ? 'video' : 'img');
  m.src = URL.createObjectURL(f);
  if (isVideo) { m.loop = true; m.playsInline = true; m.autoplay = true; m.play().catch(() => { m.muted = true; m.play().catch(() => {}); }); }
  else m.alt = 'Prévia';
  review.append(m); setStep('review'); closeCamera();
  say(isVideo ? 'Vídeo pronto para enviar.' : 'Foto pronta para enviar.');
}
async function takePhoto() {
  if (!S.cameraStream) { el('creator-file').click(); return; }
  try { showReview(await S.snapPhoto(video)); } catch (e) { showError(e.message); }
}
function startRecording() {
  const mime = S.recorderMime();
  if (!mime || !S.cameraStream) { takePhoto(); return; }
  const parts = [];
  // Bitrate contido: 15 s cabem no limite de envio de 2 MB.
  recorder = new MediaRecorder(S.cameraStream, { mimeType: mime, videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 });
  recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  recorder.onstop = () => {
    clearTimeout(recTimer); dlg.classList.remove('is-recording');
    const type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
    const f = new File(parts, 'video.' + (type === 'video/mp4' ? 'mp4' : 'webm'), { type });
    recorder = null; if (f.size) showReview(f);
  };
  recorder.start(250); dlg.classList.add('is-recording'); say('Gravando. Solte para parar.');
  recTimer = setTimeout(stopRecording, MAX_REC_MS);
}
function stopRecording() { if (recorder && recorder.state === 'recording') recorder.stop(); }
shutter.addEventListener('pointerdown', e => {
  if (mode === 'live' || step !== 'camera') return;
  e.preventDefault(); pressAt = performance.now();
  holdTimer = setTimeout(() => { holdTimer = 0; startRecording(); }, HOLD_MS);
});
const shutterUp = () => {
  if (mode === 'live' || step !== 'camera' || !pressAt) return;
  pressAt = 0;
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; takePhoto(); } else stopRecording();
};
shutter.addEventListener('pointerup', shutterUp);
shutter.addEventListener('pointercancel', () => { clearTimeout(holdTimer); holdTimer = 0; pressAt = 0; stopRecording(); });
shutter.addEventListener('click', e => {
  // Teclado (Enter/Espaço) chega como clique sem ponteiro; o toque já foi tratado acima.
  if (e.detail === 0 && mode !== 'live' && step === 'camera') takePhoto();
  if (mode === 'live' && !isLive()) startLive();
});
el('creator-file').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/.test(f.type)) { showError('Escolha uma foto ou um vídeo.'); return; }
  dlg.dataset.textMode = ''; showReview(f);
});
el('creator-flip').addEventListener('click', async () => {
  S.cameraFacing = S.cameraFacing === 'environment' ? 'user' : 'environment';
  if (mode === 'live') { if (isLive()) return L().flipCamera(); return openLiveCamera(); }
  openCamera();
});
el('creator-text-mode').addEventListener('click', () => { closeCamera(); dlg.dataset.textMode = '1'; file = null; review.replaceChildren(); textArea.value = ''; sendBtn.disabled = true; setStep('text'); textArea.focus(); });
el('creator-write-post').addEventListener('click', () => { closeCreator(); const t = $('#preview-text'); t?.scrollIntoView({ block: 'center' }); t?.focus({ preventScroll: true }); });
el('creator-retake').addEventListener('click', () => { dlg.dataset.textMode = ''; sendBtn.disabled = false; discard(); openCamera(); });
textArea.addEventListener('input', () => { sendBtn.disabled = !textArea.value.trim(); });
sendBtn.addEventListener('click', async () => {
  if (sendBtn.disabled) return;
  sendBtn.disabled = true; const label = sendBtn.textContent; sendBtn.textContent = 'Enviando…';
  try {
    const media = file ? await S.readSlot(file) : null;
    const text = step === 'text' ? textArea.value.trim() : caption.value.trim();
    if (!media && !text) throw Error('Tire uma foto, escolha da galeria ou escreva algo.');
    if (mode === 'post') await change({ action: 'publish', text, audience: 'public', communityId: '', media: media && { name: media.name, data: media.data }, file: null, location: '' });
    else await change({ action: 'story_create', text, media });
    closeCreator(); toast(mode === 'post' ? 'Publicado.' : 'Story publicado por 24 horas.');
  } catch (e) { showError(e.message); }
  finally { sendBtn.disabled = false; sendBtn.textContent = label; }
});
all('[data-cr-mode]', dlg).forEach(b => b.addEventListener('click', () => { if (b.dataset.crMode !== mode) { dlg.dataset.textMode = ''; setMode(b.dataset.crMode); } }));

// ---------- live ----------
function liveParts() {
  const tools = el('creator-host-tools'), panel = el('creator-host-panel');
  return [['live-stage', dlg.querySelector('.cr-live-slot')], ['live-flip', tools], ['live-mic', tools], ['live-cam', tools], ['live-add', tools], ['live-stop', tools], ['live-host-panel', panel], ['live-status', panel]];
}
function borrowLive() {
  if (moved.length) return;
  for (const [id, target] of liveParts()) {
    const node = el(id); if (!node || !target) continue;
    const marker = document.createComment('creator:' + id); node.before(marker);
    target.append(node); moved.push([node, marker]);
  }
}
function restoreLive() {
  for (const [node, marker] of moved.splice(0)) marker.replaceWith(node);
  if (!isLive()) { stopCamera(); L()?.liveUi('idle'); }
}
// Tocar em "Ao vivo" logo ao abrir a página: espera os dados chegarem antes de concluir se a live está ativa.
async function stateReady(ms = 8000) { const end = Date.now() + ms; while (!S.state && Date.now() < end) await new Promise(r => setTimeout(r, 100)); return S.state; }
async function openLiveCamera() {
  await stateReady();
  if (!S.state?.liveEnabled) { msg.textContent = 'A transmissão ao vivo ainda não está ativa neste servidor.'; msg.hidden = false; return; }
  borrowLive();
  try { await startCamera(el('live-preview'), true); L().liveUi('preview'); el('live-stage').hidden = false; }
  catch (e) { msg.textContent = e.message; msg.hidden = false; }
  paintFormat();
}
function paintFormat() { const f = L()?.format || 'portrait'; const b = el('creator-format'); b.textContent = f === 'portrait' ? '9:16' : '16:9'; b.setAttribute('aria-label', 'Formato da live: ' + (f === 'portrait' ? 'vertical 9:16' : 'horizontal 16:9')); dlg.dataset.format = f; }
el('creator-format').addEventListener('click', () => { if (isLive()) return; L().setFormat(L().format === 'portrait' ? 'landscape' : 'portrait'); paintFormat(); });
async function startLive() {
  shutter.disabled = true; say('Conectando…');
  try {
    await L().goLive({ title: title.value, communityId: el('creator-audience').value });
    setStep('live'); say('Você está ao vivo.');
    const watch = setInterval(() => { if (!isLive()) { clearInterval(watch); if (dlg.open && step === 'live') { closeCreator(true); toast('Live encerrada. A gravação fica na sua publicação.'); } } }, 1000);
  } catch (e) { showError(e.message); }
  finally { shutter.disabled = false; }
}
function paintAudience() {
  const sel = el('creator-audience'); const joined = (S.state?.communities || []).filter(c => c.joined);
  sel.replaceChildren(new Option('Compartilhar com Todos', ''), ...joined.map(c => new Option('Comunidade: ' + c.name, c.id)));
}

// ---------- abrir e fechar ----------
function closeCreator(force) {
  if (isLive() && !force) { if (!confirm('Encerrar a live?')) return; L().endLive(); return; }
  stopRecording(); clearTimeout(recTimer);
  if (moved.length) restoreLive();
  closeCamera(); if (dlg.open) dlg.close();
}
el('creator-close').addEventListener('click', () => closeCreator());
dlg.addEventListener('cancel', e => { e.preventDefault(); closeCreator(); });
dlg.addEventListener('close', () => { document.documentElement.classList.remove('sv-lock'); file = null; review.replaceChildren(); title.value = ''; });
function open(next = 'story') {
  if (isLive()) next = 'live';
  document.documentElement.classList.add('sv-lock');
  if (!dlg.open) { dlg.showModal(); dlg.focus({ preventScroll: true }); }
  dlg.dataset.textMode = ''; sendBtn.disabled = false; setMode(next);
  stateReady().then(paintAudience);
}
window.OpyCreator = { open, close: closeCreator };
}());
