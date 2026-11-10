// Only run against the isolated local validation database described in docs/atualizacao-opy.md.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const theme of ['sunshine', 'wowonder']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addCookies([{ name: 'user_id', value: 'opy-local-browser-validation', url: 'http://127.0.0.1:8098' }, { name: 'cookieconsent_status', value: 'dismiss', url: 'http://127.0.0.1:8098' }]);
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`http://127.0.0.1:8098/index.php?theme=${theme}`);
      assert.equal(response.status(), 200);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.evaluate(() => {
        const middle = document.querySelector('.middlecol').getBoundingClientRect();
        const right = document.querySelector('.rightcol').getBoundingClientRect();
        return right.x >= middle.right - 1;
      }), true, 'As três colunas do feed permanecem na mesma linha');
      await page.getByRole('button', { name: 'Opy', exact: true }).click();
      assert.equal(await page.locator('#opy-menu').evaluate(d => d.open), true);
      await page.keyboard.press('Escape');
      await page.locator('[data-opy-compose]').click();
      assert.equal(await page.locator('.postText').evaluate(e => e === document.activeElement), true);
      await page.locator('.postText').fill('Rascunho de validação do Etnias');
      page.once('dialog', d => d.dismiss());
      await page.locator('[data-opy-feed]').click();
      assert.equal(await page.locator('.postText').inputValue(), 'Rascunho de validação do Etnias');
      await page.locator('.postText').fill('');
      await page.locator('.postText').blur();
      await page.evaluate(() => window.Wo_HidePosInfo());
      await page.waitForFunction(() => !window.jQuery || window.jQuery(':animated').length === 0);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `.impeccable/review/${theme}-integration-desktop.png`, fullPage: true });
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Aplicação sem overflow a ${width}px`);
        assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('.sun_pub_mid_foot .poster-left-buttons .btn')).every(e => parseFloat(getComputedStyle(e).fontSize) >= 13 && e.getBoundingClientRect().height >= 44)), true, 'Anexos têm rótulos legíveis e alvos de toque');
        assert.equal(await page.locator('.postText').evaluate(e => {
          const css = getComputedStyle(e);
          const contentHeight = e.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
          return contentHeight >= 3 * parseFloat(css.lineHeight);
        }), true, 'Compositor comporta o prompt inteiro em tela pequena');
        assert.equal(await page.locator('.postText').evaluate(e => {
          const author = e.parentElement.querySelector('.sun_pub_name');
          return !author || e.getBoundingClientRect().top + parseFloat(getComputedStyle(e).paddingTop) >= author.getBoundingClientRect().bottom + 4;
        }), true, 'Nome do autor não sobrepõe o texto da publicação');
        await page.evaluate(() => scrollTo(0, 0));
        if (width === 390) await page.screenshot({ path: `.impeccable/review/${theme}-integration-mobile.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator('[data-opy-compose]').click();
      const content = `Publicação de teste Opy ${theme} — ${Date.now()}`;
      await page.locator('.postText').fill(content);
      const publicationResponse = page.waitForResponse(r => r.url().includes('insert_new_post'));
      await page.locator('#publisher-button').click();
      const publication = await (await publicationResponse).json();
      assert.equal(publication.status, 200, 'Publicação real aceita pelo backend local');
      assert.ok(publication.html.includes(content), 'Backend devolve a publicação criada');
      assert.deepEqual(errors, [], 'Sem exceções JavaScript no feed real');
      console.log(`PASS integração ${theme}: HTTP 200, menu, compositor, rascunho, publicação real, desktop, celular e JavaScript`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
