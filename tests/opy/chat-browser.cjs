const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.OPY_PREVIEW_URL || 'http://127.0.0.1:8117';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  const a=await browser.newContext(),b=await browser.newContext();
  async function account(ctx,name){const res=await ctx.request.post(base+'/api/community',{headers:{origin:base},data:{action:'register',name,username:name.toLowerCase().replace(/ /g,'')+Date.now().toString(36),password:'Test-only-2026',googleKey:name.replace(/ /g,'')+'@example.com',phone:'11912345678'}});assert.equal(res.status(),200);return (await res.json()).me;}
  const aa=await account(a,'Ana QA'),bb=await account(b,'Beto QA');
  const pa=await a.newPage(),pb=await b.newPage();
  const errors=[];pa.on('pageerror',e=>errors.push(e.message));pb.on('pageerror',e=>errors.push(e.message));

  // 1. Inbox / Mensageria genuína entre dois usuários com sessões independentes
  await pa.goto(base+'/chat/?p='+encodeURIComponent('id:'+bb.id));
  await pb.goto(base+'/chat/?p='+encodeURIComponent('id:'+aa.id));
  await pa.locator('#chat-text').fill('Mensagem de teste');await pa.locator('#chat-send').click();
  await pb.locator('#chat-log').getByText('Mensagem de teste',{exact:true}).waitFor();
  assert.equal(await pa.locator('#chat-log .chat-bubble').count(),1);
  await pa.locator('#chat-log .chat-bubble-more').first().click();await pa.getByRole('button',{name:'Editar',exact:true}).click();
  await pa.locator('#chat-dialog textarea').fill('Mensagem corrigida');await pa.locator('#chat-dialog').getByRole('button',{name:'Salvar',exact:true}).click();
  await pb.locator('#chat-log').getByText('Mensagem corrigida',{exact:true}).waitFor();

  // Direct: sem vínculo, a mensagem de Ana chega a Beto como solicitação; Ana espera o aceite
  await pa.locator('#chat-notice').filter({hasText:'Solicitação enviada'}).waitFor();
  assert.equal(await pa.locator('#chat-form').isVisible(),false);
  await pb.locator('#chat-notice').getByRole('button',{name:'Aceitar',exact:true}).click();
  await pa.locator('#chat-form').waitFor({state:'visible',timeout:15000});

  // Painel contextual de detalhes do contato
  await pa.locator('#chat-info-toggle').click();
  await pa.locator('#chat-context').waitFor({state:'visible'});
  await pa.locator('#chat-context-close').click();

  // Recuperação de falha offline e retry
  await pa.locator('#chat-text').fill('Rascunho offline');await a.setOffline(true);await pa.locator('#chat-send').click();
  await pa.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
  assert.equal(await pa.locator('#chat-text').inputValue(),'Rascunho offline');
  await a.setOffline(false);await pa.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await pb.locator('#chat-log').getByText('Rascunho offline',{exact:true}).waitFor();

  // Fluxo mobile master-detail (lista <-> conversa) e larguras responsivas
  await pa.setViewportSize({width:390,height:844});
  assert.equal(await pa.locator('#chat-workspace').getAttribute('data-mobile-view'),'thread');
  await pa.locator('#chat-back').click();
  assert.equal(await pa.locator('#chat-workspace').getAttribute('data-mobile-view'),'list');
  await pa.locator('#chat-list .chat-person-btn').first().click();
  assert.equal(await pa.locator('#chat-workspace').getAttribute('data-mobile-view'),'thread');

  for(const width of [320,390,768,1440]){
   await pa.setViewportSize({width,height:900});
   assert.equal(await pa.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'sem overflow no chat em '+width);
   fs.mkdirSync('.codex-tmp/chat-qa',{recursive:true});await pa.screenshot({path:'.codex-tmp/chat-qa/chat-'+width+'.png',fullPage:true});
  }

  // 2. Comunidades: criação, solicitação em comunidade privada, aprovação e publicação isolada
  await pa.setViewportSize({width:1280,height:900});
  await pb.setViewportSize({width:1280,height:900});
  await pa.goto(base+'/grupos/');
  await pa.locator('#community-create-open').click();
  await pa.locator('#community-create-name').fill('Conselho Audiovisual QA');
  await pa.locator('#community-create-privacy').selectOption('private');
  await pa.locator('#community-create-description').fill('Comunidade privada para testes de governança e moderação.');
  await pa.locator('#community-dialog-submit').click();
  await pa.locator('#community-detail-title').filter({hasText:'Conselho Audiovisual QA'}).waitFor();

  await pb.goto(base+'/grupos/');
  await pb.getByRole('button',{name:'Conselho Audiovisual QA'}).click();
  await pb.locator('#community-detail-join').click();
  await pb.locator('#community-detail-join').filter({hasText:'pendente'}).waitFor();

  await pa.reload();
  await pa.locator('[data-community-tab="members"]').click();
  await pa.getByRole('button',{name:'Aprovar entrada'}).click();
  await pa.locator('.community-members-list').getByText('Beto QA').waitFor();

  await pb.reload();
  await pb.locator('#community-post-text').fill('Relato aprovado dentro da comunidade privada');
  await pb.getByRole('button',{name:'Publicar na comunidade'}).click();
  await pb.locator('.community-post').filter({hasText:'Relato aprovado dentro da comunidade privada'}).waitFor();

  // 3. Composer reconstruído, diagnóstico honesto de Live e publicação com foto
  await pa.goto(base+'/');
  await pa.locator('#compose-tab-live').click();
  await pa.locator('#compose-live').getByText('Sua live, direto do aparelho').waitFor();
  await pa.locator('#compose-tab-photo').click();
  await pa.locator('#publisher-photo').setInputFiles({name:'foto-qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=','base64')});
  await pa.locator('#photo-slot img.compose-slot-preview').waitFor();
  await pa.locator('#preview-text').fill('Publicação com foto do novo composer');
  await pa.locator('#opy-compose button[type="submit"]').click();
  await pa.locator('#preview-feed .community-post').filter({hasText:'Publicação com foto do novo composer'}).waitFor();

  // 4. Perfil em /conta/: página com capa e abas, edição em painel, foto de perfil enviada de verdade
  await pa.goto(base+'/conta/');
  await pa.locator('#profile-page .pf-id h1').filter({hasText:'Ana QA'}).waitFor();
  await pa.getByRole('button',{name:'Editar perfil',exact:true}).click();
  await pa.locator('#profile-edit-affiliation').fill('Rede de Comunicadores');
  await pa.locator('#profile-edit-bio').fill('Engenheira de QA e guardiã da memória digital.');
  await pa.locator('#profile-edit-form button[type="submit"]').click();
  await pa.locator('#profile-edit-status').filter({hasText:'sucesso'}).waitFor();
  await pa.locator('#profile-avatar-input').setInputFiles({name:'rosto.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6UVsAAAAASUVORK5CYII=','base64')});
  await pa.locator('#profile-edit-status').filter({hasText:'Foto do perfil atualizada'}).waitFor();
  await pa.locator('[data-close-edit]').click();
  await pa.locator('#profile-page .pf-avatar img[src^="/api/media?id="]').waitFor();
  await pa.locator('#profile-page .pf-bio').filter({hasText:'guardiã da memória digital'}).waitFor();
  // Beto vê o perfil de Ana com a foto, a apresentação e as ações de seguir e mensagem
  await pb.goto(base+'/perfil/?u='+encodeURIComponent('id:'+aa.id));
  await pb.locator('#profile-page .pf-avatar img[src^="/api/media?id="]').waitFor();
  await pb.getByRole('button',{name:'Mensagem',exact:true}).waitFor();

  assert.deepEqual(errors,[]);
  console.log('PASS E2E navegador: chat 2 usuários (envio, edição, contexto, offline/retry, mobile master-detail), comunidades (criação privada, aprovação, postagem), composer (foto + diagnóstico honesto de Live) e edição de perfil.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
