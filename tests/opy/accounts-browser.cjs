// Missão "Conta e experiência" — Prioridade 1, no navegador (celular 390×844):
// tema claro/escuro com persistência e sem piscar, sair, trocar de conta (lista do aparelho + @ pré-preenchido),
// pertencimento e povo no perfil (aba Sobre), fotos do perfil (adicionar e excluir com confirmação) e testes negativos
// (não dá para excluir foto alheia nem editar perfil alheio). Precisa do servidor local com dados.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn, registerAccount } = require('./session.cjs');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=';
async function api(cookie, body) {
  const r = await fetch(base + '/api/community', { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const results = [];
  const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + (e.message || e).toString().split('\n')[0].slice(0, 200)]); } };
  try {
    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const ana = await signIn(ctx, base);
    const beto = await registerAccount(base, { name: 'Beto ' + Date.now().toString(36) });
    const betoPost = await api(beto.cookie, { action: 'publish', text: 'Foto do Beto', audience: 'public', communityId: '', media: { name: 'b.png', data: png }, file: null, location: '' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const click = sel => page.locator(sel).first().dispatchEvent('click');

    await step('1. Tema: alternar para escuro, persistir e carregar sem piscar', async () => {
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
      await click('#opy-theme-toggle');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      assert.equal(await page.getAttribute('#opy-theme-toggle', 'aria-pressed'), 'true');
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.notEqual(bg, 'rgb(245, 245, 241)', 'fundo muda no tema escuro: ' + bg);
      // Recarregar: o tema vem do aparelho antes da primeira pintura (theme.js no <head>).
      await page.reload();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('opy-theme')), 'dark');
      await click('#opy-theme-toggle');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    });

    await step('2. Perfil: declarar pertencimento indígena com povo e ver na aba Sobre', async () => {
      await page.locator('.community-post').first().waitFor();
      await page.goto(base + '/conta/'); await page.locator('#profile-page .pf-card').first().waitFor({ timeout: 10000 });
      // Abre o diálogo de edição por qualquer botão "Editar perfil".
      await page.locator('button:has-text("Editar perfil")').first().dispatchEvent('click');
      await page.locator('#profile-edit-form').waitFor();
      await page.locator('#profile-edit-form input[name=belonging][value=indigena]').check({ force: true });
      assert.equal(await page.locator('#profile-edit-povo-label').isHidden(), false, 'campo do povo aparece ao marcar indígena');
      await page.fill('#profile-edit-povo', 'Terena');
      await page.locator('#profile-edit-form button[type=submit]').dispatchEvent('click');
      await page.locator('#profile-edit-status:has-text("Perfil atualizado")').waitFor({ timeout: 8000 });
      await page.locator('[data-close-edit]').dispatchEvent('click');
      const snap = await (await fetch(base + '/api/community', { headers: { cookie: ana.cookie } })).json();
      assert.equal(snap.me.belonging, 'indigena'); assert.equal(snap.me.povo, 'Terena');
      assert.ok(snap.povos.includes('Terena'), 'lista de povos alimenta o autocompletar');
      await page.locator('button:has-text("Sobre")').first().dispatchEvent('click');
      await page.locator('text=Pertencimento').first().waitFor();
      assert.ok((await page.locator('.pf-card').allTextContents()).join(' ').includes('Indígena · Terena'));
    });

    await step('3. Perfil: não indígena não guarda povo', async () => {
      await page.locator('button:has-text("Editar perfil")').first().dispatchEvent('click');
      await page.locator('#profile-edit-form').waitFor();
      await page.locator('#profile-edit-form input[name=belonging][value=nao_indigena]').check({ force: true });
      assert.equal(await page.locator('#profile-edit-povo-label').isHidden(), true, 'campo do povo some');
      await page.locator('#profile-edit-form button[type=submit]').dispatchEvent('click');
      await page.locator('#profile-edit-status:has-text("Perfil atualizado")').waitFor({ timeout: 8000 });
      await page.locator('[data-close-edit]').dispatchEvent('click');
      const snap = await (await fetch(base + '/api/community', { headers: { cookie: ana.cookie } })).json();
      assert.equal(snap.me.belonging, 'nao_indigena'); assert.equal(snap.me.povo, '');
    });

    await step('4. Fotos: adicionar uma foto pelo perfil e excluir com confirmação', async () => {
      await page.locator('button:has-text("Fotos")').first().dispatchEvent('click');
      await page.locator('.pf-card-head .pf-file input[type=file]').waitFor({ state: 'attached' });
      const before = await page.locator('.pf-photo').count();
      await page.setInputFiles('.pf-card-head .pf-file input[type=file]', { name: 'nova.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
      await page.waitForFunction(n => document.querySelectorAll('.pf-photo').length > n, before, { timeout: 10000 });
      const added = await page.locator('.pf-photo').count();
      assert.ok(await page.locator('.pf-photo-delete').count() > 0, 'a própria pessoa vê Excluir');
      // Cancelar a confirmação mantém a foto; confirmar remove.
      page.once('dialog', d => d.dismiss());
      await page.locator('.pf-photo-delete').first().dispatchEvent('click');
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.pf-photo').count(), added, 'cancelar mantém a foto');
      page.once('dialog', d => d.accept());
      await page.locator('.pf-photo-delete').first().dispatchEvent('click');
      await page.waitForFunction(n => document.querySelectorAll('.pf-photo').length < n, added, { timeout: 10000 });
    });

    await step('5. Fotos: ampliar abre o visualizador', async () => {
      if (await page.locator('.pf-photo-open').count() === 0) {
        await page.setInputFiles('.pf-card-head .pf-file input[type=file]', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
        await page.locator('.pf-photo-open').first().waitFor();
      }
      await page.locator('.pf-photo-open').first().dispatchEvent('click');
      await page.locator('#opy-lightbox[open] img').first().waitFor({ timeout: 5000 });
      await page.keyboard.press('Escape');
    });

    await step('6. Negativo: outra pessoa não exclui minha foto nem edita meu perfil pela API', async () => {
      const mine = (await (await fetch(base + '/api/community', { headers: { cookie: ana.cookie } })).json()).posts.find(p => p.own && p.media?.kind === 'image');
      assert.ok(mine, 'há foto própria');
      assert.equal((await api(beto.cookie, { action: 'delete', postId: mine.id })).status, 403);
      assert.equal((await api(beto.cookie, { action: 'profile_update', name: 'Hacker', belonging: 'xpto' })).status, 400);
      // Na tela de perfil alheio não há botão de excluir foto.
      const betoId = (await (await fetch(base + '/api/community', { headers: { cookie: beto.cookie } })).json()).me.id;
      await page.goto(base + '/perfil/?u=' + encodeURIComponent('id:' + betoId)); await page.locator('#profile-page .pf-card').first().waitFor();
      await page.locator('button:has-text("Fotos")').first().dispatchEvent('click'); await page.locator('.pf-photo-open').first().waitFor();
      assert.equal(await page.locator('.pf-photo-delete').count(), 0, 'sem Excluir em foto alheia');
    });

    await step('7. Trocar de conta: diálogo lista contas do aparelho e sai para entrar com o @ preenchido', async () => {
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
      // Simula outra conta já usada neste aparelho.
      await page.evaluate(u => { const l = JSON.parse(localStorage.getItem('opy-accounts') || '[]'); l.push({ username: u.username, name: u.name, avatar: '' }); localStorage.setItem('opy-accounts', JSON.stringify(l)); }, beto);
      await page.locator('details.opy-account summary').first().dispatchEvent('click');
      await click('#opy-switch-account');
      await page.locator('.opy-switch-list').waitFor();
      assert.ok((await page.locator('.opy-switch-list').textContent()).includes('@' + beto.username));
      await page.locator('.opy-switch-list button:has-text("Entrar")').first().dispatchEvent('click');
      await page.waitForURL(/\/entrar\/\?user=/, { timeout: 10000 });
      await page.locator('#login-username').waitFor();
      assert.equal(await page.inputValue('#login-username'), beto.username);
      // A sessão antiga morreu de verdade.
      assert.equal((await fetch(base + '/api/community', { headers: { cookie: ana.cookie } })).status, 401);
    });

    await step('8. Sair: menu da conta encerra a sessão', async () => {
      const ctx2 = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const carla = await signIn(ctx2, base);
      const p2 = await ctx2.newPage(); await p2.goto(base + '/'); await p2.locator('.community-post').first().waitFor();
      await p2.locator('details.opy-account summary').first().dispatchEvent('click');
      await p2.locator('#opy-account-logout').dispatchEvent('click');
      await p2.waitForURL(/\/entrar\//, { timeout: 10000 });
      assert.equal((await fetch(base + '/api/community', { headers: { cookie: carla.cookie } })).status, 401);
      await ctx2.close();
    });

    await step('9. Configurações: privacidade, aparelhos, acessibilidade e bloqueio pelo perfil', async () => {
      const ctx3 = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const dani = await signIn(ctx3, base);
      const p3 = await ctx3.newPage(); p3.on('pageerror', e => errors.push(e.message));
      await p3.goto(base + '/configuracoes/'); await p3.locator('.set-page h1').waitFor();
      for (const t of ['Privacidade', 'Aparelhos conectados', 'Seguidores', 'Pessoas bloqueadas', 'Acessibilidade', 'Conta']) assert.ok(await p3.locator('.set-card h2', { hasText: t }).count(), 'seção ' + t);
      assert.ok((await p3.locator('.set-sessions').textContent()).includes('(este aparelho)'));
      await p3.locator('input[name=set-profile][value=friends]').check({ force: true });
      await p3.waitForFunction(() => document.querySelector('input[name=set-profile][value=friends]')?.checked, null, { timeout: 8000 });
      const acc = await (await fetch(base + '/api/community?view=account', { headers: { cookie: dani.cookie } })).json();
      assert.equal(acc.privacy.profile, 'friends', 'privacidade gravada no servidor');
      await p3.locator('input[name=set-text][value=large]').check({ force: true });
      assert.equal(await p3.evaluate(() => document.documentElement.dataset.text), 'large');
      await p3.reload(); assert.equal(await p3.evaluate(() => document.documentElement.dataset.text), 'large', 'texto grande persiste');
      // Bloquear pelo perfil de outra pessoa e desbloquear em Configurações.
      const target = await registerAccount(base, { name: 'Eva ' + Date.now().toString(36) });
      const evaId = (await (await fetch(base + '/api/community', { headers: { cookie: target.cookie } })).json()).me.id;
      await p3.goto(base + '/perfil/?u=' + encodeURIComponent('id:' + evaId)); await p3.locator('.pf-block').waitFor();
      p3.once('dialog', d => d.accept()); await p3.locator('.pf-block').dispatchEvent('click');
      await p3.waitForURL(u => new URL(u).pathname === '/', { timeout: 10000 });
      await p3.goto(base + '/configuracoes/'); await p3.locator('.set-people button:has-text("Desbloquear")').waitFor();
      await p3.locator('.set-people button:has-text("Desbloquear")').dispatchEvent('click');
      await p3.waitForFunction(() => !document.querySelector('.set-people button[aria-label^="Desbloquear"]'), null, { timeout: 8000 });
      await ctx3.close();
    });

    assert.deepEqual(errors.filter(e => !/ResizeObserver/.test(e)), [], 'sem erros de página');
  } finally {
    for (const [s, n] of results) console.log(s.padEnd(7), n);
    const failed = results.filter(r => r[0] !== 'OK').length;
    console.log(failed ? `FALHOU ${failed}/${results.length}` : `PASS contas: ${results.length} passos`);
    await browser.close();
    process.exitCode = failed ? 1 : 0;
  }
})();
