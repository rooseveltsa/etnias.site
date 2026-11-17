import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSvg } from '../../preview/server/svg-safe.mjs';
import { extrasAction, reactionSet, reactionAllowed, usernameCheck, usernameInfo, stickerCatalog, stickerById, reverseGeocode } from '../../preview/server/extras.mjs';

process.env.OPY_ADMIN_USERNAMES = 'chefe';
const mk = (username, extra = {}) => ({ id: crypto.randomUUID(), username, name: username, ...extra });
const fresh = () => { const admin = mk('chefe'), ana = mk('ana'), beto = mk('beto'); return { admin, ana, beto, state: { accounts: [admin, ana, beto], posts: [] } }; };
const rejects = (fn, status) => assert.throws(fn, e => e.status === status);
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1h4" fill="#b84a27"/></svg>';

test('SVG: mantém só desenho e recusa script, evento, imagem, uso externo e DOCTYPE', () => {
  assert.match(sanitizeSvg(Buffer.from(svg)).toString(), /^<svg xmlns=.* viewBox="0 0 24 24"><path d="M1 1h4" fill="#b84a27"\/><\/svg>$/);
  for (const bad of ['<svg viewBox="0 0 1 1" onload="alert(1)"/>', '<svg viewBox="0 0 1 1"><script>1</script></svg>', '<svg viewBox="0 0 1 1"><foreignObject/></svg>', '<svg viewBox="0 0 1 1"><use href="#a"/></svg>', '<svg viewBox="0 0 1 1"><image href="x"/></svg>', '<svg viewBox="0 0 1 1"><path fill="url(http://x/y)"/></svg>', '<!DOCTYPE svg [<!ENTITY a "b">]><svg viewBox="0 0 1 1"/>', '<svg viewBox="0 0 1 1"><a href="javascript:1"/></svg>', '<svg><path/></svg>'])
    assert.throws(() => sanitizeSvg(Buffer.from(bad)), e => e.status === 400, bad);
  assert.throws(() => sanitizeSvg(Buffer.alloc(200 * 1024, 32)), e => e.status === 400);
  const style = sanitizeSvg(Buffer.from('<svg viewBox="0 0 1 1"><path d="M0 0" style="background:url(x)" class="a"/></svg>')).toString();
  assert.ok(!/style|class/.test(style));
});

test('trocar o @: formato, reservados, disponibilidade, limite de 15 dias, histórico e @ antigo reservado', () => {
  const { state, ana, beto } = fresh();
  assert.equal(usernameCheck(state, ana, 'beto').ok, false);
  assert.equal(usernameCheck(state, ana, 'admin').ok, false);
  assert.equal(usernameCheck(state, ana, 'a').ok, false);
  assert.equal(usernameCheck(state, ana, 'ana__x').ok, false);
  assert.equal(usernameCheck(state, ana, 'ana_nova').ok, true);
  extrasAction(state, ana, { action: 'username_change', username: '@Ana_Nova' });
  assert.equal(ana.username, 'ana_nova');
  rejects(() => extrasAction(state, ana, { action: 'username_change', username: 'ana_outra' }), 429);
  assert.equal(usernameInfo(ana, state).canChange, false);
  assert.equal(usernameInfo(ana, state).history[0].username, 'ana');
  assert.equal(usernameCheck(state, beto, 'ana').ok, false, 'o @ antigo fica reservado por um período');
  ana.usernameChangedAt = Date.now() - 16 * 864e5;
  assert.equal(usernameInfo(ana, state).canChange, true);
  extrasAction(state, ana, { action: 'username_change', username: 'ana_2' });
  assert.equal(ana.username, 'ana_2');
  rejects(() => extrasAction(state, beto, { action: 'username_change', username: 'ana_2' }), 409);
});

test('sugestões dispensadas ficam salvas e só aceitam chaves de pessoa', () => {
  const { state, ana, beto } = fresh();
  extrasAction(state, ana, { action: 'suggestion_dismiss', authorKey: `id:${beto.id}` });
  assert.deepEqual(state.dismissedSuggestions[ana.id], [`id:${beto.id}`]);
  rejects(() => extrasAction(state, ana, { action: 'suggestion_dismiss', authorKey: '<script>' }), 400);
});

test('localização: exige consentimento, guarda só cidade e UF e pode ser removida', () => {
  const { state, ana } = fresh();
  rejects(() => extrasAction(state, ana, { action: 'location_set', city: 'Manaus', uf: 'AM' }), 400);
  extrasAction(state, ana, { action: 'location_set', consent: true, city: 'Manaus <b>', uf: 'am' });
  assert.deepEqual([ana.location.city, ana.location.uf], ['Manaus b', 'AM']);
  extrasAction(state, ana, { action: 'location_clear' });
  assert.equal(ana.location, undefined);
  return assert.rejects(reverseGeocode(ana.id, 'x', '1'), e => e.status === 400);
});

test('reações: padrão com 5, só admin edita, no máximo 6 ativas, apagar migra para curtir', () => {
  const { state, admin, ana } = fresh();
  assert.equal(reactionSet(state).length, 5);
  rejects(() => extrasAction(state, ana, { action: 'reaction_save', label: 'x' }, { id: 'm' }), 403);
  extrasAction(state, admin, { action: 'reaction_save', label: 'Força', active: true }, { id: 'media-1' });
  const custom = reactionSet(state).at(-1);
  assert.equal(reactionSet(state).length, 6); assert.equal(custom.mediaId, 'media-1');
  rejects(() => extrasAction(state, admin, { action: 'reaction_save', label: 'Sétima', active: true }, { id: 'media-2' }), 409);
  extrasAction(state, admin, { action: 'reaction_save', label: 'Sétima' }, { id: 'media-2' }); // criada inativa
  assert.equal(reactionSet(state).length, 6);
  extrasAction(state, admin, { action: 'reaction_reorder', ids: [custom.id, 'like'] });
  assert.equal(reactionSet(state)[0].id, custom.id);
  state.posts.push({ reactions: { [ana.id]: custom.id } });
  assert.ok(reactionAllowed(state, custom.id, ''));
  extrasAction(state, admin, { action: 'reaction_delete', id: custom.id });
  assert.equal(state.posts[0].reactions[ana.id], 'like');
  rejects(() => extrasAction(state, admin, { action: 'reaction_delete', id: 'like' }), 400);
  assert.equal(reactionAllowed(state, 'inexistente', ''), false);
});

test('figurinhas: só admin cria pacote/figurinha; catálogo só mostra pacotes ativos', () => {
  const { state, admin, ana } = fresh();
  rejects(() => extrasAction(state, ana, { action: 'sticker_pack_save', name: 'x' }), 403);
  extrasAction(state, admin, { action: 'sticker_pack_save', name: 'Zé Monge', category: 'Zé Monge' });
  const pack = state.stickerPacks[0];
  extrasAction(state, admin, { action: 'sticker_add', packId: pack.id, name: 'Oi' }, { id: 'st-1' });
  assert.equal(stickerCatalog(state).packs[0].items.length, 1);
  assert.ok(stickerById(state, state.stickers[0].id));
  extrasAction(state, admin, { action: 'sticker_pack_save', id: pack.id, name: 'Zé Monge', category: 'Zé Monge', active: false });
  assert.equal(stickerCatalog(state).packs.length, 0);
  assert.equal(stickerById(state, state.stickers[0].id), undefined);
  rejects(() => extrasAction(state, admin, { action: 'sticker_add', packId: pack.id }, null), 400);
});
