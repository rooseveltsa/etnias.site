// Live de ponta a ponta: Ana transmite com a câmera falsa do Chromium (WHIP → MediaMTX), Beto assiste (WHEP) e,
// depois do encerramento, vê a gravação como vídeo da publicação. Precisa do servidor com OPY_LIVE_URL e do MediaMTX no ar.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const a = await browser.newContext({ locale: 'pt-BR', permissions: ['camera', 'microphone'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const b = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 900 } });
    const ana = await signIn(a, base), beto = await signIn(b, base);
    const pa = await a.newPage(), pb = await b.newPage();
    const errors = []; pa.on('pageerror', e => errors.push('ana: ' + e.message)); pb.on('pageerror', e => errors.push('beto: ' + e.message));
    await pa.goto(base + '/');
    const text = `Live de ensaio ${Date.now()}`;
    await pa.locator('.postText').fill(text);
    await pa.locator('#compose-tab-live').click();
    await pa.locator('#compose-live').getByText('Sua live, direto do aparelho').waitFor();
    await pa.getByRole('button', { name: 'Abrir câmera', exact: true }).click();
    await pa.getByRole('button', { name: 'Começar a transmitir', exact: true }).waitFor();
    assert.equal(await pa.locator('#live-flip').isVisible(), true, 'prévia permite virar a câmera');
    await pa.getByRole('button', { name: 'Começar a transmitir', exact: true }).click();
    await pa.locator('#live-pill').getByText('AO VIVO').waitFor({ timeout: 20000 });
    await pa.locator('#live-status').getByText('Você está ao vivo').waitFor();
    const own = pa.locator('.community-post').filter({ hasText: text });
    await own.getByText('Você está ao vivo', { exact: true }).waitFor();
    // Beto vê o card ao vivo e assiste: o vídeo tem de chegar com quadros reais pelo MediaMTX.
    await pb.goto(base + '/');
    const card = pb.locator('.community-post').filter({ hasText: text });
    await card.waitFor();
    await card.getByText(`${ana.name} está ao vivo agora`, { exact: true }).waitFor();
    await card.getByRole('button', { name: 'Assistir à live', exact: true }).click();
    await pb.locator('#live-viewer[open]').waitFor();
    await pb.waitForFunction(() => { const v = document.querySelector('#live-viewer video'); return v && v.readyState >= 2 && v.videoWidth > 0; }, null, { timeout: 20000 });
    const size = await pb.evaluate(() => { const v = document.querySelector('#live-viewer video'); return [v.videoWidth, v.videoHeight]; });
    assert.ok(size[0] > 0 && size[1] > 0, 'quadros de vídeo chegaram ao espectador: ' + size.join('x'));
    assert.equal(await pb.locator('.live-viewer-status').textContent(), '', 'sem aviso de erro enquanto conectado');
    // Outra live da mesma pessoa é recusada pelo servidor.
    const second = await pa.evaluate(async () => { const r = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'live_start' }) }); return r.status; });
    assert.equal(second, 409);
    await pb.getByRole('button', { name: 'Fechar', exact: true }).click();
    await pa.getByRole('button', { name: 'Encerrar live', exact: true }).click();
    await pa.locator('#live-status').getByText('Live encerrada. A gravação ficou na sua publicação.').waitFor({ timeout: 20000 });
    assert.equal(await pa.locator('#live-start').textContent(), 'Abrir câmera', 'estúdio volta ao início');
    await pb.getByRole('button', { name: 'Atualizar feed', exact: true }).click();
    await card.getByText('Gravação da live', { exact: true }).waitFor({ timeout: 20000 });
    const src = await card.locator('video.preview-post-video').getAttribute('src');
    assert.match(src, /^\/live\/recordings\/[a-f0-9-]{36}\/.+\.mp4$/);
    const head = await pb.evaluate(async url => { const r = await fetch(url, { method: 'HEAD' }); return { status: r.status, type: r.headers.get('content-type'), size: Number(r.headers.get('content-length')) }; }, src);
    assert.equal(head.status, 200); assert.equal(head.type, 'video/mp4'); assert.ok(head.size > 1000, 'gravação com conteúdo: ' + head.size + ' bytes');
    const anon = await fetch(base + src, { method: 'HEAD' });
    assert.equal(anon.status, 401, 'gravação exige sessão');
    assert.deepEqual(errors, [], "erros de página: " + errors.join(" | "));
    console.log('live-browser: OK (gravação', head.size, 'bytes, quadro', size.join('x') + ')');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
