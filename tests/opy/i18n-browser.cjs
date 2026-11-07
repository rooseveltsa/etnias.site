const { chromium } = require('playwright');
const assert=require('node:assert/strict');// E2E de idiomas: navegador em espanhol, troca para inglês salva na conta e painel de traduções (rode com OPY_ADMIN_USERNAMES=chefe).
const base=process.env.OPY_PREVIEW_URL||'http://127.0.0.1:8117',out=process.env.SHOTS_DIR||require('node:os').tmpdir();
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const errs=[];
 // Visitante com navegador em espanhol: tela de entrar já em espanhol
 const anon=await b.newContext({locale:'es-ES',viewport:{width:390,height:844}});const pa=await anon.newPage();pa.on('pageerror',e=>errs.push(e.message));
 await pa.goto(base+'/entrar/');await pa.waitForTimeout(1200);await pa.screenshot({path:out+'/i18n-entrar-es.png'});
 const txt=await pa.locator('body').innerText();assert.ok(!/Criar conta/.test(txt),'tela de entrar traduzida');
 // Conta com chefe (admin) em inglês
 const ctx=await b.newContext({viewport:{width:1440,height:900}});
 await ctx.request.post(base+'/api/community',{headers:{origin:base},data:{action:'register',name:'Chefe Teste',username:'chefe',password:'Test-only-2026',googleKey:'chefe@example.com',phone:'11912345678'}});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(base+'/');await p.waitForTimeout(1200);
 await p.locator('.opy-sidebar .opy-locale select').first().selectOption('en');await p.waitForLoadState('load');await p.waitForTimeout(1500);
 await p.screenshot({path:out+'/i18n-feed-en.png'});
 const feedTxt=await p.locator('body').innerText();assert.ok(/Communities/.test(feedTxt),'feed em inglês');
 await p.reload();await p.waitForTimeout(1500);assert.equal(await p.locator('.opy-sidebar .opy-locale select').first().inputValue(),'en','preferência salva');
 // Painel: cadastrar Guarani, sugerir e aprovar
 await p.goto(base+'/admin/#traducoes');await p.locator('.adm-langs').waitFor();
 await p.locator('details.adm-card summary').click();
 await p.locator('[aria-label="Language code"],[aria-label="Código do idioma"]').fill('gn');await p.locator('[aria-label="Language name"],[aria-label="Nome do idioma"]').fill('Guarani');
 await p.locator('details.adm-card form').first().locator('button[type=submit]').click();await p.locator('.adm-lang',{hasText:'Guarani'}).waitFor();
 await p.locator('.adm-lang',{hasText:'Guarani'}).click();
 await p.locator('.adm-phrase').first().locator('textarea').fill('Teste guarani');await p.locator('.adm-phrase').first().locator('button').click();
 await p.locator('.adm-sug').first().waitFor();await p.screenshot({path:out+'/i18n-admin.png',fullPage:false});
 await p.locator('.adm-sug').first().locator('button').first().click();await p.waitForTimeout(800);
 assert.match(await p.locator('.adm-lang',{hasText:'Guarani'}).innerText(),/gn · 0%|gn ·/);
 assert.deepEqual(errs,[]);console.log('PASS i18n');await b.close();})().catch(e=>{console.error(e);process.exit(1);});
