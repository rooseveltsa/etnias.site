// Jornadas da missão "Live Experience": Ana (anfitriã, celular, 9:16), Beto (espectador que vira convidado) e Carla
// (espectadora que segue Ana). Tudo com câmera e microfone falsos do Chromium e o MediaMTX local.
// Precisa do servidor com OPY_LIVE_URL e do MediaMTX (ver tests/opy/live-browser.cjs).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { registerAccount } = require('./session.cjs');
// Nomes distintos: cliques por nome não podem ficar ambíguos.
async function signInAs(context, name) { const account = await registerAccount(base, { name }); if (account.status !== 200) throw new Error(account.data.error || 'cadastro recusado'); await context.addCookies([{ name: account.cookieName, value: account.cookieValue, url: base }]); return account; }
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + String(e.message || e).split('\n')[0].slice(0, 180)]); } };
const framesOf = page => page.evaluate(() => { const v = document.querySelector('#live-viewer video.live-main'); return v ? [v.videoWidth, v.videoHeight, v.readyState] : [0, 0, 0]; });
async function api(cookie, body) { const r = await fetch(base + '/api/community', { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; }
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const mk = async (mobile) => browser.newContext({ locale: 'pt-BR', permissions: ['camera', 'microphone'], ...(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }) });
    const ca = await mk(true), cb = await mk(false), cc = await mk(true);
    const stamp = Date.now().toString(36).slice(-4);
    const ana = await signInAs(ca, 'Ana Live ' + stamp), beto = await signInAs(cb, 'Beto Live ' + stamp), carla = await signInAs(cc, 'Carla Live ' + stamp);
    const pa = await ca.newPage(), pb = await cb.newPage(), pc = await cc.newPage();
    const errors = []; for (const [p, n] of [[pa, 'ana'], [pb, 'beto'], [pc, 'carla']]) p.on('pageerror', e => errors.push(n + ': ' + e.message));
    // Carla segue Ana: é a seguidora elegível para o aviso.
    assert.equal((await api(carla.cookie, { action: 'follow', authorKey: 'id:' + ana.data.me.id })).status, 200);
    const text = 'Live da jornada ' + Date.now();
    let postId = '';

    await step('1. Ana inicia uma live vertical (9:16) pelo celular', async () => {
      // Live pela tela Criar (padrão Instagram): título, formato e o botão de transmitir.
      await pa.goto(base + '/'); await pa.locator('#compose-tab-live').click(); await pa.locator('#opy-creator[open][data-mode="live"]').waitFor();
      if ((await pa.locator('#creator-format').textContent()).trim() !== '9:16') await pa.locator('#creator-format').click();
      await pa.waitForFunction(() => { const v = document.getElementById('live-preview'); return v && v.videoWidth > 0; }, null, { timeout: 15000 });
      await pa.fill('#creator-title', text); await pa.locator('#creator-shutter').click();
      await pa.locator('#live-pill').getByText('AO VIVO').waitFor({ timeout: 25000 });
      const canvas = await pa.evaluate(() => { const c = document.querySelector('#live-canvas'); return [c.width, c.height, c.hidden]; });
      assert.deepEqual(canvas, [720, 1280, false], 'quadro composto vertical visível no estúdio');
      postId = await pa.evaluate(() => window.OpyShared.liveSession.postId);
      assert.match(postId, /^[a-f0-9-]{36}$/);
    });
    await step('2. Beto entra como espectador e recebe vídeo', async () => {
      await pb.goto(base + '/'); const card = pb.locator('.community-post').filter({ hasText: text }); await card.waitFor();
      await card.getByRole('button', { name: 'Assistir à live', exact: true }).click();
      await pb.locator('#live-viewer[open]').waitFor();
      await pb.waitForFunction(() => { const v = document.querySelector('#live-viewer video.live-main'); return v && v.readyState >= 2 && v.videoWidth > 0; }, null, { timeout: 25000 });
      assert.equal(await pb.locator('#live-viewer').getAttribute('data-format'), 'portrait');
    });
    await step('3. Comentários chegam em tempo real nos dois lados', async () => {
      await pb.locator('#live-viewer .live-chat-form input').fill('Olá do Beto!'); await pb.locator('#live-viewer .live-chat-form button').click();
      await pa.locator('#live-host-chat').getByText('Olá do Beto!').waitFor({ timeout: 8000 });
      await pa.locator('#live-host-text').fill('Bem-vindo, Beto!'); await pa.locator('#live-host-send').click();
      await pb.locator('#live-viewer .live-chat').getByText('Bem-vindo, Beto!').waitFor({ timeout: 8000 });
      const frames = await framesOf(pb); assert.ok(frames[2] >= 2, 'o player não reiniciou com o bate-papo');
    });
    await step('4. Audiência consistente (1 e depois 2 espectadores)', async () => {
      await pa.waitForFunction(() => /^1 pessoa/.test(document.querySelector('#live-viewers').textContent), null, { timeout: 20000 });
      await pc.goto(base + '/'); await pc.locator(`button[aria-label="Assistir à live de ${ana.name}"]`).first().click();
      await pc.locator('#live-viewer[open]').waitFor();
      await pa.waitForFunction(() => /^2 pessoas/.test(document.querySelector('#live-viewers').textContent), null, { timeout: 25000 });
      await pb.waitForFunction(() => /^2 pessoas/.test(document.querySelector('#live-viewer .live-count').textContent), null, { timeout: 10000 });
    });
    await step('5. Ana convida Beto (está na audiência) pelo estúdio', async () => {
      await pa.getByRole('button', { name: 'Adicionar participante', exact: true }).click();
      await pa.locator('.live-dialog .live-people').getByText(beto.name).click();
      await pa.locator('#live-requests').getByText('Convite enviado a ' + beto.name).waitFor({ timeout: 8000 });
    });
    await step('6 e 7. Beto recebe o convite, vê a prévia e entra com câmera e microfone autorizados', async () => {
      await pb.locator('#live-viewer .live-banner').getByText('convidou você').waitFor({ timeout: 8000 });
      await pb.getByRole('button', { name: 'Entrar na live', exact: true }).click();
      await pb.locator('.live-dialog .live-guest-preview').waitFor();
      await pb.waitForFunction(() => { const v = document.querySelector('.live-dialog .live-guest-preview'); return v && v.srcObject; }, null, { timeout: 10000 });
      await pb.getByRole('button', { name: 'Entrar com câmera e microfone', exact: true }).click();
      await pb.locator('#live-viewer .live-guest-bar').getByText('Você está participando').waitFor({ timeout: 10000 });
    });
    await step('8. Anfitriã e convidado aparecem juntos (quadro composto) e o público continua recebendo', async () => {
      await pa.waitForFunction(() => { const v = [...document.querySelectorAll('video')].find(x => x.style.opacity === '0'); return v && v.videoWidth > 0; }, null, { timeout: 25000 });
      await pb.waitForFunction(() => { const v = document.querySelector('#live-viewer video.live-main'); return v && v.videoWidth > 0; }, null, { timeout: 25000 });
      await pa.locator('#live-requests').getByText(beto.name + ' está participando').waitFor({ timeout: 10000 });
      const f = await framesOf(pc); assert.ok(f[0] > 0, 'Carla segue recebendo vídeo: ' + f.join('x'));
    });
    await step('9. Convidado desliga o microfone e a anfitriã vê', async () => {
      await pb.locator('#live-viewer .live-guest-bar').getByRole('button', { name: 'Microfone', exact: true }).click();
      await pa.locator('#live-requests').getByText('sem microfone').waitFor({ timeout: 10000 });
    });
    await step('10 e 11. Anfitriã remove o convidado e a live continua', async () => {
      await pa.locator('#live-requests').getByRole('button', { name: 'Remover', exact: true }).click();
      await pb.waitForFunction(() => document.querySelector('#live-viewer .live-guest-bar').hidden, null, { timeout: 12000 });
      await pb.waitForFunction(() => { const v = document.querySelector('#live-viewer video.live-main'); return v && v.videoWidth > 0; }, null, { timeout: 25000 });
      assert.ok((await framesOf(pc))[0] > 0, 'Carla continua assistindo');
      assert.equal(await pa.locator('#live-pill').textContent(), 'AO VIVO');
    });
    await step('12 e 13. Carla pede para participar e Ana aceita', async () => {
      await pc.getByRole('button', { name: 'Pedir para participar', exact: true }).click();
      await pa.locator('#live-requests').getByText(carla.name + ' pediu para participar').waitFor({ timeout: 10000 });
      await pa.locator('#live-requests').getByRole('button', { name: 'Aceitar', exact: true }).click();
      await pc.locator('#live-viewer .live-banner').getByText('convidou você').waitFor({ timeout: 10000 });
      await pc.getByRole('button', { name: 'Entrar na live', exact: true }).click();
      await pc.getByRole('button', { name: 'Entrar com câmera e microfone', exact: true }).click();
      await pa.locator('#live-requests').getByText(carla.name + ' está participando').waitFor({ timeout: 15000 });
    });
    await step('14 e 15. Convidada sai por conta própria e a live permanece ativa', async () => {
      await pc.getByRole('button', { name: 'Sair da participação', exact: true }).click();
      await pa.waitForFunction(n => !document.querySelector('#live-requests').textContent.includes(n + ' está participando'), carla.name, { timeout: 12000 });
      await pc.waitForFunction(() => { const v = document.querySelector('#live-viewer video.live-main'); return v && v.videoWidth > 0; }, null, { timeout: 25000 });
      assert.equal(await pa.locator('#live-pill').textContent(), 'AO VIVO');
    });
    await step('16. Seguidora elegível recebe o aviso interno', async () => {
      const r = await fetch(base + '/api/community?view=notifications', { headers: { cookie: carla.cookie } }).then(r => r.json());
      assert.ok(r.items.some(i => i.kind === 'live' && i.text.includes(ana.name)), 'item "está ao vivo agora" para quem segue');
      const other = await fetch(base + '/api/community?view=notifications', { headers: { cookie: beto.cookie } }).then(r => r.json());
      assert.ok(!other.items.some(i => i.kind === 'live'), 'quem não segue não recebe');
    });
    await step('17. A live aparece no anel de stories e no perfil', async () => {
      const home = await cb.newPage(); await home.goto(base + '/');
      await home.locator(`button[aria-label="Assistir à live de ${ana.name}"]`).first().waitFor({ timeout: 10000 });
      await home.goto(base + '/perfil/?u=' + encodeURIComponent('id:' + ana.data.me.id));
      await home.getByRole('button', { name: 'Assistir ao vivo', exact: true }).waitFor({ timeout: 10000 }); await home.close();
    });
    await step('20. Encerrar remove os indicadores AO VIVO', async () => {
      await pa.locator('#live-stop').click();
      await pa.waitForFunction(() => document.getElementById('live-status').textContent.includes('Live encerrada'), null, { timeout: 25000 });
      await pb.locator('#live-viewer .live-viewer-status').getByText('Esta live terminou').waitFor({ timeout: 10000 });
      const home = await cb.newPage(); await home.goto(base + '/');
      await home.locator('.community-post').first().waitFor(); await home.waitForTimeout(1000);
      assert.equal(await home.locator(`button[aria-label="Assistir à live de ${ana.name}"]`).count(), 0, 'anel sem AO VIVO'); await home.close();
    });
    await step('18. Formato horizontal 16:9', async () => {
      await pb.getByRole('button', { name: 'Fechar', exact: true }).click().catch(() => {});
      await pa.goto(base + '/'); await pa.locator('#compose-tab-live').click(); await pa.locator('#opy-creator[open][data-mode="live"]').waitFor();
      if ((await pa.locator('#creator-format').textContent()).trim() !== '16:9') await pa.locator('#creator-format').click();
      await pa.waitForFunction(() => { const v = document.getElementById('live-preview'); return v && v.videoWidth > 0; }, null, { timeout: 15000 })
        .catch(async () => { throw new Error('câmera da live: ' + JSON.stringify(await pa.evaluate(() => { const v = document.getElementById('live-preview'); return { w: v.videoWidth, src: !!v.srcObject, live: !!document.querySelector('#opy-creator[data-step="live"]'), msg: document.getElementById('creator-camera-msg').textContent, status: document.getElementById('live-status').textContent }; }))); });
      await pa.locator('#creator-shutter').click();
      await pa.locator('#live-pill').getByText('AO VIVO').waitFor({ timeout: 25000 });
      assert.deepEqual(await pa.evaluate(() => { const c = document.querySelector('#live-canvas'); return [c.width, c.height]; }), [1280, 720]);
      await pb.goto(base + '/'); await pb.locator(`button[aria-label="Assistir à live de ${ana.name}"]`).first().click();
      await pb.waitForFunction(() => document.querySelector('#live-viewer')?.getAttribute('data-format') === 'landscape', null, { timeout: 10000 });
      await pa.locator('#live-stop').click(); await pa.waitForFunction(() => document.getElementById('live-status').textContent.includes('Live encerrada'), null, { timeout: 25000 });
    });
    assert.deepEqual(errors, [], 'erros de página: ' + errors.join(' | '));
  } finally { await browser.close(); }
  for (const [s, n] of results) console.log(s.padEnd(7), n);
  const failed = results.filter(r => r[0] !== 'OK').length;
  console.log(failed ? `${failed} jornada(s) com falha` : 'todas as jornadas de live passaram');
  console.log('Não automatizado: queda de conexão do convidado/anfitriã (reconexão WHIP testada por inspeção de código) e push no aparelho (sem inscrição nos testes).');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
