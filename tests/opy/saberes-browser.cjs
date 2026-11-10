// Saberes de ponta a ponta: membro vê o estado vazio; a equipe cria uma trilha com duas aulas; o membro começa,
// conclui a primeira aula, vê o progresso e "Continuar de onde parei", em tela de celular (390px) sem rolagem lateral.
// Uso: servidor com OPY_ADMIN_USERNAMES=equipeteste; OPY_PREVIEW_URL=http://127.0.0.1:PORTA CHROME_PATH=... node saberes-browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8191';
if (!/^http:\/\/127\.0\.0\.1:/.test(base)) throw new Error('Rode só no servidor local.');
async function person(browser, username, mobile) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'pt-BR' });
  const r = await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'register', name: username, username, password: 'Test-only-2026', googleKey: username + '@example.com', phone: '11912345678' } });
  if (r.status() === 409) await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'login', username, password: 'Test-only-2026' } });
  else assert.equal(r.status(), 200, 'cadastro de ' + username);
  // A conta da equipe é fixa (OPY_ADMIN_USERNAMES) e pode ter outro idioma salvo de uma execução anterior.
  await ctx.request.post(base + '/api/community', { headers: { origin: base }, data: { action: 'set_locale', locale: 'pt-BR' } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  return { page, errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const member = await person(browser, 'aluna' + Date.now().toString(36), true);
  const m = member.page;
  await m.goto(base + '/saberes/');
  assert.ok(await m.locator('.saber-notice').isVisible(), 'aviso de autorização das comunidades');
  const empty = await m.locator('#saberes-app .opy-empty, #saberes-app .area-card').first().textContent({ timeout: 10000 });
  const hadTrilhas = await m.locator('#saberes-app .area-card').count();
  if (!hadTrilhas) assert.match(empty, /sendo preparadas/, 'membro vê explicação, sem botão de criar');
  assert.equal(await m.locator('text=Criar trilha').count(), 0, 'membro não vê Criar trilha');

  const staff = await person(browser, 'equipeteste', false);
  const s = staff.page;
  await s.goto(base + '/saberes/');
  await s.getByRole('link', { name: 'Criar trilha' }).first().click();
  const title = 'Trilha de teste ' + Date.now().toString(36);
  await s.getByLabel('Título da trilha').fill(title);
  await s.getByLabel('Resumo').fill('Resumo da trilha de teste.');
  await s.getByLabel('Título da aula').fill('Primeira aula');
  await s.getByLabel('Texto da aula').fill('Conteúdo da primeira aula.');
  await s.getByRole('button', { name: '+ Adicionar aula' }).click();
  await s.getByLabel('Título da aula').nth(1).fill('Segunda aula');
  await s.getByLabel('Vídeo do YouTube (link opcional)').nth(1).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await s.getByRole('button', { name: 'Publicar trilha' }).click();
  await s.locator('.saber-detail h1', { hasText: title }).waitFor();
  assert.equal(await s.locator('.saber-lessons li').count(), 2);
  assert.ok(await s.getByRole('button', { name: 'Remover trilha' }).isVisible(), 'equipe vê Remover');

  await m.goto(base + '/saberes/');
  await m.locator('.area-card', { hasText: title }).click();
  await m.getByRole('button', { name: 'Começar trilha' }).click();
  await m.locator('.saber-lesson h1', { hasText: 'Primeira aula' }).waitFor();
  await m.getByRole('button', { name: 'Marcar como concluída' }).click();
  await m.locator('.saber-lesson h1', { hasText: 'Segunda aula' }).waitFor();
  assert.equal(await m.locator('.saber-lesson .post-youtube').count(), 1, 'vídeo da aula no player do feed');
  assert.match(await m.locator('.saber-progress small').textContent(), /1 de 2 aulas/);
  await m.getByRole('link', { name: '← ' + title }).click();
  await m.getByRole('link', { name: 'Continuar de onde parei' }).waitFor();
  assert.equal(await m.locator('.saber-lessons .is-done').count(), 1);
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem rolagem horizontal em 390px');

  s.once('dialog', d => d.accept()); await s.getByRole('button', { name: 'Remover trilha' }).click();
  await s.waitForURL(u => !String(u).includes('t='));
  assert.equal(await s.locator('.area-card', { hasText: title }).count(), 0, 'trilha removida');
  assert.deepEqual([...member.errors, ...staff.errors], []);
  await browser.close();
  console.log('PASS saberes: estado vazio, criar trilha, começar, concluir aula, progresso, continuar e remover.');
})().catch(e => { console.error(e); process.exit(1); });
