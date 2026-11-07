// E2E de chamadas: dois navegadores com câmera e microfone simulados conectam por WebRTC de verdade.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8117';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const a = await browser.newContext({ permissions: ['camera', 'microphone'] }), b = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    async function account(ctx, name) { const res = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'register', name, username: name.toLowerCase().replace(/ /g, '') + Date.now().toString(36), password: 'Test-only-2026', googleKey: name.replace(/ /g, '') + '@example.com', phone: '11912345678' } }); assert.equal(res.status(), 200); return (await res.json()).me; }
    const ana = await account(a, 'Ana Chamada'), beto = await account(b, 'Beto Chamada');
    const say = (ctx, to, text) => ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'dm', toKey: 'id:' + to.id, text, clientId: crypto.randomUUID() } });
    const pa = await a.newPage(), pb = await b.newPage();
    const errors = []; pa.on('pageerror', e => errors.push('A: ' + e.message)); pb.on('pageerror', e => errors.push('B: ' + e.message));

    // Sem mensagem de Beto, Ana não consegue ligar (regra contra chamadas de desconhecidos).
    await say(a, beto, 'Oi Beto');
    await pa.goto(base + '/chat/?p=' + encodeURIComponent('id:' + beto.id));
    await pa.locator('#chat-notice').filter({ hasText: 'Solicitação enviada' }).waitFor();
    assert.equal(await pa.locator('#chat-call-video').isVisible(), false, 'sem conversa aceita não há botão de ligar');

    await say(b, ana, 'Oi Ana, pode ligar');
    await pa.reload();
    await pa.locator('#chat-log').getByText('Oi Ana, pode ligar').waitFor();

    // 1. Vídeo: Beto está no feed (outra página) e recebe a chamada lá.
    await pb.goto(base + '/');
    await pa.locator('#chat-call-video').click();
    await pa.locator('#call-screen[data-mode=outgoing]').waitFor();
    await pb.locator('#call-screen[data-mode=incoming]').waitFor({ timeout: 15000 });
    assert.equal(await pb.locator('#call-name').textContent(), 'Ana Chamada');
    if (process.env.OPY_SCREENSHOTS) await pb.screenshot({ path: process.env.OPY_SCREENSHOTS + '/call-incoming.png' });
    await pb.getByRole('button', { name: 'Atender' }).click();
    await pa.locator('#call-screen[data-mode=active]').waitFor({ timeout: 20000 });
    await pb.locator('#call-screen[data-mode=active]').waitFor({ timeout: 20000 });
    // Vídeo remoto chega com quadros reais nas duas pontas.
    for (const page of [pa, pb]) await page.waitForFunction(() => { const v = document.querySelector('.call-remote'); return v && v.srcObject && v.videoWidth > 0; }, null, { timeout: 15000 });
    if (process.env.OPY_SCREENSHOTS) await pb.screenshot({ path: process.env.OPY_SCREENSHOTS + '/call-active.png' });
    await pa.locator('.call-state').filter({ hasText: /^00:0\d$/ }).waitFor();
    // Microfone mudo é local e reversível.
    await pb.getByRole('button', { name: 'Microfone' }).click();
    assert.equal(await pb.locator('.call-btn.is-toggle').first().getAttribute('aria-pressed'), 'true');
    await pa.waitForTimeout(2200);
    await pa.getByRole('button', { name: 'Encerrar' }).click();
    await pb.locator('#call-screen[open]').waitFor({ state: 'detached', timeout: 1 }).catch(() => {});
    await pb.waitForFunction(() => !document.querySelector('#call-screen')?.open, null, { timeout: 15000 });
    await pa.locator('#chat-log .chat-call-pill').filter({ hasText: /Chamada de vídeo · \d+ s/ }).waitFor({ timeout: 10000 });

    // 2. Voz recusada: aparece como recusada nas duas conversas.
    await pb.goto(base + '/chat/?p=' + encodeURIComponent('id:' + ana.id));
    await pa.locator('#chat-call-audio').click();
    await pb.locator('#call-screen[data-mode=incoming][data-kind=audio]').waitFor({ timeout: 15000 });
    await pb.getByRole('button', { name: 'Recusar' }).click();
    await pa.waitForFunction(() => !document.querySelector('#call-screen')?.open, null, { timeout: 15000 });
    await pb.locator('#chat-log .chat-call-pill.is-missed').filter({ hasText: 'Chamada de voz recusada' }).waitFor({ timeout: 10000 });
    await pa.locator('#chat-log .chat-call-pill.is-missed').filter({ hasText: 'Chamada de voz recusada' }).waitFor({ timeout: 10000 });

    // 3. Layout mobile do chat sem estouro horizontal.
    const overflow = await pb.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, 'sem rolagem horizontal no celular');
    if (process.env.OPY_SCREENSHOTS) { await pa.screenshot({ path: process.env.OPY_SCREENSHOTS + '/chat-desktop.png' }); await pb.screenshot({ path: process.env.OPY_SCREENSHOTS + '/chat-mobile.png' }); }

    assert.deepEqual(errors, []);
    console.log('PASS E2E chamadas: regra de contato, vídeo WebRTC conectado com quadros nas duas pontas, chamada recebida em outra página, mudo, encerrar com registro de duração, voz recusada registrada nas duas conversas, mobile sem overflow.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
