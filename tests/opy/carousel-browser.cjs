// Carrossel de ponta a ponta: escolher 3 fotos no compositor, ver as miniaturas, tirar uma, publicar e navegar no feed.
// Uso: OPY_PREVIEW_URL=http://127.0.0.1:PORTA CHROME_PATH=... node carousel-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8117';
if (!/^http:\/\/127\.0\.0\.1:/.test(base)) throw new Error('Rode só no servidor local.');
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const username = 'carrossel' + Date.now().toString(36);
  const auth = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'register', name: 'Teste Carrossel', username, password: 'Test-only-2026', googleKey: username + '@example.com', phone: '11912345678' } });
  assert.equal(auth.status(), 200, 'cadastro');
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // Três fotos de cores diferentes, geradas pelo próprio navegador.
  const shots = [];
  for (const color of ['#bd171c', '#176b87', '#2c6b53']) { await page.setContent(`<body style="margin:0;background:${color}"></body>`); shots.push({ name: color.slice(1) + '.png', mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 400 } }) }); }
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.locator('#publisher-photo').setInputFiles(shots);
  await page.waitForSelector('#photo-slot .compose-thumb >> nth=2');
  assert.match(await page.locator('#photo-status').textContent(), /3 fotos em carrossel/);
  await page.locator('#photo-slot .compose-thumb-remove').nth(1).dispatchEvent('click');
  await page.waitForFunction(() => document.querySelectorAll('#photo-slot .compose-thumb').length === 2);
  await page.locator('#publisher-photo').setInputFiles([shots[1]]);
  await page.waitForFunction(() => document.querySelectorAll('#photo-slot .compose-thumb').length === 3);
  await page.locator('#preview-text').fill('Carrossel de teste');
  await page.locator('#opy-compose [type=submit]').dispatchEvent('click');
  const post = page.locator('.community-post').filter({ hasText: 'Carrossel de teste' }).first();
  await post.waitFor();
  assert.equal(await post.locator('.post-media-slide').count(), 3, 'três fotos no post');
  assert.equal(await post.locator('.post-media-counter').textContent(), '1/3');
  assert.equal(await post.locator('#photo-slot').count(), 0);
  assert.ok(await post.locator('.post-media-arrow.is-prev').isHidden(), 'sem seta para trás na primeira');
  await post.locator('.post-media-arrow.is-next').click();
  await page.waitForFunction(() => document.querySelector('.community-post .post-media-counter')?.textContent === '2/3');
  assert.ok(await page.locator('#photo-slot').isHidden(), 'compositor limpo');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS carrossel: escolher, remover, adicionar, publicar, contador e setas.');
})().catch(e => { console.error(e); process.exit(1); });
