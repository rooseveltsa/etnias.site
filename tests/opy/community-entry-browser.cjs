// E2E: perguntas de entrada em comunidade privada e público "Amigos" no compositor.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8117';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const a=await browser.newContext(),b=await browser.newContext();
  const account=async(ctx,name)=>{const r=await ctx.request.post(base+'/api/community',{headers:{origin:base},data:{action:'register',name,username:name.toLowerCase().replace(/ /g,'')+Date.now().toString(36),password:'Test-only-2026',googleKey:name.replace(/ /g,'')+Date.now()+'@example.com',phone:'11912345678'}});assert.equal(r.status(),200);return (await r.json()).me;};
  await account(a,'Ana Entrada');await account(b,'Beto Entrada');
  const pa=await a.newPage(),pb=await b.newPage();const errors=[];for(const p of [pa,pb])p.on('pageerror',e=>errors.push(e.message));
  const name='Roda Privada '+Date.now().toString(36);
  await pa.goto(base+'/grupos/');
  await pa.locator('#community-create-open').click();
  await pa.locator('#community-create-name').fill(name);
  assert.equal(await pa.locator('.community-entry-questions').isVisible(),false,'perguntas escondidas em comunidade pública');
  await pa.locator('#community-create-privacy').selectOption('private');
  await pa.locator('[name=entryQuestion0]').fill('De qual território você fala?');
  await pa.locator('#community-create-description').fill('Comunidade privada para teste de entrada.');
  await pa.locator('#community-dialog-submit').click();
  await pa.locator('#community-detail').getByText(name).first().waitFor();
  const id=new URL(pa.url()).searchParams.get('c');assert.ok(id);
  await pb.goto(base+'/grupos/?c='+encodeURIComponent(id));
  await pb.locator('#community-detail-join').click();
  await pb.locator('#community-dialog').getByText('De qual território você fala?').waitFor();
  await pb.locator('[name=answer0]').fill('Do Xingu');
  await pb.locator('#community-dialog-submit').click();
  await pb.locator('#community-detail-join').filter({hasText:'Cancelar solicitação'}).waitFor();
  await pa.reload();await pa.locator('#community-detail').getByRole('button',{name:/Membros/}).click();
  await pa.locator('.community-request-answers').getByText('Do Xingu').waitFor();
  await pa.goto(base+'/');
  assert.deepEqual(await pa.locator('#preview-audience option').evaluateAll(o=>o.map(x=>x.value)),['public','friends','private']);
  assert.deepEqual(errors,[]);
  console.log('PASS community-entry-browser');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
