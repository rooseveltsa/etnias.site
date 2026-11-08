(() => {
'use strict';
// Centro de gestão da Casa Opy. Dados de GET /api/community?view=admin; ações admin_* respondem com a visão atualizada.
const root = document.getElementById('admin-app'); if (!root) return;
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined && text !== null) e.textContent = text; if (cls) e.className = cls; return e; };
const svgEl = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);
const fmtDate = t => t ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)) : '—';
const fmtDay = t => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(t));
const rel = t => { if (!t) return 'sem atividade'; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };
let data = null, tab = location.hash.replace('#', '') || 'visao', query = '', busy = false;
const tabs = [['visao', 'Visão geral'], ['alertas', 'Alertas'], ['pessoas', 'Pessoas'], ['conteudo', 'Conteúdo'], ['comunidades', 'Comunidades'], ['comunicados', 'Comunicados'], ['registro', 'Registro'], ['traducoes', 'Traduções'], ['desenvolvimento', 'Desenvolvimento']];
// Painel de traduções (GET /api/community?view=i18n). Quem só traduz entra direto nele.
let idata = null, ilang = '', ifilter = 'faltando', iquery = '', ipage = 0, translatorOnly = false;
async function api18(body) {
  const r = await fetch('/api/community?view=i18n', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(Error(j.error || 'Não foi possível concluir.'), { status: r.status });
  return j;
}
async function act18(body, done) { if (busy) return; busy = true; try { idata = await api18(body); render(); toast(done); } catch (e) { toast(e.message, true); } finally { busy = false; } }

async function api(body) {
  const url = '/api/community?' + new URLSearchParams({ view: 'admin', ...(query ? { q: query } : {}) });
  const r = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/entrar/?next=/admin/'; throw Error('Entre novamente.'); }
  if (!r.ok) throw Error(j.error || 'Não foi possível concluir.');
  return j;
}
function toast(msg, bad) { const t = el('p', msg, 'adm-toast' + (bad ? ' is-bad' : '')); t.setAttribute('role', bad ? 'alert' : 'status'); document.body.append(t); setTimeout(() => t.remove(), 4200); }
async function act(body, done) { if (busy) return; busy = true; try { data = await api(body); render(); toast(done); } catch (e) { toast(e.message, true); } finally { busy = false; } }
async function load() {
  try { data = await api(); if (tab === 'traducoes') idata = await api18(); render(); }
  catch (e) {
    try { idata = await api18(); translatorOnly = true; tab = 'traducoes'; data = { viewer: { name: '' }, role: 'translator', openAlerts: 0 }; render(); }
    catch { root.replaceChildren(el('div', e.message, 'adm-denied')); }
  }
}

// Diálogo único para pedir motivo (e prazo, na suspensão): toda ação fica registrada com o porquê.
function ask({ title, help, needDays = false, confirm = 'Confirmar', danger = false, allowForever = false }) {
  return new Promise(resolve => {
    const d = el('dialog', undefined, 'adm-dialog'); const f = el('form'); f.method = 'dialog';
    f.append(el('h2', title)); if (help) f.append(el('p', help, 'adm-muted'));
    let days;
    if (needDays) { const l = el('label', 'Prazo'); days = el('select'); for (const [v, t] of [[1, '1 dia'], [3, '3 dias'], [7, '7 dias'], [30, '30 dias'], ...(allowForever ? [[0, 'Sem prazo (até reativar)']] : [])]) { const o = el('option', t); o.value = v; days.append(o); } days.value = '7'; l.append(days); f.append(l); }
    const l2 = el('label', 'Motivo (fica no registro de transparência)'); const reason = el('textarea'); reason.maxLength = 300; reason.rows = 3; reason.required = true; l2.append(reason); f.append(l2);
    const row = el('div', undefined, 'adm-dialog-actions'); const cancel = el('button', 'Cancelar', 'adm-btn'); cancel.value = 'cancel'; cancel.formNoValidate = true; const ok = el('button', confirm, 'adm-btn ' + (danger ? 'is-danger' : 'is-primary')); ok.value = 'ok';
    row.append(cancel, ok); f.append(row); d.append(f); document.body.append(d);
    d.addEventListener('close', () => { const v = d.returnValue === 'ok' ? { reason: reason.value.trim(), days: days ? Number(days.value) : undefined } : null; d.remove(); resolve(v); });
    d.showModal(); reason.focus();
  });
}
function btn(label, fn, cls = '') { const b = el('button', label, 'adm-btn ' + cls); b.type = 'button'; b.onclick = fn; return b; }
function pill(text, kind) { return el('span', text, 'adm-pill ' + (kind || '')); }
function personLink(name, key) { if (!key) return el('strong', name); const a = el('a', name); a.href = '/perfil/?u=' + encodeURIComponent(key); return a; }
async function suspend(p) { const r = await ask({ title: 'Suspender ' + p.name, help: 'A sessão é encerrada na hora e o motivo aparece ao tentar entrar.', needDays: true, confirm: 'Suspender', danger: true, allowForever: data.role === 'admin' }); if (r) act({ action: 'admin_suspend', userKey: p.key, days: r.days, reason: r.reason }, 'Conta de ' + p.name + ' suspensa.'); }
// Recuperação de senha sem e-mail: a pessoa pede por um canal conhecido (WhatsApp, ligação), a administração emite uma senha
// provisória e a passa pelo mesmo canal. A senha aparece uma única vez, aqui.
async function resetPassword(p) {
  const r = await ask({ title: 'Nova senha para ' + p.name, help: 'A senha atual deixa de valer, todos os aparelhos saem e a pessoa terá de criar uma senha nova na primeira entrada. Só faça isso a pedido da própria pessoa.', confirm: 'Gerar senha provisória', danger: true });
  if (!r || busy) return; busy = true;
  try {
    data = await api({ action: 'admin_reset_password', userKey: p.key, reason: r.reason }); render();
    const d = el('dialog', undefined, 'adm-dialog'); d.append(el('h2', 'Senha provisória de ' + p.name), el('p', 'Passe à pessoa por um canal seguro. Ela não aparece de novo.', 'adm-muted'));
    const code = el('output', data.temporaryPassword, 'adm-code'); d.append(code);
    const row = el('div', undefined, 'adm-dialog-actions');
    row.append(btn('Copiar', async () => { try { await navigator.clipboard.writeText(data.temporaryPassword); toast('Senha copiada.'); } catch { toast('Não foi possível copiar; anote a senha.', true); } }), btn('Fechar', () => d.close(), 'is-primary'));
    d.append(row); d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal();
  } catch (e) { toast(e.message, true); } finally { busy = false; }
}
async function reactivate(p) { const r = await ask({ title: 'Reativar ' + p.name, confirm: 'Reativar' }); if (r) act({ action: 'admin_reactivate', userKey: p.key, reason: r.reason }, 'Conta de ' + p.name + ' reativada.'); }
async function removePost(id, who) { const r = await ask({ title: 'Remover publicação de ' + who, help: 'A publicação some para todos. O motivo fica registrado.', confirm: 'Remover', danger: true }); if (r) act({ action: 'admin_remove_post', postId: id, reason: r.reason }, 'Publicação removida.'); }

function kpiCard(label, value, cur, prev, note) {
  const c = el('section', undefined, 'adm-kpi'); c.append(el('h3', label), el('p', String(value), 'adm-kpi-value'));
  if (cur !== undefined) { const diff = cur - prev; const pct = prev ? Math.round(diff / prev * 100) : (cur ? 100 : 0); c.append(el('p', (diff >= 0 ? '▲ ' : '▼ ') + cur + ' em 7 dias' + (prev || cur ? ` (${diff >= 0 ? '+' : '−'}${Math.abs(pct)}% vs. semana anterior)` : ''), 'adm-delta ' + (diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''))); }
  if (note) c.append(el('p', note, 'adm-muted')); return c;
}
function chart(title, values, days) {
  const c = el('section', undefined, 'adm-card adm-chart'); c.append(el('h3', title));
  const max = Math.max(1, ...values), total = values.reduce((a, b) => a + b, 0); c.append(el('p', total + ' nos últimos 30 dias', 'adm-muted'));
  const svg = svgEl('svg'); svg.setAttribute('viewBox', '0 0 300 90'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}: ${total} nos últimos 30 dias`);
  values.forEach((v, i) => { const h = Math.max(v ? 4 : 1, Math.round(v / max * 76)); const r = svgEl('rect'); r.setAttribute('x', i * 10 + 1); r.setAttribute('y', 80 - h); r.setAttribute('width', 8); r.setAttribute('height', h); r.setAttribute('rx', 2); r.setAttribute('class', v ? 'adm-bar' : 'adm-bar is-zero'); const t = svgEl('title'); t.textContent = fmtDay(days[i]) + ': ' + v; r.append(t); svg.append(r); });
  c.append(svg); const axis = el('div', undefined, 'adm-axis'); axis.append(el('span', fmtDay(days[0])), el('span', 'hoje')); c.append(axis); return c;
}
function alertCard(a) {
  const c = el('article', undefined, 'adm-alert' + (a.status !== 'aberto' ? ' is-closed' : ''));
  const head = el('div', undefined, 'adm-alert-head'); head.append(pill(a.severity === 'alta' ? 'Prioridade alta' : 'Atenção', a.severity === 'alta' ? 'is-danger' : 'is-warn'), el('strong', a.kind), el('small', fmtDate(a.at), 'adm-muted'));
  c.append(head);
  const who = el('p'); who.append('Envolve: ', personLink(a.targetName, a.targetKey)); if (a.targetSuspended) who.append(' ', pill('conta suspensa', 'is-muted')); if (a.community) who.append(' · comunidade ' + a.community); c.append(who);
  if (a.excerpt) c.append(el('blockquote', a.excerpt));
  c.append(el('p', `Motivo: ${a.reason} · por ${a.reporter}`, 'adm-muted'));
  if (a.status !== 'aberto') { c.append(el('p', `${a.status === 'resolvido' ? 'Resolvido' : 'Dispensado'} por ${a.resolvedBy} em ${fmtDate(a.resolvedAt)}`, 'adm-muted')); return c; }
  const row = el('div', undefined, 'adm-actions');
  row.append(btn('Resolver', async () => { const r = await ask({ title: 'Resolver alerta', help: 'Descreva o que foi feito.', confirm: 'Resolver' }); if (r) act({ action: 'admin_resolve_alert', alertId: a.id, status: 'resolvido', reason: r.reason }, 'Alerta resolvido.'); }, 'is-primary'));
  row.append(btn('Dispensar', async () => { const r = await ask({ title: 'Dispensar alerta', help: 'Use quando não houver violação das regras.', confirm: 'Dispensar' }); if (r) act({ action: 'admin_resolve_alert', alertId: a.id, status: 'dispensado', reason: r.reason }, 'Alerta dispensado.'); }));
  if (a.postId) row.append(btn('Remover publicação', () => removePost(a.postId, a.targetName), 'is-danger'));
  if (a.targetKey && !a.targetSuspended && a.targetKey.startsWith('id:')) row.append(btn('Suspender pessoa', () => suspend({ key: a.targetKey, name: a.targetName }), 'is-danger-ghost'));
  c.append(row); return c;
}
function table(headers, rows) {
  const wrap = el('div', undefined, 'adm-table-wrap'); const t = el('table', undefined, 'adm-table'); const th = el('thead'); const tr = el('tr'); headers.forEach(h => tr.append(el('th', h))); th.append(tr); t.append(th);
  const tb = el('tbody'); rows.forEach(r => { const row = el('tr'); r.forEach(cell => { const td = el('td'); if (cell instanceof Node) td.append(cell); else td.textContent = String(cell); row.append(td); }); tb.append(row); }); t.append(tb); wrap.append(t); return wrap;
}
const views = {
  visao() {
    const k = data.kpis, box = el('div');
    const grid = el('div', undefined, 'adm-kpis');
    grid.append(kpiCard('Membros', k.members.total, k.members.now, k.members.before), kpiCard('Pessoas ativas', k.active.now, k.active.now, k.active.before, 'publicaram, comentaram ou conversaram em 7 dias'),
      kpiCard('Publicações', k.posts.total, k.posts.now, k.posts.before), kpiCard('Comentários', k.comments.total, k.comments.now, k.comments.before),
      kpiCard('Mensagens', k.messages.total, k.messages.now, k.messages.before), kpiCard('Chamadas', k.calls.total, k.calls.now, k.calls.before, k.calls.minutes + ' min no total'),
      kpiCard('Comunidades', k.communities.total, undefined, undefined, k.communities.members + ' participações'), kpiCard('Stories no ar', k.stories.active));
    box.append(grid);
    const charts = el('div', undefined, 'adm-charts'); charts.append(chart('Novos membros', data.series.members, data.series.days), chart('Publicações', data.series.posts, data.series.days), chart('Mensagens', data.series.messages, data.series.days)); box.append(charts);
    const lower = el('div', undefined, 'adm-two');
    const al = el('section', undefined, 'adm-card'); al.append(el('h3', 'Alertas que pedem atenção'));
    const open = data.alerts.filter(a => a.status === 'aberto').slice(0, 3); if (!open.length) al.append(el('p', 'Nenhum alerta aberto. A comunidade está tranquila.', 'adm-empty')); open.forEach(a => al.append(alertCard(a)));
    if (data.openAlerts > 3) al.append(btn(`Ver todos os ${data.openAlerts} alertas`, () => go('alertas')));
    const h = data.health, hc = el('section', undefined, 'adm-card'); hc.append(el('h3', 'Saúde da plataforma'));
    hc.append(table(['Item', 'Valor'], [['Contas', h.accounts], ['Publicações (com acervo)', h.posts], ['Mensagens', h.messages], ['Fotos e anexos', h.media], ['Tamanho dos dados', h.dataKb + ' KB'], ['Backup', 'diário e criptografado (03:30)']]));
    lower.append(al, hc); box.append(lower); return box;
  },
  alertas() {
    const box = el('div'); box.append(el('p', 'Denúncias de pessoas e sinais automáticos (por exemplo, alguém bloqueado por várias pessoas). Toda decisão fica no registro.', 'adm-muted'));
    if (!data.alerts.length) box.append(el('p', 'Nenhum alerta até agora.', 'adm-empty')); data.alerts.forEach(a => box.append(alertCard(a))); return box;
  },
  pessoas() {
    const box = el('div'); const f = el('form', undefined, 'adm-search'); const i = el('input'); i.type = 'search'; i.placeholder = 'Buscar por nome ou @usuário'; i.value = query; i.setAttribute('aria-label', 'Buscar pessoas'); const sb = el('button', 'Buscar', 'adm-btn is-primary'); sb.type = 'submit'; f.append(i, sb);
    f.onsubmit = async e => { e.preventDefault(); query = i.value.trim(); try { data = await api(); render(); } catch (err) { toast(err.message, true); } }; box.append(f);
    box.append(table(['Pessoa', 'Papel', 'Situação', 'Atividade', 'Publicações', 'Denúncias', 'Bloqueios', 'Ações'], data.people.map(p => {
      const who = el('div'); who.append(personLink(p.name, p.key), el('small', p.username ? ' @' + p.username : '', 'adm-muted'));
      const status = p.suspension ? pill(p.suspension.until ? 'Suspensa até ' + fmtDay(p.suspension.until) : 'Suspensa', 'is-danger') : pill('Ativa', 'is-ok');
      const actions = el('div', undefined, 'adm-actions');
      if (p.key !== data.viewer.key) {
        if (p.suspension) actions.append(btn('Reativar', () => reactivate(p))); else if (!p.envAdmin && !(p.role === 'admin' && data.role !== 'admin')) actions.append(btn('Suspender', () => suspend(p), 'is-danger-ghost'));
        if (data.role === 'admin' && !p.envAdmin) actions.append(btn('Nova senha', () => resetPassword(p)));
        if (data.role === 'admin' && !p.envAdmin) { const s = el('select'); s.setAttribute('aria-label', 'Papel de ' + p.name); for (const [v, t] of [['', 'Membro'], ['moderator', 'Moderação'], ['admin', 'Administração']]) { const o = el('option', t); o.value = v; s.append(o); } s.value = p.role || ''; s.onchange = async () => { const r = await ask({ title: 'Mudar papel de ' + p.name, confirm: 'Mudar papel' }); if (r) act({ action: 'admin_role', userKey: p.key, role: s.value, reason: r.reason }, 'Papel atualizado.'); else s.value = p.role || ''; }; actions.append(s); }
      }
      return [who, p.role === 'admin' ? 'Administração' : p.role === 'moderator' ? 'Moderação' : 'Membro', status, rel(p.lastActivity), p.posts, p.reports ? pill(String(p.reports), 'is-danger') : '0', p.blockedBy, actions];
    })));
    return box;
  },
  conteudo() {
    const box = el('div'); box.append(el('p', 'Publicações recentes desta versão, com as denunciadas primeiro. Publicações “Somente eu” só aparecem se forem denunciadas.', 'adm-muted'));
    if (!data.content.length) box.append(el('p', 'Nenhuma publicação ainda.', 'adm-empty'));
    data.content.forEach(p => { const c = el('article', undefined, 'adm-post'); const h = el('div', undefined, 'adm-alert-head'); h.append(personLink(p.author, p.authorKey), el('small', fmtDate(p.createdAt) + (p.community ? ' · ' + p.community : '') + (p.media ? ' · ' + p.media : '') + ' · ' + p.comments + ' comentário(s)', 'adm-muted')); if (p.reported) h.append(pill('Denunciada', 'is-danger')); c.append(h, el('p', p.text || '(sem texto)')); const row = el('div', undefined, 'adm-actions'); row.append(btn('Remover', () => removePost(p.id, p.author), 'is-danger-ghost')); c.append(row); box.append(c); });
    return box;
  },
  comunidades() {
    return table(['Comunidade', 'Tema', 'Acesso', 'Membros', 'Pedidos', 'Publicações', 'Denúncias'], data.communities.map(c => { const a = el('a', c.name); a.href = '/grupos/?c=' + encodeURIComponent(c.id); return [a, c.category || '—', c.visibility === 'private' ? 'Privada' : 'Pública', c.members, c.pending ? pill(String(c.pending), 'is-warn') : '0', c.posts, c.reports ? pill(String(c.reports), 'is-danger') : '0']; }));
  },
  comunicados() {
    const box = el('div');
    if (data.role === 'admin') {
      const f = el('form', undefined, 'adm-card adm-form'); f.append(el('h3', 'Novo comunicado'), el('p', 'Aparece no topo do feed de todas as pessoas até a data de término ou até cada pessoa fechar.', 'adm-muted'));
      const field = (label, input) => { const l = el('label', label); l.append(input); f.append(l); return input; };
      const title = field('Título', Object.assign(el('input'), { maxLength: 80, required: true }));
      const body = field('Mensagem', Object.assign(el('textarea'), { maxLength: 600, rows: 3, required: true }));
      const link = field('Link interno (opcional)', Object.assign(el('input'), { maxLength: 120, placeholder: '/grupos/' }));
      const days = field('Duração', el('select')); for (const [v, t] of [[1, '1 dia'], [3, '3 dias'], [7, '7 dias'], [14, '14 dias'], [30, '30 dias']]) { const o = el('option', t); o.value = v; days.append(o); } days.value = '7';
      const send = el('button', 'Publicar comunicado', 'adm-btn is-primary'); send.type = 'submit'; f.append(send);
      f.onsubmit = e => { e.preventDefault(); act({ action: 'admin_announce', title: title.value, text: body.value, link: link.value, days: Number(days.value) }, 'Comunicado publicado.'); };
      box.append(f);
    } else box.append(el('p', 'Só a administração publica comunicados.', 'adm-muted'));
    if (!data.announcements.length) box.append(el('p', 'Nenhum comunicado publicado.', 'adm-empty'));
    data.announcements.forEach(a => { const c = el('article', undefined, 'adm-post'); const h = el('div', undefined, 'adm-alert-head'); h.append(el('strong', a.title), pill(a.active ? 'No ar' : 'Encerrado', a.active ? 'is-ok' : 'is-muted'), el('small', 'por ' + a.by + ' · até ' + fmtDate(a.endedAt || a.until), 'adm-muted')); c.append(h, el('p', a.text)); if (a.active && data.role === 'admin') { const row = el('div', undefined, 'adm-actions'); row.append(btn('Encerrar agora', () => act({ action: 'admin_announce_end', id: a.id }, 'Comunicado encerrado.'))); c.append(row); } box.append(c); });
    return box;
  },
  traducoes() {
    const box = el('div');
    if (!idata) { box.append(el('p', 'Carregando traduções…', 'adm-muted')); api18().then(d => { idata = d; render(); }).catch(e => toast(e.message, true)); return box; }
    box.append(el('p', 'O português é a base. Inglês e espanhol vêm prontos e podem ser melhorados. Línguas indígenas são traduzidas por tradutores das comunidades. Toda sugestão passa pela aprovação da gestão.', 'adm-muted'));
    if (!idata.languages.length) { box.append(el('p', 'Nenhum idioma disponível para você.', 'adm-empty')); return box; }
    if (!ilang || !idata.languages.some(l => l.code === ilang)) ilang = idata.languages[0].code;
    const langs = el('div', undefined, 'adm-langs');
    for (const l of idata.languages) {
      const card = el('button', undefined, 'adm-lang' + (l.code === ilang ? ' is-on' : '')); card.type = 'button'; card.onclick = () => { ilang = l.code; ipage = 0; render(); };
      card.dataset.noI18n = '';
      const pct = Math.round(l.done / Math.max(l.total, 1) * 100);
      const bar = el('span', undefined, 'adm-lang-bar'); const fill = el('span'); fill.style.width = pct + '%'; bar.append(fill);
      card.append(el('strong', l.name), el('small', `${l.code} · ${pct}%${l.kind === 'community' && !l.enabled ? ' · inativo' : ''}`), bar);
      langs.append(card);
    }
    box.append(langs);
    const lang = idata.languages.find(l => l.code === ilang);
    if (idata.canManage) {
      const manage = el('details', undefined, 'adm-card'); manage.append(el('summary', 'Idiomas e tradutores'));
      const add = el('form', undefined, 'adm-inline');
      const code = el('input'); code.placeholder = 'Código (ex.: gn, yrl)'; code.required = true; code.maxLength = 12; code.setAttribute('aria-label', 'Código do idioma');
      const name = el('input'); name.placeholder = 'Nome (ex.: Guarani)'; name.required = true; name.maxLength = 40; name.setAttribute('aria-label', 'Nome do idioma');
      const sub = el('button', 'Cadastrar idioma', 'adm-btn is-primary'); sub.type = 'submit';
      add.append(code, name, sub); add.onsubmit = e => { e.preventDefault(); act18({ action: 'i18n_lang_add', code: code.value.trim(), name: name.value.trim() }, 'Idioma cadastrado. Ative quando houver tradução suficiente.'); };
      manage.append(el('p', 'Línguas indígenas entram inativas: ninguém as vê até a gestão ativar.', 'adm-muted'), add);
      if (lang.kind === 'community') manage.append(btn(lang.enabled ? `Desativar ${lang.name}` : `Ativar ${lang.name} para todas as pessoas`, () => act18({ action: 'i18n_lang_toggle', code: lang.code, enabled: !lang.enabled }, lang.enabled ? 'Idioma desativado.' : 'Idioma ativado.'), lang.enabled ? '' : 'is-primary'));
      const tf = el('form', undefined, 'adm-inline');
      const who = el('input'); who.placeholder = '@usuário de quem vai traduzir'; who.required = true; who.setAttribute('aria-label', 'Usuário');
      const tsub = el('button', `Nomear para ${lang.name}`, 'adm-btn'); tsub.type = 'submit';
      tf.append(who, tsub);
      tf.onsubmit = e => { e.preventDefault(); const u = who.value.trim().replace(/^@/, '').toLowerCase(); const p = (data.people || []).find(x => (x.username || '').toLowerCase() === u); if (!p) return toast('Pessoa não encontrada. Busque na aba Pessoas para conferir o @.', true); const cur = idata.translators.find(t => t.key === p.key)?.langs || []; act18({ action: 'i18n_translator', userKey: p.key, langs: [...new Set([...cur, lang.code])] }, `${p.name} agora traduz ${lang.name}.`); };
      manage.append(el('h3', 'Tradutores'), tf);
      const ul = el('ul', undefined, 'adm-list');
      idata.translators.forEach(t => { const li = el('li'); li.append(el('span', `${t.name} (@${t.username}) · ${t.langs.join(', ')}`), btn('Remover', () => act18({ action: 'i18n_translator', userKey: t.key, langs: [] }, 'Tradutor removido.'))); ul.append(li); });
      if (!idata.translators.length) ul.append(el('li', 'Ninguém nomeado ainda.', 'adm-muted'));
      manage.append(ul); box.append(manage);
    }
    const pending = idata.suggestions.filter(s => s.status === 'pendente' && s.lang === ilang);
    if (idata.canReview && pending.length) {
      const rev = el('section', undefined, 'adm-card'); rev.append(el('h3', `Sugestões para revisar (${pending.length})`));
      pending.slice(0, 30).forEach(s => { const row = el('div', undefined, 'adm-sug'); const pt = el('p', s.source, 'adm-muted'); pt.dataset.noI18n = ''; const tr = el('p', s.text); tr.dataset.noI18n = ''; row.append(pt, tr, el('small', `${s.byName} · ${fmtDate(s.at)}`, 'adm-muted')); const acts = el('div', undefined, 'adm-actions'); acts.append(btn('Aprovar', () => act18({ action: 'i18n_review', id: s.id, decision: 'aprovar' }, 'Tradução aprovada e já em uso.'), 'is-primary'), btn('Recusar', () => act18({ action: 'i18n_review', id: s.id, decision: 'recusar' }, 'Sugestão recusada.'))); row.append(acts); rev.append(row); });
      box.append(rev);
    }
    const tr = idata.translations[ilang] || {};
    const bar = el('div', undefined, 'adm-inline');
    const search = el('input'); search.type = 'search'; search.placeholder = 'Buscar frase'; search.value = iquery; search.setAttribute('aria-label', 'Buscar frase');
    search.oninput = () => { iquery = search.value; ipage = 0; const pos = search.selectionStart; render(); const s2 = root.querySelector('.adm-i18n-search'); s2?.focus(); s2?.setSelectionRange(pos, pos); };
    search.className = 'adm-i18n-search';
    const sel = el('select'); sel.setAttribute('aria-label', 'Mostrar'); [['faltando', 'Sem tradução'], ['todas', 'Todas as frases']].forEach(([v, t]) => { const o = new Option(t, v); o.selected = v === ifilter; sel.append(o); }); sel.onchange = () => { ifilter = sel.value; ipage = 0; render(); };
    bar.append(search, sel); box.append(bar);
    const q = iquery.toLocaleLowerCase('pt-BR');
    const list = idata.source.filter(s => (ifilter === 'todas' || !tr[s]) && (!q || s.toLocaleLowerCase('pt-BR').includes(q) || (tr[s] || '').toLocaleLowerCase('pt-BR').includes(q)));
    const per = 25, pages = Math.max(1, Math.ceil(list.length / per)); ipage = Math.min(ipage, pages - 1);
    box.append(el('p', `${list.length} frase(s) · página ${ipage + 1} de ${pages}`, 'adm-muted'));
    const mine = idata.suggestions.filter(s => s.status === 'pendente' && s.lang === ilang);
    list.slice(ipage * per, ipage * per + per).forEach(src => {
      const row = el('form', undefined, 'adm-phrase'); row.dataset.noI18n = '';
      const pt = el('p', src, 'adm-phrase-src'); const ta = el('textarea'); ta.rows = 2; ta.maxLength = 600; ta.value = mine.find(s => s.source === src)?.text || tr[src] || ''; ta.setAttribute('aria-label', 'Tradução para ' + lang.name);
      const sb = el('button', mine.some(s => s.source === src) ? 'Atualizar sugestão' : 'Sugerir tradução', 'adm-btn'); sb.type = 'submit';
      row.append(pt, ta, sb); row.onsubmit = e => { e.preventDefault(); act18({ action: 'i18n_suggest', lang: ilang, source: src, text: ta.value }, idata.canReview ? 'Sugestão enviada. Aprove acima para usar.' : 'Sugestão enviada para a gestão revisar.'); };
      box.append(row);
    });
    const nav = el('div', undefined, 'adm-actions');
    if (ipage > 0) nav.append(btn('← Anteriores', () => { ipage--; render(); }));
    if (ipage < pages - 1) nav.append(btn('Próximas →', () => { ipage++; render(); }));
    box.append(nav);
    return box;
  },
  desenvolvimento() {
    const d = data.development; if (!d) return views.visao();
    const box = el('div'), card = (title, ...kids) => { const c = el('section', undefined, 'adm-card adm-dev'); c.append(el('h3', title), ...kids); box.append(c); return c; };
    const status = { entregue: ['Entregue', 'is-ok'], parcial: ['Parcial', 'is-warn'], andamento: ['Em andamento', 'is-warn'], pendente: ['Pendente', 'is-danger'], 'nao-iniciado': ['Não iniciado', 'is-danger'], ok: ['Em ordem', 'is-ok'], atenção: ['Atenção', 'is-danger'], confirmar: ['Confirmar', 'is-warn'], agendar: ['A agendar', 'is-warn'], prazo: ['Prazo', 'is-muted'] };
    const pillOf = s => pill(...(status[s] || [s, 'is-muted']));
    const day = iso => iso ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(iso + 'T12:00:00')) : '—';
    box.append(el('p', `${d.nota} Atualizado em ${day(d.atualizadoEm)}.`, 'adm-muted'));
    const c = d.contrato, summary = el('div', undefined, 'adm-kpis');
    const done = d.escopo.filter(x => x.status === 'entregue').length;
    summary.append(kpiCard('Escopo contratado', `${done}/${d.escopo.length}`, undefined, undefined, 'frentes entregues por completo'), kpiCard('Entregas publicadas', d.entregas.length, undefined, undefined, `desde ${day(d.entregas[0].data)}`), kpiCard('Em andamento', d.andamento.length), kpiCard('Decisões pendentes', d.pendencias.length, undefined, undefined, `${d.pendencias.filter(p => p.depende === 'contratante').length} dependem da contratante`));
    box.append(summary);
    card('Contrato', el('p', c.titulo), table(['Item', 'Valor'], [['Contratante', c.contratante], ['Contratada', c.contratada], ['Assinatura', day(c.assinatura)], ['Vigência até', day(c.vigenciaAte)], ['Remuneração', c.remuneracao]]), el('p', c.anexo, 'adm-muted'),
      el('h4', 'Marcos e prazos'), table(['Marco', 'Data', 'Relatório até', 'Estado'], c.marcos.map(m => [m.titulo, day(m.data), m.prazoRelatorio ? day(m.prazoRelatorio) : '—', pillOf(m.estado)])),
      el('h4', 'Compromissos do contrato e como estão'), table(['Cláusula', 'O que o contrato exige', 'Situação'], c.compromissos.map(x => [x.clausula, x.texto, x.estado])));
    card('Escopo contratado × entregue', el('p', 'Cada frente da cláusula primeira, com evidência verificável e o que ainda falta.', 'adm-muted'), table(['Frente', 'Estado', 'Evidência', 'O que falta'], d.escopo.map(x => [x.item, pillOf(x.status), x.evidencia, x.falta || '—'])));
    const tl = el('ol', undefined, 'adm-log'); d.entregas.forEach(e => { const li = el('li'); li.append(el('strong', e.titulo), document.createTextNode(' · ' + day(e.data)), el('small', e.detalhe)); tl.append(li); });
    card('Linha do tempo das entregas', tl);
    card('Em andamento', table(['Item', 'Detalhe'], d.andamento.map(x => [x.item, x.detalhe])));
    card('Pendências e decisões', el('p', 'O que trava ou depende de decisão. "Contratante" = precisa de resposta, acesso ou contratação da ETNIAS.SITE.', 'adm-muted'), table(['Item', 'Depende de', 'Detalhe'], d.pendencias.map(x => [x.item, pill(x.depende, x.depende === 'contratante' ? 'is-warn' : 'is-muted'), x.detalhe])));
    card('LGPD e dados (cláusula 8)', table(['Ponto', 'Estado', 'Detalhe'], d.lgpd.map(x => [x.item, pillOf(x.estado), x.detalhe])));
    card('Infraestrutura e custos', table(['Recurso', 'Uso', 'Custo'], d.infra.map(x => [x.item, x.detalhe, x.custo])));
    card('Documentação (no repositório)', table(['Arquivo', 'O que contém'], d.documentos.map(x => [el('code', x.arquivo), x.descricao])));
    const cmds = el('ul', undefined, 'adm-dev-list'); d.testes.comandos.forEach(x => cmds.append(el('li', x)));
    card('Testes e validação', el('p', d.testes.resumo, 'adm-muted'), cmds);
    card('Acessos e titularidade (cláusula 5.2)', table(['Recurso', 'Situação'], d.acessos.map(x => [x.item, x.estado])));
    return box;
  },
  registro() {
    const box = el('div'); box.append(el('p', 'Tudo o que a administração e a moderação fizeram, com motivo. Transparência para a comunidade.', 'adm-muted'));
    if (!data.log.length) box.append(el('p', 'Nenhuma ação registrada ainda.', 'adm-empty'));
    const ul = el('ol', undefined, 'adm-log'); data.log.forEach(l => { const li = el('li'); li.append(el('strong', l.action), document.createTextNode(' · ' + l.target + ' · por ' + l.byName), el('small', fmtDate(l.at), 'adm-muted')); if (l.reason) li.append(el('p', l.reason)); ul.append(li); }); box.append(ul); return box;
  }
};
function go(next) { tab = next; history.replaceState(null, '', '#' + next); render(); root.querySelector('.adm-main')?.focus(); }
function render() {
  if (!data) return;
  const head = el('header', undefined, 'adm-head'); const t = el('div'); t.append(el('h1', translatorOnly ? 'Traduções' : 'Centro de gestão'), el('p', translatorOnly ? 'Ajude a levar a Casa Opy para a sua língua.' : `${data.viewer.name} · ${data.role === 'admin' ? 'Administração' : 'Moderação'} · atualizado ${fmtDate(Date.now())}`, 'adm-muted'));
  head.append(t, btn('Atualizar', load));
  const nav = el('nav', undefined, 'adm-tabs'); nav.setAttribute('aria-label', 'Áreas do centro de gestão');
  // "Desenvolvimento" é a prestação de contas do contrato: só a administração vê.
  (translatorOnly ? tabs.filter(x => x[0] === 'traducoes') : tabs.filter(x => x[0] !== 'desenvolvimento' || data.development)).forEach(([id, label]) => { const b = btn(label, () => go(id), 'adm-tab'); b.setAttribute('aria-current', String(tab === id)); if (id === 'alertas' && data.openAlerts) b.append(el('span', String(data.openAlerts), 'adm-count')); nav.append(b); });
  const main = el('section', undefined, 'adm-main'); main.tabIndex = -1; main.setAttribute('aria-label', tabs.find(x => x[0] === tab)?.[1] || ''); main.append((views[tab] || views.visao)());
  root.replaceChildren(head, nav, main);
}
window.addEventListener('hashchange', () => { tab = location.hash.replace('#', '') || 'visao'; render(); });
load(); setInterval(() => { if (!document.hidden && !document.querySelector('.adm-dialog[open]') && tab !== 'pessoas' && tab !== 'traducoes') load(); }, 60000);
})();
