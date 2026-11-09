// Aba "Vídeos" no formato rápido (TikTok/Reels): grade de vídeos e, ao tocar, um vídeo por tela com rolagem vertical.
// Vídeo deitado aparece inteiro (sem corte); vídeo em pé ocupa a tela. Curtir, comentar, compartilhar e salvar usam as
// mesmas ações do feed (react, comment, save). Todo vídeo publicado aparece no feed e aqui.
(function () {
'use strict';
const S = window.OpyShared;
if (!S) return;
const { make, change, toast, showError, openProfile, avatarNode } = S;
let muted = true;
const total = p => Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
const clip = p => p.media?.kind === 'video' ? p.media : p.repostOf?.media?.kind === 'video' ? p.repostOf.media : null;

function grid(posts) {
  const box = make('div', undefined, 'opy-vgrid'); box.setAttribute('aria-label', 'Vídeos');
  const list = posts.filter(clip);
  list.forEach((p, i) => {
    const tile = make('button', undefined, 'opy-vtile'); tile.type = 'button';
    tile.setAttribute('aria-label', 'Assistir vídeo de ' + p.author + (p.text ? ': ' + p.text.slice(0, 60) : ''));
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = clip(p).url + '#t=0.1'; v.setAttribute('aria-hidden', 'true');
    tile.append(v, make('span', '♥ ' + total(p), 'opy-vtile-meta')); tile.onclick = () => open(list, i); box.append(tile);
  });
  return box;
}

function open(list, start) {
  let dlg = document.getElementById('opy-vplayer');
  if (!dlg) {
    dlg = make('dialog'); dlg.id = 'opy-vplayer'; dlg.setAttribute('aria-label', 'Vídeos');
    dlg.addEventListener('close', () => { dlg.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); dlg.replaceChildren(); document.documentElement.classList.remove('sv-lock'); });
    dlg.addEventListener('cancel', e => { e.preventDefault(); dlg.close(); });
    document.body.append(dlg);
  }
  const track = make('div', undefined, 'vp-track');
  const close = make('button', '✕', 'vp-close'); close.type = 'button'; close.setAttribute('aria-label', 'Fechar vídeos'); close.onclick = () => dlg.close();
  const sound = make('button', '', 'vp-sound'); sound.type = 'button';
  const paintSound = () => { sound.textContent = muted ? '🔇' : '🔊'; sound.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som'); track.querySelectorAll('video').forEach(v => { v.muted = muted; }); };
  sound.onclick = () => { muted = !muted; paintSound(); };
  dlg.replaceChildren(track, close, sound);
  list.forEach(p => track.append(slide(p, dlg)));
  if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add('sv-lock'); }
  paintSound();
  // Toca só o vídeo que está na tela.
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target.querySelector('video');
      if (e.isIntersecting && e.intersectionRatio > 0.6) { v.muted = muted; v.play().catch(() => { muted = true; paintSound(); v.play().catch(() => {}); }); }
      else v.pause();
    }
  }, { root: track, threshold: [0, 0.6, 1] });
  track.querySelectorAll('.vp-slide').forEach(s => io.observe(s));
  dlg.addEventListener('close', () => io.disconnect(), { once: true });
  track.children[start]?.scrollIntoView({ block: 'start' });
  close.focus({ preventScroll: true });
}

function slide(p, dlg) {
  const s = make('section', undefined, 'vp-slide'); s.setAttribute('aria-label', 'Vídeo de ' + p.author);
  const v = document.createElement('video'); v.src = clip(p).url; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata'; v.muted = muted;
  v.addEventListener('loadedmetadata', () => { s.dataset.orient = v.videoWidth > v.videoHeight ? 'landscape' : 'portrait'; });
  v.addEventListener('click', () => { v.paused ? v.play().catch(() => {}) : v.pause(); });
  const info = make('div', undefined, 'vp-info');
  const who = make('button', undefined, 'vp-author'); who.type = 'button'; who.append(avatarNode(p.author, p.avatar, 36), make('strong', p.author));
  who.onclick = () => { dlg.close(); openProfile(p.authorKey, p.author, p.avatar); };
  info.append(who); if (p.text) info.append(make('p', p.text, 'vp-text'));
  const side = make('div', undefined, 'vp-actions');
  const act = (icon, label, fn) => { const b = make('button', undefined, 'vp-act'); b.type = 'button'; b.setAttribute('aria-label', label); const n = make('span', '', 'vp-count'); b.append(make('span', icon, 'vp-icon'), n); b.onclick = fn; side.append(b); return [b, n]; };
  const [like, likeN] = act('♥', 'Curtir', async () => {
    const next = p.reaction ? '' : 'like'; const prev = { reaction: p.reaction, reactions: { ...p.reactions } };
    p.reactions = { ...p.reactions }; if (p.reaction) p.reactions[p.reaction] = Math.max(0, (p.reactions[p.reaction] || 1) - 1); if (next) p.reactions[next] = (p.reactions[next] || 0) + 1; p.reaction = next; paint();
    try { await change({ action: 'react', postId: p.id, reaction: next }); } catch (e) { Object.assign(p, prev); paint(); showError(e.message); }
  });
  const [, comN] = act('💬', 'Comentar', () => comments(p, s, comN));
  act('↗', 'Compartilhar', () => {
    const url = location.origin + '/#post-' + p.id;
    if (navigator.share) navigator.share({ title: 'Vídeo de ' + p.author + ' · Etnias', url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast('Link do vídeo copiado.')).catch(() => {});
  });
  const [save] = act('🔖', 'Salvar', async () => {
    p.saved = !p.saved; paint();
    try { await change({ action: 'save', postId: p.id }); toast(p.saved ? 'Vídeo salvo.' : 'Removido dos salvos.'); } catch (e) { p.saved = !p.saved; paint(); showError(e.message); }
  });
  function paint() {
    like.setAttribute('aria-pressed', String(!!p.reaction)); likeN.textContent = String(total(p));
    comN.textContent = String((p.comments || []).length);
    save.setAttribute('aria-pressed', String(!!p.saved)); save.setAttribute('aria-label', p.saved ? 'Remover dos salvos' : 'Salvar');
  }
  paint();
  s.append(v, info, side);
  return s;
}

// Comentários do vídeo numa folha por cima do próprio vídeo, sem sair do player.
function comments(p, s, counter) {
  s.querySelector('.vp-sheet')?.remove();
  const sheet = make('div', undefined, 'vp-sheet'); sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', 'Comentários');
  const head = make('div', undefined, 'vp-sheet-head'); head.append(make('strong', 'Comentários'));
  const x = make('button', '✕', 'vp-sheet-close'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar comentários'); x.onclick = () => sheet.remove(); head.append(x);
  const list = make('ol', undefined, 'vp-comments');
  const paintList = () => { list.replaceChildren(...(p.comments || []).map(c => { const li = make('li'); li.append(make('strong', c.author), make('span', c.text)); return li; })); if (!list.children.length) list.append(make('li', 'Seja a primeira pessoa a comentar.', 'vp-empty')); };
  const form = make('form', undefined, 'vp-form'); const input = make('input'); input.maxLength = 500; input.placeholder = 'Comente…'; input.setAttribute('aria-label', 'Seu comentário');
  const send = make('button', 'Enviar', 'opy-primary'); send.type = 'submit'; form.append(input);
  if (window.OpyEmoji?.toggle) { const [eb, ebox] = window.OpyEmoji.toggle(input); ebox.classList.add('vp-emoji-box'); form.append(eb, ebox); }
  form.append(send);
  form.onsubmit = async e => {
    e.preventDefault(); const text = input.value.trim(); if (!text) return; send.disabled = true;
    try {
      await change({ action: 'comment', postId: p.id, text });
      const fresh = (S.state?.posts || []).find(x => x.id === p.id);
      p.comments = fresh?.comments || [...(p.comments || []), { author: S.state?.me?.name || 'Você', text }];
      input.value = ''; paintList(); counter.textContent = String(p.comments.length);
    } catch (err) { showError(err.message); } finally { send.disabled = false; }
  };
  paintList(); sheet.append(head, list, form); s.append(sheet); input.focus({ preventScroll: true });
}

window.OpyVideos = { grid, open };
}());
