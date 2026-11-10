// Mercado: anúncios dos membros (sem carrinho nem pagamento; o preço é texto livre e a conversa segue pelo chat).
// Quem anuncia edita e remove os seus; a equipe remove qualquer um (fica no registro da gestão).
// Avaliações: nota de 1 a 5 e comentário curto, uma por conta por anúncio (editável); quem vende não avalia o próprio.
// Bloqueio ou conta desativada escondem o anúncio e as avaliações dessa pessoa, como nas áreas do 1.0.
import { randomUUID } from 'node:crypto';
import { profileAccess } from './account.mjs';
import { log } from './admin.mjs';

export const marketActions = ['market_save', 'market_delete', 'market_review'];
export const MARKET_CATEGORIES = ['Artesanato', 'Arte e grafismo', 'Alimentos', 'Livros e música', 'Serviços', 'Outros'];
export const MAX_MARKET_PHOTOS = 4;
const MAX_LISTINGS = 2000, MAX_PER_SELLER = 30;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max, label, required = true) {
  if (value != null && typeof value !== 'string') fail(400, `Confira o campo ${label}.`);
  const v = (value || '').trim();
  if (required && !v) fail(400, `Preencha o campo ${label}.`);
  if (v.length > max) fail(400, `O campo ${label} aceita até ${max} caracteres.`);
  return v;
}
const listOf = state => (state.market ||= []);
const isStaff = me => me.role === 'admin' || me.role === 'moderator';
const visible = (state, me, x) => profileAccess(state, me.id, x.sellerId) !== 'none';
const photoUrl = m => `/api/media?id=${m.id}`;
function person(state, id) {
  const a = (state.accounts || []).find(x => x.id === id);
  return a ? { key: 'id:' + a.id, name: a.name, avatar: a.avatarUrl || (a.avatarId ? `/api/media?id=${a.avatarId}` : '') } : null;
}
function rating(x) {
  const all = Object.values(x.reviews || {});
  return { avg: all.length ? Math.round(all.reduce((t, r) => t + r.stars, 0) / all.length * 10) / 10 : 0, count: all.length };
}
function findVisible(state, me, id) {
  const x = typeof id === 'string' && listOf(state).find(l => l.id === id);
  if (!x || !visible(state, me, x)) fail(404, 'Este anúncio não existe mais ou não está disponível para você.');
  return x;
}
// Cartões da lista, no formato das áreas do 1.0 (o cliente usa o mesmo renderizador).
export function marketList(state, me) {
  return listOf(state).filter(x => visible(state, me, x)).map(x => ({
    id: x.id, member: true, title: x.title, excerpt: x.description.replace(/\s+/g, ' ').slice(0, 180), description: x.description, category: x.category, price: x.price, location: x.location,
    images: x.photos.map(photoUrl), createdAt: x.createdAt, author: person(state, x.sellerId), rating: rating(x)
  }));
}
export function marketDetail(state, me, id) {
  const x = findVisible(state, me, id);
  const own = x.sellerId === me.id;
  const reviews = Object.entries(x.reviews || {}).filter(([who]) => profileAccess(state, me.id, who) !== 'none')
    .map(([who, r]) => ({ ...person(state, who), stars: r.stars, text: r.text, at: r.at, own: who === me.id })).filter(r => r.key).sort((a, b) => b.at - a.at);
  return {
    item: { id: x.id, member: true, title: x.title, description: x.description, price: x.price, category: x.category, location: x.location, images: x.photos.map(photoUrl), photoIds: own ? x.photos.map(m => m.id) : [], createdAt: x.createdAt, updatedAt: x.updatedAt },
    author: person(state, x.sellerId), own, canRemove: own || isStaff(me), rating: rating(x), reviews, myReview: x.reviews?.[me.id] || null, categoriesFixed: MARKET_CATEGORIES
  };
}
export function marketMedia(state, me, id) {
  const x = listOf(state).find(l => l.photos.some(m => m.id === id));
  return x && visible(state, me, x) ? x.photos.find(m => m.id === id) : null;
}
// uploads: fotos novas já validadas (imagens) e salvas por community.mjs.
export function marketAction(state, me, body, uploads = []) {
  const removedIds = [];
  if (body.action === 'market_save') {
    const editing = body.id ? findVisible(state, me, body.id) : null;
    if (editing && editing.sellerId !== me.id) fail(403, 'Somente quem anunciou pode editar este anúncio.');
    if (!editing && listOf(state).length >= MAX_LISTINGS) fail(409, 'O Mercado atingiu o limite de anúncios deste servidor.');
    if (!editing && listOf(state).filter(x => x.sellerId === me.id).length >= MAX_PER_SELLER) fail(409, `Cada conta mantém até ${MAX_PER_SELLER} anúncios. Remova um antigo para anunciar.`);
    const category = String(body.category || '');
    if (!MARKET_CATEGORIES.includes(category)) fail(400, 'Escolha uma categoria da lista.');
    if (body.keepPhotos != null && !Array.isArray(body.keepPhotos)) fail(400, 'Confira as fotos do anúncio.');
    const kept = editing ? editing.photos.filter(m => (body.keepPhotos || []).includes(m.id)) : [];
    if (kept.length + uploads.length > MAX_MARKET_PHOTOS) fail(400, `Escolha até ${MAX_MARKET_PHOTOS} fotos por anúncio.`);
    const fields = {
      title: text(body.title, 100, 'título'), description: text(body.description, 2000, 'descrição'), price: text(body.price, 40, 'preço'),
      category, location: text(body.location, 80, 'cidade/UF', false),
      photos: [...kept, ...uploads.map(u => ({ id: u.id, kind: u.kind, name: u.name }))]
    };
    const now = Date.now();
    if (editing) {
      removedIds.push(...editing.photos.filter(m => !kept.includes(m)).map(m => m.id));
      Object.assign(editing, fields, { updatedAt: now });
      return { id: editing.id, removedIds };
    }
    const x = { id: randomUUID(), sellerId: me.id, ...fields, reviews: {}, createdAt: now, updatedAt: now };
    listOf(state).unshift(x);
    return { id: x.id, removedIds };
  }
  const x = findVisible(state, me, body.id);
  if (body.action === 'market_delete') {
    if (x.sellerId !== me.id && !isStaff(me)) fail(403, 'Somente quem anunciou ou a equipe pode remover este anúncio.');
    if (x.sellerId !== me.id) log(state, me, 'Anúncio removido do Mercado', person(state, x.sellerId)?.name || 'Conta removida', text(body.reason, 300, 'motivo', false) || 'Moderação do Mercado', { excerpt: x.title });
    state.market = listOf(state).filter(l => l !== x);
    removedIds.push(...x.photos.map(m => m.id));
    return { id: '', removedIds };
  }
  // market_review
  if (x.sellerId === me.id) fail(400, 'Quem anunciou não avalia o próprio anúncio.');
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, 'Escolha uma nota de 1 a 5 estrelas.');
  x.reviews ||= {};
  x.reviews[me.id] = { stars, text: text(body.text, 300, 'comentário', false), at: Date.now() };
  return { id: x.id, removedIds };
}
