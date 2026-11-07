const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const first = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signIn(first, base);
    await signIn(second, base);
    const page = await first.newPage(), other = await second.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(base + '/etnia/');
    await page.getByRole('link', { name: 'Precisa de conteúdo? Peça à IAra' }).click();
    await page.getByRole('heading', { name: 'Pedir à IAra', exact: true }).waitFor();
    await page.getByLabel('O que você precisa?').fill('Preciso de um card <img src=x onerror=alert(1)> para divulgar o curso de letramento');
    await page.getByRole('button', { name: 'Registrar pedido', exact: true }).click();
    await page.locator('.iara-ticket h3').filter({ hasText: 'Conteúdo estático' }).waitFor();
    assert.equal(await page.locator('img[src=x]').count(), 0, 'Pedido deve ser texto, nunca HTML');
    const protocol = await page.locator('.iara-ticket small').first().textContent();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar briefing', exact: true }).click();
    const download = await downloadEvent;
    assert.match(await fs.readFile(await download.path(), 'utf8'), /conteudo-estatico/);
    await page.reload();
    await page.getByText(protocol, { exact: true }).waitFor();
    await other.goto(base + '/iara/');
    await other.getByText('Você ainda não tem pedidos. Descreva o primeiro acima.').waitFor();
    assert.equal(await other.locator('.iara-ticket').count(), 0);
    const pii = 'Preciso de um card com contato pessoa@example.com';
    await page.getByLabel('O que você precisa?').fill(pii);
    await page.getByRole('button', { name: 'Registrar pedido', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Remova e-mail' }).waitFor();
    assert.equal(await page.getByLabel('O que você precisa?').inputValue(), pii, 'Falha deve preservar o pedido em edição');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Sem rolagem horizontal em ${width}px`);
    }
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
    await page.locator('.iara-ticket').getByText('Cancelado', { exact: true }).waitFor();
    await page.reload();
    await page.locator('.iara-ticket').getByText('Cancelado', { exact: true }).waitFor();
    assert.deepEqual(failures, []);
    console.log('PASS navegador IAra: acesso pela EtnIA, pedido privado, briefing, persistência, cancelamento, texto seguro, rascunho preservado e 320/390px.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
