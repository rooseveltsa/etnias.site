/* Etnias — painéis suspensos (pop-ups) de Mensagens, Notificações e EtnIA, sem trocar de página.
   Usa window.OpyShared (preview.js). Ctrl/⌘-clique ou botão do meio ainda abre a página inteira. */
(function(){
'use strict';
const S=()=>window.OpyShared;
const $=(s,r=document)=>r.querySelector(s),all=(s,r=document)=>[...r.querySelectorAll(s)];
const mk=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e;};
const route=document.body.dataset.previewRoute;
let current=null; // {id,el,trigger,onClose}
const ago=v=>{const d=(Date.now()-new Date(v).getTime())/1000;if(d<45)return 'agora';if(d<3600)return `há ${Math.max(1,Math.round(d/60))} min`;if(d<86400)return `há ${Math.round(d/3600)} h`;if(d<172800)return 'ontem';return new Date(v).toLocaleDateString('pt-BR');};
function closePanel(restore){
 if(!current)return;const {el,trigger,onClose}=current;current=null;
 try{onClose&&onClose();}catch{}
 el.remove();document.removeEventListener('keydown',onKey,true);document.removeEventListener('pointerdown',onOutside,true);
 if(trigger){trigger.setAttribute('aria-expanded','false');if(restore)trigger.focus({preventScroll:true});}
}
function onKey(e){
 if(!current)return;
 if(e.key==='Escape'){e.preventDefault();closePanel(true);return;}
 if(e.key==='Tab'){const f=all('a[href],button:not([disabled]),input,textarea,select,[tabindex="0"]',current.el).filter(x=>x.offsetParent!==null);if(!f.length)return;const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
}
function onOutside(e){if(!current)return;if(current.el.contains(e.target)||current.trigger?.contains(e.target))return;if(e.target.closest('dialog[open]'))return;closePanel(false);}
function openPanel(id,title,trigger,build,opts={}){
 if(current&&current.id===id){closePanel(true);return;}
 closePanel(false);
 const el=mk('div',undefined,'opy-panel opy-panel-'+id);el.id='opy-panel-'+id;el.setAttribute('role','dialog');el.setAttribute('aria-label',title);
 const head=mk('div',undefined,'opy-panel-head');
 const h=mk('h2',title);h.id='opy-panel-title-'+id;
 const tools=mk('div',undefined,'opy-panel-tools');
 if(opts.href){const a=mk('a',opts.hrefLabel||'Abrir completo','opy-panel-open');a.href=opts.href;tools.append(a);}
 const x=mk('button','','opy-panel-close');x.type='button';x.setAttribute('aria-label','Fechar '+title);x.textContent='✕';x.onclick=()=>closePanel(true);tools.append(x);
 head.append(h,tools);
 const body=mk('div',undefined,'opy-panel-body');
 el.append(head,body);document.body.append(el);
 current={id,el,trigger,onClose:null,body,head,title:h,setClose(fn){current.onClose=fn;}};
 if(trigger)trigger.setAttribute('aria-expanded','true');
 document.addEventListener('keydown',onKey,true);document.addEventListener('pointerdown',onOutside,true);
 build(body,current);
 const first=$('input,textarea,button:not(.opy-panel-close),a[href]',body)||x;setTimeout(()=>first.focus({preventScroll:true}),30);
}
const skeleton=n=>{const w=mk('div');for(let i=0;i<n;i++)w.append(mk('div',undefined,'opy-skeleton'));return w;};
const errorBox=(msg,retry)=>{const d=mk('div',undefined,'opy-panel-error');d.setAttribute('role','alert');d.append(mk('p',msg));if(retry){const b=mk('button','Tentar de novo','preview-secondary');b.type='button';b.onclick=retry;d.append(b);}return d;};
async function getJson(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
 try{const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:c.signal});const j=await r.json().catch(()=>({}));if(r.status===401){location.href='/entrar/?next='+encodeURIComponent(location.pathname);throw Error('Entre novamente.');}if(!r.ok)throw Error(j.error||'Não foi possível carregar.');return j;}
 catch(e){if(e.name==='AbortError')throw Error('Sem resposta da conexão.');throw e;}finally{clearTimeout(t);}
}
async function postJson(body){
 const r=await fetch('/api/community',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Não foi possível enviar. Tente de novo.');return j;
}
const avatar=(name,url,size)=>S()?S().avatarNode(name,url,size):mk('span');

/* ---------- Mensagens ---------- */
function chatPanel(body,ctx){
 let timer=0,openKey='',lastSig='';
 const list=()=>{
  clearInterval(timer);openKey='';ctx.title.textContent='Mensagens';
  body.replaceChildren(skeleton(3));
  const load=async()=>{
   try{
    const d=await getJson('/api/community?view=chat&key=');
    const items=(d.conversations||[]).filter(c=>!c.archived).slice(0,14);
    const ul=mk('ul',undefined,'opy-inbox-list');
    if(!items.length){const li=mk('li',undefined,'opy-inbox-empty');li.append('Nenhuma conversa ainda. ');const a=mk('a','Encontre alguém para conversar');a.href='/chat/';li.append(a);ul.append(li);}
    for(const c of items){
     const li=mk('li');const b=mk('button',undefined,'opy-inbox-item'+(c.unread?' is-unread':''));b.type='button';
     const meta=mk('span',undefined,'opy-inbox-meta');meta.append(mk('strong',c.name),mk('small',c.last||(c.group?'Grupo privado':'Conversa privada')));
     const side=mk('span',undefined,'opy-inbox-side');if(c.at)side.append(mk('small',ago(c.at)));if(c.unread){const u=mk('span',String(c.unread),'opy-header-badge');u.setAttribute('aria-label',c.unread+' não lidas');side.append(u);}
     b.append(avatar(c.name,c.avatar,44),meta,side);b.onclick=()=>thread(c);li.append(b);ul.append(li);
    }
    if(d.requests?.length){const li=mk('li');const a=mk('a',d.requests.length===1?'1 solicitação de conversa':d.requests.length+' solicitações de conversa','opy-inbox-item opy-inbox-requests');a.href='/chat/';li.append(a);ul.append(li);}
    const sig=JSON.stringify(items.map(c=>[c.key,c.last,c.unread]));
    if(!openKey&&sig!==lastSig){lastSig=sig;body.replaceChildren(ul);}else if(!openKey&&!body.firstChild)body.replaceChildren(ul);
   }catch(e){if(!openKey)body.replaceChildren(errorBox(e.message,list));}
  };
  load();timer=setInterval(()=>{if(!openKey)load();},15000);
 };
 const thread=c=>{
  clearInterval(timer);openKey=c.key;ctx.title.textContent=c.name;
  const wrap=mk('div',undefined,'opy-thread');
  const back=mk('button','← Conversas','opy-thread-back');back.type='button';back.onclick=()=>{lastSig='';list();};
  const log=mk('div',undefined,'opy-thread-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Mensagens com '+c.name);
  const form=mk('form',undefined,'opy-thread-form');
  const input=mk('textarea');input.rows=1;input.maxLength=2000;input.placeholder='Escreva uma mensagem…';input.setAttribute('aria-label','Mensagem para '+c.name);input.enterKeyHint='send';
  const send=mk('button','Enviar','opy-primary');send.type='submit';
  const status=mk('p',undefined,'opy-thread-status');status.setAttribute('role','status');
  form.append(input,send);wrap.append(back,log,status,form);body.replaceChildren(wrap);
  let msgs=[],stick=true;
  const paint=()=>{
   const sig=JSON.stringify(msgs.map(m=>[m.id,m.text,m.pending,m.failed]));if(log.dataset.sig===sig)return;log.dataset.sig=sig;
   const nodes=msgs.map(m=>{const row=mk('div',undefined,'opy-msg'+(m.own?' is-own':'')+(m.pending?' is-pending':'')+(m.failed?' is-failed':''));
    const bubble=mk('p',m.deleted?'Mensagem apagada.':(m.text||''));
    if(m.media&&!m.deleted){const a=mk('a',m.media.kind==='image'?'📷 Foto':m.media.kind==='video'?'🎞️ Vídeo':'📎 '+(m.media.name||'Arquivo'));a.href='/chat/?p='+encodeURIComponent(c.key);a.className='opy-msg-media';bubble.append(' ',a);}
    row.append(bubble);const meta=mk('small',m.failed?'Não enviada · toque em Enviar para tentar de novo':m.pending?'Enviando…':ago(m.createdAt||m.at||Date.now()));row.append(meta);return row;});
   if(!nodes.length)nodes.push(mk('p','Diga olá para começar a conversa.','opy-inbox-empty'));
   log.replaceChildren(...nodes);if(stick)log.scrollTop=log.scrollHeight;
  };
  log.addEventListener('scroll',()=>{stick=log.scrollHeight-log.scrollTop-log.clientHeight<48;});
  const load=async()=>{
   try{const d=await getJson('/api/community?view=chat&key='+encodeURIComponent(c.key));
    if(openKey!==c.key)return;
    const server=(d.messages||[]).slice(-40);const pend=msgs.filter(m=>(m.pending||m.failed)&&!server.some(x=>x.own&&x.text===m.text&&(x.createdAt||0)>=m.at-60000));
    msgs=[...server,...pend];status.textContent='';paint();
    const last=server[server.length-1];if(last&&!last.own&&d.selected&&c.unread!==0){c.unread=0;postJson({action:'chat_read',key:c.key,messageId:last.id,chatView:true,viewKey:c.key}).catch(()=>{});}
   }catch(e){status.textContent=e.message;}
  };
  load();timer=setInterval(load,5000);
  form.addEventListener('submit',async e=>{
   e.preventDefault();const text=input.value.trim();if(!text||send.disabled)return;
   const clientId=crypto.randomUUID();const temp={id:'tmp-'+clientId,own:true,text,pending:true,at:Date.now()};
   msgs=msgs.filter(m=>!m.failed);msgs.push(temp);stick=true;paint();input.value='';input.style.height='';send.disabled=true;
   try{const d=await postJson({action:'dm',toKey:c.key,text,clientId,chatView:true,viewKey:c.key});
    msgs=(d.messages||[]).slice(-40);paint();
   }catch(err){temp.pending=false;temp.failed=true;input.value=text;status.textContent=err.message;paint();}
   finally{send.disabled=false;input.focus({preventScroll:true});}
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(110,input.scrollHeight)+'px';});
  const link=$('.opy-panel-open',ctx.head);if(link)link.href='/chat/?p='+encodeURIComponent(c.key);
 };
 ctx.setClose(()=>clearInterval(timer));
 list();
}

/* ---------- Notificações ---------- */
function notifPanel(body,ctx){
 const load=async()=>{
  body.replaceChildren(skeleton(3));
  try{
   const d=await getJson('/api/community?view=notifications');
   const items=d.items||[];
   const paint=()=>{
    const nodes=items.slice(0,30).map(i=>{
     const followBack=i.kind==='follow'&&i.canFollow&&!i.following;
     const row=mk(i.href&&!i.actionable&&!followBack?'a':'div',undefined,'opy-notif'+(i.unread?' is-unread':''));if(row.tagName==='A')row.href=i.href;
     row.append(avatar((i.text||'?').split(' ')[0],i.avatar,40));
     const txt=mk('div',undefined,'opy-notif-body');txt.append(mk('p',i.text));if(!i.actionable&&i.createdAt)txt.append(mk('small',ago(i.createdAt)));
     const act=(label,primary,fn)=>{const b=mk('button',label,primary?'opy-primary':'preview-secondary');b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();items.splice(items.indexOf(i),1);paint();}catch(e){S().showError(e.message);b.disabled=false;}};return b;};
     const acts=mk('div',undefined,'opy-notif-actions');
     if(i.kind==='friend'){acts.append(act('Aceitar',true,()=>S().change({action:'friend',authorKey:i.key})),act('Recusar',false,()=>S().change({action:'friend_decline',authorKey:i.key})));}
     else if(i.kind==='invite'){acts.append(act('Aceitar',true,()=>S().change({action:'community_accept_invite',communityId:i.communityId})),act('Recusar',false,()=>S().change({action:'community_decline_invite',communityId:i.communityId})));}
     else if(followBack){acts.append(act('Seguir de volta',true,async()=>{await S().change({action:'follow',authorKey:i.key,following:true});}));}
     if(acts.children.length)txt.append(acts);row.append(txt);return row;});
    if(!nodes.length){const e=mk('div',undefined,'opy-inbox-empty');e.append(mk('strong','Tudo em silêncio por aqui'),mk('p','Quando alguém pedir sua amizade, convidar você para uma comunidade ou interagir com o que você publicou, o Maracá avisa aqui.'));nodes.push(e);}
    body.replaceChildren(...nodes);
   };
   paint();
   if(items.some(i=>i.unread&&!i.actionable))S().change({action:'notifications_seen'}).catch(()=>{});
  }catch(e){body.replaceChildren(errorBox(e.message,load));}
 };
 load();
}

/* ---------- EtnIA ---------- */
function etniaPanel(body,ctx){
 const log=mk('div',undefined,'opy-etnia-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-label','Conversa com a EtnIA');
 const sugg=mk('div',undefined,'opy-etnia-sugg');
 const form=mk('form',undefined,'opy-thread-form');const input=mk('textarea');input.rows=1;input.maxLength=500;input.placeholder='Pergunte sobre o Etnias…';input.setAttribute('aria-label','Pergunta para a EtnIA');
 const send=mk('button','Perguntar','opy-primary');send.type='submit';const status=mk('p',undefined,'opy-thread-status');status.setAttribute('role','status');
 form.append(input,send);body.append(log,sugg,status,form);
 const bubble=(role,text,src)=>{const b=mk('div',undefined,'etnia-msg'+(role==='user'?' etnia-msg-user':''));b.append(mk('strong',role==='user'?'Você':'EtnIA'),mk('p',text));if(src)b.append(mk('small',src));return b;};
 const paint=()=>{const items=Array.isArray(S().state?.etnia)?S().state.etnia:[];const nodes=items.slice(-12).map(i=>bubble(i.role,i.text,i.sourceTitle?'Fonte: '+i.sourceTitle:''));if(!nodes.length)nodes.push(bubble('etnia','Olá! Pergunte como publicar, o que é o Etnias ou como usar cada área.',''));log.replaceChildren(...nodes);log.scrollTop=log.scrollHeight;};
 for(const q of ['Como publico uma foto?','O que é o Etnias?','Onde ficam as notificações?']){const b=mk('button',q,'opy-chip');b.type='button';b.onclick=()=>{input.value=q;form.requestSubmit();};sugg.append(b);}
 paint();
 form.addEventListener('submit',async e=>{
  e.preventDefault();const text=input.value.trim();if(!text){status.textContent='Escreva a pergunta antes de enviar.';return;}
  send.disabled=true;status.textContent='';input.value='';
  const mine=bubble('user',text,''),wait=bubble('etnia','Consultando o material do Etnias…','');wait.classList.add('is-pending');log.append(mine,wait);log.scrollTop=log.scrollHeight;
  try{await S().change({action:'etnia',text});paint();}catch(err){status.textContent=err.message;input.value=text;mine.remove();wait.remove();}
  finally{send.disabled=false;input.focus({preventScroll:true});}
 });
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
}

/* ---------- ligação com os botões ---------- */
const PANELS={
 chat:{title:'Mensagens',href:'/chat/',build:chatPanel,page:'messages',sel:'.messages-notification-container a'},
 notif:{title:'Notificações',href:'/notificacoes/',build:notifPanel,page:'notifications',sel:'.notification-container a'},
 etnia:{title:'EtnIA',href:'/etnia/',hrefLabel:'Tela cheia',build:etniaPanel,page:'etnia',sel:'.opy-bottom [data-opy-destination=etnia]'}
};
function bind(){
 for(const [id,p] of Object.entries(PANELS)){
  for(const t of all(p.sel)){
   if(t.dataset.panel)continue;t.dataset.panel=id;
   t.setAttribute('aria-haspopup','dialog');t.setAttribute('aria-expanded','false');
   t.addEventListener('click',e=>{
    if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    if(route===p.page)return; // já está na página inteira
    e.preventDefault();e.stopImmediatePropagation();
    openPanel(id,p.title,t,p.build,{href:p.href,hrefLabel:p.hrefLabel});
   },true);
  }
 }
}
window.OpyPanels={open:(id)=>{const p=PANELS[id];const t=$(p.sel);if(p)openPanel(id,p.title,t,p.build,{href:p.href,hrefLabel:p.hrefLabel});},close:()=>closePanel(true)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
// Troca de rota por navegação interna: fecha o painel.
window.addEventListener('pagehide',()=>closePanel(false));
})();
