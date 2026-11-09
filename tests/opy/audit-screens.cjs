// Auditoria de qualidade e usabilidade (Etapa 1 do plano): todas as rotas, 3 larguras. Só em servidor local descartável.
// Uso: OPY_PREVIEW_URL=http://127.0.0.1:PORTA CHROME_PATH=... OPY_AUDIT_DIR=../../audit-reports node audit-screens.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8117';
if (!/^http:\/\/127\.0\.0\.1:/.test(base)) throw new Error('Rode a auditoria só no servidor local (127.0.0.1).');
const out = path.resolve(process.env.OPY_AUDIT_DIR || 'audit-out');
const routes = ['/', '/search/', '/grupos/', '/meus-grupos/', '/paginas/', '/minhas-paginas/', '/blogs/', '/mercado/', '/eventos/', '/filmes/', '/empregos/', '/coletas/', '/sobre/', '/chat/', '/notificacoes/', '/conta/', '/perfil/', '/sobre-a-previa/', '/salvos/', '/albuns/', '/recordacoes/', '/configuracoes/', '/saberes/', '/guardiao/', '/fotografos/', '/musica/', '/doar/', '/etnia/', '/iara/'];
const widths = [375, 768, 1440];
(async () => {
  fs.mkdirSync(path.join(out, 'screens'), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  // bypassCSP só aqui: a CSP do site (script-src 'self') bloquearia a injeção do axe-core.
  const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const results = [];
  const username = 'audit' + Date.now().toString(36);
  for (const width of widths) {
    // O viewport só vale em newContext (newPage ignora a opção): um contexto por largura, mesma conta.
    const ctx = await browser.newContext({ bypassCSP: true, viewport: { width, height: width < 768 ? 812 : 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const auth = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: width === widths[0] ? { action: 'register', name: 'Auditoria Visual', username, password: 'Test-only-2026', googleKey: 'audit@example.com', phone: '11912345678' } : { action: 'login', username, password: 'Test-only-2026' } });
    if (auth.status() !== 200) throw new Error('acesso falhou ' + auth.status());
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const route of routes) {
      errors.length = 0;
      await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(600);
      const name = (route.replace(/\//g, '') || 'feed') + '-' + width;
      await page.screenshot({ path: path.join(out, 'screens', name + '.png'), fullPage: true });
      const m = await page.evaluate(() => {
        const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const small = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab]')]
          .filter(vis).filter(el => !el.closest('[hidden],dialog:not([open])')).map(el => { const r = (el.matches('input,select,textarea') && el.closest('label') || el).getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: (el.getAttribute('aria-label') || el.textContent || el.name || el.tagName).trim().slice(0, 30) }; })
          .filter(x => x.w < 44 && x.h < 44);
        return { overflowX: document.documentElement.scrollWidth - innerWidth, generic: !!document.querySelector('.preview-empty'), small: small.slice(0, 8), smallCount: small.length };
      });
      let axeViolations = [];
      if (width !== 768) {
        await page.addScriptTag({ content: axe }).catch(() => {});
        axeViolations = await page.evaluate(async () => {
          if (!window.axe) return [{ id: 'axe-nao-carregou', impact: 'n/a', nodes: 0 }];
          const r = await window.axe.run(document, { resultTypes: ['violations'] });
          return r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }));
        });
      }
      results.push({ route, width, ...m, axe: axeViolations, errors: [...errors] });
      process.stdout.write('.');
    }
    await page.close();
  }
  // Etapa 2 — estados abertos (onde moram os defeitos de layout): comentar, responder, menus, OPY, Criar, configurações e áreas.
  // Mede campo de texto espremido, controle coberto por outro elemento e controle saindo da tela.
  const stateIssues = [];
  const inspect = () => {
    const root = document.querySelector('dialog[open]') || document;
    const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); const closed = el.closest('details:not([open])'); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0' && !el.closest('[hidden]') && !(closed && !el.matches('details:not([open]) > summary')); };
    const inView = r => r.bottom > 0 && r.top < innerHeight;
    const scroller = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const label = el => (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.name || el.tagName).trim().slice(0, 40);
    const out = [];
    for (const el of root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea')) {
      if (!vis(el)) continue; const r = el.getBoundingClientRect();
      if (r.width < 120) out.push('campo estreito (' + Math.round(r.width) + 'px): ' + label(el));
    }
    for (const el of root.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary')) {
      if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (!inView(r)) continue;
      if ((r.left < -1 || r.right > innerWidth + 1) && !scroller(el)) out.push('fora da tela: ' + label(el));
      const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
      // Item de fileira com rolagem lateral fora da parte visível da fileira: não está coberto, só fora da janela da fileira.
      let clip = null; for (let q = el.parentElement; q; q = q.parentElement) { const o = getComputedStyle(q).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { clip = q.getBoundingClientRect(); break; } }
      if (clip && (x < clip.left || x > clip.right)) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !(el.labels && [...el.labels].some(l => l.contains(hit)))) {
        // Sob faixa fixa ou presa (cabeçalho, barra de baixo, filtros do feed) é efeito da rolagem, não defeito de layout.
        let pinned = false; for (let q = hit; q && q !== document.body; q = q.parentElement) { const ps = getComputedStyle(q).position; if (ps === 'sticky' || ps === 'fixed') { pinned = !q.contains(el); break; } }
        if (!pinned) out.push('coberto: ' + label(el) + ' por ' + (hit.className || hit.tagName).toString().slice(0, 40));
      }
    }
    return [...new Set(out)].slice(0, 12);
  };
  for (const width of [375, 1280]) {
    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width, height: width < 768 ? 812 : 900 }, isMobile: width < 768, hasTouch: width < 768, permissions: ['camera', 'microphone'] });
    const auth = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'login', username, password: 'Test-only-2026' } });
    if (auth.status() !== 200) throw new Error('acesso falhou ' + auth.status());
    const page = await ctx.newPage();
    const check = async (name, fn) => { try { await fn(); await page.waitForTimeout(450); const issues = await page.evaluate(inspect); if (issues.length) stateIssues.push({ width, state: name, issues }); await page.screenshot({ path: path.join(out, 'screens', 'estado-' + name + '-' + width + '.png') }); } catch (e) { stateIssues.push({ width, state: name, issues: ['não abriu: ' + e.message.split('\n')[0].slice(0, 100)] }); } process.stdout.write('+'); };
    const home = async () => { await page.goto(base + '/', { waitUntil: 'networkidle' }); await page.locator('.community-post').first().waitFor(); };
    await check('feed', home);
    await check('comentar', async () => { const post = page.locator('.community-post').filter({ has: page.locator('.preview-comment') }).first(); await post.scrollIntoViewIfNeeded(); await post.locator('button.post-action').filter({ hasText: /^(Comentar|Comment)/ }).first().dispatchEvent('click'); });
    await check('responder', async () => { const post = page.locator('.community-post').filter({ has: page.locator('.preview-comment') }).first(); await post.locator('.comment-act').filter({ hasText: /^(Responder|Reply)/ }).first().dispatchEvent('click'); await post.locator('.preview-comment-form').scrollIntoViewIfNeeded(); });
    await check('menu-conta', async () => { await home(); await page.locator('.opy-account > summary').click(); });
    await check('menu-recursos', async () => { await page.keyboard.press('Escape'); await page.locator('.opy-tools > summary').click(); });
    await check('menu-conexoes', async () => { await page.keyboard.press('Escape'); await page.locator('.opy-requests > summary').click(); });
    await check('menu-opy', async () => { await page.keyboard.press('Escape'); await page.locator('.opy-house').click(); await page.locator('#opy-menu[open]').waitFor(); });
    await check('criar-story', async () => { await home(); await page.locator('.story-create').click(); await page.locator('#opy-creator[open]').waitFor(); });
    await check('criar-live', async () => { await page.locator('[data-cr-mode="live"]').click(); });
    await check('configuracoes', async () => { await page.goto(base + '/configuracoes/', { waitUntil: 'networkidle' }); await page.locator('.set-page').waitFor(); });
    for (const area of ['blogs', 'mercado', 'eventos']) await check('detalhe-' + area, async () => { await page.goto(base + '/' + area + '/', { waitUntil: 'networkidle' }); await page.locator('.area-card').first().click(); await page.locator('.area-detail').waitFor(); });
    await check('perfil-proprio', async () => { await page.goto(base + '/conta/', { waitUntil: 'networkidle' }); await page.locator('#profile-page .pf-id').waitFor(); });
    await check('chat', async () => { await page.goto(base + '/chat/', { waitUntil: 'networkidle' }); });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'ux-audit.json'), JSON.stringify(results, null, 1));
  console.log('\nrota | larg | overflow | alvos<44 | axe sérios | genérica | erros');
  for (const r of results) console.log([r.route, r.width, r.overflowX, r.smallCount, r.axe.map(v => v.id + '×' + v.nodes).join(',') || '-', r.generic ? 'SIM' : '', r.errors.length].join(' | '));
  fs.writeFileSync(path.join(out, 'ux-estados.json'), JSON.stringify(stateIssues, null, 1));
  console.log('\nESTADOS ABERTOS: ' + (stateIssues.length ? stateIssues.length + ' com achados' : 'sem achados'));
  for (const s of stateIssues) console.log(s.width + ' | ' + s.state + ' | ' + s.issues.join(' ; '));
})().catch(e => { console.error(e); process.exitCode = 1; });
