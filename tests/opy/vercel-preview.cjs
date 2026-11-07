const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    async function capture(path) {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => { scrollTo(0, 0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      await page.screenshot({ path, fullPage: true });
    }
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(base);
    await page.getByRole('heading', { name: 'Nossa aldeia digital' }).waitFor();
    assert.ok((await page.textContent('body')).includes('Prévia para avaliação'));
    await page.locator('[data-opy-compose]').click();
    await page.locator('.postText').fill('Minha publicação de avaliação <img src=x onerror=alert(1)>');
    await page.getByRole('button', { name: 'Publicar nesta prévia', exact: true }).click();
    await page.getByText('Minha publicação de avaliação <img src=x onerror=alert(1)>', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('Minha publicação de avaliação <img src=x onerror=alert(1)>', { exact: true }).waitFor();
    assert.equal(await page.locator('img[src=x]').count(), 0, 'Publicações devem ser texto, nunca HTML executável');
    await page.locator('[data-preview-like]').first().click();
    assert.equal(await page.locator('[data-preview-like]').first().getAttribute('aria-pressed'), 'true');
    await page.locator('.preview-post-actions').first().getByRole('button', { name: 'Comentar', exact: true }).click();
    await page.getByLabel('Seu comentário de avaliação').first().fill('Comentário local de avaliação');
    await page.getByRole('button', { name: 'Comentar nesta prévia' }).first().click();
    await page.getByText('Comentário local de avaliação', { exact: false }).waitFor();
    await page.locator('.postText').fill('Foto de avaliação');
    await page.locator('input[name="postPhotos[]"]').setInputFiles('public_html/assets/opy/etnias-logo.png');
    await page.locator('#preview-attachment img').waitFor();
    await page.getByRole('button', { name: 'Publicar nesta prévia', exact: true }).click();
    await page.reload();
    assert.equal(await page.locator('.preview-post-image').count(), 1, 'Foto persiste no navegador');
    await page.getByRole('button', { name: 'Opy', exact: true }).click();
    await page.locator('#opy-menu [data-opy-destination=grupos]').click();
    await page.getByRole('heading', { name: 'Grupos', exact: true }).waitFor();
    await page.locator('.opy-search input[name=query]').fill('Casa Opy');
    await page.locator('.opy-search button').click();
    await page.getByRole('heading', { name: 'Pesquisar no Etnias' }).waitFor();
    await page.getByRole('link', { name: 'Chat — mensagens' }).click();
    await page.getByRole('heading', { name: 'Chat', exact: true }).waitFor();
    await page.getByLabel('Sua mensagem de avaliação').fill('Mensagem apenas neste navegador');
    await page.getByRole('button', { name: 'Enviar nesta prévia' }).click();
    await page.getByText('Mensagem apenas neste navegador', { exact: true }).waitFor();
    await page.goto(base);
    await page.locator('.opy-bottom [data-opy-destination=etnia]').click();
    assert.equal(await page.locator('#opy-info').evaluate(d => d.open), true);
    await page.keyboard.press('Escape');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.getByRole('button', { name: 'Opy', exact: true }).click();
      await page.locator('#opy-menu [data-opy-destination=mercado]').click();
      await page.getByRole('heading', { name: 'Mercado', exact: true }).waitFor();
      assert.equal(await page.locator('.opy-bottom [aria-current=page]').count(), 1, 'Somente a área atual fica selecionada');
    }
    for (const href of await page.locator('a[href]').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))) {
      assert.ok(!/127\.0\.0\.1:809[789]|localhost|requests\.php|config\.php/.test(href), `Sem dependência do servidor local: ${href}`);
    }
    assert.deepEqual(failures, []);
    await capture('.impeccable/review/vercel-preview-mobile.png');
    await page.getByRole('link', { name: 'Abrir menu da conta' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Limpar meus dados de avaliação' }).click();
    await page.getByText('Seus dados de avaliação foram limpos deste navegador.').waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base);
    await capture('.impeccable/review/vercel-preview-desktop.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('.impeccable/review/vercel-preview-home-mobile.png');
    console.log('PASS prévia Vercel: publicação local, persistência, XSS, navegação, busca, chat, EtnIA pendente e telas 1440/390/320');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
