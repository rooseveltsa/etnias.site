const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://127.0.0.1:8117';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  const a=await browser.newContext(),b=await browser.newContext();
  async function account(ctx,name){const res=await ctx.request.post(base+'/api/community',{headers:{origin:base},data:{action:'register',name,username:name.toLowerCase().replace(/ /g,'')+Date.now().toString(36),password:'Test-only-2026',googleKey:name.replace(/ /g,'')+'@example.com',phone:'11912345678'}});assert.equal(res.status(),200);return (await res.json()).me;}
  const aa=await account(a,'Ana QA'),bb=await account(b,'Beto QA');
  const pa=await a.newPage(),pb=await b.newPage();
  await pa.goto(base+'/chat/?p='+encodeURIComponent('id:'+bb.id));
  await pb.goto(base+'/chat/?p='+encodeURIComponent('id:'+aa.id));
  await pa.locator('#chat-text').fill('Mensagem de teste');await pa.locator('#chat-send').click();
  await pb.locator('#chat-log').getByText('Mensagem de teste',{exact:true}).waitFor();
  assert.equal(await pa.locator('#chat-log .chat-bubble').count(),1);
  await pa.locator('#chat-log summary').first().click();await pa.getByRole('button',{name:'Editar',exact:true}).click();
  await pa.locator('#chat-dialog textarea').fill('Mensagem corrigida');await pa.locator('#chat-dialog').getByRole('button',{name:'Salvar',exact:true}).click();
  await pb.locator('#chat-log').getByText('Mensagem corrigida',{exact:true}).waitFor();
  await pa.locator('#chat-text').fill('Rascunho offline');await a.setOffline(true);await pa.locator('#chat-send').click();
  await pa.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
  assert.equal(await pa.locator('#chat-text').inputValue(),'Rascunho offline');
  await a.setOffline(false);await pa.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await pb.locator('#chat-log').getByText('Rascunho offline',{exact:true}).waitFor();
  for(const width of [320,390,768,1440]){
   await pa.setViewportSize({width,height:900});
   assert.equal(await pa.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'sem overflow em '+width);
   fs.mkdirSync('.codex-tmp/chat-qa',{recursive:true});await pa.screenshot({path:'.codex-tmp/chat-qa/chat-'+width+'.png',fullPage:true});
  }
  console.log('PASS chat navegador: duas contas, envio/recebimento, edição, offline/retry, 320/390/768/1440px.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
