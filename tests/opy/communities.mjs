import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCommunities, projectCommunities, communityAction, canViewCommunityContent, canPostInCommunity } from '../../preview/server/communities.mjs';

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana', username: 'ana' };
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Beto', username: 'beto' };
const caio = { id: '33333333-3333-4333-8333-333333333333', name: 'Caio', username: 'caio' };
const fresh = () => ({ accounts: [alice, bob, caio], posts: [], interests: {} });
const rejects = (fn, status) => assert.throws(fn, err => err.status === status);

test('semeadura inicial preserva comunidades públicas e privadas sem identidades fictícias', () => {
  const s = fresh();
  const list = ensureCommunities(s);
  assert.equal(list.length, 4);
  assert.equal(list.some(c => c.visibility === 'public'), true);
  assert.equal(list.some(c => c.visibility === 'private'), true);
  const projected = projectCommunities(s, alice);
  assert.equal(projected.find(c => c.id === 'avaliacao-casa-opy').joined, false);
});

test('entrada e saída em comunidade pública sincroniza estado e habilita publicação', () => {
  const s = fresh();
  rejects(() => canPostInCommunity(s, alice, 'saberes-e-formacao'), 403);
  communityAction(s, alice, { action: 'community_join', communityId: 'saberes-e-formacao' });
  const c = canPostInCommunity(s, alice, 'saberes-e-formacao');
  assert.equal(c.id, 'saberes-e-formacao');
  assert.equal(projectCommunities(s, alice).find(x => x.id === 'saberes-e-formacao').joined, true);
  communityAction(s, alice, { action: 'community_leave', communityId: 'saberes-e-formacao' });
  assert.equal(projectCommunities(s, alice).find(x => x.id === 'saberes-e-formacao').joined, false);
});

test('criação de comunidade privada, solicitação de entrada, aprovação, papéis e isolamento de feed', () => {
  const s = fresh();
  const { createdId } = communityAction(s, alice, {
    action: 'community_create',
    name: 'Conselho de Guardiões',
    category: 'Território & Guardiões',
    visibility: 'private',
    description: 'Coordenação privada de proteção ambiental.',
    rules: 'Não publicar dados sensíveis.'
  });
  assert.equal(canViewCommunityContent(s, alice, createdId), true);
  assert.equal(canViewCommunityContent(s, bob, createdId), false);
  rejects(() => canPostInCommunity(s, bob, createdId), 403);

  // Bob solicita entrada
  communityAction(s, bob, { action: 'community_join', communityId: createdId });
  assert.equal(projectCommunities(s, bob).find(c => c.id === createdId).pending, true);
  assert.equal(projectCommunities(s, alice).find(c => c.id === createdId).pendingRequests.length, 1);

  // Caio (não admin) não pode aprovar Bob
  rejects(() => communityAction(s, caio, { action: 'community_approve', communityId: createdId, memberKey: 'id:' + bob.id }), 403);

  // Alice aprova Bob
  communityAction(s, alice, { action: 'community_approve', communityId: createdId, memberKey: 'id:' + bob.id });
  assert.equal(canViewCommunityContent(s, bob, createdId), true);
  assert.equal(canPostInCommunity(s, bob, createdId).id, createdId);

  // Alice promove Bob a moderador
  communityAction(s, alice, { action: 'community_role', communityId: createdId, memberKey: 'id:' + bob.id, role: 'moderator' });
  assert.equal(projectCommunities(s, bob).find(c => c.id === createdId).canModerate, true);

  // Publicação na comunidade privada e moderação
  s.posts.push({ id: 'p-1', communityId: createdId, authorId: bob.id, author: bob.name, text: 'Relato interno' });
  communityAction(s, bob, { action: 'community_moderate_post', communityId: createdId, postId: 'p-1' });
  assert.equal(s.posts.length, 0);

  // Alice é única admin e há outro membro (Bob); não pode sair sem definir outro admin
  rejects(() => communityAction(s, alice, { action: 'community_leave', communityId: createdId }), 409);
  communityAction(s, alice, { action: 'community_role', communityId: createdId, memberKey: 'id:' + bob.id, role: 'admin' });
  communityAction(s, alice, { action: 'community_leave', communityId: createdId });
  assert.equal(canViewCommunityContent(s, alice, createdId), false);
});

test('convites e denúncias em comunidades funcionam com validação', () => {
  const s = fresh();
  const { createdId } = communityAction(s, alice, {
    action: 'community_create',
    name: 'Rede de Comunicadores',
    category: 'Cultura & Audiovisual',
    visibility: 'private',
    description: 'Grupo privado de comunicadores.'
  });
  communityAction(s, alice, { action: 'community_invite', communityId: createdId, memberKey: 'id:' + caio.id });
  assert.equal(projectCommunities(s, caio).find(c => c.id === createdId).invited, true);
  communityAction(s, caio, { action: 'community_accept_invite', communityId: createdId });
  assert.equal(projectCommunities(s, caio).find(c => c.id === createdId).joined, true);

  communityAction(s, caio, { action: 'community_report', communityId: createdId, reason: 'Conteúdo fora das regras' });
  assert.equal(s.communityReports.length, 1);
});
