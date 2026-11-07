const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const second = await browser.newContext();
    await signIn(first, base); await signIn(second, base);
    const page = await first.newPage(), other = await second.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/');
    await page.getByRole('button', { name: '+ Criar story', exact: true }).click();
    await page.locator('#story-text').fill('Foto de teste');
    await page.locator('#story-media').setInputFiles({ name: 'story.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=', 'base64') });
    await page.getByRole('button', { name: 'Publicar story', exact: true }).click();
    await page.locator('.story-thumbnail').waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Ver story de' }).click();
    await page.waitForFunction(() => document.querySelector('#story-viewer-media img')?.naturalWidth > 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#story-viewer').open);
    assert.equal(await page.locator('#story-viewer-media img').count(), 0);
    await other.goto(base + '/');
    await other.getByRole('button', { name: 'Ver story de' }).click();
    assert.equal(await other.locator('#story-delete').isVisible(), false);
    await other.waitForFunction(() => document.querySelector('#story-viewer-media img')?.naturalWidth > 0);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Sem rolagem horizontal em ${width}px`);
    }
    await page.getByRole('button', { name: '+ Criar story', exact: true }).click();
    await page.locator('#story-text').fill('Rascunho preservado');
    await page.locator('#story-media').setInputFiles({ name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('invalida') });
    await page.getByRole('button', { name: 'Publicar story', exact: true }).click();
    await page.locator('#story-status').filter({ hasText: 'não corresponde' }).waitFor();
    assert.equal(await page.locator('#story-text').inputValue(), 'Rascunho preservado');
    assert.equal(await page.locator('#story-media').evaluate(el => el.files.length), 1);
    await page.getByRole('button', { name: 'Remover arquivo', exact: true }).click();
    await page.locator('#story-cancel').click();
    await page.getByRole('button', { name: 'Ver story de' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Excluir story', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#story-viewer').open);
    await other.reload();
    assert.equal(await other.getByRole('button', { name: 'Ver story de' }).count(), 0);
    // Real browser encoding exercises video upload, decoding, playback and closing.
    const video = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d'); context.fillStyle = 'red'; context.fillRect(0, 0, 32, 32);
      const stream = canvas.captureStream(10), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = event => chunks.push(event.data);
      const finished = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (let frame = 0; frame < 10; frame++) { context.fillStyle = frame % 2 ? 'red' : 'blue'; context.fillRect(0, 0, 32, 32); await new Promise(resolve => setTimeout(resolve, 100)); }
      recorder.stop(); await finished;
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    });
    await page.getByRole('button', { name: '+ Criar story', exact: true }).click();
    await page.locator('#story-text').fill('');
    await page.locator('#story-media').setInputFiles({ name: 'story.webm', mimeType: 'video/webm', buffer: Buffer.from(video) });
    await page.getByRole('button', { name: 'Publicar story', exact: true }).click();
    await page.getByRole('button', { name: 'Ver story de' }).click();
    await page.waitForFunction(() => document.querySelector('#story-viewer-media video')?.readyState >= 2);
    await page.locator('#story-viewer-media video').evaluate(el => el.play());
    await page.locator('#story-close').click();
    assert.equal(await page.locator('#story-viewer-media video').count(), 0);
    await page.getByRole('button', { name: 'Ver story de' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Excluir story', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#story-viewer').open);
    assert.deepEqual(errors, []);
    console.log('PASS stories navegador: foto/vídeo, reprodução, duas contas, recarga, exclusão, Escape, rascunho preservado e 320/390/1440px.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
