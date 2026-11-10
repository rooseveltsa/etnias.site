(() => {
'use strict';
const $ = selector => document.querySelector(selector);
const node = (tag, value, cls) => { const el=document.createElement(tag); if(value!==undefined)el.textContent=value; if(cls)el.className=cls; return el; };
const status = message => { $('#chat-status').textContent=message; };
// Foto de perfil quando existe (mesmas origens aceitas em preview.js), inicial do nome quando não.
const avatarOk = url => !!url && (/^\/api\/media\?id=[a-f0-9-]{36}$/.test(url) || /^\/assets\/archive\/avatar-[a-f0-9]{20}\.(jpg|jpeg|png|webp|gif)$/.test(url) || /^\/legado\/upload\/[\w./%-]+\.(jpg|jpeg|png|webp|gif)$/i.test(url));
function avatarEl(name, url) {
 if (avatarOk(url)) { const img=node('img',undefined,'preview-avatar preview-avatar-image'); img.src=url; img.alt=''; img.loading='lazy'; return img; }
 const el=node('span',(name||'?').slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar'); el.setAttribute('aria-hidden','true'); return el;
}
const time = value => new Intl.DateTimeFormat('pt-BR',{timeStyle:'short'}).format(new Date(value));
const dayKey = value => new Date(value).toDateString();
function dayLabel(value) {
 const d=new Date(value),today=new Date(),yesterday=new Date(Date.now()-864e5);
 if(d.toDateString()===today.toDateString())return 'Hoje';
 if(d.toDateString()===yesterday.toDateString())return 'Ontem';
 return new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',...(d.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})}).format(d);
}
function shortWhen(value) {
 const label=dayLabel(value);
 if(label==='Hoje')return time(value);
 if(label==='Ontem')return label;
 if(Date.now()-value>6*864e5)return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(new Date(value));
 return new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(new Date(value));
}
let data, key=new URLSearchParams(location.search).get('p') || '', query='', loading=false, sending=false, older=false, reply=null, attachment=null, recorder=null, stream=null, timer, showContext=false, lastTypingSent=0;
const drafts=new Map(), pending=new Map();
let generation=0, reading=false, recordingGeneration=0, fileGeneration=0, box='main';
const relationLabel={accepted:'Contato',request_out:'Solicitação enviada',request_in:'Quer conversar com você',declined_out:'Não aceitou a conversa',declined_in:'Você recusou',none:'Ainda não conectados'};
const accepts={document:'application/pdf,text/plain',camera:'image/jpeg,image/png,image/webp',gallery:'image/jpeg,image/png,image/webp,video/mp4,video/webm',audio:'audio/mpeg,audio/ogg,audio/webm,audio/mp4'};
function syncMobileView() {
 const ws=$('#chat-workspace');
 if(ws&&ws.dataset)ws.dataset.mobileView=key?'thread':'list';
 fitMessenger();
}
// No celular a conversa ocupa só o que sobra entre o cabeçalho e a barra inferior (que muda com a fonte do aparelho),
// para os botões de aceitar/responder nunca ficarem por baixo da barra.
function fitMessenger() {
 const m=document.querySelector('#chat-workspace .chat-messenger');if(!m?.getBoundingClientRect||typeof innerWidth!=='number')return;
 if(innerWidth>700){m.style.height='';return;}
 const bar=document.querySelector('.opy-bottom'),barH=bar&&getComputedStyle(bar).display!=='none'?bar.getBoundingClientRect().height:0;
 m.style.height=Math.max(320,Math.floor(innerHeight-(m.getBoundingClientRect().top+scrollY)-barH-12))+'px';
}
window.addEventListener('resize',fitMessenger);
syncMobileView();
function button(label, fn, parent) { const b=node('button',label,'preview-secondary');b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status(e.message);}finally{b.disabled=false;}};parent.append(b);return b; }
async function request(body, params={}) {
 const url='/api/community?'+new URLSearchParams({view:'chat',key,...params});
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
 try {
  const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,chatView:true,viewKey:key})}:{})});
  const json=await response.json().catch(()=>({}));
  if(response.status===401){location.href='/entrar/?next='+encodeURIComponent(location.pathname+location.search);throw Error('Entre novamente.');}
  if(!response.ok)throw Error(json.error || 'Não foi possível concluir. Tente novamente.');
  return json;
 } catch(e) { if(e.name==='AbortError'||e instanceof TypeError)throw Error('Sem resposta da conexão. Seu rascunho continua aqui.');throw e; }
 finally {clearTimeout(timeout);}
}
async function action(body) { const current=key,version=++generation;loading=true;try{const next=await request(body);if(current===key&&version===generation){data=next;older=false;render();}}finally{if(version===generation)loading=false;} }
function dialog(title, build) { if($('#chat-sheet').open)$('#chat-sheet').close();$('#chat-dialog-title').textContent=title;const box=$('#chat-dialog-body');box.replaceChildren();build(box);if(!$('#chat-dialog').open)$('#chat-dialog').showModal(); }
function field(parent,label,value='',multiline=false) { const wrap=node('label',label);const input=node(multiline?'textarea':'input');input.value=value;input.maxLength=multiline?2000:60;wrap.append(input);parent.append(wrap);return input; }
function selectPerson(parent,label,people=data.contacts) { const wrap=node('label',label),select=node('select'); for(const p of people){const option=node('option',p.name+(p.username?' (@'+p.username+')':''));option.value=p.key;select.append(option);}wrap.append(select);parent.append(wrap);return select; }
function setRecording(on) { const b=$('#chat-voice');b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Parar gravação':'Gravar áudio');b.classList.toggle('is-recording',on); }
function stopRecording() { recordingGeneration++; if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer);setRecording(false); }
function stash() { if(key)drafts.set(key,{text:$('#chat-text').value,reply,attachment}); }
function grow() { const t=$('#chat-text');t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'; }
async function choose(next) {
 if(sending){status('Aguarde o envio terminar.');return;}stopRecording();fileGeneration++;stash();key=next;query='';$('#chat-search').value='';$('#chat-search-form').hidden=true;older=false;reply=null;attachment=null;
 syncMobileView();
 const saved=drafts.get(key);$('#chat-text').value=saved?.text || '';reply=saved?.reply || null;attachment=saved?.attachment || null;grow();
 history.replaceState(null,'','/chat/'+(key?'?p='+encodeURIComponent(key):''));
 $('#chat-form').hidden=true;$('#chat-send').disabled=true;$('#chat-name').textContent=key?'Carregando conversa…':'Escolha uma conversa';$('#chat-log').replaceChildren();$('#chat-log').dataset.signature='';
 await refresh(true);if(key)$('#chat-text').focus();
}
function media(item,parent) {
 if(!item)return;
 if(item.kind==='file'){const a=node('a','Baixar '+item.name,'chat-file-link');a.href=item.url;a.download=item.name;parent.append(a);}
 else if(item.kind==='image'){
  const b=button('',()=>dialog(item.name,box=>{const img=node('img');img.src=item.url;img.alt=item.name;box.append(img);}),parent);b.className='chat-image-btn';b.setAttribute('aria-label','Abrir imagem '+item.name);
  const img=node('img',undefined,'chat-image');img.src=item.url;img.alt=item.name;img.loading='lazy';b.append(img);
 } else {const el=node(item.kind==='audio'?'audio':'video');el.src=item.url;el.controls=true;el.preload='none';el.setAttribute('playsinline','');el.setAttribute('aria-label',item.name);parent.append(el);}
}
function messageActions(m) {
 dialog('Ações da mensagem',actions=>{
  if(!m.deleted){
   const react=node('div',undefined,'chat-react-row');react.setAttribute('aria-label','Reações');actions.append(react);
   for(const symbol of ['👍','❤️','👏','😂','😢']){const b=button(symbol,async()=>{await action({action:'chat_react',messageId:m.id,reaction:m.reaction===symbol?'':symbol});$('#chat-dialog').close();},react);b.setAttribute('aria-label','Reagir com '+symbol);b.setAttribute('aria-pressed',String(m.reaction===symbol));}
   button('Responder',()=>{reply=m;paintDraft();$('#chat-dialog').close();$('#chat-text').focus();},actions);
   button('Copiar',async()=>{await navigator.clipboard.writeText(m.text);$('#chat-dialog').close();status('Texto copiado.');},actions);
   button('Encaminhar texto',()=>dialog('Encaminhar texto',box=>{box.append(node('p','Confirme que você tem permissão para compartilhar este texto em outra conversa. Anexos não serão copiados.'));const target=selectPerson(box,'Para quem?');button('Encaminhar',async()=>{await action({action:'dm',toKey:target.value,text:m.text,clientId:crypto.randomUUID()});$('#chat-dialog').close();status('Texto encaminhado.');},box);}),actions);
   if(m.own)button('Editar',()=>dialog('Editar mensagem',box=>{const input=field(box,'Texto',m.text,true);button('Salvar',async()=>{await action({action:'chat_edit',messageId:m.id,text:input.value});$('#chat-dialog').close();},box);}),actions);
  }
  button('Apagar para mim',async()=>{await action({action:'chat_delete',messageId:m.id,scope:'me'});$('#chat-dialog').close();},actions);
  if(m.own&&!m.deleted)button('Apagar para todos',()=>dialog('Apagar mensagem',box=>{box.append(node('p','O texto e o anexo deixam de estar disponíveis nesta conversa. Cópias feitas fora da plataforma não podem ser removidas.'));button('Confirmar exclusão',async()=>{await action({action:'chat_delete',messageId:m.id,scope:'all'});$('#chat-dialog').close();},box);}),actions);
  if(!m.own)button('Registrar denúncia',()=>dialog('Registrar denúncia',box=>{box.append(node('p','O registro fica salvo, mas a equipe de revisão ainda não está conectada nesta prévia. Bloqueie a pessoa para impedir novas mensagens. Não use este canal para emergências.'));const input=field(box,'Motivo','',true);input.maxLength=500;button('Registrar',async()=>{await action({action:'chat_report',messageId:m.id,reason:input.value});$('#chat-dialog').close();status('Registro salvo. Revisão humana ainda não conectada.');},box);}),actions);
 });
}
function message(m, showDay) {
 const article=node('article',undefined,'chat-row'+(m.own?' is-mine':'')+(m.call?' is-call':''));article.dataset.message=m.id;
 if(showDay)article.append(node('p',dayLabel(m.createdAt),'chat-day'));
 if(m.call){
  const pill=node('p',undefined,'chat-call-pill'+(['missed','declined','failed'].includes(m.call.status)?' is-missed':''));
  pill.append(node('span',m.text),node('small',time(m.createdAt)));article.append(pill);return article;
 }
 const bubble=node('div',undefined,'chat-bubble'+(m.own?' is-mine':''));
 if(data?.selected?.group&&!m.own)bubble.append(node('strong',m.fromName,'chat-author'));
 if(m.reply)bubble.append(node('blockquote',(m.reply.name?m.reply.name+': ':'')+m.reply.text));
 if(m.deleted||m.text)bubble.append(node('p',m.deleted?'Mensagem apagada':m.text,m.deleted?'is-deleted':undefined));
 media(m.media,bubble);article.append(bubble);
 const meta=node('div',undefined,'chat-meta');
 const when=node('small',time(m.createdAt)+(m.editedAt?' · editada':''));when.title=new Date(m.createdAt).toLocaleString('pt-BR');meta.append(when);
 if(m.own){const tick=node('small','✓','chat-tick');tick.title='Salva no servidor';tick.setAttribute('aria-label','Salva no servidor');meta.append(tick);}
 if(Object.keys(m.reactions).length)meta.append(node('span',Object.entries(m.reactions).map(([r,n])=>r+(n>1?' '+n:'')).join(' '),'chat-reactions'));
 const more=button('⋯',()=>messageActions(m),meta);more.className='chat-bubble-more';more.setAttribute('aria-label','Ações da mensagem');
 article.append(meta);
 return article;
}
function paintNotice(selected) {
 const notice=$('#chat-notice'),actions=$('#chat-notice-actions');actions.replaceChildren();
 notice.hidden=!selected?.notice;if(!selected?.notice)return;
 $('#chat-notice-text').textContent=selected.notice;
 if(selected.relation==='request_in'){
  const ok=button('Aceitar',async()=>{await action({action:'chat_request_accept',key});box='main';render();status('Conversa aceita.');},actions);ok.className='opy-primary';
  button('Recusar',async()=>{const old=key;await action({action:'chat_request_decline',key:old});await choose('');status('Solicitação recusada.');},actions);
  button('Bloquear',async()=>{const old=key;await action({action:'chat_block',key:old,blocked:true});await choose('');status('Pessoa bloqueada.');},actions);
 }
}
function paintContext() {
 const panel=$('#chat-context'),toggle=$('#chat-info-toggle');
 if(!panel||!toggle)return;
 const selected=data?.selected;
 toggle.hidden=!selected;
 toggle.setAttribute('aria-expanded',String(!!(selected&&showContext)));
 if(!selected||!showContext){panel.hidden=true;panel.replaceChildren();return;}
 panel.hidden=false;panel.replaceChildren();
 const head=node('div',undefined,'chat-context-head');
 const titleWrap=node('div');
 titleWrap.append(node('h3',selected.name));
 if(selected.username)titleWrap.append(node('small','@'+selected.username));
 if(selected.affiliation)titleWrap.append(node('small',selected.affiliation));
 head.append(titleWrap);
 const closeBtn=button('Fechar',()=>{showContext=false;paintContext();},head);
 closeBtn.id='chat-context-close';
 panel.append(head);
 if(selected.bio||selected.description)panel.append(node('p',selected.bio||selected.description,'chat-context-bio'));
 panel.append(node('p',selected.group?'Grupo privado com convite. Mensagens anteriores à sua entrada não são exibidas.':'Conversa direta privada entre contas autenticadas da Casa Opy.','chat-context-note'));
 if(selected.group&&selected.members?.length){
  const sec=node('section',undefined,'chat-context-section');
  sec.append(node('h4','Participantes ('+selected.members.length+')'));
  for(const m of selected.members)sec.append(node('small',m.name+(m.admin?' · administração':'')));
  panel.append(sec);
 }
 if(selected.sharedMedia?.length){
  const sec=node('section',undefined,'chat-context-section');
  sec.append(node('h4','Anexos compartilhados ('+selected.sharedMedia.length+')'));
  for(const item of selected.sharedMedia){
   const a=node('a',item.name,'preview-text-link');a.href=item.url;if(item.kind==='file')a.download=item.name;
   sec.append(a);
  }
  panel.append(sec);
 }
}
function paintDraft() {
 const area=$('#chat-reply');area.replaceChildren();if(reply){area.append(node('p','Respondendo: '+reply.text.slice(0,100)));button('Cancelar resposta',()=>{reply=null;paintDraft();},area);}
 const slot=$('#chat-attachment');slot.replaceChildren();if(attachment){slot.append(node('span',attachment.name));button('Remover anexo',()=>{attachment=null;$('#chat-file').value='';paintDraft();},slot);}
 const retry=$('#chat-retry');retry.replaceChildren();const job=pending.get(key);if(job&&!sending){retry.append(node('p','Envio sem confirmação. Tentar novamente não duplica a mensagem.'));button('Tentar novamente',()=>send(job),retry);button('Manter rascunho e cancelar tentativa',()=>{pending.delete(key);paintDraft();},retry);}
 $('#chat-send').disabled=sending||!!job||!!data?.selected?.blocked||data?.selected?.key!==key;
}
function render() {
 if(!data)return;
 syncMobileView();
 const filter=$('#chat-find').value.trim().toLocaleLowerCase('pt-BR'),showArchived=$('#chat-archives').checked;
 const list=$('#chat-list');
 const source=box==='requests'?data.requests:data.conversations;
 const entries=source.filter(p=>!p.archived||showArchived).filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(filter));
 // Contador do cabeçalho acompanha a leitura, sem esperar a atualização geral da página.
 const headerBadge=document.querySelector('.messages-notification-container a');if(headerBadge){const unread=data.conversations.reduce((s,c)=>s+(c.unread||0),0)+data.requests.length+data.invitations.length;let b=headerBadge.querySelector('.opy-header-badge');if(unread>0){if(!b){b=node('span',undefined,'opy-header-badge');headerBadge.append(b);}b.textContent=unread>99?'99+':String(unread);}else if(b)b.remove();}
 const open=new Set(data.conversations.map(c=>c.key));
 const people=box==='main'?(data.people||[]).filter(p=>!open.has(p.key)).filter(p=>p.name.toLocaleLowerCase('pt-BR').includes(filter)||(p.username||'').toLocaleLowerCase('pt-BR').includes(filter)):[];
 // A lista só é reconstruída quando muda: a atualização a cada 4 s não derruba o toque nem o foco de quem está escolhendo.
 const listSig=JSON.stringify([box,filter,showArchived,key,entries,people,data.invitations]);
 if(list.dataset.sig!==listSig){list.dataset.sig=listSig;list.replaceChildren();
 for(const b of document.querySelectorAll('[data-box]'))b.setAttribute('aria-pressed',String(b.dataset.box===box));
 const rc=$('#chat-requests-count');rc.hidden=!data.requests.length;rc.textContent=String(data.requests.length);
 for(const p of entries){
  const li=node('li');const b=button('',()=>choose(p.key),li);b.className='chat-person-btn';b.setAttribute('aria-pressed',String(key===p.key));
  const av=avatarEl(p.name,p.avatar);
  const meta=node('span',undefined,'chat-person-meta');meta.append(node('strong',p.name),node('small',p.declined?'Não aceitou a conversa':p.pending?'Solicitação enviada · '+(p.last||''):(p.pinned?'Fixada · ':'')+(p.last || (p.group?'Grupo privado':'Conversa privada'))));
  const side=node('span',undefined,'chat-person-side');if(p.at)side.append(node('small',shortWhen(p.at)));if(p.unread){const u=node('span',String(p.unread),'chat-unread');u.setAttribute('aria-label',p.unread+' não lidas');side.append(u);}
  b.append(av,meta,side);list.append(li);
 }
 // Caixa de entrada: depois das conversas, as pessoas com quem dá para começar a conversar (amigos e quem você segue).
 if(!entries.length)list.append(node('li',box==='requests'?'Nenhuma solicitação. Quando alguém sem vínculo com você mandar mensagem, ela aparece aqui para você aceitar ou recusar.':filter&&!people.length?'Ninguém com esse nome nas suas conversas. Use o lápis para procurar outras pessoas.':people.length?'Nenhuma conversa ainda. Comece com alguém que você já conhece:':'Nenhuma conversa ainda. Toque no lápis para procurar alguém pelo nome.','chat-list-empty'));
 if(people.length){
  if(entries.length)list.append(node('li','Pessoas','chat-list-heading'));
  for(const p of people){
   const li=node('li');const b=button('',()=>choose(p.key),li);b.className='chat-person-btn';b.setAttribute('aria-pressed',String(key===p.key));
   const meta=node('span',undefined,'chat-person-meta');meta.append(node('strong',p.name),node('small',(p.username?'@'+p.username+' · ':'')+(p.relation==='accepted'?'Toque para conversar':p.relation==='declined_in'?'Você recusou antes · enviar reabre a conversa':'Você segue · a primeira mensagem vai como solicitação')));
   b.append(avatarEl(p.name,p.avatar),meta);list.append(li);
  }
 }
 }
 const invites=$('#chat-invitations');invites.replaceChildren();for(const invite of data.invitations){const card=node('div',undefined,'chat-invite');card.append(node('p','Convite: '+invite.name));button('Aceitar',()=>action({action:'chat_group_accept',key:invite.key}),card);button('Recusar',()=>action({action:'chat_group_decline',key:invite.key}),card);invites.append(card);}
 const selected=data.selected;$('#chat-name').textContent=selected?.name || 'Escolha uma conversa';
 const avEl=$('#chat-avatar');if(avEl)avEl.replaceWith(Object.assign(avatarEl(selected?.name||'C',selected?.avatar),{id:'chat-avatar'}));
 const typingNames=selected?.typing||[];
 $('#chat-subtitle').textContent=selected ? (selected.blocked?'Envio bloqueado.':typingNames.length?typingNames.join(', ')+' está digitando…':selected.group?selected.members.length+' participantes':'Conversa privada'+(selected.username?' · @'+selected.username:'')) : 'Encontre alguém pelo nome ou crie um grupo.';
 $('#chat-call-audio').hidden=!(selected?.canCall||selected?.group);$('#chat-call-video').hidden=!(selected?.canCall||selected?.group);
 $('#chat-options').hidden=!selected;$('#chat-older').hidden=!data.hasMore;
 paintNotice(selected);
 $('#chat-form').hidden=!selected||!selected.canSend||selected.relation==='request_in';
 // Para quem ainda não aceitou: só texto, sem anexo nem áudio.
 const textOnly=selected?.relation==='none';$('#chat-plus').hidden=textOnly;$('#chat-voice').hidden=textOnly;
 const log=$('#chat-log');const signature=JSON.stringify(data.messages);
 if(log.dataset.signature!==signature){const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;const scroll=log.scrollTop,height=log.scrollHeight;log.dataset.signature=signature;const existing=new Map([...document.querySelectorAll('#chat-log [data-message]')].map(el=>[el.dataset.message,el]));
 const ids=new Set(data.messages.map(m=>m.id));for(const [id,el] of existing)if(!ids.has(id))el.remove();
 for(const empty of document.querySelectorAll('#chat-log .chat-empty'))empty.remove();
 data.messages.forEach((m,index)=>{const showDay=index===0||dayKey(data.messages[index-1].createdAt)!==dayKey(m.createdAt);let el=existing.get(m.id);const value=JSON.stringify([m,showDay,!!selected?.group]);if(!el||el.dataset.value!==value){const next=message(m,showDay);next.dataset.value=value;if(el){const playing=el.querySelector('audio,video'),replacement=next.querySelector('audio,video');if(playing&&replacement&&playing.src===replacement.src)replacement.replaceWith(playing);el.replaceWith(next);}el=next;}if(log.children[index]!==el)log.insertBefore(el,log.children[index]||null);});
 if(!data.messages.length)log.append(node('p',query?'Nenhuma mensagem encontrada.':data.selected?'A conversa começa com sua primeira mensagem.':'Escolha uma conversa ao lado ou toque no lápis para começar uma nova.','chat-empty'));if(older)log.scrollTop=scroll+log.scrollHeight-height;else if(nearBottom)log.scrollTop=log.scrollHeight;}
 paintContext();
 paintDraft();
}
async function markRead(){
 if(!key||!data?.selected||data.selected.key!==key||document.hidden||query||loading||sending||reading)return;
 const log=$('#chat-log');if(log.scrollHeight-log.scrollTop-log.clientHeight>60)return;
 const conv=data.conversations.find(c=>c.key===key),last=data.messages.at(-1);if(!conv?.unread||!last)return;
 reading=true;try{await action({action:'chat_read',key,messageId:last.id});}finally{reading=false;}
}
async function refresh(force=false){if((loading&&!force)||sending)return;loading=true;const current=key,version=++generation;try{const next=await request(null,{q:query});if(current!==key||version!==generation)return;if(older){const ids=new Set(next.messages.map(m=>m.id));next.messages=[...data.messages.filter(m=>!ids.has(m.id)),...next.messages];next.hasMore=data.hasMore;}data=next;render();status(navigator.onLine?'':'Sem conexão.');}catch(e){if(version===generation)status(e.message);}finally{if(version===generation)loading=false;}await markRead().catch(e=>status(e.message));}
async function send(job){
 if(sending||data?.selected?.key!==key)return;const destination=key;const submittedText=$('#chat-text').value,submittedAttachment=attachment,submittedReply=reply;
 if(!job&&pending.get(key))return;
 if(!job){if(!submittedText.trim()&&!attachment)return;job={action:'dm',toKey:key,text:$('#chat-text').value,clientId:crypto.randomUUID(),replyTo:reply?.id || null,media:attachment?{name:attachment.name,data:attachment.data}:null};}
 generation++;loading=false;pending.set(destination,job);sending=true;paintDraft();status('Enviando…');
 try{data=await request(job);pending.delete(destination);drafts.delete(destination);if(key===destination){if($('#chat-text').value===submittedText&&submittedText===job.text){$('#chat-text').value='';grow();}if(attachment===submittedAttachment&&attachment?.data===job.media?.data){attachment=null;$('#chat-file').value='';}if(reply===submittedReply&&reply?.id===job.replyTo)reply=null;older=false;render();$('#chat-log').scrollTop=$('#chat-log').scrollHeight;}status('');}
 catch(e){status(e.message);}finally{sending=false;paintDraft();}
}
async function fileData(file){file=await (window.OpyShared?.shrinkPhoto||(f=>f))(file);if(file.size>2*1024*1024)throw Error('Escolha um anexo de até 2 MB.');const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler o anexo.'));reader.readAsDataURL(file);});return {name:file.name,data:content.replace(/^data:[^;]+(?:;codecs=[^;]+)?;base64,/, 'data:'+file.type.split(';')[0]+';base64,')};}
function call(kind){
 const selected=data?.selected;if(!selected)return;
 if(selected.group){if(!window.OpyCalls?.startGroup){status('As chamadas não carregaram. Recarregue a página.');return;}window.OpyCalls.startGroup({groupKey:selected.key,name:selected.name,kind}).catch(e=>status(e.message));return;}
 if(!selected.canCall){status('Você poderá ligar quando a conversa com '+selected.name+' estiver aceita.');return;}
 if(!window.OpyCalls){status('As chamadas não carregaram. Recarregue a página.');return;}
 window.OpyCalls.start({key:selected.key,name:selected.name,kind}).catch(e=>status(e.message));
}
$('#chat-back').onclick=()=>choose('');
$('#chat-info-toggle').onclick=()=>{showContext=!showContext;paintContext();};
$('#chat-call-audio').onclick=()=>call('audio');
$('#chat-call-video').onclick=()=>call('video');
$('#chat-text').addEventListener('input',()=>{
 grow();
 const now=Date.now();
 if(key&&data?.selected?.key===key&&!data.selected.blocked&&$('#chat-text').value.trim()&&now-lastTypingSent>2500){
  lastTypingSent=now;
  request({action:'chat_typing',key,typing:true}).catch(()=>{});
 }
});
// Enter envia em teclado físico; no celular Enter quebra linha.
$('#chat-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&matchMedia('(pointer:fine)').matches){e.preventDefault();send();}});
$('#chat-form').onsubmit=e=>{e.preventDefault();send();};
$('#chat-find').oninput=render;$('#chat-archives').onchange=render;
$('#chat-search-form').onsubmit=async e=>{e.preventDefault();query=$('#chat-search').value;older=false;await refresh(true);};
$('#chat-plus').onclick=()=>$('#chat-sheet').showModal();
$('#chat-sheet').addEventListener('click',e=>{if(e.target===$('#chat-sheet'))$('#chat-sheet').close();});
for(const b of document.querySelectorAll('[data-pick]'))b.onclick=()=>{const input=$('#chat-file');input.accept=accepts[b.dataset.pick];if(b.dataset.pick==='camera')input.setAttribute('capture','environment');else input.removeAttribute('capture');$('#chat-sheet').close();input.click();};
$('#chat-file').onchange=async e=>{const current=key,version=++fileGeneration;try{const file=e.target.files[0];if(file){const result=await fileData(file);if(current!==key||version!==fileGeneration)return;attachment=result;}paintDraft();}catch(error){if(current===key)status(error.message);}};
// Seletor completo de emojis (preview.js, mesmo das publicações e comentários).
$('#chat-emoji').onclick=()=>dialog('Emojis',box=>{if(!window.OpyEmoji){status('Os emojis não carregaram. Recarregue a página.');return;}window.OpyEmoji.open(box,$('#chat-text'),()=>$('#chat-dialog').close());});
$('#chat-older').onclick=async()=>{if(loading||!data.messages.length)return;loading=true;const current=key,version=++generation;try{const page=await request(null,{before:data.messages[0].id,q:query});if(current!==key||version!==generation)return;data.messages=[...page.messages,...data.messages];data.hasMore=page.hasMore;older=true;render();}catch(e){status(e.message);}finally{if(version===generation)loading=false;}};
$('#chat-log').addEventListener('scroll',()=>{markRead().catch(()=>{});},{passive:true});
for(const b of document.querySelectorAll('[data-box]'))b.onclick=()=>{box=b.dataset.box;render();};
$('#chat-new').onclick=()=>dialog('Nova mensagem',panel=>{
 const wrap=node('label','Para');const input=node('input');input.type='search';input.maxLength=60;input.placeholder='Nome ou @usuário';wrap.append(input);panel.append(wrap);
 const results=node('ul',undefined,'chat-people chat-found');panel.append(results);
 const hint=node('p','Digite pelo menos 2 letras do nome ou @usuário.','chat-hint');panel.append(hint);
 let wait=0,ask=0;
 input.oninput=()=>{clearTimeout(wait);const term=input.value.trim();results.replaceChildren();hint.hidden=term.length>=2;if(term.length<2)return;
  wait=setTimeout(async()=>{const mine=++ask;try{const page=await request(null,{find:term});if(mine!==ask)return;
   if(!page.found.length){results.append(node('li','Ninguém encontrado com esse nome.','chat-list-empty'));return;}
   for(const p of page.found){const li=node('li');const b=button('',async()=>{$('#chat-dialog').close();box='main';await choose(p.key);},li);b.className='chat-person-btn';
    const av=avatarEl(p.name,p.avatar);
    const meta=node('span',undefined,'chat-person-meta');meta.append(node('strong',p.name),node('small',(p.username?'@'+p.username+' · ':'')+(p.blocked?'Bloqueado':relationLabel[p.relation]||'')));
    b.append(av,meta);results.append(li);}
  }catch(e){if(mine===ask)hint.hidden=false,hint.textContent=e.message;}},300);};
 setTimeout(()=>input.focus(),50);
});
$('#chat-new-group').onclick=()=>dialog('Novo grupo privado',box=>{
 const name=field(box,'Nome do grupo');box.append(node('p','As pessoas precisam aceitar o convite. Até 12 participantes nesta prévia.'));
 if(!data.contacts.length)box.append(node('p','Você ainda não tem contatos. Grupos só aceitam pessoas com quem você já conversa.'));
 const members=[];for(const p of data.contacts.filter(p=>!p.blocked)){const label=node('label',p.name);const check=node('input');check.type='checkbox';check.value=p.key;label.prepend(check);box.append(label);members.push(check);}
 button('Criar e convidar',async()=>{await action({action:'chat_group_create',name:name.value,members:members.filter(c=>c.checked).map(c=>c.value)});$('#chat-dialog').close();status('Grupo criado. Os convites aguardam aceitação.');},box);
});
$('#chat-options').onclick=()=>dialog('Opções da conversa',box=>{
 const selected=data.selected,p=data.conversations.find(c=>c.key===key) || {};
 button('Buscar nesta conversa',()=>{$('#chat-search-form').hidden=false;$('#chat-dialog').close();$('#chat-search').focus();},box);
 for(const [field,label] of [['pinned','Fixar'],['muted','Silenciar avisos'],['archived','Arquivar'],['unread','Marcar como não lida']])button((p[field]?'Desativar: ':'')+label,async()=>{await action({action:'chat_preferences',key,[field]:!p[field]});$('#chat-dialog').close();if(field==='unread')await choose('');},box);
 if(!selected.group){const ownBlock=selected.blockedByMe;button(ownBlock?'Desbloquear pessoa':'Bloquear pessoa',async()=>{await action({action:'chat_block',key,blocked:!ownBlock});$('#chat-dialog').close();},box);}
 else {
  box.append(node('p',selected.description));
  for(const member of selected.members){const row=node('div',member.name+(member.admin?' · administração':''));if(selected.admin && member.key!=='id:'+data.me.id){button('Remover participante',()=>action({action:'chat_group_remove',key,memberKey:member.key}).then(()=>$('#chat-dialog').close()),row);if(!member.admin)button('Tornar administrador',()=>action({action:'chat_group_admin',key,memberKey:member.key}).then(()=>$('#chat-dialog').close()),row);}box.append(row);}
  if(selected.admin){const name=field(box,'Nome',selected.name),description=field(box,'Descrição',selected.description,true);description.maxLength=500;button('Salvar grupo',async()=>{await action({action:'chat_group_update',key,name:name.value,description:description.value});$('#chat-dialog').close();},box);const target=selectPerson(box,'Convidar pessoa',data.contacts.filter(p=>!selected.members.some(m=>m.key===p.key)));button('Enviar convite',async()=>{await action({action:'chat_group_invite',key,memberKey:target.value});$('#chat-dialog').close();},box);}
  button('Sair do grupo',async()=>{await action({action:'chat_group_leave',key});$('#chat-dialog').close();await choose('');},box);
  box.append(node('p','Chamadas em grupo ainda não estão disponíveis. Chamadas de voz e vídeo funcionam em conversas entre duas pessoas.','chat-hint'));
 }
});
$('#chat-voice').onclick=async()=>{
 if(recorder?.state==='recording'){stopRecording();return;}
 try {
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Este navegador não grava áudio. Você pode anexar um arquivo.');
  const recordingKey=key,version=++recordingGeneration;const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(key!==recordingKey||document.hidden||version!==recordingGeneration){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
  const mime=['audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Formato de áudio indisponível neste navegador.');
  recorder=new MediaRecorder(stream,{mimeType:mime});const parts=[];let size=0;
  recorder.ondataavailable=e=>{parts.push(e.data);size+=e.data.size;if(size>1800000)stopRecording();};
  recorder.onstop=async()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer);setRecording(false);try{const file=new File(parts,'audio.'+(mime==='audio/mp4'?'m4a':mime.split('/')[1]),{type:mime});if(key===recordingKey){const result=await fileData(file);if(key!==recordingKey)return;attachment=result;paintDraft();status('Áudio anexado. Toque em enviar para compartilhar.');}}catch(e){status(e.message);}};
  recorder.start(250);timer=setTimeout(stopRecording,60000);setRecording(true);status('Gravando por até um minuto. Toque no microfone de novo para parar.');
 }catch(e){stopRecording();status(e.name==='NotAllowedError'?'Permita o microfone no navegador ou anexe um áudio.':e.message);}
};
window.addEventListener('pagehide',stopRecording);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRecording();else refresh();});
window.addEventListener('offline',()=>status('Sem conexão. Escreva e tente enviar quando a internet voltar.'));
window.addEventListener('online',refresh);
window.addEventListener('opy:call-ended',()=>refresh());
// shortcut: polling com a tela visível serve à homologação; migrar para eventos (SSE na VPS) antes de ampliar o público.
setInterval(()=>{if(!document.hidden&&!$('#chat-dialog').open&&!$('#chat-sheet').open)refresh();},4000);
// Mensagem sugerida por outra tela (ex.: "Tenho interesse" no Mercado): só preenche o campo; quem envia é a pessoa.
try{const d=JSON.parse(sessionStorage.getItem('opy_chat_draft')||'null');sessionStorage.removeItem('opy_chat_draft');if(d&&d.key===key&&typeof d.text==='string'){$('#chat-text').value=d.text.slice(0,1000);grow();}}catch{}
refresh();
})();
