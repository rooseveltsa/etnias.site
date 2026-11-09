// Chamada em grupo (pedido do Karuan: "cria um grupo e liga em grupo"): três pessoas num grupo de conversa,
// Ana começa, Beto e Caio entram pelo aviso, todos recebem vídeo de todos; quem sai some da grade dos outros.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { registerAccount } = require('./session.cjs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8101';
async function api(who, body) {
  const r = await fetch(base + '/api/community', { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie: who.cookie }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({})); if (!r.ok) throw Error(data.error || r.status); return data;
}
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const results = []; const step = async (name, fn) => { try { await fn(); results.push(['OK', name]); } catch (e) { results.push(['FALHOU', name + ' — ' + String(e.message || e).split('\n')[0].slice(0, 180)]); } };
  try {
    const [ana, beto, caio] = await Promise.all(['Ana', 'Beto', 'Caio'].map(n => registerAccount(base, { name: n + ' Grupo' })));
    const id = p => 'id:' + p.data.me.id;
    // Conversa liberada entre Ana e cada um (exigência para convidar ao grupo).
    for (const p of [beto, caio]) { await api(ana, { action: 'dm', toKey: id(p), text: 'Oi', clientId: randomUUID() }); await api(p, { action: 'dm', toKey: id(ana), text: 'Oi', clientId: randomUUID() }); }
    await api(ana, { action: 'chat_group_create', name: 'Roda de conversa ' + Date.now().toString(36), members: [id(beto), id(caio)] });
    const chatView = await (await fetch(base + '/api/community?view=chat', { headers: { cookie: beto.cookie } })).json();
    const groupKey = chatView.invitations[0].key;
    for (const p of [beto, caio]) await api(p, { action: 'chat_group_accept', key: groupKey });
    const pages = [];
    for (const p of [ana, beto, caio]) {
      const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: 390, height: 844 } });
      await ctx.addCookies([{ name: p.cookieName, value: p.cookieValue, url: base }]);
      const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
      await page.goto(base + '/chat/?p=' + encodeURIComponent(groupKey)); pages.push(page);
    }
    const [pa, pb, pc] = pages;
    const remoteTiles = page => page.evaluate(() => [...document.querySelectorAll('.gcall-tile:not(.is-self) video')].filter(v => v.videoWidth > 0).length);

    await step('1. Conversa de grupo mostra os botões de chamada', async () => {
      await pa.locator('#chat-call-video').waitFor({ state: 'visible', timeout: 10000 });
    });
    await step('2. Ana começa a chamada de vídeo em grupo', async () => {
      await pa.locator('#chat-call-video').click();
      await pa.locator('.gcall-screen[open]').waitFor({ timeout: 10000 });
      await pa.waitForFunction(() => document.querySelector('.gcall-tile.is-self video')?.videoWidth > 0, null, { timeout: 10000 });
    });
    await step('3. Beto e Caio veem o aviso "chamada em andamento" e entram', async () => {
      for (const p of [pb, pc]) { await p.locator('#gcall-banner').getByRole('button', { name: 'Entrar' }).click({ timeout: 15000 }); await p.locator('.gcall-screen[open]').waitFor({ timeout: 10000 }); }
    });
    await step('4. Cada pessoa recebe vídeo das outras duas (malha completa)', async () => {
      for (const p of [pa, pb, pc]) await p.waitForFunction(() => [...document.querySelectorAll('.gcall-tile:not(.is-self) video')].filter(v => v.videoWidth > 0).length === 2, null, { timeout: 30000 });
      assert.match(await pa.locator('.gcall-screen .call-state').textContent(), /3 pessoas/);
    });
    await step('5. Caio sai; Ana e Beto continuam conectados entre si', async () => {
      await pc.locator('.gcall-screen').getByRole('button', { name: 'Sair' }).click();
      for (const p of [pa, pb]) await p.waitForFunction(() => document.querySelectorAll('.gcall-tile:not(.is-self)').length === 1, null, { timeout: 15000 });
      assert.equal(await remoteTiles(pa), 1);
    });
    await step('6. A conversa do grupo registra o início da chamada', async () => {
      const v = await (await fetch(base + '/api/community?view=chat&key=' + encodeURIComponent(groupKey), { headers: { cookie: caio.cookie } })).json();
      assert.ok((v.messages || []).some(m => /chamada de vídeo em grupo/.test(m.text)));
    });
    await step('7. Sem erros de página', async () => { assert.deepEqual([...pa.errors, ...pb.errors, ...pc.errors], []); });
  } finally { await browser.close(); }
  for (const [s, n] of results) console.log(s.padEnd(7), n);
  const failed = results.filter(r => r[0] !== 'OK').length;
  console.log(failed ? `FAIL chamada em grupo: ${failed} de ${results.length}` : `PASS chamada em grupo: ${results.length} passos`);
  process.exitCode = failed ? 1 : 0;
})();
