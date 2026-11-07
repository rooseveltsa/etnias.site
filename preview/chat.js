(() => {
'use strict';
const $ = selector => document.querySelector(selector);
const node = (tag, value, cls) => { const el=document.createElement(tag); if(value!==undefined)el.textContent=value; if(cls)el.className=cls; return el; };
const status = message => { $('#chat-status').textContent=message; };
const date = value => new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
let data, key=new URLSearchParams(location.search).get('p') || '', query='', loading=false, sending=false, older=false, reply=null, attachment=null, recorder=null, stream=null, timer;
const drafts=new Map(), pending=new Map();
let generation=0, reading=false, recordingGeneration=0, fileGeneration=0;
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
function dialog(title, build) { $('#chat-dialog-title').textContent=title;const box=$('#chat-dialog-body');box.replaceChildren();build(box);if(!$('#chat-dialog').open)$('#chat-dialog').showModal(); }
function field(parent,label,value='',multiline=false) { const wrap=node('label',label);const input=node(multiline?'textarea':'input');input.value=value;input.maxLength=multiline?2000:60;wrap.append(input);parent.append(wrap);return input; }
function selectPerson(parent,label,people=data.people) { const wrap=node('label',label),select=node('select'); for(const p of people){const option=node('option',p.name+(p.username?' (@'+p.username+')':''));option.value=p.key;select.append(option);}wrap.append(select);parent.append(wrap);return select; }
function stopRecording() { recordingGeneration++; if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer); }
function stash() { if(key)drafts.set(key,{text:$('#chat-text').value,reply,attachment}); }
async function choose(next) {
 if(sending)return;stopRecording();fileGeneration++;stash();key=next;query='';$('#chat-search').value='';older=false;reply=null;attachment=null;
 const saved=drafts.get(key);$('#chat-text').value=saved?.text || '';reply=saved?.reply || null;attachment=saved?.attachment || null;
 history.replaceState(null,'','/chat/'+(key?'?p='+encodeURIComponent(key):''));
 $('#chat-form').hidden=true;$('#chat-send').disabled=true;$('#chat-name').textContent='Carregando conversa…';$('#chat-log').replaceChildren();$('#chat-log').dataset.signature='';
 await refresh(true);$('#chat-text').focus();
}
function media(item,parent) {
 if(!item)return;
 if(item.kind==='file'){const a=node('a','Baixar '+item.name,'preview-text-link');a.href=item.url;a.download=item.name;parent.append(a);}
 else if(item.kind==='image'){
  const b=button('Abrir imagem',()=>dialog(item.name,box=>{const img=node('img');img.src=item.url;img.alt=item.name;box.append(img);}),parent);
  const img=node('img',undefined,'chat-image');img.src=item.url;img.alt=item.name;img.loading='lazy';b.prepend(img);
 } else {const el=node(item.kind==='audio'?'audio':'video');el.src=item.url;el.controls=true;el.preload='none';el.setAttribute('playsinline','');el.setAttribute('aria-label',item.name);parent.append(el);}
}
function message(m) {
 const article=node('article',undefined,'chat-bubble'+(m.own?' is-mine':''));article.dataset.message=m.id;
 article.append(node('strong',m.own?'Você':m.fromName));
 if(m.reply)article.append(node('blockquote',(m.reply.name?m.reply.name+': ':'')+m.reply.text));
 const copy=node('p',m.deleted?'Mensagem apagada':m.text);article.append(copy);media(m.media,article);
 article.append(node('small',date(m.createdAt)+(m.editedAt?' · editada':'')+(m.own?' · salva no servidor':'')));
 if(Object.keys(m.reactions).length)article.append(node('p',Object.entries(m.reactions).map(([r,n])=>r+' '+n).join(' · '),'chat-reactions'));
 const menu=node('details');menu.append(node('summary','Ações da mensagem'));const actions=node('div',undefined,'chat-message-actions');menu.append(actions);article.append(menu);
 if(!m.deleted){
  button('Responder',()=>{reply=m;paintDraft();$('#chat-text').focus();},actions);
  button('Copiar',async()=>{await navigator.clipboard.writeText(m.text);status('Texto copiado.');},actions);
  button('Encaminhar texto',()=>dialog('Encaminhar texto',box=>{box.append(node('p','Confirme que você tem permissão para compartilhar este texto em outra conversa. Anexos não serão copiados.'));const target=selectPerson(box,'Para quem?');button('Encaminhar',async()=>{await action({action:'dm',toKey:target.value,text:m.text,clientId:crypto.randomUUID()});$('#chat-dialog').close();status('Texto encaminhado.');},box);}),actions);
  if(m.own)button('Editar',()=>dialog('Editar mensagem',box=>{const input=field(box,'Texto',m.text,true);button('Salvar',async()=>{await action({action:'chat_edit',messageId:m.id,text:input.value});$('#chat-dialog').close();},box);}),actions);
  const react=node('div');react.setAttribute('aria-label','Reações');for(const symbol of ['👍','❤️','👏','😂','😢']){const b=button(symbol,()=>action({action:'chat_react',messageId:m.id,reaction:m.reaction===symbol?'':symbol}),react);b.setAttribute('aria-label','Reagir com '+symbol);b.setAttribute('aria-pressed',String(m.reaction===symbol));}actions.append(react);
 }
 button('Apagar para mim',()=>action({action:'chat_delete',messageId:m.id,scope:'me'}),actions);
 if(m.own&&!m.deleted)button('Apagar para todos',()=>dialog('Apagar mensagem',box=>{box.append(node('p','O texto e o anexo deixam de estar disponíveis nesta conversa. Cópias feitas fora da plataforma não podem ser removidas.'));button('Confirmar exclusão',async()=>{await action({action:'chat_delete',messageId:m.id,scope:'all'});$('#chat-dialog').close();},box);}),actions);
 if(!m.own)button('Registrar denúncia',()=>dialog('Registrar denúncia',box=>{box.append(node('p','O registro fica salvo, mas a equipe de revisão ainda não está conectada nesta prévia. Bloqueie a pessoa para impedir novas mensagens. Não use este canal para emergências.'));const input=field(box,'Motivo','',true);input.maxLength=500;button('Registrar',async()=>{await action({action:'chat_report',messageId:m.id,reason:input.value});$('#chat-dialog').close();status('Registro salvo. Revisão humana ainda não conectada.');},box);}),actions);
 return article;
}
function paintDraft() {
 const area=$('#chat-reply');area.replaceChildren();if(reply){area.append(node('p','Respondendo: '+reply.text.slice(0,100)));button('Cancelar resposta',()=>{reply=null;paintDraft();},area);}
 const slot=$('#chat-attachment');slot.replaceChildren();if(attachment){slot.append(node('span',attachment.name));button('Remover anexo',()=>{attachment=null;$('#chat-file').value='';paintDraft();},slot);}
 const retry=$('#chat-retry');retry.replaceChildren();const job=pending.get(key);if(job&&!sending){retry.append(node('p','Envio sem confirmação. Tentar novamente não duplica a mensagem.'));button('Tentar novamente',()=>send(job),retry);button('Manter rascunho e cancelar tentativa',()=>{pending.delete(key);paintDraft();},retry);}
 $('#chat-send').disabled=sending||!!job||!!data?.selected?.blocked||data?.selected?.key!==key;
}
function render() {
 if(!data)return;
 const filter=$('#chat-find').value.trim().toLocaleLowerCase('pt-BR'),showArchived=$('#chat-archives').checked;
 const list=$('#chat-list');list.replaceChildren();
 const conversations=new Map(data.conversations.map(c=>[c.key,c]));
 const entries=[...data.conversations,...data.people.filter(p=>!conversations.has(p.key))].filter(p=>!p.archived||showArchived).filter(p=>(p.name+' '+(p.username || '')).toLocaleLowerCase('pt-BR').includes(filter));
 for(const p of entries){const li=node('li');const b=button('',()=>choose(p.key),li);b.className='chat-person-btn';b.setAttribute('aria-pressed',String(key===p.key));const av=node('span',p.name.slice(0,1),'preview-avatar');av.setAttribute('aria-hidden','true');const meta=node('span',undefined,'chat-person-meta');meta.append(node('strong',p.name),node('small',(p.pinned?'Fixada · ':'')+(p.last || (p.group?'Grupo privado':'Conversa privada'))));if(p.at)meta.append(node('small',date(p.at)));b.append(av,meta);if(p.unread)b.append(node('span',String(p.unread),'chat-unread'));list.append(li);}
 if(!entries.length)list.append(node('li','Nenhuma pessoa ou conversa encontrada.'));
 const invites=$('#chat-invitations');invites.replaceChildren();for(const invite of data.invitations){const card=node('div',undefined,'chat-invite');card.append(node('p','Convite: '+invite.name));button('Aceitar',()=>action({action:'chat_group_accept',key:invite.key}),card);button('Recusar',()=>action({action:'chat_group_decline',key:invite.key}),card);invites.append(card);}
 const selected=data.selected;$('#chat-name').textContent=selected?.name || 'Escolha uma conversa';
 $('#chat-subtitle').textContent=selected ? (selected.blocked?'Envio bloqueado.':selected.group?selected.members.length+' participantes · você vê mensagens desde sua entrada':'Conversa privada · presença e leitura não são divulgadas') : 'Encontre alguém pelo nome ou crie um grupo.';
 $('#chat-form').hidden=!selected;$('#chat-options').hidden=!selected;$('#chat-search-form').hidden=!selected;$('#chat-older').hidden=!data.hasMore;
 const log=$('#chat-log');const signature=JSON.stringify(data.messages);
 if(log.dataset.signature!==signature){const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;const scroll=log.scrollTop,height=log.scrollHeight;log.dataset.signature=signature;const existing=new Map([...document.querySelectorAll('#chat-log [data-message]')].map(el=>[el.dataset.message,el]));
 const ids=new Set(data.messages.map(m=>m.id));for(const [id,el] of existing)if(!ids.has(id))el.remove();
 for(const empty of document.querySelectorAll('#chat-log .chat-empty'))empty.remove();
 data.messages.forEach((m,index)=>{let el=existing.get(m.id);const value=JSON.stringify(m);if(!el||el.dataset.value!==value){const next=message(m);next.dataset.value=value;if(el){const playing=el.querySelector('audio,video'),replacement=next.querySelector('audio,video');if(playing&&replacement&&playing.src===replacement.src)replacement.replaceWith(playing);el.replaceWith(next);}el=next;}if(log.children[index]!==el)log.insertBefore(el,log.children[index]||null);});
 if(!data.messages.length)log.append(node('p',query?'Nenhuma mensagem encontrada.':'A conversa começa com sua primeira mensagem.','chat-empty'));if(older)log.scrollTop=scroll+log.scrollHeight-height;else if(nearBottom)log.scrollTop=log.scrollHeight;}
 paintDraft();
}
async function markRead(){
 if(!key||!data?.selected||data.selected.key!==key||document.hidden||query||older||loading||sending||reading)return;
 const log=$('#chat-log');if(log.scrollHeight-log.scrollTop-log.clientHeight>60)return;
 const conv=data.conversations.find(c=>c.key===key),last=data.messages.at(-1);if(!conv?.unread||!last)return;
 reading=true;try{await action({action:'chat_read',key,messageId:last.id});}finally{reading=false;}
}
async function refresh(force=false){if((loading&&!force)||sending)return;loading=true;const current=key,version=++generation;try{const next=await request(null,{q:query});if(current!==key||version!==generation)return;if(older){next.messages=data.messages;next.hasMore=data.hasMore;}data=next;render();status(navigator.onLine?'Atualizado. Novas mensagens chegam enquanto esta tela estiver aberta.':'Sem conexão.');}catch(e){if(version===generation)status(e.message);}finally{if(version===generation)loading=false;}await markRead().catch(e=>status(e.message));}
async function send(job){
 if(sending||data?.selected?.key!==key)return;const destination=key;const submittedText=$('#chat-text').value,submittedAttachment=attachment,submittedReply=reply;
 if(!job){job={action:'dm',toKey:key,text:$('#chat-text').value,clientId:crypto.randomUUID(),replyTo:reply?.id || null,media:attachment?{name:attachment.name,data:attachment.data}:null};}
 generation++;pending.set(destination,job);sending=true;paintDraft();status('Enviando…');
 try{data=await request(job);pending.delete(destination);drafts.delete(destination);if(key===destination){if($('#chat-text').value===submittedText&&submittedText===job.text)$('#chat-text').value='';if(attachment===submittedAttachment&&attachment?.data===job.media?.data){attachment=null;$('#chat-file').value='';}if(reply===submittedReply&&reply?.id===job.replyTo)reply=null;older=false;render();$('#chat-log').scrollTop=$('#chat-log').scrollHeight;}status('Mensagem salva no servidor.');}
 catch(e){status(e.message);}finally{sending=false;paintDraft();}
}
async function fileData(file){if(file.size>2*1024*1024)throw Error('Escolha um anexo de até 2 MB.');const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler o anexo.'));reader.readAsDataURL(file);});return {name:file.name,data:content.replace(/^data:[^;]+(?:;codecs=[^;]+)?;base64,/, 'data:'+file.type.split(';')[0]+';base64,')};}
$('#chat-form').onsubmit=e=>{e.preventDefault();send();};
$('#chat-find').oninput=render;$('#chat-archives').onchange=render;
$('#chat-search-form').onsubmit=async e=>{e.preventDefault();query=$('#chat-search').value;older=false;await refresh();};
$('#chat-file').onchange=async e=>{const current=key,version=++fileGeneration;try{const file=e.target.files[0];if(file){const result=await fileData(file);if(current!==key||version!==fileGeneration)return;attachment=result;}paintDraft();}catch(error){if(current===key)status(error.message);}};
$('#chat-emoji').onclick=()=>dialog('Emojis',box=>{for(const symbol of ['😀','❤️','👏','🙏','🌱'])button(symbol,()=>{const input=$('#chat-text');input.setRangeText(symbol,input.selectionStart,input.selectionEnd,'end');$('#chat-dialog').close();input.focus();},box);});
$('#chat-older').onclick=async()=>{if(loading||!data.messages.length)return;loading=true;const current=key,version=++generation;try{const page=await request(null,{before:data.messages[0].id,q:query});if(current!==key||version!==generation)return;data.messages=[...page.messages,...data.messages];data.hasMore=page.hasMore;older=true;render();}catch(e){status(e.message);}finally{if(version===generation)loading=false;}};
$('#chat-log').addEventListener('scroll',()=>{markRead().catch(()=>{});},{passive:true});
$('#chat-new-group').onclick=()=>dialog('Novo grupo privado',box=>{
 const name=field(box,'Nome do grupo');box.append(node('p','As pessoas precisam aceitar o convite. Até 12 participantes nesta prévia.'));
 const members=[];for(const p of data.people.filter(p=>!p.blocked)){const label=node('label',p.name);const check=node('input');check.type='checkbox';check.value=p.key;label.prepend(check);box.append(label);members.push(check);}
 button('Criar e convidar',async()=>{await action({action:'chat_group_create',name:name.value,members:members.filter(c=>c.checked).map(c=>c.value)});$('#chat-dialog').close();status('Grupo criado. Os convites aguardam aceitação.');},box);
});
$('#chat-options').onclick=()=>dialog('Opções da conversa',box=>{
 const selected=data.selected,p=data.conversations.find(c=>c.key===key) || {};
 for(const [field,label] of [['pinned','Fixar'],['muted','Silenciar avisos'],['archived','Arquivar'],['unread','Marcar como não lida']])button((p[field]?'Desativar: ':'')+label,async()=>{await action({action:'chat_preferences',key,[field]:!p[field]});$('#chat-dialog').close();if(field==='unread')await choose('');},box);
 if(!selected.group){const ownBlock=data.people.find(p=>p.key===key)?.blocked;button(ownBlock?'Desbloquear pessoa':'Bloquear pessoa',async()=>{await action({action:'chat_block',key,blocked:!ownBlock});$('#chat-dialog').close();},box);}
 else {
  box.append(node('p',selected.description));
  for(const member of selected.members){const row=node('div',member.name+(member.admin?' · administração':''));if(selected.admin && member.key!=='id:'+data.me.id){button('Remover participante',()=>action({action:'chat_group_remove',key,memberKey:member.key}).then(()=>$('#chat-dialog').close()),row);if(!member.admin)button('Tornar administrador',()=>action({action:'chat_group_admin',key,memberKey:member.key}).then(()=>$('#chat-dialog').close()),row);}box.append(row);}
  if(selected.admin){const name=field(box,'Nome',selected.name),description=field(box,'Descrição',selected.description,true);description.maxLength=500;button('Salvar grupo',async()=>{await action({action:'chat_group_update',key,name:name.value,description:description.value});$('#chat-dialog').close();},box);const target=selectPerson(box,'Convidar pessoa',data.people.filter(p=>!selected.members.some(m=>m.key===p.key)));button('Enviar convite',async()=>{await action({action:'chat_group_invite',key,memberKey:target.value});$('#chat-dialog').close();},box);}
  button('Sair do grupo',async()=>{const old=key;key='';try{await action({action:'chat_group_leave',key:old});$('#chat-dialog').close();}catch(e){key=old;throw e;}},box);
 }
 box.append(node('p','Chamadas ainda não estão disponíveis nesta prévia. O serviço e os custos precisam ser definidos antes da ativação.'));
});
$('#chat-voice').onclick=async()=>{
 if(recorder?.state==='recording'){stopRecording();return;}
 try {
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Este navegador não grava áudio. Você pode anexar um arquivo.');
  const recordingKey=key,version=++recordingGeneration;const acquired=await navigator.mediaDevices.getUserMedia({audio:true});if(key!==recordingKey||document.hidden||version!==recordingGeneration){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
  const mime=['audio/webm','audio/mp4','audio/ogg'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('Formato de áudio indisponível neste navegador.');
  recorder=new MediaRecorder(stream,{mimeType:mime});const parts=[];let size=0;
  recorder.ondataavailable=e=>{parts.push(e.data);size+=e.data.size;if(size>1800000)stopRecording();};
  recorder.onstop=async()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;clearTimeout(timer);$('#chat-voice').textContent='Gravar áudio';try{const file=new File(parts,'audio.'+(mime==='audio/mp4'?'m4a':mime.split('/')[1]),{type:mime});if(key===recordingKey){const result=await fileData(file);if(key!==recordingKey)return;attachment=result;paintDraft();status('Áudio anexado. Toque em Enviar para compartilhar.');}}catch(e){status(e.message);}};
  recorder.start(250);timer=setTimeout(stopRecording,60000);$('#chat-voice').textContent='Parar gravação';status('Gravando por até um minuto. Toque em Parar gravação para anexar.');
 }catch(e){stopRecording();status(e.name==='NotAllowedError'?'Permita o microfone no navegador ou anexe um áudio.':e.message);}
};
window.addEventListener('pagehide',stopRecording);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRecording();else refresh();});
window.addEventListener('offline',()=>status('Sem conexão. Escreva e tente enviar quando a internet voltar.'));
window.addEventListener('online',refresh);
// shortcut: polling com a tela visível serve à homologação; migrar para eventos e banco indexado antes de ampliar o público.
setInterval(()=>{if(!document.hidden&&!$('#chat-dialog').open&&!older&&!$('#chat-log details[open]'))refresh();},5000);
refresh();
})();
