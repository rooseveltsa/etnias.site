// Visualizador de stories no padrão Instagram/TikTok: celular (390×844, toque) e desktop (1280×800), contra o servidor local.
// Tela cheia real, barras por pessoa, tempo só com a mídia tocando (foto 5 s, vídeo pela duração), toques nos terços,
// segurar pausa e esconde a interface, botão e espaço pausam, digitar pausa, curtir, responder, menu (velocidade,
// copiar link, denunciar), compartilhar com cópia de link, troca de pessoa por arrasto (cubo), arrastar para baixo
// fecha, para cima abre a resposta, link direto ?story=, anel visto, movimento reduzido e bloqueio.
// Vídeo: OPY_STORY_VIDEO com um WebM curto (gerado com ffmpeg; o Chromium de teste não toca H.264).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn, registerAccount } = require('./session.cjs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const pngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=';
async function api(cookie, body) {
  const r = await fetch(base + '/api/community', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: base, cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const results = [], errors = [];
  const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + (e.message || e).toString().split('\n')[0].slice(0, 220)]); } };
  try {
    const stamp = Date.now().toString(36);
    const ana = await registerAccount(base, { name: 'Ana Story ' + stamp });
    const bia = await registerAccount(base, { name: 'Bia Story ' + stamp });
    const video = process.env.OPY_STORY_VIDEO && fs.existsSync(process.env.OPY_STORY_VIDEO) ? 'data:video/webm;base64,' + fs.readFileSync(process.env.OPY_STORY_VIDEO).toString('base64') : '';
    const b1 = (await api(bia.cookie, { action: 'story_create', text: 'Vídeo da Bia', media: video ? { name: 'b1.webm', data: video } : { name: 'b1.png', data: pngData } })).data.stories.find(s => s.text === 'Vídeo da Bia');
    const a1 = (await api(ana.cookie, { action: 'story_create', text: 'Primeiro story da Ana', media: { name: 'a1.png', data: pngData } })).data.stories.find(s => s.text === 'Primeiro story da Ana');
    const a2 = (await api(ana.cookie, { action: 'story_create', text: 'Segundo da Ana, só texto' })).data.stories.find(s => s.text === 'Segundo da Ana, só texto');
    assert.ok(a1 && a2 && b1, 'stories criados');

    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const me = await signIn(ctx, base);
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    const fill = (k = null) => page.evaluate(k2 => { const segs = [...document.querySelectorAll('#story-progress .sv-seg-fill')]; const f = k2 === null ? segs[Number(document.querySelector('#story-progress').getAttribute('aria-valuenow')) - 1] : segs[k2]; return parseFloat((f?.style.transform.match(/scaleX\(([\d.]+)\)/) || [])[1] || 0); }, k);
    const now = () => page.evaluate(() => Number(document.querySelector('#story-progress').getAttribute('aria-valuenow')));
    const author = () => page.locator('#story-viewer-author').textContent();
    const tapAt = async ratio => { const b = await page.locator('.sv-face-main').boundingBox(); await page.mouse.click(b.x + b.width * ratio, b.y + b.height * 0.5); };
    const drag = async (fx, fy, tx, ty, p = page) => { const b = await p.locator('.sv-face-main').boundingBox(); await p.mouse.move(b.x + b.width * fx, b.y + b.height * fy); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(b.x + b.width * (fx + (tx - fx) * k / 8), b.y + b.height * (fy + (ty - fy) * k / 8)); await p.mouse.up(); };
    const openById = async id => { await page.goto(base + '/?story=' + encodeURIComponent(id)); await page.locator('#story-viewer[open]').waitFor(); };

    await step('1. Tela cheia real pelo anel: ocupa a tela, rolagem travada, uma barra por story da pessoa, botões nomeados e ≥ 44 px', async () => {
      await page.goto(base + '/'); await page.locator(`.story-pill[aria-label*="${ana.name}"]`).first().tap(); await page.locator('#story-viewer[open]').waitFor();
      const r = await page.evaluate(() => { const v = document.getElementById('story-viewer').getBoundingClientRect(); return { box: [v.x, v.y, v.width, v.height], lock: document.documentElement.classList.contains('sv-lock'), segs: document.querySelectorAll('#story-progress .sv-seg').length }; });
      assert.deepEqual(r.box, [0, 0, 390, 844]); assert.ok(r.lock, 'rolagem travada'); assert.equal(r.segs, 2);
      assert.equal(await author(), ana.name);
      assert.match(await page.locator('#story-viewer-time').textContent(), /agora|\d+ min|\d+ h/);
      const unnamed = await page.evaluate(() => [...document.querySelectorAll('#story-viewer button')].filter(b => b.offsetParent && !b.getAttribute('aria-label') && !b.textContent.trim()).length);
      assert.equal(unnamed, 0, 'todo botão tem nome');
      const small = await page.evaluate(() => [...document.querySelectorAll('#story-viewer button')].filter(b => b.offsetParent && (b.getBoundingClientRect().width < 44 || b.getBoundingClientRect().height < 44)).map(b => b.getAttribute('aria-label') || b.textContent));
      assert.deepEqual(small, [], 'toques de no mínimo 44 px');
    });

    await step('2. Foto conta 5 s depois de carregar e avança sozinha', async () => {
      assert.equal(await now(), 1);
      await page.waitForTimeout(1000); const f1 = await fill(); assert.ok(f1 > 0.1 && f1 < 0.35, 'cerca de 1/5 em 1 s: ' + f1);
      await page.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '2', null, { timeout: 6000 });
      assert.equal(await fill(0), 1, 'item anterior completo');
    });

    await step('3. Toque no terço esquerdo volta; no restante avança', async () => {
      await tapAt(0.15); await page.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '1');
      await tapAt(0.7); await page.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '2');
      await tapAt(0.15); await page.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '1');
    });

    await step('4. Segurar pausa e esconde a interface; soltar retoma sem trocar de story', async () => {
      const b = await page.locator('.sv-face-main').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      let p2 = 0;
      try {
        await page.waitForFunction(() => document.getElementById('story-viewer').classList.contains('is-holding'), null, { timeout: 2000 });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.sv-top')).opacity === '0', null, { timeout: 2000 });
        const p1 = await fill(); await page.waitForTimeout(500); p2 = await fill(); assert.ok(Math.abs(p2 - p1) < 0.01, 'tempo parado');
      } finally { await page.mouse.up(); }
      await page.waitForTimeout(400); assert.ok(await fill() > p2, 'retoma');
      assert.equal(await now(), 1);
    });

    await step('5. Botão pausar, tecla espaço e digitar pausam; responder vira mensagem para a autora', async () => {
      await page.locator('#story-pause').tap(); assert.equal(await page.getAttribute('#story-pause', 'aria-pressed'), 'true');
      const p1 = await fill(); await page.waitForTimeout(500); assert.ok(Math.abs(await fill() - p1) < 0.01);
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press(' '); assert.equal(await page.getAttribute('#story-pause', 'aria-pressed'), 'false', 'espaço retoma');
      const input = page.locator('#story-actions input');
      await input.focus(); const q1 = await fill(); await page.waitForTimeout(500); assert.ok(Math.abs(await fill() - q1) < 0.01, 'digitar pausa');
      await input.fill('Que lindo!'); await page.locator('#story-actions .sv-send').tap();
      await page.waitForFunction(() => !document.querySelector('#story-actions input')?.value, null, { timeout: 5000 });
      assert.ok(JSON.stringify((await api(ana.cookie)).data.dms || []).includes('Que lindo!'), 'resposta chegou para a Ana');
    });

    await step('6. Curtir: coração anima e a reação chega ao servidor', async () => {
      await page.locator('#story-actions .sv-like').tap();
      assert.equal(await page.getAttribute('#story-actions .sv-like', 'aria-pressed'), 'true');
      assert.ok(await page.evaluate(() => document.querySelector('.sv-heart').classList.contains('is-pop')));
      await page.waitForTimeout(500);
      const mine = (await api(ana.cookie)).data.stories.find(s => s.id === a1.id);
      assert.ok((mine.reactions || []).some(([r, n]) => r === '❤️' && n >= 1), 'Ana vê a curtida');
    });

    await step('7. Menu ⋯: velocidade, denunciar (registro real) e Esc fecha só o menu', async () => {
      await page.locator('#story-more').tap(); await page.locator('#story-menu:not([hidden])').waitFor();
      await page.locator('#story-menu button', { hasText: '2x' }).tap();
      await page.locator('#story-more').tap();
      assert.equal(await page.locator('#story-menu button', { hasText: '2x' }).getAttribute('aria-checked'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#story-menu').isHidden(), true); assert.equal(await page.locator('#story-viewer[open]').count(), 1, 'visualizador continua aberto');
      await page.locator('#story-more').tap();
      page.once('dialog', d => d.accept('Teste de denúncia'));
      const sent = page.waitForResponse(r => r.request().method() === 'POST' && (r.request().postData() || '').includes('story_report'));
      await page.locator('#story-menu button', { hasText: 'Denunciar' }).tap();
      assert.equal((await sent).status(), 200);
    });

    await step('8. Compartilhar sem Web Share copia o link do story', async () => {
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
      await page.locator('#story-actions .sv-share').tap(); await page.waitForTimeout(300);
      const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
      assert.ok(clip.includes('/?story='), 'link copiado: ' + clip);
    });

    await step('9. Arrastar para o lado troca de pessoa com o cubo 3D e volta', async () => {
      const first = await author();
      let rotated = false;
      const b = await page.locator('.sv-face-main').boundingBox();
      await page.mouse.move(b.x + b.width * 0.85, b.y + b.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height / 2, { steps: 5 });
      rotated = /rotateY/.test(await page.evaluate(() => document.querySelector('.sv-cube').style.transform));
      await page.mouse.move(b.x + b.width * 0.1, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
      assert.ok(rotated, 'cubo gira durante o arrasto');
      await page.waitForFunction(n => document.getElementById('story-viewer-author').textContent !== n, first, { timeout: 4000 });
      await drag(0.1, 0.5, 0.85, 0.5);
      await page.waitForFunction(n => document.getElementById('story-viewer-author').textContent === n, first, { timeout: 4000 });
    });

    await step('10. Arrastar para cima foca a resposta; para baixo fecha e destrava a rolagem', async () => {
      await page.waitForFunction(() => document.querySelector('.sv-face-next').hidden && !document.getElementById('story-viewer').dataset.turn, null, { timeout: 3000 });
      await drag(0.5, 0.75, 0.5, 0.35);
      const focusInfo = await page.evaluate(() => ({ ok: !!document.activeElement?.matches('#story-actions input'), el: (document.activeElement?.outerHTML || '').slice(0, 80), now: document.querySelector('#story-progress').getAttribute('aria-valuenow'), who: document.getElementById('story-viewer-author').textContent, holding: document.getElementById('story-viewer').className }));
      assert.ok(focusInfo.ok, 'foco: ' + JSON.stringify(focusInfo));
      await page.evaluate(() => document.activeElement.blur());
      await drag(0.5, 0.3, 0.5, 0.75);
      await page.waitForFunction(() => !document.getElementById('story-viewer').open);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('sv-lock')), false);
    });

    await step('11. Anel: visto vira cinza, sem gradiente', async () => {
      await page.waitForFunction(n => [...document.querySelectorAll('.story-pill')].some(p => p.getAttribute('aria-label')?.includes(n) && p.classList.contains('is-seen')), ana.name, { timeout: 5000 });
      assert.equal(await page.locator(`.story-pill.is-seen[aria-label*="${ana.name}"] .story-ring`).first().evaluate(e => getComputedStyle(e).backgroundImage), 'none');
    });

    await step('12. Vídeo usa a duração real; mute global persiste', async () => {
      if (!video) throw new Error('defina OPY_STORY_VIDEO com um WebM curto');
      await openById(b1.id); assert.equal(await author(), bia.name, 'link direto abre o story');
      await page.waitForFunction(() => { const v = document.querySelector('#story-viewer-media video'); return v && v.currentTime > 0.3; }, null, { timeout: 8000 });
      const d = await page.evaluate(() => document.querySelector('#story-viewer-media video').duration);
      assert.ok(d > 2.5 && d < 3.5, 'duração real: ' + d);
      const muted0 = await page.evaluate(() => document.querySelector('#story-viewer-media video').muted);
      await page.locator('#story-mute').tap();
      assert.equal(await page.evaluate(() => document.querySelector('#story-viewer-media video').muted), !muted0);
      assert.equal(await page.evaluate(() => localStorage.getItem('opy-story-muted')), muted0 ? '0' : '1');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('story-viewer').open);
    });

    await step('13. Aba escondida pausa o tempo', async () => {
      await openById(a1.id);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      const p1 = await fill(); await page.waitForTimeout(500); assert.ok(Math.abs(await fill() - p1) < 0.01);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(400); assert.ok(await fill() > p1);
      await page.locator('#story-close').tap();
    });

    await step('14. Link de story expirado avisa sem abrir', async () => {
      await page.goto(base + '/?story=00000000-0000-0000-0000-000000000000');
      await page.getByText('não está mais disponível').first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator('#story-viewer[open]').count(), 0);
    });

    await step('15. Story próprio: "Visto por" e arrastar para cima abre a lista', async () => {
      const mine = (await api(me.cookie, { action: 'story_create', text: 'Meu story ' + stamp })).data.stories.find(s => s.own);
      await api(ana.cookie, { action: 'story_seen', storyId: mine.id });
      await openById(mine.id);
      assert.match(await page.locator('#story-actions .sv-seen').textContent(), /Visto por 1 pessoa/);
      await drag(0.5, 0.75, 0.5, 0.35); await page.locator('#story-sheet:not([hidden])').waitFor();
      assert.ok((await page.locator('#story-sheet').textContent()).includes(ana.name));
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#story-sheet').isHidden(), true);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('story-viewer').open);
    });

    await step('16. Desktop: cartão 9:16 centralizado com fundo desfocado, setas e teclado', async () => {
      const d = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 } });
      await d.addCookies([{ name: me.cookieName, value: me.cookieValue, url: base }]);
      const p = await d.newPage(); p.on('pageerror', e => errors.push(e.message));
      await p.goto(base + '/?story=' + a1.id); await p.locator('#story-viewer[open]').waitFor();
      const r = await p.locator('.sv-face-main').boundingBox();
      assert.ok(Math.abs(r.width / r.height - 9 / 16) < 0.02, 'proporção 9:16'); assert.ok(Math.abs(r.x + r.width / 2 - 640) < 2, 'centralizado');
      assert.match(await p.locator('.sv-bg-img').evaluate(e => getComputedStyle(e).filter), /blur/);
      assert.equal(await p.locator('.sv-nav-next').isVisible(), true);
      await p.locator('.sv-nav-next').click(); await p.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '2');
      await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '1');
      await p.keyboard.press('ArrowRight'); await p.waitForFunction(() => document.querySelector('#story-progress').getAttribute('aria-valuenow') === '2');
      await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.getElementById('story-viewer').open);
      await d.close();
    });

    await step('17. Movimento reduzido: troca de pessoa sem cubo', async () => {
      const r = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await r.addCookies([{ name: me.cookieName, value: me.cookieValue, url: base }]);
      const p = await r.newPage();
      await p.goto(base + '/?story=' + a1.id); await p.locator('#story-viewer[open]').waitFor();
      const before = await p.locator('#story-viewer-author').textContent();
      const b = await p.locator('.sv-face-main').boundingBox();
      await p.mouse.move(b.x + b.width * 0.85, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width * 0.4, b.y + b.height / 2, { steps: 4 });
      assert.equal(await p.evaluate(() => document.querySelector('.sv-cube').style.transform), '', 'sem rotação');
      await p.mouse.move(b.x + b.width * 0.1, b.y + b.height / 2, { steps: 4 }); await p.mouse.up();
      await p.waitForFunction(n => document.getElementById('story-viewer-author').textContent !== n, before, { timeout: 3000 });
      await r.close();
    });

    await step('18. Bloqueio: stories de quem você bloqueou somem e não aceitam interação', async () => {
      const biaId = (await api(bia.cookie)).data.me.id;
      assert.equal((await api(me.cookie, { action: 'block_set', key: 'id:' + biaId, blocked: true })).status, 200);
      assert.equal(((await api(me.cookie)).data.stories || []).some(s => s.id === b1.id), false);
      assert.equal((await api(me.cookie, { action: 'story_seen', storyId: b1.id })).status, 404);
    });

    // Tela Criar (padrão Instagram): câmera em tela cheia com Publicação · Story · Live.
    const cctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone'] });
    const cme = await signIn(cctx, base); const cp = await cctx.newPage(); cp.on('pageerror', e => errors.push(e.message));
    const mine = async () => ((await api(cme.cookie)).data.stories || []).filter(s => s.own);
    const waitCam = () => cp.waitForFunction(() => { const v = document.querySelector('#opy-creator[data-mode="live"]') ? document.getElementById('live-preview') : document.getElementById('creator-preview'); return v && v.srcObject && v.videoWidth > 0; }, null, { timeout: 10000 });

    await step('19. Criar: o + do story abre a câmera em tela cheia; tocar tira a foto e "Seu story" publica com legenda', async () => {
      await cp.goto(base + '/'); await cp.locator('.community-post').first().waitFor();
      await cp.locator('.story-create').tap(); await cp.locator('#opy-creator[open]').waitFor(); await waitCam();
      const r = await cp.evaluate(() => { const b = document.getElementById('opy-creator').getBoundingClientRect(); return [b.width, b.height]; }); assert.deepEqual(r, [390, 844]);
      assert.equal(await cp.locator('[data-cr-mode="story"]').getAttribute('aria-current'), 'true');
      await cp.locator('#creator-shutter').tap(); await cp.locator('#creator-review img').waitFor();
      await cp.fill('#creator-caption', 'Foto pela câmera'); await cp.locator('#creator-send').tap();
      await cp.waitForFunction(() => !document.getElementById('opy-creator').open, null, { timeout: 10000 });
      assert.ok((await mine()).some(s => s.text === 'Foto pela câmera' && s.media?.kind === 'image'));
      assert.equal(await cp.evaluate(() => !!document.getElementById('creator-preview').srcObject), false, 'câmera desligada ao fechar');
    });

    await step('20. Criar: segurar grava vídeo; "Aa Criar" faz story de texto; galeria também entra', async () => {
      await cp.locator('.story-create').tap(); await cp.locator('#opy-creator[open]').waitFor(); await waitCam();
      const b = await cp.locator('#creator-shutter').boundingBox();
      await cp.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await cp.mouse.down(); await cp.waitForTimeout(1600); await cp.mouse.up();
      await cp.locator('#creator-review video').waitFor({ timeout: 8000 });
      await cp.locator('#creator-send').tap(); await cp.waitForFunction(() => !document.getElementById('opy-creator').open, null, { timeout: 15000 });
      assert.ok((await mine()).some(s => s.media?.kind === 'video'), 'story de vídeo');
      await cp.locator('.story-create').tap(); await cp.locator('#opy-creator[open]').waitFor();
      await cp.locator('#creator-text-mode').tap(); await cp.fill('#creator-text', 'Bom dia, parentes!'); await cp.locator('#creator-send').tap();
      await cp.waitForFunction(() => !document.getElementById('opy-creator').open, null, { timeout: 10000 });
      assert.ok((await mine()).some(s => s.text === 'Bom dia, parentes!' && !s.media));
    });

    await step('21. Postagem no celular abre Criar em Publicação; foto + legenda vira publicação no feed', async () => {
      await cp.locator('.opy-bottom [data-opy-compose]').tap(); await cp.locator('#opy-creator[open][data-mode="post"]').waitFor(); await waitCam();
      await cp.setInputFiles('#creator-file', { name: 'g.png', mimeType: 'image/png', buffer: Buffer.from(pngData.split(',')[1], 'base64') });
      await cp.locator('#creator-review img').waitFor();
      const text = 'Publicação pela câmera ' + stamp; await cp.fill('#creator-caption', text); await cp.locator('#creator-send').tap();
      await cp.waitForFunction(() => !document.getElementById('opy-creator').open, null, { timeout: 10000 });
      assert.ok(((await api(cme.cookie)).data.posts || []).some(p => p.text === text && p.media?.kind === 'image'));
    });

    await step('22. Live no Criar: título, "Compartilhar com Todos", transmitir, controles por cima e encerrar devolve o estúdio', async () => {
      if (!(await api(cme.cookie)).data.liveEnabled) throw new Error('servidor sem live configurada (MediaMTX local)');
      await cp.locator('.story-create').tap(); await cp.locator('#opy-creator[open]').waitFor();
      await cp.locator('[data-cr-mode="live"]').tap(); await cp.locator('#creator-title').waitFor({ state: 'visible' }); await waitCam();
      assert.ok((await cp.locator('#creator-audience').textContent()).includes('Compartilhar com Todos'));
      assert.equal(await cp.evaluate(() => document.getElementById('live-stage').closest('#opy-creator') !== null), true, 'palco da live dentro do Criar');
      await cp.fill('#creator-title', 'Live pela câmera nova'); await cp.locator('#creator-shutter').tap();
      await cp.locator('#opy-creator[data-step="live"]').waitFor({ timeout: 20000 });
      await cp.locator('#creator-host-tools #live-stop').waitFor({ state: 'visible' });
      const live = ((await api(cme.cookie)).data.lives || []).find(l => l.own) || ((await api(cme.cookie)).data.posts || []).find(p => p.own && p.live?.active);
      assert.ok(live, 'live no ar');
      await cp.locator('#creator-host-tools #live-stop').tap();
      await cp.waitForFunction(() => !document.getElementById('opy-creator').open, null, { timeout: 15000 });
      assert.equal(await cp.evaluate(() => !!document.getElementById('live-stage').closest('#compose-live')), true, 'estúdio volta para o compositor');
    });
    await cctx.close();

    assert.deepEqual(errors.filter(e => !/ResizeObserver/.test(e)), [], 'sem erros de página');
  } catch (e) { results.push(['FALHOU', 'geral — ' + e.message.split('\n')[0]]); }
  finally {
    for (const [s, n] of results) console.log(s.padEnd(7), n);
    const failed = results.filter(r => r[0] !== 'OK').length;
    console.log(failed ? `FALHOU ${failed}/${results.length}` : `PASS stories: ${results.length} jornadas`);
    await browser.close();
    process.exitCode = failed ? 1 : 0;
  }
})();
