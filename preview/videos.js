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
    // Com capa gravada na publicação, a grade mostra só a imagem leve. Sem capa (vídeos antigos), cai no primeiro quadro do vídeo.
    let thumb;
    if (clip(p).poster) { thumb = make('img'); thumb.src = clip(p).poster; thumb.alt = ''; thumb.loading = 'lazy'; thumb.decoding = 'async'; }
    else { thumb = document.createElement('video'); thumb.muted = true; thumb.playsInline = true; thumb.preload = 'metadata'; thumb.src = clip(p).url + '#t=0.1'; thumb.setAttribute('aria-hidden', 'true'); }
    tile.append(thumb, make('span', '♥ ' + total(p), 'opy-vtile-meta')); tile.onclick = () => open(list, i); box.append(tile);
  });
  return box;
}

// Primeira vez no MOMENTOS: a pessoa escolhe se os vídeos do feed tocam sozinhos. O padrão é só ao toque; a escolha fica na conta
// e pode ser mudada em Configurações. Se fechar sem escolher, nada é salvo e a pergunta volta na próxima vez.
function askAutoplay() {
  if (S.state?.me?.videoAutoplay) return Promise.resolve();
  return new Promise(resolve => {
    const d = make('dialog', undefined, 'community-dialog momentos-ask'); d.setAttribute('aria-labelledby', 'momentos-ask-title');
    const h = make('h2', 'Reprodução automática de vídeos'); h.id = 'momentos-ask-title';
    const actions = make('div', undefined, 'community-dialog-actions');
    let picked = '';
    const choose = (value, label, cls) => { const b = make('button', label, cls); b.type = 'button'; b.onclick = () => { picked = value; d.close(); }; actions.append(b); return b; };
    const safe = choose('off', 'Só quando eu tocar', 'opy-primary');
    choose('on', 'Tocar automaticamente', 'preview-secondary');
    d.append(h, make('p', 'Quer que os vídeos do feed toquem sozinhos, sem som, quando aparecerem na tela? Isso gasta mais dados da internet. Você pode mudar isso quando quiser em Configurações.'), actions);
    d.addEventListener('close', async () => {
      d.remove();
      if (picked) { try { await change({ action: 'video_prefs', autoplay: picked }); } catch (e) { showError(e.message); } }
      resolve();
    });
    document.body.append(d); d.showModal(); safe.focus({ preventScroll: true });
  });
}

// Toque na capa de um vídeo do feed: abre o MOMENTOS (tela cheia, um vídeo por tela) a partir dele, seguido dos próximos do feed.
async function openClip(p, posts) {
  // Sem pergunta antes de assistir: um toque abre o vídeo. O padrão é tocar só ao toque; dá para mudar em Configurações > Vídeos.
  const list = (posts || []).filter(clip);
  let i = list.findIndex(x => x.id === p.id);
  if (i < 0) { list.unshift(p); i = 0; }
  open(list, i);
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
  // Carrega só o vídeo da tela; do próximo, só os metadados. Os demais ficam sem arquivo, para não gastar dados.
  const slides = [...track.querySelectorAll('.vp-slide')]; let current = -1;
  const load = (i, preload) => { const v = slides[i]?.querySelector('video'); if (!v) return; if (!v.getAttribute('src')) v.src = v.dataset.src; v.preload = preload; };
  const unload = i => { const v = slides[i]?.querySelector('video'); if (v && v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); } };
  const activate = i => {
    if (i === current) return; current = i;
    slides.forEach((_, j) => { if (j !== i && j !== i + 1) unload(j); });
    // O próximo só busca os metadados (capa e duração), não o vídeo: economia de dados (doc. Vídeos curtos).
    load(i, 'auto'); load(i + 1, 'metadata');
    slides.forEach((sl, j) => { const v = sl.querySelector('video'); if (j !== i) v.pause(); });
    const v = slides[i].querySelector('video'); v.muted = muted;
    v.play().catch(() => { muted = true; paintSound(); v.play().catch(() => {}); });
  };
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) activate(slides.indexOf(e.target));
  }, { root: track, threshold: [0, 0.6, 1] });
  track.querySelectorAll('.vp-slide').forEach(s => io.observe(s));
  dlg.addEventListener('close', () => io.disconnect(), { once: true });
  track.children[start]?.scrollIntoView({ block: 'start' });
  close.focus({ preventScroll: true });
}

function slide(p, dlg) {
  const s = make('section', undefined, 'vp-slide'); s.setAttribute('aria-label', 'Vídeo de ' + p.author);
  const v = document.createElement('video'); v.dataset.src = clip(p).url; if (clip(p).poster) v.poster = clip(p).poster; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'none'; v.muted = muted;
  v.addEventListener('loadedmetadata', () => { s.dataset.orient = v.videoWidth > v.videoHeight ? 'landscape' : 'portrait'; });
  v.addEventListener('click', () => { v.paused ? v.play().catch(() => {}) : v.pause(); });
  const info = make('div', undefined, 'vp-info');
  const who = make('button', undefined, 'vp-author'); who.type = 'button'; who.append(avatarNode(p.author, p.avatar, 36), make('strong', p.author));
  who.onclick = () => { dlg.close(); openProfile(p.authorKey, p.author, p.avatar); };
  info.append(who); if (p.text) info.append(make('p', p.text, 'vp-text'));
  // Seguir direto do vídeo: "+" no avatar, como nos apps de vídeo curto (some depois de seguir e nos próprios vídeos).
  if (!p.own && String(p.authorKey || '').startsWith('id:') && !p.following) {
    const plus = make('button', '+', 'vp-follow'); plus.type = 'button'; plus.setAttribute('aria-label', 'Seguir ' + p.author);
    plus.onclick = async e => { e.stopPropagation(); plus.disabled = true; try { await change({ action: 'follow', authorKey: p.authorKey, following: true }); p.following = true; plus.remove(); toast('Você agora segue ' + p.author + '.'); } catch (err) { plus.disabled = false; showError(err.message); } };
    who.after(plus);
  }
  const side = make('div', undefined, 'vp-actions');
  const act = (icon, label, fn) => { const b = make('button', undefined, 'vp-act'); b.type = 'button'; b.setAttribute('aria-label', label); const n = make('span', '', 'vp-count'); b.append(make('span', icon, 'vp-icon'), n); b.onclick = fn; side.append(b); return [b, n]; };
  const [like, likeN] = act('♥', 'Curtir', async () => {
    const next = p.reaction ? '' : 'like'; const prev = { reaction: p.reaction, reactions: { ...p.reactions } };
    p.reactions = { ...p.reactions }; if (p.reaction) p.reactions[p.reaction] = Math.max(0, (p.reactions[p.reaction] || 1) - 1); if (next) p.reactions[next] = (p.reactions[next] || 0) + 1; p.reaction = next; paint();
    try { await change({ action: 'react', postId: p.id, reaction: next }); } catch (e) { Object.assign(p, prev); paint(); showError(e.message); }
  });
  const [, comN] = act('💬', 'Comentar', () => comments(p, s, comN));
  act('↗', 'Compartilhar', () => {
    // Link público com prévia (título, texto e capa do vídeo) no WhatsApp; vídeo de perfil restrito cai na identidade padrão.
    const url = p.audience === 'public' ? location.origin + '/p/' + encodeURIComponent(p.id) + '/' : location.origin + '/#post-' + p.id;
    if (navigator.share) navigator.share({ title: 'Vídeo de ' + p.author + ' · Etnias', text: (p.text || '').slice(0, 120), url }).catch(() => {});
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

window.OpyVideos = { grid, open, openClip };
}());
