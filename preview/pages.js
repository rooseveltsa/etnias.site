(function () {
'use strict';
// Páginas (estilo Facebook): lista, criação, página com capa/foto, seguidores, agenda e estatísticas. Dados de /api/community?view=pages|page.
const S = window.OpyShared; if (!S) return;
const { make, change, toast, showError, avatarNode } = S;
const fmtDate = t => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t));
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const get = async qs => { const r = await fetch('/api/community?' + qs, { credentials: 'same-origin', cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Error(j.error || 'Não foi possível carregar.'); return j; };
const input = (label, name, opts = {}) => {
  const l = make('label'); l.append(make('span', label, 'pg-label'));
  const el = document.createElement(opts.area ? 'textarea' : opts.select ? 'select' : 'input');
  el.name = name; if (opts.max) el.maxLength = opts.max; if (opts.type) el.type = opts.type; if (opts.required) el.required = true; if (opts.rows) el.rows = opts.rows; if (opts.placeholder) el.placeholder = opts.placeholder; if (opts.autocomplete) el.autocomplete = opts.autocomplete;
  if (opts.select) opts.select.forEach(o => el.append(new Option(o, o)));
  if (opts.value !== undefined) el.value = opts.value; l.append(el); return [l, el];
};

/* ---------- lista ---------- */
let root = null, scope = 'all', query = '';
const route = () => new URLSearchParams(location.search).get('p');
async function paintList() {
  const wrap = make('div', undefined, 'pg-list');
  const head = make('div', undefined, 'pg-head'); head.append(make('h1', 'Páginas'));
  const create = make('button', 'Criar página', 'opy-primary'); create.type = 'button'; create.onclick = () => openForm(null); head.append(create);
  const tools = make('div', undefined, 'pg-tools');
  const q = make('input'); q.type = 'search'; q.placeholder = 'Buscar páginas'; q.setAttribute('aria-label', 'Buscar páginas'); q.value = query; q.maxLength = 60;
  let timer = 0; q.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { query = q.value.trim(); load(); }, 300); };
  const tabs = make('div', undefined, 'pg-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Filtrar páginas');
  for (const [k, l] of [['all', 'Descobrir'], ['following', 'Seguindo'], ['mine', 'Minhas']]) { const b = make('button', l, 'pg-chip'); b.type = 'button'; b.setAttribute('aria-pressed', String(scope === k)); b.onclick = () => { scope = k; paintList(); }; tabs.append(b); }
  tools.append(q, tabs);
  const grid = make('div', undefined, 'pg-grid'); grid.setAttribute('aria-busy', 'true'); grid.append(make('p', 'Carregando páginas…', 'pg-empty'));
  wrap.append(head, tools, grid); root.replaceChildren(wrap);
  create.hidden = false;
  async function load() {
    try {
      const d = await get(new URLSearchParams({ view: 'pages', scope, q: query }).toString());
      create.disabled = !d.canCreate; if (!d.canCreate) create.title = 'Limite de 5 páginas por pessoa.';
      grid.removeAttribute('aria-busy'); grid.replaceChildren();
      if (!d.pages.length) { grid.append(make('p', scope === 'mine' ? 'Você ainda não tem páginas. Crie a primeira para divulgar seu projeto.' : scope === 'following' ? 'Você ainda não segue nenhuma página.' : 'Nenhuma página encontrada.', 'pg-empty')); return; }
      for (const p of d.pages) grid.append(card(p));
    } catch (e) { grid.replaceChildren(make('p', e.message, 'pg-empty')); }
  }
  q.focus && 0; load();
}
function card(p) {
  const a = make('article', undefined, 'pg-card');
  const link = make('a'); link.href = '/paginas/?p=' + encodeURIComponent(p.id); link.className = 'pg-card-link';
  const av = make('span', undefined, 'pg-card-av'); av.append(p.avatar ? Object.assign(make('img'), { src: p.avatar, alt: '', width: 56, height: 56, loading: 'lazy' }) : make('span', p.name.slice(0, 1).toUpperCase(), 'pg-initial'));
  const t = make('span', undefined, 'pg-card-t'); t.append(make('strong', p.name), make('small', p.category + ' · ' + compact.format(p.followers) + (p.followers === 1 ? ' seguidor' : ' seguidores')));
  link.append(av, t); a.append(link);
  if (p.role) a.append(make('span', p.role === 'owner' ? 'Dono(a)' : p.role === 'admin' ? 'Admin' : 'Moderação', 'pg-role'));
  else { const f = make('button', p.following ? 'Seguindo' : 'Seguir', p.following ? 'preview-secondary' : 'opy-primary'); f.type = 'button'; f.setAttribute('aria-pressed', String(p.following));
    f.onclick = async () => { p.following = !p.following; p.followers += p.following ? 1 : -1; a.replaceWith(card(p)); try { await change({ action: 'page_follow', pageId: p.id }); } catch (e) { p.following = !p.following; p.followers += p.following ? 1 : -1; showError(e.message); } }; a.append(f); }
  return a;
}

/* ---------- página ---------- */
async function paintPage(id) {
  root.replaceChildren(make('p', 'Carregando página…', 'pg-empty'));
  let pg; try { pg = await get(new URLSearchParams({ view: 'page', id }).toString()); } catch (e) { const w = make('div', undefined, 'pg-list'); w.append(make('p', e.message, 'pg-empty'), Object.assign(make('a', 'Ver todas as páginas'), { href: '/paginas/' })); root.replaceChildren(w); return; }
  document.title = pg.name + ' · Etnias';
  const page = make('div', undefined, 'pf-page pg-page');
  const back = make('a', '← Todas as páginas', 'pg-back'); back.href = '/paginas/';
  const top = make('section', undefined, 'pf-top');
  const cover = make('div', undefined, 'pf-cover'); if (pg.cover) cover.append(Object.assign(make('img'), { src: pg.cover, alt: 'Capa da página ' + pg.name }));
  if (pg.canEdit) { const b = make('button', 'Editar capa', 'pf-cover-btn'); b.type = 'button'; b.onclick = () => pickImage('cover', pg); cover.append(b); }
  const head = make('div', undefined, 'pf-head');
  const av = make('div', undefined, 'pf-avatar'); if (pg.avatar) { const im = Object.assign(make('img'), { src: pg.avatar, alt: 'Foto da página ' + pg.name, width: 168, height: 168 }); im.className = 'preview-avatar preview-avatar-image'; av.append(im); } else av.append(avatarNode(pg.name, '', 168));
  if (pg.canEdit) { const b = make('button', '', 'pf-avatar-btn'); b.type = 'button'; b.setAttribute('aria-label', 'Trocar foto da página'); b.title = 'Trocar foto da página'; b.onclick = () => pickImage('avatar', pg); av.append(b); }
  const idc = make('div', undefined, 'pf-id'); idc.append(make('h1', pg.name));
  if (pg.tagline) idc.append(make('p', pg.tagline, 'pf-meta'));
  idc.append(make('p', [pg.category, pg.city].filter(Boolean).join(' · '), 'pf-meta'));
  const actions = make('div', undefined, 'pf-actions');
  const follow = make('button', pg.following ? 'Seguindo' : 'Seguir', 'pf-pill pf-pill-green'); follow.type = 'button'; follow.setAttribute('aria-pressed', String(pg.following)); if (pg.role === 'owner') follow.hidden = true;
  follow.onclick = async () => { follow.disabled = true; try { await change({ action: 'page_follow', pageId: pg.id }); await paintPage(id); } catch (e) { showError(e.message); follow.disabled = false; } };
  actions.append(follow);
  if (pg.canEdit) { const e = make('button', 'Editar página', 'pf-pill pf-pill-brown'); e.type = 'button'; e.onclick = () => openForm(pg); actions.append(e); }
  const share = make('button', 'Compartilhar', 'pf-pill pf-pill-line'); share.type = 'button';
  share.onclick = async () => { const url = location.origin + '/paginas/?p=' + pg.id; if (navigator.share) { try { await navigator.share({ title: pg.name + ' no Etnias', url }); } catch {} return; } try { await navigator.clipboard.writeText(url); toast('Link da página copiado.'); } catch { window.prompt('Copie o link:', url); } };
  actions.append(share);
  idc.append(actions);
  const counts = make('p', undefined, 'pf-counts'); const c1 = make('span', undefined, 'pf-count'); c1.append(make('strong', compact.format(pg.followers)), make('small', pg.followers === 1 ? 'seguidor' : 'seguidores')); counts.append(c1); idc.append(counts);
  head.append(av, idc); top.append(cover, head);
  const body = make('div', undefined, 'pg-body');
  // Sobre
  const about = make('section', undefined, 'pf-card pg-about'); about.append(make('h2', 'Sobre'));
  if (pg.about) about.append(make('p', pg.about, 'pg-text')); else about.append(make('p', pg.canEdit ? 'Conte quem somos. Toque em Editar página.' : 'Sem descrição ainda.', 'pf-empty'));
  if (pg.project) { about.append(make('h3', 'O projeto'), make('p', pg.project, 'pg-text')); }
  const facts = make('ul', undefined, 'pf-facts');
  if (pg.phone) { const li = make('li'); const a = make('a', pg.phone); a.href = 'tel:' + pg.phone.replace(/[^0-9+]/g, ''); li.append('Telefone: ', a); facts.append(li); }
  if (pg.website) { const li = make('li'); const a = make('a', pg.website.replace(/^https?:\/\//, '').replace(/\/$/, '')); a.href = pg.website; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow ugc'; li.append('Site: ', a); facts.append(li); }
  if (pg.owner) { const li = make('li'); const a = make('a', pg.owner.name); a.href = '/perfil/?u=' + encodeURIComponent(pg.owner.key); li.append('Criada por ', a); facts.append(li); }
  facts.append(make('li', 'Na rede desde ' + new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(pg.createdAt))));
  about.append(facts);
  if (pg.staff.length) { about.append(make('h3', 'Equipe')); const ul = make('ul', undefined, 'pg-staff'); pg.staff.forEach(m => { const li = make('li'); const a = make('a'); a.href = '/perfil/?u=' + encodeURIComponent(m.key); a.append(avatarNode(m.name, m.avatar, 32), make('span', m.name)); li.append(a, make('small', m.role === 'admin' ? 'Admin' : 'Moderação')); ul.append(li); }); about.append(ul); }
  // Agenda
  const agenda = make('section', undefined, 'pf-card pg-agenda'); const ah = make('div', undefined, 'pf-card-head'); ah.append(make('h2', 'Agenda de eventos'));
  if (pg.canEvents) { const add = make('button', 'Novo evento', 'preview-secondary'); add.type = 'button'; add.onclick = () => openEvent(pg, null); ah.append(add); }
  agenda.append(ah);
  const upcoming = pg.events.filter(e => !e.past), past = pg.events.filter(e => e.past).slice(-3).reverse();
  if (!pg.events.length) agenda.append(make('p', pg.canEvents ? 'Nenhum evento ainda. Toque em Novo evento.' : 'Nenhum evento marcado.', 'pf-empty'));
  const evList = (list, cls) => { const ul = make('ul', undefined, 'pg-events ' + cls); list.forEach(e => ul.append(eventItem(pg, e))); return ul; };
  if (upcoming.length) agenda.append(evList(upcoming, 'is-upcoming'));
  if (past.length) { agenda.append(make('h3', 'Já aconteceram'), evList(past, 'is-past')); }
  const all = make('a', 'Ver todos os eventos do Etnias'); all.href = pg.eventsLink; all.className = 'pg-all'; agenda.append(all);
  body.append(about, agenda);
  if (pg.stats) body.append(statsCard(pg), teamCard(pg));
  body.append(postsCard(pg));
  page.append(back, top, body); root.replaceChildren(page);
}
// Feed da Página: publicações feitas em nome dela (quem administra publica pelo campo "Onde publicar" do feed).
function postsCard(pg) {
  const box = make('section', undefined, 'pf-card pg-posts'); box.append(make('h2', 'Publicações'));
  const list = make('div', undefined, 'pg-posts-list'); box.append(list);
  if (['owner', 'admin'].includes(pg.role)) box.insertBefore(make('p', 'Para publicar como esta Página, escolha "Como Página: ' + pg.name + '" em "Onde publicar", no feed.', 'pf-empty'), list);
  get('view=posts&limit=20&page=' + encodeURIComponent(pg.id)).then(d => {
    if (!d.posts.length) return list.append(make('p', 'Nenhuma publicação ainda.', 'pf-empty'));
    d.posts.forEach(p => list.append(S.renderPost(p)));
  }).catch(e => list.append(make('p', e.message, 'pf-empty')));
  return box;
}
function eventItem(pg, e) {
  const li = make('li'); const when = make('time', fmtDate(e.startsAt)); when.dateTime = new Date(e.startsAt).toISOString();
  const t = make('div'); t.append(make('strong', e.title), when); if (e.place) t.append(make('span', e.place)); if (e.description) t.append(make('p', e.description));
  li.append(t);
  const acts = make('div', undefined, 'pg-event-actions');
  const go = make('button', e.iGo ? 'Vou' : 'Tenho interesse', e.iGo ? 'opy-primary' : 'preview-secondary'); go.type = 'button'; go.setAttribute('aria-pressed', String(e.iGo));
  go.onclick = async () => { go.disabled = true; try { await change({ action: 'page_event_rsvp', pageId: pg.id, id: e.id }); await paintPage(pg.id); } catch (er) { showError(er.message); go.disabled = false; } };
  acts.append(go, make('small', e.goingCount + (e.goingCount === 1 ? ' interessada(o)' : ' interessadas(os)')));
  if (pg.canEvents) {
    const ed = make('button', 'Editar', 'pg-link'); ed.type = 'button'; ed.onclick = () => openEvent(pg, e);
    const del = make('button', 'Apagar', 'pg-link'); del.type = 'button'; del.onclick = async () => { if (!confirm('Apagar o evento “' + e.title + '”?')) return; try { await change({ action: 'page_event_delete', pageId: pg.id, id: e.id }); await paintPage(pg.id); } catch (er) { showError(er.message); } };
    acts.append(ed, del);
  }
  li.append(acts); return li;
}
function statsCard(pg) {
  const c = make('section', undefined, 'pf-card pg-stats'); c.append(make('h2', 'Estatísticas'), make('p', 'Só a equipe da página vê estes números.', 'set-desc'));
  const g = make('dl', undefined, 'pg-stat-grid');
  [['Seguidores', pg.stats.followers], ['Entraram em 7 dias', pg.stats.last7], ['Entraram em 30 dias', pg.stats.last30], ['Eventos futuros', pg.stats.upcoming], ['Interessadas(os) nos eventos', pg.stats.interested]].forEach(([l, v]) => { const d = make('div'); d.append(make('dt', l), make('dd', compact.format(v))); g.append(d); });
  c.append(g);
  const max = Math.max(1, ...pg.stats.series.map(x => x.n));
  const chart = make('div', undefined, 'pg-chart'); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Novos seguidores nos últimos 14 dias: ' + pg.stats.series.map(x => x.n).join(', '));
  pg.stats.series.forEach(x => { const b = make('span'); b.style.setProperty('--h', Math.round(x.n / max * 100) + '%'); b.title = new Date(x.day).toLocaleDateString('pt-BR') + ': ' + x.n; chart.append(b); });
  c.append(make('h3', 'Novos seguidores (14 dias)'), chart); return c;
}
function teamCard(pg) {
  const c = make('section', undefined, 'pf-card pg-team'); c.append(make('h2', 'Equipe'), make('p', 'Moderação cria eventos. Administração também edita a página. Só quem criou a página escolhe administradores.', 'set-desc'));
  const form = make('form', undefined, 'pg-inline'); const [l1, u] = input('@ da pessoa', 'username', { max: 40, required: true, autocomplete: 'off' }); const [l2, r] = input('Função', 'role', { select: ['mod', 'admin', ''] });
  r.replaceChildren(new Option('Moderação', 'mod'), new Option('Administração', 'admin'), new Option('Remover da equipe', ''));
  if (pg.role !== 'owner') r.querySelector('option[value=admin]').disabled = true;
  const send = make('button', 'Salvar', 'opy-primary'); send.type = 'submit'; form.append(l1, l2, send);
  form.onsubmit = async e => { e.preventDefault(); send.disabled = true; try { await change({ action: 'page_role', pageId: pg.id, username: u.value, role: r.value }); toast('Equipe atualizada.'); await paintPage(pg.id); } catch (er) { showError(er.message); send.disabled = false; } };
  c.append(form);
  if (pg.role === 'owner') { const del = make('button', 'Apagar página', 'preview-secondary pg-danger'); del.type = 'button'; del.onclick = async () => { if (!confirm('Apagar a página “' + pg.name + '” e a agenda dela? Não dá para desfazer.')) return; try { await change({ action: 'page_delete', pageId: pg.id }); location.href = '/paginas/'; } catch (er) { showError(er.message); } }; c.append(del); }
  return c;
}

/* ---------- formulários ---------- */
function dialog(title, onSubmit, fields) {
  const d = make('dialog', undefined, 'community-dialog pg-dialog'); d.setAttribute('aria-labelledby', 'pg-dialog-title');
  const form = make('form'); form.method = 'dialog'; const h = make('h2', title); h.id = 'pg-dialog-title';
  const status = make('p', '', 'pg-status'); status.setAttribute('role', 'alert');
  const actions = make('div', undefined, 'community-dialog-actions'); const ok = make('button', 'Salvar', 'opy-primary'); ok.type = 'submit'; const no = make('button', 'Cancelar', 'preview-secondary'); no.type = 'button'; no.onclick = () => d.close(); actions.append(ok, no);
  form.append(h, ...fields, status, actions);
  form.onsubmit = async e => { e.preventDefault(); ok.disabled = true; status.textContent = ''; try { await onSubmit(); d.close(); } catch (er) { status.textContent = er.message; } finally { ok.disabled = false; } };
  d.addEventListener('close', () => d.remove()); d.append(form); document.body.append(d); d.showModal(); return d;
}
function openForm(pg) {
  const f = {};
  const mk = (...a) => { const [l, el] = input(...a); f[a[1]] = el; return l; };
  const fields = [mk('Nome da página', 'name', { max: 60, required: true, value: pg?.name || '' }), mk('Título curto (opcional)', 'tagline', { max: 120, value: pg?.tagline || '', placeholder: 'Ex.: Cultura Baniwa em movimento' }),
    mk('Categoria', 'category', { select: pg?.categories || ['Organização indígena', 'Projeto cultural', 'Artista ou coletivo', 'Comunidade ou aldeia', 'Educação', 'Saúde', 'Comunicação', 'Outro'], value: pg?.category }),
    mk('Sobre', 'about', { area: true, rows: 3, max: 1000, value: pg?.about || '' }), mk('Sobre o projeto', 'project', { area: true, rows: 3, max: 1000, value: pg?.project || '' }),
    mk('Telefone', 'phone', { type: 'tel', max: 24, value: pg?.phone || '', autocomplete: 'off' }), mk('Site', 'website', { max: 200, value: pg?.website || '', placeholder: 'exemplo.org' }), mk('Cidade', 'city', { max: 60, value: pg?.city || '' })];
  dialog(pg ? 'Editar página' : 'Criar página', async () => {
    const body = { action: pg ? 'page_update' : 'page_create', ...(pg ? { pageId: pg.id } : {}) }; for (const k of Object.keys(f)) body[k] = f[k].value;
    await change(body); toast(pg ? 'Página atualizada.' : 'Página criada.');
    if (pg) await paintPage(pg.id); else { const mine = await get('view=pages&scope=mine'); const created = mine.pages.find(p => p.name === body.name) || mine.pages[0]; location.href = '/paginas/?p=' + encodeURIComponent(created.id); }
  }, fields);
}
function openEvent(pg, e) {
  const f = {}; const mk = (...a) => { const [l, el] = input(...a); f[a[1]] = el; return l; };
  const local = e ? new Date(e.startsAt - new Date(e.startsAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  dialog(e ? 'Editar evento' : 'Novo evento', async () => {
    await change({ action: 'page_event_save', pageId: pg.id, ...(e ? { id: e.id } : {}), title: f.title.value, startsAt: new Date(f.when.value).getTime(), place: f.place.value, description: f.description.value }); toast('Evento salvo.'); await paintPage(pg.id);
  }, [mk('Título', 'title', { max: 80, required: true, value: e?.title || '' }), mk('Data e hora', 'when', { type: 'datetime-local', required: true, value: local }), mk('Local', 'place', { max: 100, value: e?.place || '' }), mk('Descrição', 'description', { area: true, rows: 3, max: 400, value: e?.description || '' })]);
}
function pickImage(kind, pg) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'; inp.hidden = true; document.body.append(inp);
  inp.onchange = async () => {
    try {
      let file = inp.files[0]; if (!file) return;
      file = await S.shrinkPhoto(file, 1.5 * 1024 * 1024);
      const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(Error('Não foi possível ler a imagem.')); r.readAsDataURL(file); });
      await change({ action: 'page_media', pageId: pg.id, kind, media: { name: file.name, data } }); toast(kind === 'avatar' ? 'Foto da página atualizada.' : 'Capa da página atualizada.'); await paintPage(pg.id);
    } catch (e) { showError(e.message); } finally { inp.remove(); }
  };
  inp.click();
}

/* ---------- cartão no perfil ---------- */
const profileCache = new Map();
window.OpyPages = {
  profileCard(key, own) {
    if (!key || !key.startsWith('id:')) return null;
    const c = make('section', undefined, 'pf-card pg-profile'); c.hidden = true;
    const paint = list => {
      c.replaceChildren(make('h2', 'Páginas'));
      if (!list.length) { if (!own) { c.hidden = true; return; } const a = make('a', 'Criar uma página'); a.href = '/paginas/'; c.append(make('p', 'Divulgue seu projeto, aldeia ou coletivo.', 'pf-empty'), a); c.hidden = false; return; }
      const ul = make('ul', undefined, 'pg-profile-list'); list.forEach(p => { const li = make('li'); const a = make('a'); a.href = '/paginas/?p=' + encodeURIComponent(p.id); a.append(p.avatar ? Object.assign(make('img'), { src: p.avatar, alt: '', width: 32, height: 32 }) : make('span', p.name.slice(0, 1).toUpperCase(), 'pg-initial'), make('span', p.name)); li.append(a); ul.append(li); }); c.append(ul); c.hidden = false;
    };
    const hit = profileCache.get(key); if (hit) paint(hit.list);
    if (!hit || Date.now() - hit.at > 60000) get(new URLSearchParams({ view: 'pages', owner: key }).toString()).then(d => { profileCache.set(key, { at: Date.now(), list: d.pages }); paint(d.pages); }).catch(() => {});
    return c;
  }
};

function mount() {
  if (document.body.dataset.previewRoute !== 'suggested-pages') return;
  const legacy = document.getElementById('area-app'); if (!legacy) return;
  root = make('div', undefined, 'pg-root'); root.id = 'opy-pages'; legacy.before(root);
  const id = route();
  if (id) { legacy.hidden = true; paintPage(id); } else paintList();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
}());
