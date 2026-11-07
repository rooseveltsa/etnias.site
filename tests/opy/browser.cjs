const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    for (const theme of ['sunshine', 'wowonder']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(`http://127.0.0.1:8097/preview?theme=${theme}`);
      await page.getByRole('button', { name: 'Opy', exact: true }).click();
      assert.equal(await page.locator('#opy-menu').evaluate(d => d.open), true, 'Opy abre como diálogo');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#opy-menu').evaluate(d => d.open), false);
      assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Opy', 'Escape devolve o foco');
      await page.locator('.opy-bottom').getByRole('button', { name: /EtnIA/ }).click();
      assert.equal(await page.locator('#opy-info').evaluate(d => d.open), true);
      assert.match(await page.locator('#opy-info-description').textContent(), /ainda não/);
      await page.getByRole('button', { name: 'Entendi', exact: true }).click();
      assert.match(await page.locator('.opy-bottom').getByRole('link', { name: 'Saberes' }).getAttribute('href'), /link1=saberes/);
      await page.locator('.postText').fill('Meu rascunho');
      let dropdownPrompts = 0;
      const acceptDropdownPrompt = d => { dropdownPrompts++; d.accept(); };
      page.on('dialog', acceptDropdownPrompt);
      await page.locator('.notification-container > a').click();
      page.off('dialog', acceptDropdownPrompt);
      assert.equal(dropdownPrompts, 0, 'Abrir notificações não pede para descartar rascunho');
      assert.equal(await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        dispatchEvent(event);
        return event.defaultPrevented;
      }), true, 'Proteção de saída continua ativa após abrir notificações');
      const more = page.getByRole('button', { name: 'Mais opções', exact: true });
      assert.equal(await page.locator('.sun_pub_more').isVisible(), false, 'Opções secundárias começam recolhidas');
      await more.click();
      assert.equal(await page.locator('.sun_pub_more').isVisible(), true);
      await page.locator('[data-opy-compose]').click();
      assert.equal(await page.locator('.postText').inputValue(), 'Meu rascunho');
      assert.equal(await page.locator('.postText').evaluate(e => e === document.activeElement), true);
      page.once('dialog', d => d.dismiss());
      await page.locator('[data-opy-feed]').click();
      assert.equal(await page.locator('.postText').inputValue(), 'Meu rascunho', 'Cancelar atualização preserva rascunho');
      await page.locator('.postText').fill('');
      await page.locator('.opy-search input[name=query]').fill('povos & saberes');
      const request = page.waitForRequest(r => r.url().includes('link1=search'));
      await page.locator('.opy-search button').click();
      assert.equal(new URL((await request).url()).searchParams.get('query'), 'povos & saberes');
      await page.goto(`http://127.0.0.1:8097/preview?theme=${theme}`);
      fs.mkdirSync('.impeccable/review', { recursive: true });
      await page.screenshot({ path: `.impeccable/review/${theme}-desktop.png`, fullPage: true });
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Sem overflow a ${width}px`);
        await page.getByRole('button', { name: 'Opy', exact: true }).click();
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#opy-menu').evaluate(d => d.contains(document.activeElement)), true);
        await page.keyboard.press('Escape');
        if (width === 390) await page.screenshot({ path: `.impeccable/review/${theme}-mobile.png`, fullPage: true });
      }
      console.log(`PASS ${theme}: menu, foco, indisponibilidade, compositor, rascunho, busca, desktop e celular`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
