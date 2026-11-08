// Visualizador de stories da Casa Opy, no padrão Instagram/TikTok. Usa a ponte window.OpyShared de preview.js e a API
// atual (story_seen, story_react, story_reply, story_delete) mais story_report. Os stories vêm agrupados por pessoa;
// a barra de progresso só corre com a mídia tocando (foto 5 s, vídeo pela duração real) e qualquer motivo de pausa
// (segurar, digitar, menu, aba escondida, botão) para o tempo. Trocar de pessoa gira um cubo 3D; com
// prefers-reduced-motion a troca é direta.
(function () {
'use strict';
const S = window.OpyShared;
const viewer = document.getElementById('story-viewer');
if (!S || !viewer) return;
const { $, make, api, change, toast, showError, avatarNode, openProfile, plural } = S;
const IMAGE_MS = 5000, HOLD_MS = 180, LIKE = '❤️';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = {
  scene: $('.sv-scene', viewer), cube: $('.sv-cube', viewer), card: $('.sv-face-main', viewer), next: $('.sv-face-next', viewer),
  slot: $('#story-viewer-media'), stage: $('#story-stage'), progress: $('#story-progress'),
  avatar: $('#story-viewer-avatar'), author: $('#story-viewer-author'), time: $('#story-viewer-time'), caption: $('#story-viewer-text'),
  bottom: $('#story-actions'), menu: $('#story-menu'), sheet: $('#story-sheet'), heart: $('.sv-heart', viewer), who: $('.sv-who', viewer),
  mute: $('#story-mute'), pause: $('#story-pause'), more: $('#story-more'), close: $('#story-close'),
  bgImg: $('.sv-bg-img', viewer), bgCanvas: $('.sv-bg-canvas', viewer), status: $('#story-viewer-status'),
  prev: $('.sv-nav-prev', viewer), nextBtn: $('.sv-nav-next', viewer)
};
let groups = [], g = 0, i = 0, elapsed = 0, last = 0, raf = 0, expiry = 0, bgTimer = 0, speed = 1, loading = false, turning = false;
let muted = (() => { try { return localStorage.getItem('opy-story-muted') === '1'; } catch { return false; } })();
const pauses = new Set();
const preloads = [];

const active = () => (S.state?.stories || []).filter(s => s.expiresAt > Date.now());
// Pessoas na ordem do anel (mais recente primeiro); dentro de cada pessoa, do mais antigo para o mais novo.
function buildGroups() { const m = new Map(); for (const s of active()) { const k = s.authorKey || s.author; if (!m.has(k)) m.set(k, []); m.get(k).push(s); } return [...m.values()].map(list => list.sort((a, b) => a.createdAt - b.createdAt)); }
const item = () => groups[g]?.[i];
const video = () => el.slot.querySelector('video');
const startIndex = n => { const list = groups[n] || []; const k = list.findIndex(s => !S.isSeen(s.id)); return k < 0 ? 0 : k; };
const isPaused = () => pauses.size > 0;
const linkOf = it => location.origin + '/?story=' + encodeURIComponent(it.id);
function rel(ts) { const m = Math.max(0, Math.floor((Date.now() - ts) / 60000)); return m < 1 ? 'agora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h`; }
const say = text => { el.status.textContent = text; };

// ---------- pausa e tempo ----------
function pause(reason) { pauses.add(reason); applyPause(); }
function resume(reason) { if (!pauses.delete(reason)) return; if (!pauses.size) last = performance.now(); applyPause(); }
function applyPause() {
  const v = video();
  if (v) { if (isPaused()) { if (!v.paused) v.pause(); } else if (v.paused && !v.ended) v.play().catch(() => {}); }
  const userPaused = pauses.has('user');
  viewer.classList.toggle('is-paused', userPaused);
  el.pause.setAttribute('aria-pressed', String(userPaused));
  el.pause.setAttribute('aria-label', userPaused ? 'Continuar' : 'Pausar');
}
function setFill(ratio) { const f = el.progress.children[i]?.firstElementChild; if (f) f.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`; }
function tick(now) {
  if (!viewer.open) return;
  const dt = Math.min(100, Math.max(0, now - last)); last = now;
  const v = video();
  let ratio = 0;
  if (v) { ratio = v.duration > 0 && Number.isFinite(v.duration) ? v.currentTime / v.duration : 0; if (v.ended) ratio = 1; }
  else { if (!isPaused() && !loading) elapsed += dt * speed; ratio = elapsed / IMAGE_MS; }
  setFill(ratio);
  if (ratio >= 1 && !isPaused() && !turning) { nextItem(); return; }
  raf = requestAnimationFrame(tick);
}

// ---------- pintura ----------
function paintProgress() {
  const list = groups[g];
  el.progress.setAttribute('aria-valuemin', '1'); el.progress.setAttribute('aria-valuemax', String(list.length)); el.progress.setAttribute('aria-valuenow', String(i + 1));
  el.progress.replaceChildren(...list.map((_, k) => { const bar = make('span', undefined, 'sv-seg'); const fill = make('span', undefined, 'sv-seg-fill'); fill.style.transform = `scaleX(${k < i ? 1 : 0})`; bar.append(fill); return bar; }));
}
const cssUrl = u => u ? `url(${JSON.stringify(String(u))})` : 'none';
function paintBackground(it) {
  clearInterval(bgTimer);
  const media = it.media;
  el.bgImg.hidden = media?.kind !== 'image';
  el.bgCanvas.hidden = media?.kind !== 'video';
  if (media?.kind === 'image') el.bgImg.src = media.url; else el.bgImg.removeAttribute('src');
  viewer.style.setProperty('--sv-avatar', cssUrl(it.avatar));
  // Fundo desfocado da própria mídia (desktop): o vídeo é copiado em baixa resolução a cada 400 ms, sem custo perceptível.
  if (media?.kind === 'video' && matchMedia('(min-width: 768px)').matches) {
    const ctx = el.bgCanvas.getContext('2d');
    bgTimer = setInterval(() => { const v = video(); if (v && v.readyState >= 2) try { ctx.drawImage(v, 0, 0, el.bgCanvas.width, el.bgCanvas.height); } catch { } }, 400);
  }
}
function paintFace(face, it) {
  // Face de chegada do cubo: imagem parada do primeiro story da próxima pessoa (o vídeo só toca depois da troca).
  face.replaceChildren();
  if (!it) return;
  const wrap = make('div', undefined, 'sv-media');
  if (it.media?.kind === 'image') { const img = make('img'); img.src = it.media.url; img.alt = ''; wrap.append(img); }
  else if (it.media?.kind === 'video') { const v = make('video'); v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = it.media.url + '#t=0.1'; wrap.append(v); }
  else wrap.append(make('p', it.text || '', 'sv-caption sv-caption-solo'));
  const head = make('div', undefined, 'sv-face-head'); head.append(avatarNode(it.author, it.avatar, 32), make('strong', it.author));
  face.append(wrap, make('div', undefined, 'sv-shade sv-shade-top'), head);
}
function syncMute() {
  const v = video(); const on = v ? v.muted : muted;
  el.mute.setAttribute('aria-pressed', String(on));
  el.mute.setAttribute('aria-label', on ? 'Ativar som' : 'Silenciar');
  el.mute.classList.toggle('is-muted', on);
}
function iconButton(cls, label, path, fn) {
  const b = make('button', undefined, 'sv-btn ' + cls); b.type = 'button'; b.setAttribute('aria-label', label);
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>';
  b.onclick = fn; return b;
}
function paintBottom(it) {
  el.bottom.replaceChildren();
  const share = iconButton('sv-share', 'Compartilhar story', '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>', () => shareStory(it));
  if (it.own) {
    const seen = make('button', undefined, 'sv-seen'); seen.type = 'button';
    seen.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    seen.append(make('span', it.views ? `Visto por ${plural(it.views, 'pessoa', 'pessoas')}` : 'Ainda ninguém viu'));
    seen.onclick = () => openSheet(it);
    el.bottom.append(seen, share); return;
  }
  const form = make('form', undefined, 'sv-reply');
  const input = make('input'); input.type = 'text'; input.maxLength = 500; input.placeholder = 'Enviar mensagem…'; input.autocomplete = 'off'; input.enterKeyHint = 'send';
  input.setAttribute('aria-label', 'Enviar mensagem para ' + it.author);
  const send = make('button', 'Enviar', 'sv-send'); send.type = 'submit'; send.hidden = true;
  input.addEventListener('focus', () => { pause('input'); viewer.classList.add('is-typing'); });
  // Com texto, a barra fica no modo digitação: o botão Enviar não muda de lugar no meio do toque.
  input.addEventListener('blur', () => { if (!input.value.trim()) { viewer.classList.remove('is-typing'); resume('input'); } });
  input.addEventListener('input', () => { send.hidden = !input.value.trim(); });
  form.onsubmit = async e => {
    e.preventDefault(); const copy = input.value.trim(); if (!copy) return; send.disabled = true;
    try { await api({ action: 'story_reply', storyId: it.id, text: copy }); input.value = ''; send.hidden = true; input.blur(); viewer.classList.remove('is-typing'); resume('input'); toast('Mensagem enviada para ' + it.author.split(' ')[0] + '.'); }
    catch (error) { showError(error.message); } finally { send.disabled = false; }
  };
  form.append(input, send);
  const liked = it.reaction === LIKE;
  const like = iconButton('sv-like', liked ? 'Descurtir story' : 'Curtir story', '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.3 5c2 0 3.3 1.1 4 2.3h3.4C14.4 6.1 15.7 5 17.7 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z"/>', () => toggleLike(it, like));
  like.setAttribute('aria-pressed', String(liked));
  const comment = iconButton('sv-comment', 'Comentar no story', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>', () => input.focus());
  el.bottom.append(form, like, comment, share);
}
async function toggleLike(it, btn) {
  const on = it.reaction !== LIKE;
  it.reaction = on ? LIKE : ''; btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', on ? 'Descurtir story' : 'Curtir story');
  if (on) { popHeart(); try { navigator.vibrate?.(12); } catch { } }
  try {
    const next = await api({ action: 'story_react', storyId: it.id, reaction: on ? LIKE : '' });
    if (next?.stories) { S.state.stories = next.stories; const fresh = next.stories.find(s => s.id === it.id); if (fresh) { it.reaction = fresh.reaction; it.reactions = fresh.reactions; } }
    say(on ? 'Você curtiu o story.' : 'Curtida removida.');
  } catch (error) { it.reaction = on ? '' : LIKE; btn.setAttribute('aria-pressed', String(!on)); showError(error.message); }
}
function popHeart() { el.heart.classList.remove('is-pop'); void el.heart.offsetWidth; el.heart.classList.add('is-pop'); }

// ---------- menu ⋯ e folha "quem viu" ----------
function paintMenu(it) {
  const items = [make('p', 'Velocidade', 'sv-menu-label')];
  for (const r of [0.5, 1, 1.5, 2]) {
    const b = make('button', r === 1 ? 'Normal' : String(r).replace('.', ',') + 'x'); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(speed === r));
    b.onclick = () => { speed = r; const v = video(); if (v) v.playbackRate = r; closeMenu(); say('Velocidade ' + b.textContent + '.'); };
    items.push(b);
  }
  items.push(make('hr'));
  const copy = make('button', 'Copiar link'); copy.type = 'button'; copy.setAttribute('role', 'menuitem'); copy.onclick = () => { closeMenu(); copyLink(it); }; items.push(copy);
  if (it.own) {
    const del = make('button', 'Excluir story', 'sv-danger'); del.type = 'button'; del.setAttribute('role', 'menuitem');
    del.onclick = async () => { closeMenu(); pause('confirm'); if (!confirm('Excluir este story?')) { resume('confirm'); return; } try { await change({ action: 'story_delete', storyId: it.id }); closeViewer(); toast('Story excluído.'); } catch (e) { showError(e.message); resume('confirm'); } };
    items.push(del);
  } else {
    const rep = make('button', 'Denunciar', 'sv-danger'); rep.type = 'button'; rep.setAttribute('role', 'menuitem');
    rep.onclick = async () => {
      closeMenu(); pause('confirm');
      const reason = prompt('Por que este story deve ser revisado pela moderação?', 'Conteúdo impróprio');
      if (reason === null) { resume('confirm'); return; }
      try { await api({ action: 'story_report', storyId: it.id, reason }); toast('Denúncia enviada. A moderação vai revisar.'); } catch (e) { showError(e.message); } finally { resume('confirm'); }
    };
    items.push(rep);
  }
  el.menu.replaceChildren(...items);
}
function openMenu() { paintMenu(item()); el.menu.hidden = false; el.more.setAttribute('aria-expanded', 'true'); pause('menu'); el.menu.querySelector('button')?.focus(); }
function closeMenu() { if (el.menu.hidden) return; el.menu.hidden = true; el.more.setAttribute('aria-expanded', 'false'); resume('menu'); }
function openSheet(it) {
  const summary = (it.reactions || []).map(([r, n]) => r + ' ' + n).join('   ');
  const close = make('button', 'Fechar', 'sv-sheet-close'); close.type = 'button'; close.onclick = closeSheet;
  const list = make('ul', undefined, 'sv-viewers');
  for (const name of it.viewers || []) list.append(make('li', name));
  if (it.views > (it.viewers || []).length) list.append(make('li', 'e mais ' + (it.views - it.viewers.length), 'sv-more'));
  el.sheet.replaceChildren(make('h2', it.views ? `Visto por ${plural(it.views, 'pessoa', 'pessoas')}` : 'Ainda ninguém viu'), ...(summary ? [make('p', summary, 'sv-reactions')] : []), list, close);
  el.sheet.hidden = false; pause('sheet'); close.focus();
}
function closeSheet() { if (el.sheet.hidden) return; el.sheet.hidden = true; resume('sheet'); }

// ---------- compartilhar ----------
async function copyLink(it) {
  const url = linkOf(it);
  try { await navigator.clipboard.writeText(url); toast('Link copiado.'); }
  catch { const t = make('input'); t.value = url; viewer.append(t); t.select(); try { document.execCommand('copy'); toast('Link copiado.'); } catch { toast(url); } t.remove(); }
}
async function shareStory(it) {
  if (navigator.share) { pause('share'); try { await navigator.share({ title: 'Story de ' + it.author + ' no Etnias', url: linkOf(it) }); } catch { } finally { resume('share'); } }
  else copyLink(it);
}

// ---------- exibir ----------
function show(ng, ni) {
  cancelAnimationFrame(raf); clearTimeout(expiry);
  if (ng >= groups.length) { closeViewer(); return; }
  g = Math.max(0, ng); i = Math.max(0, Math.min(ni, groups[g].length - 1));
  const it = item(); elapsed = 0; last = performance.now(); loading = false;
  pauses.delete('hold'); viewer.classList.remove('is-holding', 'is-buffering');
  closeMenu(); closeSheet();
  if (!it.own && !S.isSeen(it.id)) api({ action: 'story_seen', storyId: it.id }).catch(() => {});
  S.markSeen(it.id);
  el.avatar.replaceChildren(avatarNode(it.author, it.avatar, 36));
  el.author.textContent = it.author; el.time.textContent = rel(it.createdAt); el.time.title = new Date(it.createdAt).toLocaleString('pt-BR');
  el.who.setAttribute('aria-label', 'Ver perfil de ' + it.author);
  paintProgress();
  viewer.dataset.kind = it.media?.kind || 'text';
  el.caption.textContent = it.text || ''; el.caption.hidden = !it.text;
  const old = video(); if (old) { old.pause(); old.removeAttribute('src'); old.load(); }
  el.slot.replaceChildren();
  paintBackground(it);
  if (it.media) {
    loading = true; viewer.classList.add('is-loading');
    const media = make(it.media.kind === 'video' ? 'video' : 'img');
    const ready = () => { if (!loading) return; loading = false; viewer.classList.remove('is-loading'); last = performance.now(); };
    media.addEventListener('error', () => { ready(); el.slot.replaceChildren(make('p', 'Não foi possível carregar este story.', 'sv-error')); });
    if (it.media.kind === 'video') {
      media.playsInline = true; media.setAttribute('playsinline', ''); media.preload = 'auto'; media.muted = muted; media.playbackRate = speed;
      media.setAttribute('aria-label', it.text || 'Vídeo de ' + it.author);
      media.addEventListener('playing', () => { ready(); viewer.classList.remove('is-buffering'); });
      media.addEventListener('waiting', () => viewer.classList.add('is-buffering'));
      media.addEventListener('volumechange', syncMute);
      media.src = it.media.url;
      el.slot.append(media);
      if (!isPaused()) media.play().catch(() => { media.muted = true; syncMute(); if (!isPaused()) media.play().catch(() => {}); });
    } else {
      media.alt = it.text || 'Foto de ' + it.author; media.decoding = 'async';
      media.addEventListener('load', ready);
      media.src = it.media.url; el.slot.append(media);
      if (media.complete && media.naturalWidth) ready();
    }
  }
  el.mute.hidden = it.media?.kind !== 'video'; syncMute();
  el.prev.hidden = g === 0 && i === 0;
  paintBottom(it);
  say(`Story ${i + 1} de ${groups[g].length} de ${it.author}, ${rel(it.createdAt)}.`);
  expiry = setTimeout(() => { closeViewer(); S.refresh(); }, Math.max(1000, it.expiresAt - Date.now()));
  preload();
  applyPause();
  raf = requestAnimationFrame(tick);
}
function preload() {
  preloads.splice(0).forEach(p => { if (p.tagName === 'VIDEO') p.removeAttribute('src'); });
  const targets = [groups[g][i + 1], groups[g + 1]?.[startIndex(g + 1)]].filter(it => it?.media);
  for (const it of targets) {
    if (it.media.kind === 'video') { const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = it.media.url; preloads.push(v); }
    else { const img = new Image(); img.decoding = 'async'; img.src = it.media.url; preloads.push(img); }
  }
}
function nextItem() { if (turning) return; if (i + 1 < groups[g].length) show(g, i + 1); else if (g + 1 < groups.length) turn(1); else closeViewer(); }
function prevItem() { if (turning) return; if (i > 0) show(g, i - 1); else if (g > 0) turn(-1); else show(g, 0); }

// ---------- cubo 3D ----------
function setCube(angle, animate) {
  el.cube.style.transition = animate ? 'transform .38s cubic-bezier(.2,.7,.2,1)' : 'none';
  // O cubo gira em torno do próprio centro (origem com profundidade -metade da largura, no CSS).
  el.cube.style.transform = angle ? `rotateY(${angle}deg)` : '';
}
function prepareFace(dir) {
  const ng = g + dir; if (!groups[ng]) return false;
  paintFace(el.next, groups[ng][startIndex(ng)]);
  // Face de chegada presa na borda da atual, a 90°: direita para a próxima pessoa, esquerda para a anterior.
  el.next.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
  el.next.style.transform = `translateX(${dir * 100}%) rotateY(${dir * 90}deg)`;
  el.next.hidden = false; viewer.dataset.turn = String(dir);
  return true;
}
function turn(dir, fromAngle = 0) {
  const ng = g + dir;
  if (!groups[ng]) { setCube(0, true); return; }
  if (reduced()) { show(ng, startIndex(ng)); return; }
  turning = true; pause('turn');
  prepareFace(dir); setCube(fromAngle, false);
  requestAnimationFrame(() => requestAnimationFrame(() => setCube(-dir * 90, true)));
  let safety = 0;
  const done = () => { el.cube.removeEventListener('transitionend', done); clearTimeout(safety); finishTurn(ng); };
  safety = setTimeout(done, 650);
  el.cube.addEventListener('transitionend', done);
}
function finishTurn(ng) {
  if (!turning) return;
  turning = false; setCube(0, false); el.next.hidden = true; el.next.replaceChildren(); delete viewer.dataset.turn;
  resume('turn'); show(ng, startIndex(ng));
}

// ---------- gestos ----------
let down = null, holdTimer = 0;
el.stage.addEventListener('pointerdown', e => {
  if (turning || e.button > 0) return;
  try { el.stage.setPointerCapture(e.pointerId); } catch { }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), axis: '', held: false, face: 0, w: el.card.getBoundingClientRect().width };
  holdTimer = setTimeout(() => { if (!down || down.axis) return; down.held = true; pause('hold'); viewer.classList.add('is-holding'); }, HOLD_MS);
});
el.stage.addEventListener('pointermove', e => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.axis && Math.hypot(dx, dy) > 12) {
    down.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : dy > 0 ? 'down' : 'up';
    clearTimeout(holdTimer); pause('drag');
    if (down.axis === 'x' && !reduced()) { const dir = dx < 0 ? 1 : -1; down.face = prepareFace(dir) ? dir : 0; }
  }
  if (down.axis === 'x' && !reduced()) {
    let angle = (dx / down.w) * 90;
    if (!down.face) angle *= 0.15;
    setCube(Math.max(-90, Math.min(90, angle)), false);
  } else if (down.axis === 'down') {
    const y = Math.max(0, dy);
    el.scene.style.transform = `translateY(${y}px) scale(${1 - Math.min(0.15, y / 2000)})`;
    viewer.style.setProperty('--sv-fade', String(Math.max(0.3, 1 - y / 600)));
  }
});
function release(e, cancelled) {
  if (!down) return;
  clearTimeout(holdTimer);
  const d = down; down = null;
  const dx = e.clientX - d.x, dy = e.clientY - d.y, fast = Math.abs(dx) / Math.max(1, performance.now() - d.t) > 0.5;
  resume('drag');
  if (d.held) { resume('hold'); viewer.classList.remove('is-holding'); if (!d.axis) return; }
  if (cancelled) { setCube(0, true); el.scene.style.transform = ''; viewer.style.removeProperty('--sv-fade'); return; }
  if (d.axis === 'x') {
    const dir = dx < 0 ? 1 : -1;
    if ((Math.abs(dx) > d.w * 0.25 || fast) && groups[g + dir]) {
      if (reduced()) show(g + dir, startIndex(g + dir)); else turn(dir, Math.max(-90, Math.min(90, (dx / d.w) * 90)));
    } else { setCube(0, true); setTimeout(() => { if (!turning) { el.next.hidden = true; delete viewer.dataset.turn; } }, 400); }
    return;
  }
  if (d.axis === 'down') {
    if (dy > 120) { closeViewer(); return; }
    el.scene.style.transition = 'transform .25s ease'; el.scene.style.transform = ''; viewer.style.removeProperty('--sv-fade');
    setTimeout(() => { el.scene.style.transition = ''; }, 260); return;
  }
  if (d.axis === 'up') { if (dy < -70) { const it = item(); if (it.own) openSheet(it); else el.bottom.querySelector('input')?.focus(); } return; }
  // Toque: terço esquerdo volta; o restante avança.
  const box = el.card.getBoundingClientRect();
  if (e.clientX - box.left < box.width / 3) prevItem(); else nextItem();
}
el.stage.addEventListener('pointerup', e => release(e, false));
el.stage.addEventListener('pointercancel', e => release(e, true));
el.stage.addEventListener('contextmenu', e => e.preventDefault());

// ---------- controles ----------
el.close.addEventListener('click', () => closeViewer());
el.pause.addEventListener('click', () => { if (pauses.has('user')) resume('user'); else pause('user'); });
el.mute.addEventListener('click', () => {
  const v = video(); muted = !(v ? v.muted : muted);
  try { localStorage.setItem('opy-story-muted', muted ? '1' : '0'); } catch { }
  if (v) { v.muted = muted; if (!muted && v.paused && !isPaused()) v.play().catch(() => {}); }
  syncMute(); say(muted ? 'Som desligado.' : 'Som ligado.');
});
el.more.addEventListener('click', () => { if (el.menu.hidden) openMenu(); else closeMenu(); });
el.who.addEventListener('click', () => { const it = item(); if (it?.authorKey) { closeViewer(); openProfile(it.authorKey); } });
el.prev.addEventListener('click', prevItem);
el.nextBtn.addEventListener('click', nextItem);
viewer.addEventListener('click', e => { if (!el.menu.hidden && !el.menu.contains(e.target) && !el.more.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => {
  if (!viewer.open || e.defaultPrevented || e.target.matches?.('input, textarea')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevItem(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nextItem(); }
  else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); el.pause.click(); }
  else if (e.key === 'm' || e.key === 'M') { if (!el.mute.hidden) el.mute.click(); }
});
// Escape: fecha o menu ou a folha primeiro; depois o visualizador.
viewer.addEventListener('cancel', e => { if (!el.menu.hidden) { e.preventDefault(); closeMenu(); el.more.focus(); } else if (!el.sheet.hidden) { e.preventDefault(); closeSheet(); } });
viewer.addEventListener('close', () => {
  cancelAnimationFrame(raf); clearTimeout(expiry); clearInterval(bgTimer); clearTimeout(holdTimer);
  const v = video(); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  el.slot.replaceChildren(); preloads.splice(0); pauses.clear(); turning = false; down = null;
  setCube(0, false); el.next.hidden = true; el.scene.style.transform = ''; viewer.style.removeProperty('--sv-fade');
  document.documentElement.classList.remove('sv-lock');
  if (new URLSearchParams(location.search).has('story')) history.replaceState(null, '', location.pathname + location.hash);
  S.render();
});
document.addEventListener('visibilitychange', () => { if (!viewer.open) return; if (document.hidden) pause('hidden'); else resume('hidden'); });
const measure = () => viewer.style.setProperty('--sv-half', (el.card.getBoundingClientRect().width / 2) + 'px');
addEventListener('resize', () => { if (viewer.open) measure(); });

function closeViewer() { if (viewer.open) viewer.close(); }
function open(id, opts = {}) {
  groups = buildGroups();
  let ng = -1, ni = 0;
  groups.forEach((list, n) => { const k = list.findIndex(s => s.id === id); if (k >= 0 && ng < 0) { ng = n; ni = k; } });
  // Pelo anel, a pessoa abre no primeiro story ainda não visto; um link abre exatamente o story do link.
  if (ng >= 0 && !opts.fromLink) ni = startIndex(ng);
  if (ng < 0) { if (opts.fromLink) toast('Este story não está mais disponível.'); return false; }
  pauses.clear(); speed = 1;
  document.documentElement.classList.add('sv-lock');
  if (!viewer.open) { viewer.showModal(); viewer.focus({ preventScroll: true }); }
  measure(); setCube(0, false); el.next.hidden = true;
  show(ng, ni);
  return true;
}
window.OpyStories = { open, close: closeViewer };
}());
