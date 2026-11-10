// Mercado de ponta a ponta: membro anuncia com foto, o anúncio aparece primeiro na lista, outra pessoa avalia,
// "Tenho interesse" abre o chat com a mensagem sugerida (sem enviar) e o dono remove; em celular de 390px.
// Uso: OPY_PREVIEW_URL=http://127.0.0.1:PORTA CHROME_PATH=... node mercado-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8191';
if (!/^http:\/\/127\.0\.0\.1:/.test(base)) throw new Error('Rode só no servidor local.');
async function person(browser, username) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR' });
  const r = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'register', name: username, username, password: 'Test-only-2026', googleKey: username + '@example.com', phone: '11912345678' } });
  assert.equal(r.status(), 200, 'cadastro de ' + username);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { page, errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const id = Date.now().toString(36);
  const seller = await person(browser, 'vende' + id), buyer = await person(browser, 'compra' + id);
  const s = seller.page, b = buyer.page;
  await s.setContent('<body style="margin:0;background:#bd171c"></body>');
  const photo = { name: 'cesto.png', mimeType: 'image/png', buffer: await s.screenshot({ clip: { x: 0, y: 0, width: 300, height: 300 } }) };
  await s.goto(base + '/mercado/');
  await s.getByRole('link', { name: 'Anunciar no Mercado' }).click();
  const title = 'Cesto de teste ' + id;
  await s.getByLabel('Título').fill(title);
  await s.getByLabel('Descrição').fill('Feito à mão com palha.');
  await s.getByLabel('Preço').fill('A combinar');
  await s.getByLabel('Categoria').selectOption('Artesanato');
  await s.getByLabel('Fotos (até 4)').setInputFiles([photo]);
  await s.locator('.market-photos figure').waitFor();
  await s.getByRole('button', { name: 'Publicar anúncio' }).click();
  await s.locator('.area-detail h1', { hasText: title }).waitFor();
  assert.equal(await s.locator('.area-gallery img').count(), 1, 'foto no anúncio');
  assert.equal(await s.getByRole('button', { name: 'Tenho interesse' }).count(), 0, 'dono não vê Tenho interesse');
  assert.equal(await s.locator('.market-review-form').count(), 0, 'dono não avalia');

  await b.goto(base + '/mercado/');
  const first = b.locator('.area-card').first();
  assert.match(await first.textContent(), new RegExp(title), 'anúncio de membro primeiro');
  await first.click();
  await b.locator('.market-stars-row label[for=market-star-4]').click();
  await b.getByLabel('Comentário (opcional)').fill('Muito bonito.');
  await b.getByRole('button', { name: 'Enviar avaliação' }).click();
  await b.getByRole('button', { name: 'Atualizar avaliação' }).waitFor();
  assert.match(await b.locator('.market-rating').textContent(), /4 · 1 avaliação/);
  assert.ok(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal em 390px');
  await b.getByRole('button', { name: 'Tenho interesse' }).click();
  await b.waitForURL(u => String(u).includes('/chat/?p='));
  await b.waitForFunction(t => document.querySelector('#chat-text')?.value.includes(t), title);
  assert.equal(await b.evaluate(() => document.querySelectorAll('#chat-log .chat-bubble').length), 0, 'nada foi enviado');

  await s.reload(); s.once('dialog', d => d.accept());
  await s.getByRole('button', { name: 'Remover anúncio' }).click();
  await s.waitForURL(u => !String(u).includes('id='));
  await s.locator('.area-card').first().waitFor();
  assert.equal(await s.locator('.area-card', { hasText: title }).count(), 0, 'anúncio removido');
  assert.deepEqual([...seller.errors, ...buyer.errors], []);
  await browser.close();
  console.log('PASS mercado: anunciar com foto, aparecer primeiro, avaliar, interesse no chat sem enviar e remover.');
})().catch(e => { console.error(e); process.exit(1); });
