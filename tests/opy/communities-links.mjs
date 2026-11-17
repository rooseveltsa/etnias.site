import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCommunities, projectCommunities, communityAction, canPostInCommunity } from '../../preview/server/communities.mjs';

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana', username: 'ana' };
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Beto', username: 'beto' };
const caio = { id: '33333333-3333-4333-8333-333333333333', name: 'Caio', username: 'caio' };
const fresh = () => ({ accounts: [alice, bob, caio], posts: [], interests: {} });
const rejects = (fn, status) => assert.throws(fn, err => err.status === status);
const view = (s, me, id) => projectCommunities(s, me).find(c => c.id === id);
function create(s, extra = {}) {
  const r = communityAction(s, alice, { action: 'community_create', name: 'Povo Teste', category: 'Música & Artes', visibility: 'private', description: 'Descrição de teste da comunidade', ...extra });
  return r.createdId;
}

test('quem pode publicar: restrito a administração e moderação, aplicado no servidor', () => {
  const s = fresh(); const id = create(s, { postingMode: 'staff' });
  assert.equal(view(s, alice, id).postingMode, 'staff');
  communityAction(s, bob, { action: 'community_join', communityId: id });
  communityAction(s, alice, { action: 'community_approve', communityId: id, memberKey: `id:${bob.id}` });
  assert.ok(canPostInCommunity(s, alice, id));
  rejects(() => canPostInCommunity(s, bob, id), 403);
  assert.equal(view(s, bob, id).canPost, false);
  communityAction(s, alice, { action: 'community_role', communityId: id, memberKey: `id:${bob.id}`, role: 'moderator' });
  assert.ok(canPostInCommunity(s, bob, id));
  communityAction(s, alice, { action: 'community_update', communityId: id, name: 'Povo Teste', description: 'Descrição de teste da comunidade', postingMode: 'open' });
  communityAction(s, alice, { action: 'community_role', communityId: id, memberKey: `id:${bob.id}`, role: 'member' });
  assert.ok(canPostInCommunity(s, bob, id));
});

test('convite por link: só staff cria, entra mesmo em privada, expira e pode ser revogado', () => {
  const s = fresh(); const id = create(s);
  rejects(() => communityAction(s, bob, { action: 'community_link_create', communityId: id }), 403);
  communityAction(s, alice, { action: 'community_link_create', communityId: id, days: 1 });
  const [link] = view(s, alice, id).inviteLinks;
  assert.ok(link.token.length >= 20);
  assert.deepEqual(view(s, bob, id).inviteLinks, []);
  communityAction(s, bob, { action: 'community_join_link', token: link.token });
  assert.ok(view(s, bob, id).joined);
  assert.equal(view(s, alice, id).inviteLinks[0].uses, 1);
  communityAction(s, bob, { action: 'community_join_link', token: link.token });
  assert.equal(view(s, alice, id).inviteLinks[0].uses, 1);
  rejects(() => communityAction(s, caio, { action: 'community_join_link', token: 'x'.repeat(24) }), 404);
  communityAction(s, alice, { action: 'community_link_revoke', communityId: id, token: link.token });
  rejects(() => communityAction(s, caio, { action: 'community_join_link', token: link.token }), 404);
  assert.equal(view(s, caio, id).joined, false);
  communityAction(s, alice, { action: 'community_link_create', communityId: id, days: 30 });
  const [second] = view(s, alice, id).inviteLinks;
  ensureCommunities(s).find(c => c.id === id).inviteLinks.find(l => l.token === second.token).expiresAt = Date.now() - 1;
  rejects(() => communityAction(s, caio, { action: 'community_join_link', token: second.token }), 404);
});

test('limite de 10 links ativos', () => {
  const s = fresh(); const id = create(s);
  for (let i = 0; i < 10; i++) communityAction(s, alice, { action: 'community_link_create', communityId: id });
  rejects(() => communityAction(s, alice, { action: 'community_link_create', communityId: id }), 409);
});
