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
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
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
  await browser.close();
  fs.writeFileSync(path.join(out, 'ux-audit.json'), JSON.stringify(results, null, 1));
  console.log('\nrota | larg | overflow | alvos<44 | axe sérios | genérica | erros');
  for (const r of results) console.log([r.route, r.width, r.overflowX, r.smallCount, r.axe.map(v => v.id + '×' + v.nodes).join(',') || '-', r.generic ? 'SIM' : '', r.errors.length].join(' | '));
})().catch(e => { console.error(e); process.exitCode = 1; });
