import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPost } from '../../preview/server/share.mjs';

const acc = (id, extra = {}) => ({ id, username: id, name: id, ...extra });
const post = (id, extra = {}) => ({ id, authorId: 'a1', author: 'Ana', text: 'oi', audience: 'public', ...extra });
const state = (posts, accounts = [acc('a1')], communities = []) => ({ accounts, posts, communities });

test('compartilhamento: só publicação pública vira prévia', () => {
  const s = state([post('post-public'), post('post-friends', { audience: 'friends' }), post('post-private', { audience: 'private' })]);
  assert.ok(publicPost(s, 'post-public'));
  assert.equal(publicPost(s, 'post-friends'), null);
  assert.equal(publicPost(s, 'post-private'), null);
  assert.equal(publicPost(s, 'não existe'), null);
});
test('compartilhamento: perfil só para amigos, conta suspensa e comunidade privada não vazam', () => {
  assert.equal(publicPost(state([post('post-1')], [acc('a1', { privacy: { profile: 'friends' } })]), 'post-1'), null);
  assert.equal(publicPost(state([post('post-1')], [acc('a1', { suspension: { until: Date.now() + 1e6, reason: 'x' } })]), 'post-1'), null);
  assert.equal(publicPost(state([post('post-1', { communityId: 'c1' })], [acc('a1')], [{ id: 'c1', visibility: 'private' }]), 'post-1'), null);
  assert.ok(publicPost(state([post('post-1', { communityId: 'c1' })], [acc('a1')], [{ id: 'c1', visibility: 'public' }]), 'post-1'));
});
test('compartilhamento: id com caracteres estranhos é recusado', () => {
  const s = state([post('post-public')]);
  for (const id of ['../x', 'a b', '<script>', '', 'x'.repeat(100)]) assert.equal(publicPost(s, id), null);
});
