// Medição do cabeçalho global nas larguras da missão: altura da barra, onde o feed começa, rolagem horizontal e capturas.
// Uso: OUT=<pasta> node tests/opy/header-measure.cjs  (servidor local com dados).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8140';
const widths = [320, 360, 390, 430, 768, 1024, 1440];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const rows = [];
  try {
    for (const w of widths) {
      const mobile = w < 768;
      const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: w, height: mobile ? 800 : 900 }, isMobile: mobile, hasTouch: mobile });
      await signIn(ctx, base);
      const page = await ctx.newPage();
      await page.goto(base + '/'); await page.locator('.community-post').first().waitFor(); await page.waitForTimeout(800);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.opy-topbar'); const r = bar.getBoundingClientRect();
        const first = document.querySelector('#story-list, .story-section, #preview-feed'); const f = first ? first.getBoundingClientRect().top : 0;
        const search = document.querySelector('.opy-search'); const s = search ? search.getBoundingClientRect() : null;
        const items = [...bar.querySelectorAll('a,button,summary,input')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
        const rowsTop = new Set(items.map(i => Math.round(i.top + i.height / 2) >> 3));
        return { bar: Math.round(r.height), feedTop: Math.round(f), searchVisible: !!(s && s.width > 0), searchTop: s ? Math.round(s.top) : -1, overflowX: document.documentElement.scrollWidth > innerWidth, lines: rowsTop.size };
      });
      await page.screenshot({ path: `${process.env.OUT}/w${w}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(420, mobile ? 800 : 900) } });
      rows.push({ w, ...m });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log('largura | barra px | feed começa em | pesquisa visível | rolagem horizontal');
  for (const r of rows) console.log(`${r.w} | ${r.bar} | ${r.feedTop} | ${r.searchVisible ? 'sim' : 'ícone'} | ${r.overflowX ? 'SIM' : 'não'}`);
  require('fs').writeFileSync(`${process.env.OUT}/medidas.json`, JSON.stringify(rows, null, 1));
})();
