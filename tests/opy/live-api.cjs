const assert = require('node:assert/strict');
const { registerAccount } = require('./session.cjs');
const base = process.env.OPY_API_URL || 'http://127.0.0.1:8101';
function visitor() {
  let cookie = '';
  return async (body, origin = base) => {
    if (!cookie) {
      const account = await registerAccount(base);
      assert.equal(account.status, 200, account.data.error || 'cadastro');
      cookie = account.cookie;
    }
    const response = await fetch(`${base}/api/community`, { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json', origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    if (!body) assert.equal(response.status, 200, 'Backend compartilhado deve estar disponível');
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    return { status: response.status, data: await response.json() };
  };
}
(async () => {
  const anon = await fetch(`${base}/api/community`);
  assert.equal(anon.status, 401, 'Sem conta, a prévia pede entrada');
  const alice = visitor(), bob = visitor();
  const a = await alice(), b = await bob();
  assert.equal(a.status, 200, 'Backend compartilhado deve estar disponível');
  assert.notEqual(a.data.me.id, b.data.me.id, 'Visitantes têm sessões distintas');
  assert.ok(a.data.posts.some(p => p.origin === 'legacy'), 'O feed contém o acervo público autorizado');
  assert.equal((await alice({ action: 'publish', text: 'bloqueado' }, 'https://outro-site.invalid')).status, 403);
  const text = `Ensaio de integração ${Date.now()} 😄`;
  const published = await alice({ action: 'publish', text, audience: 'public', poll: ['Opção A', 'Opção B'] });
  assert.equal(published.status, 200);
  const post = published.data.posts.find(p => p.text === text);
  assert.ok(post && post.own);
  assert.ok((await bob()).data.posts.some(p => p.id === post.id), 'Outra sessão lê a publicação persistida');
  assert.equal((await bob({ action: 'delete', postId: post.id })).status, 403, 'Visitante não exclui conteúdo de outra sessão');
  await Promise.all([
    bob({ action: 'react', postId: post.id, reaction: 'heart' }).then(r => assert.equal(r.status, 200)),
    alice({ action: 'comment', postId: post.id, text: 'Comentário real de ensaio' }).then(r => assert.equal(r.status, 200))
  ]);
  let current = (await bob()).data.posts.find(p => p.id === post.id);
  assert.equal(current.reactions.heart, 1, 'Concorrência não perde a reação');
  assert.ok(current.comments.some(c => c.text === 'Comentário real de ensaio'), 'Concorrência não perde o comentário');
  await bob({ action: 'vote', postId: post.id, option: 1 });
  current = (await bob()).data.posts.find(p => p.id === post.id);
  assert.equal(current.poll.counts[1], 1);
  await bob({ action: 'save', postId: post.id });
  assert.equal((await bob()).data.posts.find(p => p.id === post.id).saved, true);
  assert.equal((await alice({ action: 'message', text: 'Sala pública removida' })).status, 400, 'A antiga sala pública não aceita mensagens');
  assert.equal((await bob()).data.messages, undefined, 'O snapshot não expõe a antiga sala pública');
  assert.equal((await alice({ action: 'delete', postId: post.id })).status, 200);
  assert.ok(!(await bob()).data.posts.some(p => p.id === post.id));
  const enrolled = await alice({ action: 'enroll_saber', trackId: 'saberes-comunicacao' });
  assert.equal(enrolled.status, 200);
  assert.equal(enrolled.data.saberes['saberes-comunicacao'].enrolled, true);
  await alice({ action: 'enroll_saber', trackId: 'saberes-comunicacao' });
  const liked = await alice({ action: 'like_music', trackId: 'canto-alvorada' });
  assert.equal(liked.status, 200);
  assert.equal(liked.data.music['canto-alvorada'].liked, true);
  await alice({ action: 'like_music', trackId: 'canto-alvorada' });
  const privateSub = await alice({ action: 'module_submit', module: 'guardiao', category: 'Queimada, fumaça ou foco de calor', community: 'Bacia do Xingu', title: `Relato privado ${Date.now()}`, details: 'Teste de visibilidade restrita na homologação', audience: 'private' });
  assert.equal(privateSub.status, 200);
  const guardiaoEntry = privateSub.data.submissions.find(s => s.module === 'guardiao' && s.own);
  assert.ok(guardiaoEntry && guardiaoEntry.protocol.startsWith('OPY-GUA-'));
  assert.ok(!(await bob()).data.submissions.some(s => s.id === guardiaoEntry.id), 'Relato privado não aparece para outra sessão');
  assert.equal((await bob({ action: 'module_delete', submissionId: guardiaoEntry.id })).status, 404);
  assert.equal((await alice({ action: 'module_delete', submissionId: guardiaoEntry.id })).status, 200);
  const publicSub = await alice({ action: 'module_submit', module: 'saberes', category: 'Línguas, oralidade e memória', community: 'Coletivo Opy', title: `Oficina ${Date.now()}`, details: 'Proposta de curso compartilhada', audience: 'public' });
  assert.equal(publicSub.status, 200);
  const saberEntry = publicSub.data.submissions.find(s => s.module === 'saberes' && s.own);
  assert.ok((await bob()).data.submissions.some(s => s.id === saberEntry.id), 'Outra sessão vê proposta pública');
  assert.equal((await bob({ action: 'module_delete', submissionId: saberEntry.id })).status, 403);
  assert.equal((await alice({ action: 'module_delete', submissionId: saberEntry.id })).status, 200);
  console.log('PASS API real: acervo, sessões, persistência compartilhada, autorização, CSRF, reação/comentário concorrentes, enquete, salvos, mensagens, novos módulos Opy e exclusão');
})().catch(error => { console.error(error); process.exit(1); });
