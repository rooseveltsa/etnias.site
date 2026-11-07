const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const first = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signIn(first, base);
    await signIn(second, base);
    const page = await first.newPage(), other = await second.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); other.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    assert.equal(await page.locator('.opy-bottom').isVisible(), true, 'Barra da navegação anterior restaurada conforme preferência do usuário');
    await page.locator('.community-post[data-origin=legacy]').first().waitFor();
    assert.ok(await page.locator('.community-post[data-origin=legacy]').count() >= 16);
    assert.ok(await page.locator('.community-post[data-origin=legacy] .preview-post-image').count() > 0, 'Acervo traz fotos públicas disponíveis');
    for (const name of ['Vídeo', 'Arquivo', 'Localização']) await page.getByRole('button', { name, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Foto', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.feed-float')).position), 'static');
    const content = `Ensaio funcional de UX ${Date.now()}`;
    await page.locator('.postText').fill(content);
    await page.getByRole('button', { name: 'Localização', exact: true }).click();
    await page.getByLabel('Um único lugar').fill('Aldeia Casa Opy');
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    const post = page.locator('.community-post').filter({ hasText: content });
    await post.waitFor();
    await other.goto(base);
    const received = other.locator('.community-post').filter({ hasText: content });
    await received.waitFor();
    await received.getByText('Localização · Aldeia Casa Opy', { exact: true }).waitFor();
    await received.getByRole('button', { name: 'Amei', exact: true }).click();
    await received.getByRole('button', { name: 'Comentar', exact: true }).click();
    await received.getByLabel('Seu comentário').fill('Comentário recebido por outro navegador');
    await received.getByRole('button', { name: 'Enviar comentário' }).click();
    await page.getByRole('button', { name: 'Atualizar feed', exact: true }).click();
    await post.getByText('Comentário recebido por outro navegador', { exact: true }).waitFor();
    assert.ok((await post.textContent()).includes('Amei'));
    await post.getByRole('button', { name: 'Comentar', exact: true }).click();
    await post.getByLabel('Seu comentário').fill('Rascunho que precisa ser preservado');
    await post.getByRole('button', { name: 'Salvar publicação' }).click();
    assert.equal(await post.getByLabel('Seu comentário').inputValue(), 'Rascunho que precisa ser preservado');
    await post.getByLabel('Seu comentário').fill('');
    await page.locator('.leftcol').getByRole('link', { name: 'Salvos', exact: true }).click();
    await page.locator('.community-post').filter({ hasText: content }).waitFor();
    for (const [path, heading] of [
      ['/saberes/', 'Saberes e Trilhas de Conhecimento'],
      ['/guardiao/', 'Guardião da Floresta'],
      ['/fotografos/', 'Fotógrafos Indígenas'],
      ['/musica/', 'Catálogo Musical da Casa Opy'],
      ['/doar/', 'Doe para o Instituto Etnias']
    ]) {
      await page.goto(base + path);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    }
    await page.goto(base + '/saberes/');
    const proposalTitle = `Oficina de Ensaio ${Date.now()}`;
    await page.locator('#saberes-community').fill('Coletivo Casa Opy');
    await page.locator('#saberes-title').fill(proposalTitle);
    await page.locator('#saberes-details').fill('Ementa de avaliação para homologação do módulo Saberes.');
    await page.getByRole('button', { name: 'Registrar proposta no Saberes', exact: true }).click();
    const submissionCard = page.locator('.opy-submission-card').filter({ hasText: proposalTitle });
    await submissionCard.waitFor();
    await submissionCard.getByRole('button', { name: 'Remover registro', exact: true }).click();
    await submissionCard.waitFor({ state: 'detached' });
    await page.goto(base + '/chat/');
    await other.goto(base + '/chat/');
    const message = `Conversa entre sessões ${Date.now()}`;
    await page.getByLabel('Sua mensagem').fill(message);
    await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await other.getByText(message, { exact: true }).waitFor({ timeout: 20000 });
    for (const width of [390, 320]) {
      await other.setViewportSize({ width, height: 844 });
      assert.equal(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await other.locator('.opy-bottom').isVisible(), true);
      assert.equal(await other.locator('.opy-topbar .messages-notification-container').isVisible(), true, 'Chat acessível no cabeçalho com a barra anterior');
      await other.getByRole('button', { name: 'Opy', exact: true }).click();
      await other.getByRole('button', { name: 'Fechar Casa Opy' }).click();
    }
    await page.goto(base);
    const cleanup = page.locator('.community-post').filter({ hasText: content });
    page.once('dialog', d => d.accept());
    await cleanup.getByRole('button', { name: 'Excluir minha publicação' }).click();
    await cleanup.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: '.impeccable/review/opy-v2-desktop.png', fullPage: true });
    await other.goto(base);
    await other.locator('.community-post').first().waitFor();
    await other.setViewportSize({ width: 390, height: 844 });
    await other.evaluate(() => document.fonts.ready);
    await other.screenshot({ path: '.impeccable/review/opy-v2-mobile.png', fullPage: true });
    console.log('PASS UX real: acervo, fluxo de texto com localização, reação, comentário, salvos, chat e celular');
    await first.close(); await second.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
