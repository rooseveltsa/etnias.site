// Writes only into the synthetic database and its separate writable test upload directory.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = 'http://127.0.0.1:8098';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const context = await browser.newContext();
    context.setDefaultTimeout(60000);
    await context.addCookies([{ name: 'user_id', value: 'opy-local-browser-validation', url: base }]);
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`${base}/home`);
    if (await page.locator('.cc-dismiss').isVisible()) await page.locator('.cc-dismiss').click();
    const text = `Ensaio de anexo Opy ${Date.now()}`;
    await page.locator('[data-opy-compose]').click();
    await page.locator('.postText').fill(text);
    await page.locator('#publisher-photos').setInputFiles(path.resolve(__dirname, '../../public_html/assets/opy/etnias-logo.png'));
    const saved = page.waitForResponse(r => r.url().includes('insert_new_post'));
    await page.locator('#publisher-button').click();
    const publication = await (await saved).json();
    assert.equal(publication.status, 200);
    const image = await page.evaluate(html => {
      const post = new DOMParser().parseFromString(html, 'text/html');
      return Array.from(post.querySelectorAll('img')).map(img => img.getAttribute('data-src') || img.getAttribute('src')).find(src => src && /upload\/photos\/20\d\d\//.test(src));
    }, publication.html);
    assert.ok(image, 'Publicação devolve o caminho da imagem enviada');
    const response = await context.request.get(new URL(image, base).href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /^image\//);
    assert.ok((await response.body()).length > 0);
    await page.waitForFunction(() => document.querySelector('.postText').value === '');
    await page.goto(`${base}/home`);
    await page.getByText(text, { exact: true }).first().waitFor();
    assert.ok((await page.content()).includes(image), 'Anexo persiste após recarregar o feed');
    assert.equal((await context.request.get(`${base}/upload/qa-executable.php`)).status(), 403);
    assert.equal((await context.request.get(`${base}/upload/qa-safe.zip`)).status(), 200, 'Anexos ZIP continuam disponíveis sem expor o ZIP do backup');
    console.log('PASS anexos: envio real, arquivo de imagem legível, persistência, ZIP permitido e execução PHP bloqueada');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
