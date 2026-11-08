import { randomUUID, randomBytes } from 'node:crypto';
import { hashPassword } from './session.mjs';

// Centro de gestão da Casa Opy: indicadores, alertas de moderação, pessoas, conteúdo, comunidades,
// comunicados e registro de transparência. Toda ação fica no adminLog com autor, alvo e motivo.
export const adminActions = ['admin_resolve_alert', 'admin_remove_post', 'admin_suspend', 'admin_reactivate', 'admin_role', 'admin_reset_password', 'admin_announce', 'admin_announce_end'];
const DAY = 864e5;
// Senha provisória fácil de ditar por telefone (sem 0/O/1/I); a pessoa é obrigada a trocá-la na primeira entrada.
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from(randomBytes(8), b => alphabet[b % 32]).join('');
  return `Opy-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
const keyOf = a => `id:${a.id}`;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'Confira o texto e o limite de caracteres.');
  return value.trim();
}
const envAdmins = env => String(env.OPY_ADMIN_USERNAMES || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
export function roleOf(account, env = process.env) {
  if (!account) return '';
  if (envAdmins(env).includes(String(account.username || '').toLowerCase())) return 'admin';
  return ['admin', 'moderator'].includes(account.role) ? account.role : '';
}
export function isSuspended(account, now = Date.now()) {
  const s = account?.suspension;
  return !!s && (!s.until || s.until > now);
}
export function suspensionMessage(account) {
  const s = account.suspension;
  return s.until ? `Sua conta está suspensa até ${new Date(s.until).toLocaleDateString('pt-BR')}. Motivo: ${s.reason}` : `Sua conta está suspensa. Motivo: ${s.reason}`;
}
function log(state, actor, action, target, reason = '', extra = {}) {
  state.adminLog ||= [];
  state.adminLog.push({ id: randomUUID(), at: Date.now(), by: keyOf(actor), byName: actor.name, action, target, reason, ...extra });
  if (state.adminLog.length > 2000) state.adminLog = state.adminLog.slice(-2000);
}
const accountByKey = (state, key) => (state.accounts || []).find(a => keyOf(a) === key);
const between = (t, from, to) => t >= from && t < to;

function alertsOf(state) {
  const nameOf = key => accountByKey(state, key)?.name || String(key || '').replace(/^(id|name):/, '') || 'Desconhecido';
  const out = [];
  for (const r of state.chatReports || []) {
    const m = (state.dms || []).find(x => x.id === r.messageId);
    out.push({ id: 'chat:' + r.id, kind: 'Mensagem denunciada', severity: 'alta', at: r.createdAt, reason: r.reason, reporter: nameOf(r.authorKey),
      targetKey: m?.fromKey || '', targetName: m ? nameOf(m.fromKey) : 'Mensagem apagada', excerpt: m && !m.deleted ? (m.text || 'Anexo').slice(0, 280) : 'Mensagem já apagada' });
  }
  for (const r of state.communityReports || []) {
    const c = (state.communities || []).find(x => x.id === r.communityId);
    const p = r.postId && (state.posts || []).find(x => x.id === r.postId);
    out.push({ id: 'community:' + r.id, kind: p ? 'Publicação denunciada em comunidade' : 'Comunidade denunciada', severity: 'alta', at: r.createdAt, reason: r.reason, reporter: nameOf(r.authorKey),
      targetKey: p ? `id:${p.authorId}` : '', targetName: p ? p.author : (c?.name || 'Comunidade'), postId: p?.id || '', community: c?.name || '', excerpt: p ? (p.text || 'Publicação com mídia').slice(0, 280) : '' });
  }
  // Sinais automáticos: pessoas bloqueadas ou recusadas por várias outras costumam indicar assédio.
  const blockedBy = new Map();
  for (const [who, list] of Object.entries(state.chatBlocks || {})) for (const k of list || []) blockedBy.set(k, [...(blockedBy.get(k) || []), who]);
  for (const [k, list] of blockedBy) if (list.length >= 3) out.push({ id: 'blocks:' + k + ':' + list.length, kind: `Bloqueios de ${list.length} pessoas`, severity: 'média', at: Date.now(), reason: 'Sinal automático', reporter: 'Sistema', targetKey: k, targetName: nameOf(k), excerpt: '' });
  const declined = new Map();
  for (const [pair, c] of Object.entries(state.chatConsent || {})) if (c?.status === 'declined') { const other = pair.split('|').find(k => k !== c.by); if (other) declined.set(other, (declined.get(other) || 0) + 1); }
  for (const [k, n] of declined) if (n >= 3) out.push({ id: 'declined:' + k + ':' + n, kind: `Solicitações recusadas por ${n} pessoas`, severity: 'média', at: Date.now(), reason: 'Sinal automático', reporter: 'Sistema', targetKey: k, targetName: nameOf(k), excerpt: '' });
  const res = state.adminResolutions || {};
  return out.map(a => ({ ...a, status: res[a.id]?.status || 'aberto', resolvedBy: res[a.id]?.byName || '', resolvedAt: res[a.id]?.at || 0, targetSuspended: isSuspended(accountByKey(state, a.targetKey)) }))
    .sort((a, b) => Number(a.status !== 'aberto') - Number(b.status !== 'aberto') || (a.severity === b.severity ? b.at - a.at : a.severity === 'alta' ? -1 : 1));
}

export function adminView(state, viewer, params = new URLSearchParams(), env = process.env, now = Date.now()) {
  const role = roleOf(viewer, env);
  if (!role) fail(403, 'Esta área é só para quem administra ou modera a rede.');
  const accounts = state.accounts || [], posts = state.posts || [], dms = state.dms || [];
  const comments = posts.flatMap(p => (p.comments || []).map(c => ({ ...c, postId: p.id })));
  const msgs = dms.filter(m => !m.call), calls = dms.filter(m => m.call);
  const range = (list, field, from, to) => list.filter(x => between(x[field] || 0, from, to)).length;
  const kpi = (list, field) => ({ now: range(list, field, now - 7 * DAY, now + 1), before: range(list, field, now - 14 * DAY, now - 7 * DAY) });
  const activeKeys = (from, to = now + 1) => new Set([...posts.filter(p => between(p.createdAt, from, to) && p.authorId).map(p => 'id:' + p.authorId), ...comments.filter(c => between(c.createdAt, from, to)).map(c => c.authorKey), ...msgs.filter(m => between(m.createdAt, from, to)).map(m => m.fromKey)]);
  const newPosts = posts.filter(p => p.origin !== 'legacy');
  const kpis = {
    members: { total: accounts.length, ...kpi(accounts, 'createdAt') },
    active: { now: activeKeys(now - 7 * DAY).size, before: activeKeys(now - 14 * DAY, now - 7 * DAY).size },
    posts: { total: newPosts.length, ...kpi(newPosts, 'createdAt') },
    comments: { total: comments.length, ...kpi(comments, 'createdAt') },
    messages: { total: msgs.length, ...kpi(msgs, 'createdAt') },
    calls: { total: calls.length, ...kpi(calls, 'createdAt'), minutes: Math.round(calls.reduce((s, m) => s + (m.call?.duration || 0), 0) / 60) },
    communities: { total: (state.communities || []).length, members: (state.communities || []).reduce((s, c) => s + (c.members?.length || 0), 0) },
    stories: { active: (state.stories || []).filter(s => s.expiresAt > now).length }
  };
  const end = new Date(now); end.setHours(24, 0, 0, 0);
  const days = [...Array(30)].map((_, i) => { const to = end.getTime() - (29 - i) * DAY; return { from: to - DAY, to }; });
  const series = {
    days: days.map(d => d.from),
    members: days.map(d => range(accounts, 'createdAt', d.from, d.to)),
    posts: days.map(d => range(newPosts, 'createdAt', d.from, d.to)),
    messages: days.map(d => range(msgs, 'createdAt', d.from, d.to))
  };
  const alerts = alertsOf(state);
  const reportsAgainst = k => alerts.filter(a => a.targetKey === k && a.reporter !== 'Sistema').length;
  const blockedCount = k => Object.values(state.chatBlocks || {}).filter(l => (l || []).includes(k)).length;
  const lastActivity = k => Math.max(0, ...posts.filter(p => 'id:' + p.authorId === k).map(p => p.createdAt), ...comments.filter(c => c.authorKey === k).map(c => c.createdAt), ...msgs.filter(m => m.fromKey === k).map(m => m.createdAt));
  const q = String(params.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const people = accounts.filter(a => !q || (a.name + ' ' + (a.username || '')).toLocaleLowerCase('pt-BR').includes(q))
    .map(a => ({ key: keyOf(a), name: a.name, username: a.username || '', createdAt: a.createdAt || 0, role: roleOf(a, env), envAdmin: envAdmins(env).includes(String(a.username || '').toLowerCase()),
      suspension: isSuspended(a, now) ? { until: a.suspension.until || 0, reason: a.suspension.reason } : null,
      posts: posts.filter(p => p.authorId === a.id).length, reports: reportsAgainst(keyOf(a)), blockedBy: blockedCount(keyOf(a)), lastActivity: lastActivity(keyOf(a)) }))
    .sort((a, b) => b.reports - a.reports || b.lastActivity - a.lastActivity).slice(0, 60);
  const reportedPosts = new Set(alerts.filter(a => a.postId).map(a => a.postId));
  // "Somente eu" fica fora da moderação, a não ser que tenha sido denunciada.
  const content = newPosts.filter(p => !['private', 'friends'].includes(p.audience) || reportedPosts.has(p.id))
    .sort((a, b) => Number(reportedPosts.has(b.id)) - Number(reportedPosts.has(a.id)) || b.createdAt - a.createdAt).slice(0, 40)
    .map(p => ({ id: p.id, author: p.author, authorKey: 'id:' + p.authorId, text: (p.text || '').slice(0, 400), createdAt: p.createdAt, community: p.communityName || '', media: p.media?.kind || p.file?.kind || '', comments: (p.comments || []).length, reported: reportedPosts.has(p.id) }));
  const communities = (state.communities || []).map(c => ({ id: c.id, name: c.name, category: c.category, visibility: c.visibility, members: c.members?.length || 0, pending: (c.pendingRequests || []).length,
    posts: posts.filter(p => p.communityId === c.id).length, reports: (state.communityReports || []).filter(r => r.communityId === c.id).length }));
  const announcements = (state.announcements || []).slice().sort((a, b) => b.createdAt - a.createdAt).map(a => ({ ...a, active: !a.endedAt && (!a.until || a.until > now) }));
  const health = { accounts: accounts.length, posts: posts.length, messages: dms.length, media: new Set([...posts.flatMap(p => [p.media?.id, p.file?.id]), ...dms.map(m => m.media?.id), ...accounts.flatMap(a => [a.avatarId, a.coverId])].filter(Boolean)).size, dataKb: Math.round(JSON.stringify(state).length / 1024) };
  return { role, viewer: { key: keyOf(viewer), name: viewer.name }, kpis, series, alerts, openAlerts: alerts.filter(a => a.status === 'aberto').length, people, content, communities, announcements, log: (state.adminLog || []).slice(-150).reverse(), health };
}

export function adminAction(state, actor, body, env = process.env, now = Date.now()) {
  const role = roleOf(actor, env);
  if (!role) fail(403, 'Esta ação é só para quem administra ou modera a rede.');
  const adminOnly = () => { if (role !== 'admin') fail(403, 'Só administradores podem fazer isso.'); };
  const reason = text(String(body.reason ?? ''), 300, false);
  if (body.action === 'admin_resolve_alert') {
    if (!['resolvido', 'dispensado'].includes(body.status)) fail(400, 'Escolha como encerrar o alerta.');
    const alert = alertsOf(state).find(a => a.id === body.alertId); if (!alert) fail(404, 'Alerta não encontrado.');
    state.adminResolutions ||= {}; state.adminResolutions[alert.id] = { status: body.status, at: now, by: keyOf(actor), byName: actor.name };
    log(state, actor, body.status === 'resolvido' ? 'Alerta resolvido' : 'Alerta dispensado', alert.targetName, reason || alert.kind);
    return {};
  }
  if (body.action === 'admin_remove_post') {
    const post = (state.posts || []).find(p => p.id === body.postId); if (!post) fail(404, 'Publicação não encontrada.');
    if (!reason) fail(400, 'Informe o motivo da remoção. Ele fica no registro de transparência.');
    state.posts = state.posts.filter(p => p.id !== post.id);
    log(state, actor, 'Publicação removida', post.author, reason, { excerpt: (post.text || '').slice(0, 140) });
    const removedIds = [post.media?.id, post.file?.id].filter(id => id && !state.posts.some(p => p.media?.id === id || p.file?.id === id || p.repostOf?.media?.id === id || p.repostOf?.file?.id === id));
    return { removedIds };
  }
  const target = accountByKey(state, body.userKey);
  if (['admin_suspend', 'admin_reactivate', 'admin_role', 'admin_reset_password'].includes(body.action)) {
    if (!target) fail(404, 'Pessoa não encontrada.');
    if (target.id === actor.id) fail(400, 'Você não pode aplicar esta ação a si mesmo.');
    if (roleOf(target, env) === 'admin' && role !== 'admin') fail(403, 'Moderadores não podem agir sobre administradores.');
  }
  if (body.action === 'admin_suspend') {
    if (envAdmins(env).includes(String(target.username || '').toLowerCase())) fail(403, 'Administradores definidos no servidor não podem ser suspensos pelo painel.');
    if (!reason) fail(400, 'Informe o motivo da suspensão. A pessoa verá esse motivo.');
    const days = Number(body.days);
    if (!Number.isInteger(days) || days < 0 || days > 365) fail(400, 'Escolha de 0 (sem prazo) a 365 dias.');
    if (days === 0) adminOnly();
    target.suspension = { until: days ? now + days * DAY : 0, reason, by: keyOf(actor), at: now };
    target.sessions = [];
    log(state, actor, days ? `Suspensão por ${days} dia(s)` : 'Suspensão sem prazo', target.name, reason);
    return {};
  }
  if (body.action === 'admin_reactivate') {
    if (!target.suspension) fail(409, 'Esta conta não está suspensa.');
    delete target.suspension;
    log(state, actor, 'Conta reativada', target.name, reason);
    return {};
  }
  if (body.action === 'admin_role') {
    adminOnly();
    if (!['', 'moderator', 'admin'].includes(body.role)) fail(400, 'Papel inválido.');
    if (envAdmins(env).includes(String(target.username || '').toLowerCase())) fail(403, 'Este administrador é definido no servidor.');
    if (body.role) target.role = body.role; else delete target.role;
    log(state, actor, body.role ? `Papel: ${body.role === 'admin' ? 'administração' : 'moderação'}` : 'Papel removido', target.name, reason);
    return {};
  }
  if (body.action === 'admin_reset_password') {
    adminOnly();
    if (envAdmins(env).includes(String(target.username || '').toLowerCase())) fail(403, 'Administradores definidos no servidor trocam a senha pela própria conta.');
    if (!reason) fail(400, 'Registre como a pessoa pediu a nova senha (por exemplo, "pediu pelo WhatsApp").');
    const temporary = temporaryPassword();
    target.password = hashPassword(temporary); delete target.legacyPassword; target.mustChangePassword = true; target.sessions = [];
    log(state, actor, 'Senha provisória emitida', target.name, reason);
    return { temporaryPassword: temporary };
  }
  if (body.action === 'admin_announce') {
    adminOnly();
    const title = text(body.title, 80), message = text(body.text, 600);
    const link = String(body.link || '').trim();
    if (link && !/^\/[a-z0-9/?=&._%-]*$/i.test(link)) fail(400, 'O link precisa ser um endereço interno da Casa Opy, como /grupos/.');
    const days = Number(body.days); if (!Number.isInteger(days) || days < 1 || days > 90) fail(400, 'Escolha de 1 a 90 dias.');
    state.announcements ||= [];
    state.announcements.push({ id: randomUUID(), title, text: message, link, createdAt: now, until: now + days * DAY, by: actor.name });
    if (state.announcements.length > 100) state.announcements = state.announcements.slice(-100);
    log(state, actor, 'Comunicado publicado', title, '');
    return {};
  }
  if (body.action === 'admin_announce_end') {
    adminOnly();
    const a = (state.announcements || []).find(x => x.id === body.id); if (!a) fail(404, 'Comunicado não encontrado.');
    a.endedAt = now; log(state, actor, 'Comunicado encerrado', a.title, '');
    return {};
  }
  fail(400, 'Ação desconhecida.');
}

// Comunicados ativos que a pessoa ainda não fechou.
export function announcementsFor(state, me, now = Date.now()) {
  const closed = new Set(state.announcementDismiss?.[me.id] || []);
  return (state.announcements || []).filter(a => !a.endedAt && a.until > now && !closed.has(a.id)).slice(-3).map(a => ({ id: a.id, title: a.title, text: a.text, link: a.link }));
}
