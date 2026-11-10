// Only the synthetic accounts in the isolated localhost:8098 database.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8098';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const contexts = [];
    async function signIn(username, recipient) {
      const context = await browser.newContext();
      contexts.push(context);
      context.setDefaultTimeout(60000);
      await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const response = await context.request.post(`${base}/requests.php?f=login`, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, form: { username, password: 'Opy-local-2026!' }, timeout: 60000 });
      assert.equal((await response.json()).status, 200);
      const page = await context.newPage();
      await page.goto(`${base}/messages/${recipient}`);
      if (await page.locator('.cc-dismiss').isVisible()) await page.locator('.cc-dismiss').click();
      await page.locator('#sendMessage:not([disabled])').waitFor();
      return page;
    }
    const sender = await signIn('opy_teste', 2);
    const text = `Mensagem de ensaio Etnias ${Date.now()}`;
    await sender.locator('#sendMessage').fill(text);
    const sent = sender.waitForResponse(r => r.url().includes('s=send_message'));
    await sender.locator('form.sendMessages .send-button').click();
    const result = await (await sent).json();
    assert.equal(result.status, 200);
    assert.ok(result.html.includes(text), 'Remetente recebe confirmação da mensagem real');
    const recipient = await signIn('opy_parente', 1);
    await recipient.getByText(text, { exact: true }).first().waitFor();
    console.log('PASS mensagens: duas contas autenticadas, envio pelo formulário e leitura pelo destinatário');
    for (const context of contexts) await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
