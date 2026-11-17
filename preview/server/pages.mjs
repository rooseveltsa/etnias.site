// Páginas (estilo Facebook): vinculadas ao perfil de quem as criou, com administração e moderação, capa, foto, contato,
// informações do projeto, seguidores, agenda de eventos e estatísticas para quem administra. Dados em state.pages.
import { randomUUID } from 'node:crypto';
import { roleOf } from './admin.mjs';
import { readState } from './store.mjs';

export const pageActions = ['page_create', 'page_update', 'page_media', 'page_follow', 'page_role', 'page_event_save', 'page_event_delete', 'page_event_rsvp', 'page_delete'];
export const pageUploadActions = ['page_media'];
export const PAGE_CATEGORIES = ['Organização indígena', 'Projeto cultural', 'Artista ou coletivo', 'Comunidade ou aldeia', 'Educação', 'Saúde', 'Comunicação', 'Outro'];
const MAX_PAGES_PER_USER = 5, MAX_EVENTS = 100, MAX_STAFF = 20;
const DAY = 864e5;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max, required = false, label = 'campo') => {
  const v = typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, ' ').replace(/[ \t]+/g, ' ').trim() : '';
  if (required && !v) fail(400, `Preencha ${label}.`);
  if (v.length > max) fail(400, `Use até ${max} caracteres em ${label}.`);
  return v;
};
const phoneOf = value => { const v = clean(value, 24); if (!v) return ''; if (!/^\+?[0-9 ()-]{8,20}$/.test(v)) fail(400, 'Telefone inválido. Use só números, espaço, + ( ) e -.'); return v; };
const siteOf = value => { const v = clean(value, 200); if (!v) return ''; let u; try { u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); } catch { fail(400, 'Endereço do site inválido.'); } if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) fail(400, 'Endereço do site inválido.'); return u.href.slice(0, 200); };
const keyOf = id => `id:${id}`;
const pagesOf = state => (state.pages ||= []);
const accountById = (state, id) => (state.accounts || []).find(a => a.id === id);
const isPlatformAdmin = account => roleOf(account) === 'admin';

export function pageRole(page, account) {
  if (!account) return '';
  if (page.ownerId === account.id) return 'owner';
  const r = page.roles?.[account.id];
  return r === 'admin' || r === 'mod' ? r : '';
}
const canEdit = (page, account) => ['owner', 'admin'].includes(pageRole(page, account)) || isPlatformAdmin(account);
const canEvents = (page, account) => !!pageRole(page, account) || isPlatformAdmin(account);
const avatarUrl = id => id ? `/api/media?id=${id}` : '';
const person = (state, id) => { const a = accountById(state, id); return a ? { key: keyOf(a.id), name: a.name, username: a.username || '', avatar: a.avatarUrl || avatarUrl(a.avatarId) } : null; };

export const pageMedia = (state, id) => (state.pages || []).some(p => p.avatarId === id || p.coverId === id) ? { kind: 'image', name: 'pagina' } : null;

function summary(state, page, me) {
  const mine = accountById(state, me.id);
  return { id: page.id, name: page.name, tagline: page.tagline || '', category: page.category, avatar: avatarUrl(page.avatarId), followers: (page.followers || []).length,
    following: (page.followers || []).some(f => f.id === me.id), role: pageRole(page, mine) };
}
export function pagesList(state, me, params) {
  const q = String(params.get('q') || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 60);
  const scope = params.get('scope') || 'all';
  const owner = params.get('owner') || '';
  const mine = accountById(state, me.id);
  let list = pagesOf(state).filter(p => !p.suspended);
  if (scope === 'mine') list = list.filter(p => pageRole(p, mine));
  else if (scope === 'following') list = list.filter(p => (p.followers || []).some(f => f.id === me.id));
  if (/^id:[a-f0-9-]{36}$/.test(owner)) list = list.filter(p => keyOf(p.ownerId) === owner || p.roles?.[owner.slice(3)] === 'admin');
  if (q) list = list.filter(p => `${p.name} ${p.tagline} ${p.category}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q));
  list = list.sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0) || b.createdAt - a.createdAt).slice(0, 60);
  return { pages: list.map(p => summary(state, p, me)), categories: PAGE_CATEGORIES, canCreate: pagesOf(state).filter(p => p.ownerId === me.id).length < MAX_PAGES_PER_USER };
}
export function pageView(state, me, id) {
  const page = pagesOf(state).find(p => p.id === id && !p.suspended);
  if (!page) fail(404, 'Página não encontrada.');
  const mine = accountById(state, me.id);
  const role = pageRole(page, mine);
  const staff = !!role || isPlatformAdmin(mine);
  const now = Date.now();
  const events = (page.events || []).slice().sort((a, b) => a.startsAt - b.startsAt).map(e => ({ id: e.id, title: e.title, startsAt: e.startsAt, place: e.place || '', description: e.description || '', goingCount: (e.going || []).length, iGo: (e.going || []).includes(me.id), past: e.startsAt < now - 6 * 3600e3 }));
  const out = { id: page.id, name: page.name, tagline: page.tagline || '', about: page.about || '', project: page.project || '', category: page.category, phone: page.phone || '', website: page.website || '', city: page.city || '',
    avatar: avatarUrl(page.avatarId), cover: avatarUrl(page.coverId), createdAt: page.createdAt, followers: (page.followers || []).length, following: (page.followers || []).some(f => f.id === me.id),
    role, canEdit: canEdit(page, mine), canManageRoles: canEdit(page, mine), canEvents: canEvents(page, mine), owner: person(state, page.ownerId),
    staff: Object.entries(page.roles || {}).map(([aid, r]) => ({ ...person(state, aid), role: r })).filter(p => p.key), events, eventsLink: '/eventos/', categories: PAGE_CATEGORIES };
  if (staff) {
    const f = page.followers || [];
    const series = Array.from({ length: 14 }, (_, i) => { const start = new Date(now - (13 - i) * DAY); start.setHours(0, 0, 0, 0); const end = start.getTime() + DAY; return { day: start.getTime(), n: f.filter(x => x.at >= start.getTime() && x.at < end).length }; });
    out.stats = { followers: f.length, last7: f.filter(x => x.at > now - 7 * DAY).length, last30: f.filter(x => x.at > now - 30 * DAY).length, events: (page.events || []).length,
      upcoming: events.filter(e => !e.past).length, interested: (page.events || []).reduce((n, e) => n + (e.going || []).length, 0), series };
  }
  return out;
}

export async function pagesPrepareUpload(body, account, { mediaInput, saveMedia }) {
  // A permissão é conferida ANTES de gravar o arquivo: quem não administra a página não consegue nem guardar a imagem.
  const state = (await readState()).data;
  const page = pagesOf(state).find(p => p.id === body.pageId);
  if (!page) fail(404, 'Página não encontrada.');
  if (!canEdit(page, accountById(state, account.id))) fail(403, 'Só quem administra a página pode trocar a foto e a capa.');
  if (!['avatar', 'cover'].includes(body.kind)) fail(400, 'Escolha foto ou capa.');
  if (body.media === null) return null;
  const upload = mediaInput(body.media);
  if (!upload || upload.kind !== 'image' || !['image/png', 'image/jpeg', 'image/webp'].includes(upload.type)) fail(400, 'Escolha uma imagem PNG, JPG ou WebP de até 2 MB.');
  await saveMedia(upload.id, upload.bytes, upload.type);
  return upload;
}

export function pageAction(state, account, body, upload) {
  const pages = pagesOf(state);
  const now = Date.now();
  const find = () => { const p = pages.find(x => x.id === String(body.pageId || '') && !x.suspended); if (!p) fail(404, 'Página não encontrada.'); return p; };
  const removedIds = [];
  switch (body.action) {
    case 'page_create': {
      if (pages.filter(p => p.ownerId === account.id).length >= MAX_PAGES_PER_USER) fail(429, `Cada pessoa pode criar até ${MAX_PAGES_PER_USER} páginas.`);
      const category = PAGE_CATEGORIES.includes(body.category) ? body.category : 'Outro';
      const name = clean(body.name, 60, true, 'o nome da página');
      if (name.length < 3) fail(400, 'O nome da página precisa de pelo menos 3 letras.');
      pages.push({ id: randomUUID(), name, tagline: clean(body.tagline, 120), about: clean(body.about, 1000), project: clean(body.project, 1000), category,
        phone: phoneOf(body.phone), website: siteOf(body.website), city: clean(body.city, 60), ownerId: account.id, roles: {}, followers: [{ id: account.id, at: now }], events: [], createdAt: now });
      return { pageId: pages.at(-1).id };
    }
    case 'page_update': {
      const p = find(); if (!canEdit(p, account)) fail(403, 'Só quem administra a página pode editar.');
      if (body.name !== undefined) { const n = clean(body.name, 60, true, 'o nome da página'); if (n.length < 3) fail(400, 'O nome da página precisa de pelo menos 3 letras.'); p.name = n; }
      if (body.tagline !== undefined) p.tagline = clean(body.tagline, 120);
      if (body.about !== undefined) p.about = clean(body.about, 1000);
      if (body.project !== undefined) p.project = clean(body.project, 1000);
      if (body.category !== undefined && PAGE_CATEGORIES.includes(body.category)) p.category = body.category;
      if (body.phone !== undefined) p.phone = phoneOf(body.phone);
      if (body.website !== undefined) p.website = siteOf(body.website);
      if (body.city !== undefined) p.city = clean(body.city, 60);
      return {};
    }
    case 'page_media': {
      const p = find(); if (!canEdit(p, account)) fail(403, 'Só quem administra a página pode trocar a foto e a capa.');
      const field = body.kind === 'avatar' ? 'avatarId' : body.kind === 'cover' ? 'coverId' : fail(400, 'Escolha foto ou capa.');
      if (p[field]) removedIds.push(p[field]);
      if (upload) p[field] = upload.id; else delete p[field];
      return { removedIds };
    }
    case 'page_follow': {
      const p = find(); const i = (p.followers ||= []).findIndex(f => f.id === account.id);
      if (i >= 0) { if (p.ownerId === account.id) fail(400, 'Quem criou a página não pode deixar de segui-la.'); p.followers.splice(i, 1); }
      else p.followers.push({ id: account.id, at: now });
      return {};
    }
    case 'page_role': {
      const p = find(); if (!canEdit(p, account)) fail(403, 'Só quem administra a página pode mudar a equipe.');
      const username = clean(body.username, 40, true, 'o @ da pessoa').replace(/^@+/, '').toLowerCase();
      const target = (state.accounts || []).find(a => (a.username || '').toLowerCase() === username);
      if (!target) fail(404, 'Não encontramos essa pessoa.');
      if (target.id === p.ownerId) fail(400, 'Quem criou a página já é a dona ou o dono.');
      const role = body.role === 'admin' || body.role === 'mod' ? body.role : '';
      // Só o dono promove administradores: um admin não consegue se multiplicar nem rebaixar quem criou a página.
      if ((role === 'admin' || p.roles?.[target.id] === 'admin') && pageRole(p, account) !== 'owner' && !isPlatformAdmin(account)) fail(403, 'Só quem criou a página muda administradores.');
      p.roles ||= {};
      if (role) { if (!p.roles[target.id] && Object.keys(p.roles).length >= MAX_STAFF) fail(400, `A equipe da página tem no máximo ${MAX_STAFF} pessoas.`); p.roles[target.id] = role; if (!(p.followers ||= []).some(f => f.id === target.id)) p.followers.push({ id: target.id, at: now }); }
      else delete p.roles[target.id];
      return {};
    }
    case 'page_event_save': {
      const p = find(); if (!canEvents(p, account)) fail(403, 'Só a equipe da página cria eventos.');
      const startsAt = Number(body.startsAt);
      if (!Number.isFinite(startsAt) || startsAt < now - 365 * DAY || startsAt > now + 3 * 365 * DAY) fail(400, 'Escolha uma data válida para o evento.');
      const fields = { title: clean(body.title, 80, true, 'o título do evento'), startsAt, place: clean(body.place, 100), description: clean(body.description, 400) };
      p.events ||= [];
      if (body.id) { const e = p.events.find(x => x.id === body.id); if (!e) fail(404, 'Evento não encontrado.'); Object.assign(e, fields); }
      else { if (p.events.length >= MAX_EVENTS) fail(400, 'Limite de eventos da página atingido.'); p.events.push({ id: randomUUID(), ...fields, going: [], createdAt: now, createdBy: account.id }); }
      return {};
    }
    case 'page_event_delete': {
      const p = find(); if (!canEvents(p, account)) fail(403, 'Só a equipe da página apaga eventos.');
      const before = (p.events || []).length; p.events = (p.events || []).filter(e => e.id !== body.id); if (p.events.length === before) fail(404, 'Evento não encontrado.');
      return {};
    }
    case 'page_event_rsvp': {
      const p = find(); const e = (p.events || []).find(x => x.id === body.id); if (!e) fail(404, 'Evento não encontrado.');
      const going = (e.going ||= []); const i = going.indexOf(account.id); if (i >= 0) going.splice(i, 1); else going.push(account.id);
      return {};
    }
    case 'page_delete': {
      const p = find(); if (p.ownerId !== account.id && !isPlatformAdmin(account)) fail(403, 'Só quem criou a página pode apagá-la.');
      if (p.avatarId) removedIds.push(p.avatarId); if (p.coverId) removedIds.push(p.coverId);
      state.pages = pages.filter(x => x !== p);
      return { removedIds };
    }
  }
  return {};
}
