// Saberes: trilhas de conhecimento. Leitura em GET /api/community?view=saberes (lista) e &id= (trilha com aulas);
// ações trilha_* respondem com a visão atualizada. Só a equipe (admin/moderador) cria, edita e remove.
// Rotas na própria página: ?t=ID (trilha), ?t=ID&aula=ID (aula), ?editar=ID ou ?editar=nova (formulário da equipe).
(function () {
'use strict';
const S = window.OpyShared;
const root = document.getElementById('saberes-app');
if (!S || !root) return;
const { make, api, apiGet, toast, showError, emptyState, youtubeCard, linkified, readSlot, plural } = S;
let gen = 0;
// Texto escrito pela equipe (títulos, resumos, aulas) não passa pela tradução automática da interface.
const own = el => { el.dataset.noI18n = ''; return el; };
const params = () => new URLSearchParams(location.search);
const href = q => location.pathname + (Object.keys(q).length ? '?' + new URLSearchParams(q) : '');
function go(q, replace) { history[replace ? 'replaceState' : 'pushState'](null, '', href(q)); show(); scrollTo(0, 0); }
function link(label, q, cls) { const a = make('a', label, cls); a.href = href(q); a.onclick = e => { if (e.ctrlKey || e.metaKey || e.shiftKey) return; e.preventDefault(); go(q); }; return a; }
function action(label, fn, cls = 'preview-secondary') { const b = make('button', label, cls); b.type = 'button'; b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { showError(e.message); } finally { b.disabled = false; } }; return b; }
function progress(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  const bar = make('div', undefined, 'area-progress'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(pct)); bar.setAttribute('aria-label', 'Progresso na trilha');
  const fill = make('span'); fill.style.width = pct + '%'; bar.append(fill);
  const box = make('div', undefined, 'saber-progress'); box.append(bar, make('small', `${done} de ${plural(total, 'aula', 'aulas')} concluídas`)); return box;
}
const paragraphs = (text, cls) => { const box = own(make('div', undefined, cls)); for (const para of String(text || '').split(/\n{2,}/).filter(Boolean)) { const p = make('p'); p.append(linkified(para)); box.append(p); } return box; };

async function show() {
  const q = params(), mine = ++gen;
  const id = q.get('editar') || q.get('t') || '';
  try {
    const d = await apiGet({ view: 'saberes', ...(id && id !== 'nova' ? { id } : {}) });
    if (mine !== gen) return;
    if (q.get('editar')) { if (!d.staff) return go({}, true); root.replaceChildren(editor(d.trilha || null)); }
    else if (d.trilha && q.get('aula')) root.replaceChildren(lesson(d.trilha, q.get('aula')));
    else if (d.trilha) root.replaceChildren(detail(d.trilha, d.staff));
    else root.replaceChildren(list(d));
    document.title = (d.trilha ? d.trilha.title + ' · ' : '') + 'Saberes · Etnias';
  } catch (e) {
    if (mine !== gen) return;
    if (e.status === 401) { location.replace('/entrar/?next=' + encodeURIComponent(location.pathname + location.search)); return; }
    root.replaceChildren(emptyState('Não foi possível abrir', e.message, [['Voltar para Saberes', location.pathname]]));
  }
}

function list(d) {
  const box = make('div', undefined, 'area-list');
  const head = make('header', undefined, 'area-head saber-head');
  head.append(make('p', 'Trilhas de conhecimento com aulas em sequência. Acompanhe no seu ritmo e retome de onde parou.', 'area-sub'));
  if (d.staff) head.append(link('Criar trilha', { editar: 'nova' }, 'opy-primary'));
  box.append(head);
  if (!d.trilhas.length) {
    box.append(d.staff
      ? emptyState('Nenhuma trilha publicada ainda', 'Crie a primeira trilha com as aulas em ordem. Publique só o que a comunidade autorizou compartilhar.', [['Criar trilha', () => go({ editar: 'nova' })]])
      : emptyState('As trilhas estão sendo preparadas', 'A equipe do Etnias publica aqui os saberes autorizados pelas comunidades. Quando a primeira trilha chegar, ela aparece nesta página.', [['Voltar ao feed', '/']]));
    return box;
  }
  const grid = make('div', undefined, 'area-grid');
  for (const t of d.trilhas) {
    const a = link('', { t: t.id }, 'area-card');
    const fig = make('div', undefined, 'area-card-cover');
    if (t.cover) { const img = make('img'); img.src = t.cover; img.alt = ''; img.loading = 'lazy'; fig.append(img); } else { fig.classList.add('is-empty'); fig.append(make('span', t.title.slice(0, 1).toLocaleUpperCase('pt-BR'), 'area-card-initial')); }
    const body = make('div', undefined, 'area-card-body');
    body.append(make('small', [t.povo, plural(t.lessonsCount, 'aula', 'aulas')].filter(Boolean).join(' · '), 'area-card-meta'), own(make('strong', t.title)), own(make('p', t.summary, 'area-card-excerpt')));
    if (t.started) body.append(progress(t.doneCount, t.lessonsCount));
    a.append(fig, body); grid.append(a);
  }
  box.append(grid);
  return box;
}

function detail(t, staff) {
  const box = make('article', undefined, 'area-detail saber-detail');
  box.append(link('← Saberes', {}, 'area-back'));
  if (t.cover) { const img = make('img', undefined, 'area-cover'); img.src = t.cover; img.alt = ''; box.append(img); }
  const head = make('header', undefined, 'area-detail-head'); head.append(own(make('h1', t.title)));
  const facts = make('ul', undefined, 'area-facts'); if (t.povo) facts.append(own(make('li', t.povo))); facts.append(make('li', plural(t.lessonsCount, 'aula', 'aulas')), own(make('li', 'Por ' + t.author)));
  head.append(facts); box.append(head, paragraphs(t.summary, 'area-body'));
  if (t.started) box.append(progress(t.doneCount, t.lessonsCount));
  const actions = make('div', undefined, 'area-actions');
  const finished = t.doneCount === t.lessonsCount;
  if (!t.started) actions.append(action('Começar trilha', async () => { const r = await api({ action: 'trilha_start', id: t.id }); go({ t: t.id, aula: r.trilha.nextLessonId }); }, 'opy-primary'));
  else if (!finished) actions.append(link('Continuar de onde parei', { t: t.id, aula: t.nextLessonId }, 'opy-primary'));
  else actions.append(make('p', 'Você concluiu todas as aulas desta trilha.', 'saber-done'));
  if (staff) {
    actions.append(link('Editar trilha', { editar: t.id }, 'preview-secondary'));
    actions.append(action('Remover trilha', async () => { if (!confirm('Remover a trilha "' + t.title + '"? As aulas e o progresso de quem acompanha deixam de existir.')) return; await api({ action: 'trilha_delete', id: t.id }); toast('Trilha removida'); go({}); }));
  }
  box.append(actions);
  const ol = make('ol', undefined, 'saber-lessons'); ol.setAttribute('aria-label', 'Aulas da trilha');
  t.lessons.forEach((l, i) => { const li = make('li', undefined, l.done ? 'is-done' : ''); const a = link('', { t: t.id, aula: l.id }); a.append(make('span', l.done ? '✓' : String(i + 1), 'saber-lesson-mark'), own(make('span', l.title))); if (l.done) a.setAttribute('aria-label', l.title + ' (concluída)'); li.append(a); ol.append(li); });
  box.append(ol);
  return box;
}

function lesson(t, lessonId) {
  const i = t.lessons.findIndex(l => l.id === lessonId);
  if (i < 0) return emptyState('Aula não encontrada', 'A equipe pode ter reorganizado esta trilha.', [['Ver a trilha', href({ t: t.id })]]);
  const l = t.lessons[i];
  const box = make('article', undefined, 'area-detail saber-lesson');
  box.append(own(link('← ' + t.title, { t: t.id }, 'area-back')));
  const head = make('header', undefined, 'area-detail-head'); head.append(make('small', `Aula ${i + 1} de ${t.lessons.length}`, 'area-card-meta'), own(make('h1', l.title))); box.append(head);
  if (l.youtube) box.append(youtubeCard(l.youtube, t.title));
  if (l.text) box.append(paragraphs(l.text, 'area-body'));
  const actions = make('div', undefined, 'area-actions');
  const mark = action(l.done ? '✓ Aula concluída' : 'Marcar como concluída', async () => {
    const r = await api({ action: 'trilha_lesson', id: t.id, lessonId: l.id, done: !l.done });
    const next = t.lessons[i + 1];
    if (!l.done && next) { toast('Aula concluída'); go({ t: t.id, aula: next.id }); return; }
    if (!l.done && r.trilha.doneCount === r.trilha.lessonsCount) { toast('Trilha concluída'); go({ t: t.id }); return; }
    go({ t: t.id, aula: l.id }, true);
  }, l.done ? 'preview-secondary' : 'opy-primary');
  mark.setAttribute('aria-pressed', String(l.done)); actions.append(mark);
  if (i > 0) actions.append(link('← Aula anterior', { t: t.id, aula: t.lessons[i - 1].id }, 'preview-secondary'));
  if (t.lessons[i + 1]) actions.append(link('Próxima aula →', { t: t.id, aula: t.lessons[i + 1].id }, 'preview-secondary'));
  box.append(actions, progress(t.doneCount, t.lessonsCount));
  return box;
}

// Formulário da equipe: dados da trilha, capa opcional e aulas em ordem (subir, descer, remover).
function editor(t) {
  const f = make('form', undefined, 'area-detail set-verify saber-form');
  f.append(t ? own(link('← ' + t.title, { t: t.id }, 'area-back')) : link('← Saberes', {}, 'area-back'), make('h2', t ? 'Editar trilha' : 'Criar trilha'));
  const field = (label, value, max, multiline, required = true) => { const l = make('label', label); const i = make(multiline ? 'textarea' : 'input'); i.value = value || ''; i.maxLength = max; i.required = required; if (multiline) i.rows = multiline; l.append(i); return [l, i]; };
  const [lt, title] = field('Título da trilha', t?.title, 120);
  const [ls, summary] = field('Resumo', t?.summary, 600, 3);
  const [lp, povo] = field('Povo ou tema (opcional)', t?.povo, 80, 0, false);
  f.append(lt, ls, lp);
  let cover, coverState = t?.cover ? 'keep' : 'none';
  const coverBox = make('div', undefined, 'saber-cover-field');
  const coverInput = make('input'); coverInput.type = 'file'; coverInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  const coverLabel = make('label', 'Capa (foto opcional)'); coverLabel.append(coverInput);
  const paintCover = () => { coverBox.replaceChildren(coverLabel); const src = coverState === 'new' ? cover.data : coverState === 'keep' ? t.cover : ''; if (src) { const img = make('img', undefined, 'saber-cover-preview'); img.src = src; img.alt = 'Prévia da capa'; coverBox.append(img, action('Remover capa', async () => { cover = null; coverState = t?.cover ? 'removed' : 'none'; coverInput.value = ''; paintCover(); })); } };
  coverInput.onchange = async () => { try { cover = await readSlot(coverInput.files[0], 900 * 1024); if (cover && !/^data:image\/(png|jpeg|gif|webp);/.test(cover.data)) throw Error('A capa precisa ser PNG, JPG, GIF ou WebP.'); coverState = cover ? 'new' : coverState; paintCover(); } catch (e) { showError(e.message); coverInput.value = ''; } };
  paintCover(); f.append(coverBox);

  const lessons = (t?.lessons || [{}]).map(l => ({ id: l.id, title: l.title || '', video: l.video || '', text: l.text || '' }));
  const list = make('ol', undefined, 'saber-edit-lessons');
  const paint = () => {
    list.replaceChildren(...lessons.map((l, i) => {
      const li = make('li'); const fs = make('fieldset'); fs.append(make('legend', 'Aula ' + (i + 1)));
      const [a, ti] = field('Título da aula', l.title, 120); ti.oninput = () => { l.title = ti.value; };
      const [b, vi] = field('Vídeo do YouTube (link opcional)', l.video, 300, 0, false); vi.type = 'url'; vi.placeholder = 'https://youtu.be/…'; vi.oninput = () => { l.video = vi.value; };
      const [c, te] = field('Texto da aula', l.text, 8000, 5, false); te.oninput = () => { l.text = te.value; };
      const tools = make('div', undefined, 'area-actions');
      const move = (to, label) => { const btn = make('button', label, 'preview-secondary'); btn.type = 'button'; btn.onclick = () => { lessons.splice(to, 0, lessons.splice(i, 1)[0]); paint(); list.children[to]?.querySelector('input')?.focus(); }; tools.append(btn); };
      if (i > 0) move(i - 1, '↑ Subir');
      if (i < lessons.length - 1) move(i + 1, '↓ Descer');
      if (lessons.length > 1) { const rm = make('button', 'Remover aula', 'preview-secondary'); rm.type = 'button'; rm.onclick = () => { lessons.splice(i, 1); paint(); }; tools.append(rm); }
      fs.append(a, b, c, tools); li.append(fs); return li;
    }));
  };
  paint();
  const add = make('button', '+ Adicionar aula', 'preview-secondary'); add.type = 'button';
  add.onclick = () => { if (lessons.length >= 30) { showError('Uma trilha tem até 30 aulas.'); return; } lessons.push({ title: '', video: '', text: '' }); paint(); list.lastElementChild?.querySelector('input')?.focus(); };
  f.append(make('h3', 'Aulas'), list, add);
  f.append(make('p', 'Publique só conteúdo que a comunidade de origem autorizou compartilhar.', 'area-note'));
  const save = make('button', t ? 'Salvar alterações' : 'Publicar trilha', 'opy-primary'); save.type = 'submit';
  const status = make('p', '', 'area-note'); status.setAttribute('role', 'status');
  f.append(save, status);
  f.onsubmit = async e => {
    e.preventDefault(); save.disabled = true; status.textContent = 'Salvando…';
    try {
      const body = { action: 'trilha_save', title: title.value, summary: summary.value, povo: povo.value, lessons };
      if (t) body.id = t.id;
      if (coverState === 'new') body.cover = { name: cover.name, data: cover.data };
      if (coverState === 'removed') body.cover = null;
      const r = await api(body);
      toast(t ? 'Trilha atualizada' : 'Trilha publicada'); go({ t: r.trilha.id });
    } catch (err) { status.textContent = err.message; showError(err.message); }
    finally { save.disabled = false; }
  };
  return f;
}

window.addEventListener('popstate', show);
show();
})();
