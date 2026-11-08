// Jornadas completas no celular (390×844, toque), como a missão "Social Experience Excellence" pede:
// stories (abrir, pausar, avançar, voltar, fechar, reagir), curtir e comentar mantendo a posição do feed, perfil e voltar,
// comunidade, chat, rascunho de comentário, toques duplos rápidos, rede lenta, estados vazios e permissão.
// Precisa do servidor local com dados e do MediaMTX só para a live (não usada aqui).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn, registerAccount } = require('./session.cjs');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const png = () => Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=', 'base64');
async function api(cookie, body) {
  const r = await fetch(base + '/api/community', { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const results = [];
  const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + (e.message || e).toString().split('\n')[0].slice(0, 160)]); } };
  try {
    // Duas pessoas: Ana usa o celular; Beto publica um story com foto e texto.
    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const ana = await signIn(ctx, base);
    const beto = await registerAccount(base, { name: 'Beto ' + Date.now().toString(36) });
    await api(beto.cookie, { action: 'story_create', text: 'Story de ensaio ' + Date.now(), media: { name: 'story.png', data: 'data:image/png;base64,' + png().toString('base64') } });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));

    await step('1. Abrir o feed no celular e ver um story', async () => {
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
      await page.locator(`button[aria-label^="Ver 1 story de ${beto.name}"]`).tap();
      await page.locator('#story-viewer[open]').waitFor();
      await page.waitForFunction(() => !document.querySelector('#story-stage').classList.contains('is-loading'), null, { timeout: 10000 });
      assert.equal(await page.locator('#story-viewer-author').textContent(), beto.name);
    });
    await step('2. Pausar, avançar, voltar, reagir e fechar o story', async () => {
      const fill = () => page.evaluate(() => parseFloat(document.querySelector('#story-progress .story-bar-fill').style.width) || 0);
      await page.waitForTimeout(800); const a = await fill(); assert.ok(a > 0, 'barra anda com a mídia pronta');
      // Segurar pausa; soltar continua.
      const stage = page.locator('#story-stage'); const box = await stage.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(700);
      const b1 = await fill(); await page.waitForTimeout(500); const b2 = await fill(); assert.ok(Math.abs(b2 - b1) < 0.5, 'segurar pausa a barra');
      await page.mouse.up(); await page.waitForTimeout(400); assert.ok(await fill() > b2, 'soltar retoma');
      await page.locator('.story-react-row button').first().tap();
      await page.waitForFunction(() => document.querySelector('.story-react-row button')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 });
      await page.getByRole('button', { name: 'Fechar', exact: true }).tap();
      await page.waitForFunction(() => !document.querySelector('#story-viewer').open);
      assert.ok(await page.locator('.community-post').first().isVisible(), 'feed continua atrás do story');
    });
    await step('3. Curtir (resposta imediata) e comentar sem perder a posição do feed', async () => {
      const post = page.locator('.community-post').nth(3); await post.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
      const y0 = await page.evaluate(() => scrollY);
      const id = (await post.getAttribute('id')).replace('post-', '');
      const like = () => page.locator('#post-' + id + ' .post-react-main');
      const was = await like().getAttribute('aria-pressed'); const want = was === 'true' ? 'false' : 'true';
      const t0 = Date.now(); await like().tap();
      await page.waitForFunction(([id, want]) => document.querySelector('#post-' + id + ' .post-react-main')?.getAttribute('aria-pressed') === want, [id, want], { timeout: 800 });
      const reaction = Date.now() - t0; assert.ok(reaction < 800, 'curtida refletida em ' + reaction + ' ms (inclui o custo do automatizador)');
      await post.getByRole('button', { name: 'Comentar', exact: true }).tap();
      const texto = 'Comentário de jornada ' + Date.now().toString(36);
      await post.getByLabel('Seu comentário').fill(texto); await page.waitForTimeout(300); const yFill = await page.evaluate(() => scrollY);
      // Dispara o envio sem o automatizador rolar a página para alcançar o botão (sob a barra fixa).
      await post.getByRole('button', { name: 'Enviar comentário' }).dispatchEvent('click');
      await page.locator('#post-' + id).getByText(texto).waitFor();
      const y1 = await page.evaluate(() => scrollY); // O navegador mantém o campo de comentário à vista enquanto o cartão cresce com o comentário novo (até ~1 comentário de altura).
      assert.ok(Math.abs(y1 - yFill) < 220, `enviar o comentário não move a tela além do próprio comentário (${yFill} → ${y1}; antes de tocar no campo: ${y0})`);
      await page.waitForTimeout(1500); // o servidor confirma; a curtida continua
      assert.equal(await like().getAttribute('aria-pressed'), want);
    });
    await step('4. Abrir um perfil pelo feed, seguir e voltar para a mesma posição', async () => {
      await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(600);
      // O que importa é a publicação que estava na tela voltar a estar na tela (a rolagem em px muda com imagens carregando acima).
      const topPost = () => page.evaluate(() => { for (const y of [420, 360, 480, 300, 540]) { const id = document.elementFromPoint(195, y)?.closest('.community-post')?.id; if (id) return id; } return ([...document.querySelectorAll('.community-post')].find(c => c.getBoundingClientRect().bottom > 300) || {}).id || ''; });
      const y0 = await topPost();
      // Toca no nome de quem publicou a publicação que está na tela (como uma pessoa faria), não num botão fora da tela.
      await page.locator('#' + y0 + ' .author-name-btn').first().dispatchEvent('click'); await page.waitForURL(/perfil/);
      const follow = page.locator('.profile-actions button, button').filter({ hasText: /^(Seguir|Seguindo)$/ }).first();
      await follow.waitFor(); const before = await follow.textContent(); await follow.tap();
      await page.waitForFunction((t) => [...document.querySelectorAll('button')].some(b => b.textContent.trim() !== t.trim() && /^(Seguir|Seguindo)$/.test(b.textContent.trim())), before, { timeout: 5000 });
      await page.goBack(); await page.locator('.community-post').first().waitFor(); await page.waitForTimeout(2500);
      const y1 = await topPost(); assert.equal(y1, y0, `voltou para a mesma publicação (${y0} → ${y1})`);
    });
    await step('5. Encontrar uma comunidade e participar', async () => {
      await page.goto(base + '/grupos/'); const join = page.getByRole('button', { name: /^Participar$/ }).first(); await join.waitFor(); await join.tap();
      await page.getByText(/Você entrou em|Pedido enviado/).first().waitFor({ timeout: 8000 });
    });
    await step('6. Abrir uma conversa, digitar e enviar', async () => {
      await page.goto(base + '/chat/?p=' + encodeURIComponent('id:' + beto.data.me.id));
      await page.locator('#chat-text').waitFor(); await page.locator('#chat-text').fill('Oi, Beto! Jornada no celular.');
      await page.locator('#chat-send').tap(); await page.locator('#chat-log').getByText('Oi, Beto! Jornada no celular.').waitFor({ timeout: 8000 });
    });
    await step('7. Rascunho de comentário sobrevive à atualização do feed', async () => {
      await page.goto(base + '/'); const post = page.locator('.community-post').nth(1); await post.waitFor();
      await post.getByRole('button', { name: 'Comentar', exact: true }).tap(); await post.getByLabel('Seu comentário').fill('rascunho que não some');
      await page.getByRole('button', { name: 'Atualizar feed', exact: true }).tap(); await page.waitForTimeout(2500);
      assert.equal(await page.locator('.community-post').nth(1).getByLabel('Seu comentário').inputValue(), 'rascunho que não some');
    });
    await step('8. Trocar de filtro e voltar sem perder o estado', async () => {
      await page.getByRole('button', { name: 'Fotos', exact: true }).tap(); await page.waitForTimeout(1500);
      assert.equal(await page.getByRole('button', { name: 'Fotos', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'Tudo', exact: true }).tap(); await page.locator('.community-post').first().waitFor();
    });
    await step('9. Feed com rede lenta (Slow 4G, CPU 4x) carrega e responde', async () => {
      const slow = await ctx.newPage(); const cdp = await ctx.newCDPSession(slow);
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const t0 = Date.now(); await slow.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await slow.locator('.community-post').first().waitFor({ timeout: 30000 });
      const ms = Date.now() - t0; assert.ok(ms < 8000, 'primeira publicação em ' + ms + ' ms'); await slow.close();
    });
    await step('10. Toques duplos rápidos na curtida terminam coerentes com o servidor', async () => {
      const post = page.locator('.community-post').nth(2); await post.scrollIntoViewIfNeeded();
      const like = post.locator('.post-react-main'); const id = (await post.getAttribute('id')).replace('post-', '');
      const start = await like.getAttribute('aria-pressed');
      await like.tap(); await like.tap(); await like.tap(); await page.waitForTimeout(3000);
      const ui = await page.locator('#post-' + id + ' .post-react-main').getAttribute('aria-pressed');
      const r = await fetch(base + '/api/community?view=posts', { headers: { cookie: ana.cookie } }).then(r => r.json());
      const server = !!r.posts.find(p => p.id === id)?.reaction;
      assert.equal(ui, String(server), `interface (${ui}) e servidor (${server}) coincidem (início ${start})`);
    });
    await step('11. Teclado: campo de comentário visível com a janela reduzida', async () => {
      // Emula o teclado reduzindo a altura visível (interactive-widget=resizes-content): o campo focado continua na tela.
      const small = await ctx.newPage(); await small.setViewportSize({ width: 390, height: 420 }); await small.goto(base + '/');
      const post = small.locator('.community-post').nth(1); await post.waitFor(); await post.getByRole('button', { name: 'Comentar', exact: true }).tap();
      const input = post.getByLabel('Seu comentário'); await input.focus(); await small.waitForTimeout(400);
      const box = await input.boundingBox(); assert.ok(box && box.y >= 0 && box.y + box.height <= 420, 'campo dentro da área visível'); await small.close();
    });
    await step('12. Estados vazios e permissão', async () => {
      await page.goto(base + '/chat/'); await page.getByRole('button', { name: /Solicitações/ }).tap();
      await page.getByText(/Nenhuma solicitação/).waitFor();
      const admin = await fetch(base + '/api/community?view=admin', { headers: { cookie: ana.cookie } });
      assert.equal(admin.status, 403, 'conta comum não entra no Centro de gestão');
    });
    await step('13. Link do YouTube: vira link clicável e cartão com miniatura; o player só carrega ao tocar', async () => {
      const text = 'Vídeo para a aldeia ' + Date.now() + ': https://youtu.be/nCRfDMbVUn0?si=hSO1mjMQhoWOJQkg';
      const made = await api(beto.cookie, { action: 'publish', text, audience: 'public' });
      const post = made.data.posts.find(p => p.text === text);
      await page.goto(base + '/#post-' + post.id); const card = page.locator('#post-' + post.id);
      await card.waitFor();
      const link = card.locator('a.post-inline-link'); assert.equal(await link.getAttribute('href'), 'https://youtu.be/nCRfDMbVUn0?si=hSO1mjMQhoWOJQkg');
      assert.equal(await link.getAttribute('target'), '_blank'); assert.ok((await link.getAttribute('rel')).includes('noopener'));
      const thumb = card.locator('.post-youtube-play img'); assert.equal(await thumb.getAttribute('src'), 'https://i.ytimg.com/vi/nCRfDMbVUn0/hqdefault.jpg');
      assert.equal(await card.locator('iframe').count(), 0, 'nada do YouTube carrega antes do toque');
      await card.locator('.post-youtube-play').dispatchEvent('click');
      assert.equal(await card.locator('iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/nCRfDMbVUn0?autoplay=1&rel=0&playsinline=1');
      const csp = (await fetch(base + '/', { headers: { cookie: ana.cookie } })).headers.get('content-security-policy') || '';
      assert.ok(csp.includes('https://i.ytimg.com') && csp.includes('frame-src https://www.youtube-nocookie.com'), 'política de segurança libera só a miniatura e o player');
      // Texto com HTML não vira marcação.
      const evil = 'teste <img src=x onerror=alert(1)> https://example.org/ok ' + Date.now();
      const e2 = (await api(beto.cookie, { action: 'publish', text: evil, audience: 'public' })).data.posts.find(p => p.text === evil);
      await page.goto(base + '/#post-' + e2.id); await page.locator('#post-' + e2.id).waitFor();
      assert.equal(await page.locator('#post-' + e2.id + ' .post-copy img').count(), 0, 'HTML no texto continua texto');
    });
    assert.deepEqual(errors, [], 'sem erros de página');
  } finally { await browser.close(); }
  for (const [s, n] of results) console.log(s.padEnd(7), n);
  const failed = results.filter(r => r[0] !== 'OK').length;
  console.log(failed ? `${failed} jornada(s) com falha` : 'todas as jornadas passaram');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
