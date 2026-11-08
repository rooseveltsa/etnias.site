// Linha de base de performance em celular com rede lenta (perfil Slow 4G do Chrome: 1,6 Mbps, 150 ms; CPU 4x): LCP, CLS, resposta ao toque (INP aproximado)
// e erros de console nas telas principais. Uso: OPY_PREVIEW_URL=http://127.0.0.1:8140 node tests/opy/vitals.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { signIn } = require('./session.cjs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
const pages = ['/', '/chat/', '/grupos/', '/notificacoes/', '/conta/'];
const observer = `(() => { window.__v = { lcp: 0, cls: 0, inp: 0 };
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver(l => { for (const e of l.getEntries()) window.__v.inp = Math.max(window.__v.inp, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
})();`;
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await signIn(ctx, base);
  const rows = [];
  for (const path of pages) {
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.addInitScript(observer);
    const t0 = Date.now();
    await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('load', { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // Um toque real (primeiro elemento interativo visível) para medir a resposta.
    const target = page.locator('main button:visible, main a:visible').first();
    if (await target.count()) { await target.tap().catch(() => {}); await page.waitForTimeout(1200); }
    const v = await page.evaluate(() => ({ ...window.__v, bytes: performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0) }));
    rows.push({ path, lcp: Math.round(v.lcp), cls: Number(v.cls.toFixed(3)), inp: Math.round(v.inp), kb: Math.round(v.bytes / 1024), load: Date.now() - t0, errors: errors.length });
    await page.close();
  }
  console.log('tela | LCP ms | CLS | resposta ao toque ms | KB | carga total ms | erros');
  for (const r of rows) console.log(`${r.path} | ${r.lcp} | ${r.cls} | ${r.inp} | ${r.kb} | ${r.load} | ${r.errors}`);
  const bad = rows.filter(r => r.lcp > 2500 || r.cls > 0.1 || r.inp > 200 || r.errors);
  console.log(bad.length ? `fora da meta: ${bad.map(r => r.path).join(', ')}` : 'todas as telas dentro da meta (LCP ≤ 2,5 s, CLS ≤ 0,1, toque ≤ 200 ms, sem erros)');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
