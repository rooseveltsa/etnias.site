// Synthetic integration only. Never point this test at a database with real accounts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8098';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const response = await page.goto(`${base}/welcome`);
    assert.equal(response.status(), 200);
    await page.locator('#login [name=username]').fill('opy_teste');
    await page.locator('#login [name=password]').fill('senha-incorreta-teste');
    let loginResponse = page.waitForResponse(r => r.url().includes('f=login'));
    await page.locator('#login button[type=submit]').click();
    let result = await (await loginResponse).json();
    assert.ok(result.errors, 'Senha incorreta deve ser recusada');
    await page.locator('#login [name=password]').fill('Opy-local-2026!');
    loginResponse = page.waitForResponse(r => r.url().includes('f=login'));
    await page.locator('#login button[type=submit]').click();
    result = await (await loginResponse).json();
    assert.equal(result.status, 200, 'Login real com bcrypt deve funcionar');
    await page.waitForURL(url => !url.pathname.includes('welcome'));
    await page.locator('[data-opy-compose]').waitFor();
    const homeTitle = await page.title();
    for (const route of ['home', 'search', 'groups', 'pages', 'blogs', 'products', 'events', 'messages', 'setting', 'saberes', 'guardiao', 'fotografos', 'musica', 'doar']) {
      await page.goto(`${base}/index.php?link1=${route}`);
      const expectedTitle = await page.title();
      if (route !== 'home') assert.notEqual(expectedTitle, homeTitle, `Tela ${route} deve abrir seu próprio conteúdo`);
      const response = await page.goto(`${base}/${route}`);
      assert.equal(response.status(), 200, `Rota ${route} retorna HTTP 200`);
      assert.ok((await page.content()).length > 10000, `Rota ${route} não pode resultar em tela vazia`);
      assert.equal(await page.locator('body.opy-enabled').count(), 1, `Rota ${route} mantém sessão e interface`);
      assert.equal(await page.title(), expectedTitle, `URL amigável ${route} deve abrir a mesma tela da rota PHP`);
      console.log(`PASS rota ${route}`);
    }
    for (const path of ['config.php', '_diag.php', 'wowonder.sql', 'enviar-etnias.zip', 'php.ini', 'error_log', 'nodejs/config.json']) {
      const response = await context.request.get(`${base}/${path}`);
      assert.equal(response.status(), 403, `Arquivo privado bloqueado: ${path}`);
    }
    await page.goto(`${base}/logout`);
    await page.goto(`${base}/home`);
    assert.equal(await page.locator('[data-opy-compose]').count(), 0, 'Sair deve encerrar acesso autenticado');
    console.log('PASS autenticação, rejeição de senha inválida, rotas, arquivos privados e saída');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
