import test from 'node:test';
import assert from 'node:assert/strict';
import { pageAction, pageView, pagesList } from '../../preview/server/pages.mjs';

const mk = (username, extra = {}) => ({ id: crypto.randomUUID(), username, name: username, ...extra });
const fresh = () => { const dono = mk('dono'), admin = mk('adm'), mod = mk('mod'), fora = mk('fora'); return { dono, admin, mod, fora, state: { accounts: [dono, admin, mod, fora], posts: [], pages: [] } }; };
const rejects = (fn, status) => assert.throws(fn, e => e.status === status);
const me = a => ({ id: a.id });

test('página: criar, validar campos e limite por pessoa', () => {
  const { dono, state } = fresh();
  const { pageId } = pageAction(state, dono, { action: 'page_create', name: 'Projeto Raízes', phone: '+55 92 99999-0000', website: 'raizes.org', category: 'Projeto cultural' });
  const v = pageView(state, me(dono), pageId);
  assert.equal(v.role, 'owner'); assert.equal(v.followers, 1); assert.equal(v.website, 'https://raizes.org/'); assert.ok(v.stats);
  rejects(() => pageAction(state, dono, { action: 'page_create', name: 'ab' }), 400);
  rejects(() => pageAction(state, dono, { action: 'page_create', name: 'Ok nome', phone: 'abc' }), 400);
  rejects(() => pageAction(state, dono, { action: 'page_create', name: 'Ok nome', website: 'javascript:alert(1)' }), 400);
  for (let i = 0; i < 4; i++) pageAction(state, dono, { action: 'page_create', name: 'Página ' + i });
  rejects(() => pageAction(state, dono, { action: 'page_create', name: 'Sexta página' }), 429);
});
test('página: quem não administra não edita, não muda equipe nem apaga (IDOR)', () => {
  const { dono, admin, mod, fora, state } = fresh();
  const { pageId } = pageAction(state, dono, { action: 'page_create', name: 'Aldeia Viva' });
  rejects(() => pageAction(state, fora, { action: 'page_update', pageId, name: 'Invadida' }), 403);
  rejects(() => pageAction(state, fora, { action: 'page_role', pageId, username: 'fora', role: 'admin' }), 403);
  rejects(() => pageAction(state, fora, { action: 'page_delete', pageId }), 403);
  rejects(() => pageAction(state, fora, { action: 'page_event_save', pageId, title: 'x', startsAt: Date.now() + 1e6 }), 403);
  pageAction(state, dono, { action: 'page_role', pageId, username: '@ADM', role: 'admin' });
  pageAction(state, dono, { action: 'page_role', pageId, username: 'mod', role: 'mod' });
  pageAction(state, admin, { action: 'page_update', pageId, tagline: 'Nova frase' });
  rejects(() => pageAction(state, mod, { action: 'page_update', pageId, name: 'Mod não edita' }), 403);
  pageAction(state, mod, { action: 'page_event_save', pageId, title: 'Roda de conversa', startsAt: Date.now() + 864e5 });
  rejects(() => pageAction(state, admin, { action: 'page_role', pageId, username: 'fora', role: 'admin' }), 403); // admin não cria admin
  rejects(() => pageAction(state, admin, { action: 'page_role', pageId, username: 'dono', role: 'mod' }), 400);
  rejects(() => pageAction(state, admin, { action: 'page_delete', pageId }), 403);
  pageAction(state, dono, { action: 'page_delete', pageId });
  rejects(() => pageView(state, me(dono), pageId), 404);
});
test('página: seguidores, estatísticas só para a equipe, agenda e RSVP', () => {
  const { dono, fora, state } = fresh();
  const { pageId } = pageAction(state, dono, { action: 'page_create', name: 'Coletivo Maracá' });
  pageAction(state, fora, { action: 'page_follow', pageId });
  pageAction(state, dono, { action: 'page_event_save', pageId, title: 'Festival', startsAt: Date.now() + 864e5, place: 'Praça' });
  const eid = pageView(state, me(dono), pageId).events[0].id;
  pageAction(state, fora, { action: 'page_event_rsvp', pageId, id: eid });
  const pub = pageView(state, me(fora), pageId); assert.equal(pub.stats, undefined); assert.equal(pub.following, true); assert.equal(pub.events[0].iGo, true);
  const staff = pageView(state, me(dono), pageId); assert.equal(staff.stats.followers, 2); assert.equal(staff.stats.interested, 1); assert.equal(staff.stats.series.length, 14);
  rejects(() => pageAction(state, dono, { action: 'page_follow', pageId }), 400); // dono não sai
  pageAction(state, fora, { action: 'page_follow', pageId });
  assert.equal(pageView(state, me(dono), pageId).followers, 1);
  assert.equal(pagesList(state, me(fora), new URLSearchParams('q=maraca')).pages.length, 1);
});
test('página: texto com marcação HTML é neutralizado', () => {
  const { dono, state } = fresh();
  const { pageId } = pageAction(state, dono, { action: 'page_create', name: 'A<script>alert(1)</script>B', about: '<img src=x onerror=alert(1)>' });
  const v = pageView(state, me(dono), pageId); assert.ok(!v.name.includes('<') && !v.about.includes('<'));
});
