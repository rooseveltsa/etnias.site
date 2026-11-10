import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeLegacy, accountIdOf, uuidFrom } from '../../scripts/opy-import-legacy.mjs';

const account = (legacyId, username, name) => ({ legacyId, username, name, bio: '', googleKey: `${username}@x.com`, phone: '', avatarUrl: '', coverUrl: '', createdAt: 1000 * legacyId, lastSeenAt: 2000, verified: false, legacyPassword: '$2y$10$' + 'a'.repeat(53) });
const input = {
  generatedAt: 1,
  accounts: [account(1, 'ana', 'Ana'), account(2, 'beto', 'Beto'), account(3, 'chefe', 'Impostor')],
  communities: [{ legacyId: 7, slug: 'retomada', name: 'Retomada', description: 'Grupo', visibility: 'public', avatarUrl: '', coverUrl: '', ownerLegacyId: 1, createdAt: 500, memberLegacyIds: [1, 2, 3] }],
  posts: [
    { legacyId: 100, authorLegacyId: 1, text: 'Oi', createdAt: 5000, image: '/legado/upload/photos/a.jpg', images: ['/legado/upload/photos/a.jpg'], media: null, attachmentMissing: false, communityLegacyId: 0, link: null,
      comments: [{ legacyId: 9, authorLegacyId: 2, text: 'Legal', createdAt: 5500 }], reactions: [{ authorLegacyId: 2, reaction: 'heart' }, { authorLegacyId: 3, reaction: 'like' }] },
    { legacyId: 101, authorLegacyId: 2, text: 'No grupo', createdAt: 6000, image: '', images: [], media: { kind: 'video', url: '/legado/upload/videos/v.mp4', name: 'v.mp4' }, attachmentMissing: false, communityLegacyId: 7, link: null, comments: [], reactions: [] }
  ],
  follows: [[1, 2], [2, 1], [3, 1]]
};
const existingState = () => ({
  version: 2, accounts: [{ id: 'real-1', username: 'chefe', name: 'Chefe', password: 'x' }],
  posts: [{ id: 'legacy-100', text: 'antigo', author: 'Ana', createdAt: 1, origin: 'legacy', image: '', audience: 'public', avatar: '/assets/archive/avatar-x.jpg', comments: [], reactions: { 'real-1': 'wow' }, saves: ['real-1'], shares: 2 }],
  communities: []
});

test('uuidFrom é determinístico e tem forma de UUID v4', () => {
  assert.equal(uuidFrom('a'), uuidFrom('a'));
  assert.notEqual(uuidFrom('a'), uuidFrom('b'));
  assert.match(accountIdOf(1), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('mesclagem: idempotente, conflito de usuário, comunidade, amizade e reações preservadas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'opy-legacy-'));
  await writeFile(join(dir, 'legacy-import.json'), JSON.stringify(input));
  const data = JSON.parse(await readFile(join(dir, 'legacy-import.json'), 'utf8'));
  const state = existingState();
  const first = mergeLegacy(state, data);
  const afterFirst = JSON.stringify(state);
  const second = mergeLegacy(state, data);
  assert.equal(JSON.stringify(state), afterFirst, 'segunda rodada não muda nada');
  assert.equal(second.accounts.created + second.posts.created + second.communities.created + second.follows + second.friends, 0);

  assert.equal(first.accounts.created, 2);
  assert.deepEqual(first.conflicts.map(c => c.legacyId), [3], 'conta com username já usado por outra pessoa não entra');
  assert.equal(state.accounts.find(a => a.username === 'chefe').id, 'real-1');
  const ana = state.accounts.find(a => a.legacyId === 1), beto = state.accounts.find(a => a.legacyId === 2);
  assert.equal(ana.id, accountIdOf(1));
  assert.equal(ana.password, undefined);
  assert.equal(ana.legacyPassword.length, 60);

  const old = state.posts.find(p => p.id === 'legacy-100');
  assert.equal(old.authorId, ana.id);
  assert.equal(old.text, 'Oi');
  assert.equal(old.avatar, '/assets/archive/avatar-x.jpg', 'campo antigo mantido');
  assert.deepEqual(old.reactions, { 'real-1': 'wow', [beto.id]: 'heart' }, 'reação existente preservada, do legado acrescentada, autor em conflito ignorado');
  assert.deepEqual(old.saves, ['real-1']); assert.equal(old.shares, 2);
  assert.equal(old.comments.length, 1); assert.equal(old.comments[0].id, uuidFrom('legacy-comment-9')); assert.equal(old.comments[0].authorKey, 'id:' + beto.id);

  const community = state.communities.find(c => c.legacyId === 7);
  assert.equal(community.id, 'legado-retomada');
  assert.deepEqual(community.admins, ['id:' + ana.id]);
  assert.deepEqual(new Set(community.members), new Set(['id:' + ana.id, 'id:' + beto.id]));
  const inCommunity = state.posts.find(p => p.id === 'legacy-101');
  assert.equal(inCommunity.communityId, 'legado-retomada'); assert.equal(inCommunity.communityName, 'Retomada');
  assert.equal(inCommunity.media.kind, 'video');
  assert.deepEqual(state.posts.map(p => p.id), ['legacy-101', 'legacy-100'], 'do mais novo para o mais antigo');

  assert.deepEqual(state.follows[ana.id], ['id:' + beto.id]);
  assert.deepEqual(state.follows[beto.id], ['id:' + ana.id]);
  assert.deepEqual(state.friends['id:' + ana.id], ['id:' + beto.id]);
  assert.deepEqual(state.friends['id:' + beto.id], ['id:' + ana.id]);
});

test('vínculo confirmado: conta nova herda legacyId, conteúdo e relações; senha e foto novas mantidas', () => {
  const state = existingState();
  state.accounts[0].avatarId = 'nova-foto';
  const withAvatar = { ...input, accounts: input.accounts.map(a => a.legacyId === 3 ? { ...a, avatarUrl: '/legado/upload/photos/old.jpg', bio: 'Bio antiga' } : a) };
  const first = mergeLegacy(state, withAvatar, { link: ['chefe'] });
  assert.equal(first.conflicts.length, 0); assert.equal(first.accounts.linked, 1); assert.equal(first.accounts.created, 2);
  const chefe = state.accounts.find(a => a.username === 'chefe');
  assert.equal(chefe.id, 'real-1'); assert.equal(chefe.legacyId, 3); assert.equal(chefe.name, 'Chefe');
  assert.equal(chefe.password, 'x'); assert.equal(chefe.legacyPassword, undefined);
  assert.equal(chefe.avatarUrl, undefined, 'foto enviada no Etnias prevalece'); assert.equal(chefe.bio, 'Bio antiga');
  const old = state.posts.find(p => p.id === 'legacy-100');
  assert.equal(old.reactions['real-1'], 'wow', 'reação própria mantida (legado tinha like)');
  assert.deepEqual(state.follows['real-1'], ['id:' + accountIdOf(1)]);
  assert.ok(state.communities[0].members.includes('id:real-1'));
  const snapshot = JSON.stringify(state);
  const second = mergeLegacy(state, withAvatar); // sem --link: o vínculo já está gravado via legacyId
  assert.equal(JSON.stringify(state), snapshot); assert.equal(second.conflicts.length, 0); assert.equal(second.accounts.linked, 0);
});
