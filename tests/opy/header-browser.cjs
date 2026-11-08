// Missão "Global Header": jornadas do cabeçalho no desktop (1440) e no celular (390 e 320), contra o servidor local.
// Casa OPY abre o menu e fecha (Escape, clique fora), itens reais navegam e itens futuros mostram o aviso honesto;
// pesquisa com sugestões reais, limpar, Enter e versão compacta no celular; badges sobre os ícones com contagem real
// que zera ao ler; "Seguir de volta" no Maracá; foto sincronizada; menu pessoal e Recursos (com permissões); Sair.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn, registerAccount } = require('./session.cjs');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=';
async function api(cookie, body) {
  const r = await fetch(base + '/api/community', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: base, cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const results = [];
  const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + (e.message || e).toString().split('\n')[0].slice(0, 220)]); } };
  const errors = [];
  try {
    const desk = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 } });
    const ana = await signIn(desk, base);
    const anaId = (await api(ana.cookie)).data.me.id;
    const beto = await registerAccount(base, { name: 'Beto Header ' + Date.now().toString(36) });
    const page = await desk.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();

    await step('1. Desktop: marca, casa OPY, pesquisa central e ícones numa única linha', async () => {
      const r = await page.evaluate(() => {
        const box = s => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, cy: b.y + b.height / 2 }; };
        return { bar: box('.opy-topbar'), brand: box('.opy-brand'), house: box('.opy-house'), search: box('.opy-search'), chat: box('.messages-notification-container a'), maraca: box('.notification-container a'), avatar: box('.opy-account > summary'), tools: box('.opy-tools > summary'), vw: innerWidth };
      });
      assert.ok(r.bar.h <= 72, 'barra compacta: ' + r.bar.h);
      const centers = [r.brand, r.house, r.search, r.chat, r.maraca, r.avatar, r.tools].map(b => b.cy);
      assert.ok(Math.max(...centers) - Math.min(...centers) < 8, 'tudo alinhado na mesma linha');
      assert.ok(r.brand.x < r.house.x && r.house.x < r.search.x && r.search.x + r.search.w < r.chat.x && r.chat.x < r.maraca.x && r.maraca.x < r.avatar.x && r.avatar.x < r.tools.x, 'ordem: marca, casa, pesquisa, chat, maracá, perfil, recursos');
      const searchCenter = r.search.x + r.search.w / 2; assert.ok(Math.abs(searchCenter - r.vw / 2) < r.vw * 0.12, 'pesquisa centralizada');
      assert.equal(await page.locator('.opy-control-label:visible').count(), 0, 'sem textos ao lado dos ícones');
    });

    await step('2. Casa OPY abre o menu "Encontre seu caminho", fecha com Escape e devolve o foco', async () => {
      await page.locator('.opy-house').click();
      await page.locator('#opy-menu[open]').waitFor();
      assert.equal(await page.getAttribute('.opy-house', 'aria-expanded'), 'true');
      const text = await page.locator('#opy-menu').textContent();
      for (const t of ['Encontre seu caminho no Etnias', 'Opy', 'Saberes', 'Conexões', 'Comunidades', 'Páginas', 'Blogs', 'Mercado', 'Eventos', 'Filmes', 'Música', 'Empregos', 'Coletas', 'Sobre', 'Sair']) assert.ok(text.includes(t), 'item ' + t);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#opy-menu').open);
      assert.equal(await page.getAttribute('.opy-house', 'aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('opy-house')), true, 'foco volta à casa');
    });

    await step('3. Itens do OPY: rotas reais navegam; áreas ainda sem servidor mostram o aviso, sem página de enfeite', async () => {
      await page.locator('.opy-house').click(); await page.locator('#opy-menu[open]').waitFor();
      await page.locator('#opy-menu button[data-opy-info="Blogs"]').click();
      await page.locator('#opy-info[open]').waitFor();
      assert.ok((await page.locator('#opy-info').textContent()).includes('Em breve'));
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      for (const [label, path] of [['Conexões', 'search'], ['Comunidades', 'grupos'], ['Sobre', 'sobre']]) {
        await page.locator('.opy-house').click(); await page.locator('#opy-menu[open]').waitFor();
        await Promise.all([page.waitForURL(u => String(u).includes(path), { timeout: 10000 }), page.locator('#opy-menu a', { hasText: label }).first().click()]);
      }
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
    });

    await step('4. Pesquisa: sugestões reais ao digitar, limpar, Escape e Enter levam aos resultados com o termo preservado', async () => {
      const input = page.locator('#opy-search-query');
      await input.click(); await input.fill(beto.name);
      await page.locator('#opy-search-results:not([hidden]) a[role=option]').first().waitFor({ timeout: 8000 });
      assert.ok((await page.locator('#opy-search-results').textContent()).includes(beto.name), 'pessoa real aparece');
      assert.equal(await page.locator('.opy-search-clear').isVisible(), true);
      await page.locator('.opy-search-clear').click();
      assert.equal(await input.inputValue(), ''); await page.waitForFunction(() => document.getElementById('opy-search-results').hidden);
      await input.fill('Beto Header');
      await page.locator('#opy-search-results:not([hidden]) a[role=option]').first().waitFor();
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#opy-search-results').isHidden(), true, 'Escape fecha as sugestões');
      await Promise.all([page.waitForURL(/search/, { timeout: 10000 }), input.press('Enter')]);
      assert.equal(await page.locator('#opy-search-query').inputValue(), 'Beto Header', 'termo preservado na página de resultados');
    });

    await step('5. Badges sobre o Chat e o Maracá com contagem real; ler zera; "Seguir de volta" funciona', async () => {
      await api(beto.cookie, { action: 'dm', toKey: 'id:' + anaId, text: 'Oi Ana, teste do badge' });
      await api(beto.cookie, { action: 'follow', authorKey: 'id:' + anaId });
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
      const chatBadge = page.locator('.messages-notification-container .opy-header-badge');
      const notifBadge = page.locator('.notification-container .opy-header-badge');
      await chatBadge.waitFor(); await notifBadge.waitFor();
      for (const [badge, icon] of [[chatBadge, '.messages-notification-container a'], [notifBadge, '.notification-container a']]) {
        const b = await badge.boundingBox(), i = await page.locator(icon).boundingBox();
        assert.ok(b.x > i.x && b.x + b.width <= i.x + i.width + 12 && b.y <= i.y + i.height / 2, 'badge no canto superior direito do ícone');
        assert.ok(/^\d+\+?$/.test((await badge.textContent()).trim()));
      }
      const widthBefore = await page.locator('.opy-member-controls').evaluate(e => e.getBoundingClientRect().width);
      await page.goto(base + '/notificacoes/');
      const followBack = page.locator('#community-notifications button', { hasText: 'Seguir de volta' }).first();
      await followBack.waitFor(); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
      await page.locator('#community-notifications button', { hasText: 'Seguir de volta' }).first().click();
      await page.waitForFunction(() => ![...document.querySelectorAll('#community-notifications button')].some(b => b.textContent === 'Seguir de volta'), null, { timeout: 8000 });
      const betoId = (await api(beto.cookie)).data.me.id;
      assert.ok(((await api(ana.cookie)).data.directory || []).some(p => p.key === 'id:' + betoId && p.following), 'segue de verdade no servidor');
      await page.waitForFunction(() => !document.querySelector('.notification-container .opy-header-badge'), null, { timeout: 8000 });
      const widthAfter = await page.locator('.opy-member-controls').evaluate(e => e.getBoundingClientRect().width);
      assert.ok(Math.abs(widthAfter - widthBefore) < 1, 'badge não muda a largura da barra');
      await page.goto(base + '/chat/?with=' + encodeURIComponent('id:' + betoId));
      await page.locator('.chat-list, #chat-workspace').first().waitFor();
      await page.locator('#chat-workspace').getByText(beto.name).first().click();
      await page.waitForFunction(() => !document.querySelector('.messages-notification-container .opy-header-badge'), null, { timeout: 10000 });
    });

    await step('5b. Conexões: badge com pedidos de amizade; Aceitar e Recusar funcionam sem fechar o painel', async () => {
      const cai = await registerAccount(base, { name: 'Cai Header ' + Date.now().toString(36) });
      const dan = await registerAccount(base, { name: 'Dan Header ' + Date.now().toString(36) });
      await api(cai.cookie, { action: 'friend', authorKey: 'id:' + anaId }); await api(dan.cookie, { action: 'friend', authorKey: 'id:' + anaId });
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor();
      const badge = page.locator('.opy-requests .opy-header-badge'); await badge.waitFor();
      assert.equal((await badge.textContent()).trim(), '2');
      await page.locator('.opy-requests > summary').click();
      await page.locator('[data-opy-requests] .opy-req-row', { hasText: cai.name }).locator('button', { hasText: 'Aceitar' }).click();
      await page.waitForFunction(n => ![...document.querySelectorAll('[data-opy-requests] .opy-req-row')].some(r => r.textContent.includes(n) && r.querySelector('button')?.textContent === 'Aceitar'), cai.name, { timeout: 8000 });
      assert.equal(await page.locator('details.opy-requests[open]').count(), 1, 'painel continua aberto');
      await page.locator('[data-opy-requests] .opy-req-row', { hasText: dan.name }).locator('button', { hasText: 'Recusar' }).click();
      await page.waitForFunction(() => !document.querySelector('.opy-requests .opy-header-badge'), null, { timeout: 8000 });
      const caiId = (await api(cai.cookie)).data.me.id;
      assert.ok(((await api(ana.cookie)).data.directory || []).some(p => p.key === 'id:' + caiId && p.friendStatus === 'friends'), 'amizade aceita no servidor');
      assert.equal((await api(ana.cookie, { action: 'friend_decline', authorKey: 'id:' + caiId })).status, 404, 'recusar pedido inexistente é recusado');
      await page.keyboard.press('Escape');
    });

    await step('6. Foto do perfil sincronizada no cabeçalho', async () => {
      assert.equal((await api(ana.cookie, { action: 'profile_media', kind: 'avatar', media: { name: 'a.png', data: png } })).status, 200);
      await page.goto(base + '/'); await page.locator('.opy-account > summary img').waitFor({ timeout: 8000 });
    });

    await step('7. Menu pessoal: opções reais, um menu por vez, Escape fecha; Editar perfil e Privacidade abrem no lugar certo', async () => {
      await page.locator('.opy-account > summary').click();
      const menu = await page.locator('.opy-account .opy-account-menu').textContent();
      for (const t of ['Meu perfil', 'Editar perfil', 'Configurações', 'Privacidade', 'Segurança', 'Verificação da conta', 'Sair da conta']) assert.ok(menu.includes(t), t);
      await page.locator('.opy-tools > summary').click();
      assert.equal(await page.evaluate(() => document.querySelectorAll('details.opy-pop[open]').length), 1, 'só um menu aberto');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.querySelectorAll('details.opy-pop[open]').length), 0);
      await page.locator('.opy-account > summary').click();
      await Promise.all([page.waitForURL(/\/conta\//), page.locator('.opy-account a', { hasText: 'Editar perfil' }).click()]);
      await page.locator('#profile-edit-dialog[open]').waitFor({ timeout: 8000 });
      await page.goto(base + '/'); await page.locator('.opy-account > summary').click();
      await Promise.all([page.waitForURL(/configuracoes/), page.locator('.opy-account a', { hasText: 'Privacidade' }).click()]);
      await page.locator('#privacidade').waitFor();
      assert.ok(await page.evaluate(() => { const r = document.getElementById('privacidade').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), 'seção Privacidade na tela');
    });

    await step('8. Recursos: criar publicação e comunidade; sem itens de gestão para conta comum', async () => {
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor(); await page.locator('.opy-tools > summary').click();
      const txt = await page.locator('.opy-tools-menu').textContent();
      assert.ok(txt.includes('Criar publicação') && txt.includes('Criar comunidade') && txt.includes('Tema escuro'));
      assert.equal(await page.locator('.opy-tools-menu a', { hasText: 'Centro de gestão' }).count(), 0, 'conta comum não vê a gestão');
      await page.locator('.opy-tools-menu a', { hasText: 'Criar publicação' }).click();
      await page.waitForFunction(() => document.activeElement?.id === 'preview-text', null, { timeout: 8000 });
      await page.locator('.opy-tools > summary').click();
      await Promise.all([page.waitForURL(/grupos/), page.locator('.opy-tools-menu a', { hasText: 'Criar comunidade' }).click()]);
      await page.locator('#community-create-name').waitFor({ timeout: 8000 });
    });

    await step('9. Recursos para a administração: Centro de gestão aparece só para quem tem papel', async () => {
      const login = await fetch(base + '/api/community', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ action: 'login', username: process.env.OPY_ADMIN_USER || 'fase.dois', password: process.env.OPY_ADMIN_PASSWORD || 'Fase-dois-local-2026' }) });
      if (login.status !== 200) throw new Error('conta de administração local indisponível (' + login.status + ')');
      const pair = login.headers.get('set-cookie').split(';')[0]; const i = pair.indexOf('=');
      const adm = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1440, height: 900 } });
      await adm.addCookies([{ name: pair.slice(0, i), value: pair.slice(i + 1), url: base }]);
      const p = await adm.newPage(); await p.goto(base + '/'); await p.locator('.community-post').first().waitFor();
      await p.locator('.opy-tools > summary').click();
      await p.locator('.opy-tools-menu a', { hasText: 'Centro de gestão' }).waitFor();
      assert.equal(await p.locator('.opy-admin-link').count(), 0, 'sem link de gestão solto na barra');
      await adm.close();
    });

    for (const width of [390, 320]) {
      await step(`10. Celular ${width}px: uma linha, pesquisa compacta sobre a barra, menus dentro da tela, sem rolagem lateral`, async () => {
        const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width, height: 760 }, isMobile: true, hasTouch: true });
        await signIn(ctx, base);
        const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
        await p.goto(base + '/'); await p.locator('.community-post').first().waitFor();
        const barH = await p.locator('.opy-topbar').evaluate(e => e.getBoundingClientRect().height);
        assert.ok(barH <= 60, 'barra compacta: ' + barH);
        for (const sel of ['.opy-house', '.opy-search-open', '.opy-requests > summary', '.messages-notification-container a', '.notification-container a', '.opy-account > summary', '.opy-tools > summary']) {
          const b = await p.locator(sel).boundingBox(); assert.ok(b && b.x >= 0 && b.x + b.width <= width + 0.5 && b.height >= 36, sel + ' visível e tocável');
        }
        assert.equal(await p.locator('.opy-search').isVisible(), false, 'campo compacto vira ícone');
        await p.locator('.opy-search-open').tap();
        await p.locator('.opy-search').waitFor({ state: 'visible' });
        assert.equal(await p.evaluate(() => document.activeElement?.id), 'opy-search-query', 'foco no campo');
        assert.equal(await p.locator('.opy-topbar').evaluate(e => e.getBoundingClientRect().height), barH, 'sem segunda linha');
        await p.keyboard.press('Escape');
        assert.equal(await p.locator('.opy-search').isVisible(), false);
        assert.equal(await p.evaluate(() => document.activeElement?.classList.contains('opy-search-open')), true, 'foco volta ao ícone');
        for (const sel of ['.opy-account', '.opy-tools']) {
          await p.locator(sel + ' > summary').tap();
          const m = await p.locator(sel + ' .opy-account-menu').boundingBox();
          assert.ok(m.x >= 0 && m.x + m.width <= width + 0.5 && m.y >= 0, sel + ' dentro da tela');
          assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem lateral com menu aberto');
          await p.mouse.click(5, 500);
          assert.equal(await p.locator(sel + '[open]').count(), 0, 'clique fora fecha');
        }
        await p.locator('.opy-house').tap(); await p.locator('#opy-menu[open]').waitFor();
        await p.keyboard.press('Escape');
        await ctx.close();
      });
    }

    await step('11. Sair pelo menu OPY encerra a sessão', async () => {
      await page.goto(base + '/'); await page.locator('.opy-house').click(); await page.locator('#opy-menu[open]').waitFor();
      await Promise.all([page.waitForURL(/\/entrar\//, { timeout: 10000 }), page.locator('#opy-menu [data-opy-logout]').click()]);
      assert.equal((await api(ana.cookie)).status, 401);
    });

    assert.deepEqual(errors.filter(e => !/ResizeObserver/.test(e)), [], 'sem erros de página');
  } catch (e) { results.push(['FALHOU', 'geral — ' + e.message.split('\n')[0]]); }
  finally {
    for (const [s, n] of results) console.log(s.padEnd(7), n);
    const failed = results.filter(r => r[0] !== 'OK').length;
    console.log(failed ? `FALHOU ${failed}/${results.length}` : `PASS cabeçalho: ${results.length} jornadas`);
    await browser.close();
    process.exitCode = failed ? 1 : 0;
  }
})();
