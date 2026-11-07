(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const all = (s, root=document) => [...root.querySelectorAll(s)];
const make = (tag, text, cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const button=(label, fn, root)=>{const b=make('button',label,'preview-secondary');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){showError(e.message);}finally{b.disabled=false;}});root.append(b);return b;};
const emoji=[['😀','Sorriso'],['❤️','Coração'],['😂','Risada'],['👏','Palmas'],['🙏','Gratidão'],['🌱','Planta'],['💚','Coração verde'],['✨','Brilho']];
const reactions=[['like','👍','Curti'],['heart','❤️','Amei'],['laugh','😂','Haha'],['wow','😮','Surpresa'],['sad','😢','Triste']];
let state, filter='all', view='news', videoAttachment=null, fileAttachment=null, busy=false;
const expandedComments=new Set(), openCommentForms=new Set(), replyTargets=new Map();
let profileTab='posts', dockChatKey='';
const seenStories=new Set((()=>{try{return JSON.parse(localStorage.getItem('opy_seen_stories')||'[]');}catch{return[];}})());
const markStorySeen=id=>{seenStories.add(id);try{localStorage.setItem('opy_seen_stories',JSON.stringify([...seenStories].slice(-200)));}catch{}};
const date=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
function showError(message){let el=$('#community-error');if(!el){el=make('p',undefined,'preview-feedback');el.id='community-error';el.setAttribute('role','alert');$('.middlecol').prepend(el);}el.textContent=message;}
async function api(body){const response=await fetch('/api/community',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok){const error=Error(data.error||'Não foi possível carregar. Tente novamente.');error.status=response.status;throw error;}return data;}
async function change(body){state=await api(body);render();}
function picker(root,target){root.replaceChildren();for(const [symbol,label] of emoji){const b=button(symbol,()=>{const start=target.selectionStart??target.value.length;target.setRangeText(symbol,start,target.selectionEnd??start,'end');target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();root.hidden=true;},root);b.setAttribute('aria-label',label);}root.hidden=false;}
const glyph={
 like:'<path d="M8 10v10H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm0 0 3.4-6.1A2.2 2.2 0 0 1 15.3 5.2L14 10h5.1a2 2 0 0 1 2 2.4l-1 6.2a2 2 0 0 1-2 1.4H8"/>',
 heart:'<path d="M12 20s-6.4-4.1-6.4-8.2A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 6.4 3.2C18.4 15.9 12 20 12 20z"/>',
 comment:'<path d="M5 6.5h14V15H9l-4 3.2z"/>',
 share:'<path d="M15 5l5 5-5 5"/><path d="M20 10H9a5 5 0 0 0-5 5v4"/>',
 save:'<path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.4L6 20V5a1 1 0 0 1 1-1z"/>',
 play:'<path d="M9 6.5v11l9-5.5z"/>',
 pause:'<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
 laugh:'<circle cx="12" cy="12" r="8"/><path d="M8.5 10h.01M15.5 10h.01M8.5 14.2a4 4 0 0 0 7 0"/>',
 wow:'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M12 16.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
 sad:'<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8.5 16a4 4 0 0 1 7 0"/>',
 file:'<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>'
};
function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+glyph[name]+'</svg>';}
function clock(seconds){if(!Number.isFinite(seconds))return '0:00';const whole=Math.max(0,Math.round(seconds));return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');}
const plural=(n,one,many)=>n+' '+(n===1?one:many);
// O menu vem do legado ("Grupos"); na prévia o nome é Comunidades, como no resto da tela.
document.querySelectorAll('[data-opy-destination="grupos"] span:not(.opy-pending)').forEach(el=>{el.textContent='Comunidades';});
// Barra do celular: Comunidades ocupa o lugar do Mercado (oculto até existir), mantendo Postagem no centro.
(()=>{const merc=document.querySelector('.opy-bottom [data-opy-destination="mercado"]'),icon=document.querySelector('[data-opy-destination="grupos"] img');if(!merc)return;
 const item=merc.cloneNode(true);item.dataset.opyDestination='comunidades';item.setAttribute('href','/grupos/');item.removeAttribute('data-opy-info');
 const route=document.body.dataset.previewRoute;if(route==='suggested-groups'||route==='joined_groups')item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
 const img=item.querySelector('img');if(img&&icon)img.src=icon.src;const label=[...item.querySelectorAll('span')].find(el=>!el.classList.contains('opy-pending'));if(label)label.textContent='Comunidades';
 merc.before(item);})();
function postAction(name, label, fn){const b=document.createElement('button');b.type='button';b.className='post-action';b.innerHTML=svg(name);if(label){const span=document.createElement('span');span.textContent=label;b.append(span);}b.addEventListener('click',async event=>{b.disabled=true;try{await fn(event);}catch(e){showError(e.message);}finally{b.disabled=false;}});return b;}
function avatarNode(name, url, size=42){
 const fallback=()=>make('span',(name||'?').slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar');
 if(url&&(/^\/assets\/archive\/avatar-[a-f0-9]{20}\.(jpg|jpeg|png|webp|gif)$/.test(url)||/^\/api\/media\?id=[a-f0-9-]{36}$/.test(url))){
  const img=make('img',undefined,'preview-avatar preview-avatar-image');img.src=url;img.alt='Foto de '+name;img.width=size;img.height=size;img.loading='lazy';
  img.addEventListener('error',()=>img.replaceWith(fallback()),{once:true});return img;
 }
 return fallback();
}
function friendLabel(status){return status==='friends'?'Amigos ✓':status==='incoming'?'Aceitar amizade':status==='outgoing'?'Solicitação enviada':'Adicionar amigo';}
function personByKey(key, fallbackName='', fallbackAvatar=''){
 const found=(state?.directory||[]).find(p=>p.key===key);
 if(found)return found;
 const myKey=state?.me?`id:${state.me.id}`:'';
 return {key:key||`name:${fallbackName}`,name:fallbackName||'Comunidade',username:'',avatar:fallbackAvatar||'',own:key===myKey,following:false,friendStatus:'none',followersCount:0,friendsCount:0,postsCount:0};
}
function mountAudio(media, parent){const audio=document.createElement('audio');audio.preload='metadata';audio.tabIndex=-1;audio.setAttribute('aria-hidden','true');audio.src=media.url;const box=make('div',undefined,'opy-player');const toggle=make('button',undefined,'opy-player-toggle');toggle.type='button';toggle.innerHTML=svg('play');toggle.setAttribute('aria-label','Reproduzir');const body=make('div',undefined,'opy-player-body');const meta=make('div',undefined,'opy-player-meta');const title=make('strong',media.name);const time=make('span','0:00 / 0:00','opy-player-time');meta.append(title,time);const range=document.createElement('input');range.type='range';range.min='0';range.max='1000';range.value='0';range.className='opy-player-range';range.setAttribute('aria-label','Avançar no áudio');range.setAttribute('aria-valuemin','0');range.setAttribute('aria-valuemax','1000');let seeking=false;const paint=()=>{const duration=audio.duration||0;const ratio=duration?audio.currentTime/duration:0;if(!seeking)range.value=String(Math.round(ratio*1000));range.setAttribute('aria-valuenow',range.value);range.setAttribute('aria-valuetext',clock(audio.currentTime)+' de '+clock(duration));time.textContent=clock(audio.currentTime)+' / '+clock(duration);range.style.setProperty('--opy-progress',(ratio*100)+'%');};toggle.addEventListener('click',async()=>{if(audio.paused){all('audio').forEach(other=>{if(other!==audio)other.pause();});try{await audio.play();}catch(e){showError('Não foi possível reproduzir este áudio.');}}else audio.pause();});audio.addEventListener('play',()=>{toggle.innerHTML=svg('pause');toggle.setAttribute('aria-label','Pausar');});audio.addEventListener('pause',()=>{toggle.innerHTML=svg('play');toggle.setAttribute('aria-label','Reproduzir');});audio.addEventListener('timeupdate',paint);audio.addEventListener('loadedmetadata',paint);audio.addEventListener('ended',()=>{audio.currentTime=0;paint();});range.addEventListener('pointerdown',()=>{seeking=true;});range.addEventListener('input',()=>{const duration=audio.duration||0;const ratio=Number(range.value)/1000;range.style.setProperty('--opy-progress',(ratio*100)+'%');time.textContent=clock(ratio*duration)+' / '+clock(duration);});range.addEventListener('change',()=>{if(audio.duration)audio.currentTime=(Number(range.value)/1000)*audio.duration;seeking=false;paint();});body.append(meta,range);box.append(toggle,body,audio);parent.append(box);}
function appendFile(media, parent){const file=document.createElement('a');file.className='post-file';file.href=media.url;file.setAttribute('download',media.name);file.innerHTML=svg('file');const label=make('span');label.append(make('strong',media.name),make('small','Baixar'));file.append(label);parent.append(file);}
function appendPostBody(item, parent){
 if(item.feeling)parent.append(make('small','Sentindo-se '+item.feeling,'post-feeling'));
 if(item.text&&item.text.trim())parent.append(make('p',item.text,'post-copy'));
 if(item.image&&item.image.startsWith('/assets/archive/')){const img=make('img',undefined,'preview-post-image');img.src=item.image;img.alt='Imagem da publicação de '+item.author;img.loading='lazy';parent.append(img);}
 if(item.media&&item.media.kind==='audio')mountAudio(item.media,parent);
 else if(item.media&&item.media.kind==='file')appendFile(item.media,parent);
 else if(item.media&&item.media.kind==='video'){const video=document.createElement('video');video.className='preview-post-video';video.src=item.media.url;video.controls=true;video.preload='metadata';video.setAttribute('playsinline','');parent.append(video);}
 else if(item.media){const img=make('img',undefined,'preview-post-image');img.src=item.media.url;img.alt=item.media.name;img.loading='lazy';parent.append(img);}
 if(item.file)appendFile(item.file,parent);
 if(item.location)parent.append(make('p','Localização · '+item.location,'post-place'));
}
function renderPost(post, communityContext=null){
 const card=make('article',undefined,'preview-post community-post');card.dataset.origin=post.origin;card.id='post-'+post.id;
 const head=make('div',undefined,'preview-author');
 const pKey=post.authorKey||`name:${post.author}`;
 const avBtn=make('button',undefined,'author-trigger');avBtn.type='button';avBtn.setAttribute('aria-label','Abrir perfil de '+post.author);avBtn.append(avatarNode(post.author,post.avatar,42));avBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 const who=make('div');
 const nameBtn=make('button',post.author,'author-name-btn');nameBtn.type='button';nameBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 const metaLine=make('small',(post.origin==='legacy'?'Acervo público · ':'')+date(post.createdAt)+(post.editedAt?' · editada':'')+(post.audience==='private'?' · Somente eu':post.audience==='friends'?' · Amigos':''));
 who.append(nameBtn);
 if(post.communityId&&post.communityName){
  const commLink=make('a','Comunidade · '+post.communityName,'post-community-badge');
  commLink.href='/grupos/?c='+encodeURIComponent(post.communityId);
  who.append(commLink);
 }
 who.append(metaLine);
 head.append(avBtn,who);
 if(!post.own&&post.authorKey){const follow=button(post.following?'Seguindo':'Seguir',()=>change({action:'follow',authorKey:post.authorKey}),head);follow.classList.add('preview-follow');follow.setAttribute('aria-pressed',String(!!post.following));}
 card.append(head);
 appendPostBody(post,card);
 if(post.repostOf){
  const orig=post.repostOf;const rep=make('div',undefined,'post-repost-card');
  const repHead=make('div',undefined,'post-repost-head');
  const origBtn=make('button','🔁 '+orig.author,'author-name-btn');origBtn.type='button';origBtn.onclick=()=>openProfile(orig.authorKey||`name:${orig.author}`,orig.author,orig.avatar||'');
  repHead.append(origBtn,make('small',date(orig.createdAt)));rep.append(repHead);
  appendPostBody(orig,rep);card.append(rep);
 }
 if(post.attachmentMissing)card.append(make('small','O anexo original ainda não foi recuperado.'));
 if(post.poll){const poll=make('div',undefined,'post-poll');post.poll.options.forEach((option,i)=>{const b=button(option+' · '+post.poll.counts[i]+' voto(s)',()=>change({action:'vote',postId:post.id,option:i}),poll);b.setAttribute('aria-pressed',String(post.poll.voted===i));});card.append(poll);}
 const reacted=reactions.filter(([id])=>post.reactions[id]);
 const total=reacted.reduce((sum,[id])=>sum+post.reactions[id],0);
 const sharesCount=post.shares||0;
 const form=make('form',undefined,'preview-comment-form');form.hidden=!openCommentForms.has(post.id);form.id='comment-'+post.id;
 const input=make('input');input.required=true;input.maxLength=500;input.placeholder='Escreva um comentário (até 500 caracteres)';input.setAttribute('aria-label','Seu comentário');
 const charCount=make('small','0/500','comment-char-count');
 input.addEventListener('input',()=>{charCount.textContent=input.value.length+'/500';});
 const submit=make('button','Enviar','preview-secondary');submit.type='submit';submit.setAttribute('aria-label','Enviar comentário');
 const target=replyTargets.get(post.id);
 if(target){const chip=make('p',undefined,'comment-reply-chip');chip.append(make('span','Respondendo a '+target.author));const x=button('Cancelar',()=>{replyTargets.delete(post.id);render();},chip);x.className='pf-link';form.append(chip);input.placeholder='Escreva sua resposta…';}
 const emojiBtn=make('button','😀','comment-emoji-btn');emojiBtn.type='button';emojiBtn.setAttribute('aria-label','Inserir emoji');emojiBtn.setAttribute('aria-expanded','false');
 const emojiBox=make('div',undefined,'comment-emoji-picker');emojiBox.hidden=true;
 emojiBtn.onclick=()=>{emojiBox.hidden=!emojiBox.hidden;emojiBtn.setAttribute('aria-expanded',String(!emojiBox.hidden));if(!emojiBox.hidden)picker(emojiBox,input);};
 form.append(input,emojiBtn,charCount,submit,emojiBox);
 form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{openCommentForms.add(post.id);const draft=input.value;const replyTo=replyTargets.get(post.id)?.id;await change({action:'comment',postId:post.id,text:draft,...(replyTo?{replyTo}:{})});replyTargets.delete(post.id);const sent=document.getElementById('post-'+post.id)?.querySelector('.preview-comment-form input');if(sent){sent.value='';const cc=document.getElementById('post-'+post.id)?.querySelector('.comment-char-count');if(cc)cc.textContent='0/500';}}catch(err){showError(err.message);submit.disabled=false;}});
 const repostForm=make('form',undefined,'preview-repost-form');repostForm.hidden=true;
 const repostInput=make('input');repostInput.maxLength=1000;repostInput.placeholder='Adicione um comentário ao repostar (opcional)…';repostInput.setAttribute('aria-label','Comentário do repost');
 const repostSubmit=make('button','Repostar agora','opy-primary');repostSubmit.type='submit';
 const copyLink=make('button','Copiar link','preview-secondary');copyLink.type='button';
 copyLink.onclick=async()=>{const url=location.origin+'/#post-'+post.id;try{await navigator.clipboard.writeText(url);copyLink.textContent='Link copiado ✓';setTimeout(()=>{copyLink.textContent='Copiar link';},1800);}catch{prompt('Link da publicação:',url);}};
 repostForm.append(repostInput,repostSubmit,copyLink);
 repostForm.addEventListener('submit',async e=>{e.preventDefault();repostSubmit.disabled=true;try{await change({action:'repost',postId:post.id,text:repostInput.value});repostInput.value='';repostForm.hidden=true;}catch(err){showError(err.message);}finally{repostSubmit.disabled=false;}});
 if(total||post.comments.length||sharesCount){
  const summary=make('div',undefined,'post-summary');
  const left=make('span');
  if(total){left.setAttribute('aria-label',total+(total===1?' reação':' reações')+': '+reacted.map(([, ,label])=>label).join(', '));left.textContent=reacted.map(([,icon])=>icon).join(' ')+' '+total;}
  summary.append(left);
  const right=make('div',undefined,'post-summary-right');
  if(post.comments.length){
   const cBtn=make('button',post.comments.length+(post.comments.length===1?' comentário':' comentários'),'summary-link');cBtn.type='button';
   cBtn.onclick=()=>{if(post.comments.length>2){if(expandedComments.has(post.id))expandedComments.delete(post.id);else expandedComments.add(post.id);render();}else{form.hidden=!form.hidden;if(!form.hidden)input.focus();}};
   right.append(cBtn);
  }
  if(sharesCount)right.append(make('span',sharesCount+(sharesCount===1?' compartilhamento':' compartilhamentos')));
  summary.append(right);card.append(summary);
 }
 const actions=make('div',undefined,'preview-post-actions');
 const reactWrap=make('div',undefined,'post-react');
 const like=postAction('like','Curtir',()=>{if(like.dataset.held==='1'){like.dataset.held='';return;}return change({action:'react',postId:post.id,reaction:post.reaction==='like'?'':'like'});});
 like.setAttribute('aria-pressed',String(post.reaction==='like'));like.setAttribute('aria-haspopup','true');
 let hold;like.addEventListener('pointerdown',()=>{like.dataset.held='';hold=setTimeout(()=>{like.dataset.held='1';reactWrap.classList.add('is-open');},450);});
 const endHold=()=>clearTimeout(hold);like.addEventListener('pointerup',endHold);like.addEventListener('pointercancel',endHold);like.addEventListener('contextmenu',event=>event.preventDefault());
 const tray=make('div',undefined,'post-react-tray');tray.setAttribute('role','group');tray.setAttribute('aria-label','Reações');
 for(const [id,icon,label] of [['like','like','Curti'],['heart','heart','Amei'],['laugh','laugh','Haha'],['wow','wow','Surpresa'],['sad','sad','Triste']]){const choice=postAction(icon,'',()=>change({action:'react',postId:post.id,reaction:post.reaction===id?'':id}));choice.classList.add('post-react-choice','is-'+id);choice.setAttribute('aria-label',label);choice.title=label;choice.setAttribute('aria-pressed',String(post.reaction===id));tray.append(choice);}
 reactWrap.append(like,tray);
 const commentBtn=postAction('comment','Comentar',()=>{form.hidden=!form.hidden;if(form.hidden)openCommentForms.delete(post.id);else openCommentForms.add(post.id);commentBtn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)input.focus();});
 commentBtn.setAttribute('aria-expanded',String(!form.hidden));commentBtn.setAttribute('aria-controls',form.id);
 const heart=postAction('heart','Amei',()=>change({action:'react',postId:post.id,reaction:post.reaction==='heart'?'':'heart'}));
 heart.setAttribute('aria-pressed',String(post.reaction==='heart'));
 const shareBtn=postAction('share','Repostar',()=>{repostForm.hidden=!repostForm.hidden;shareBtn.setAttribute('aria-expanded',String(!repostForm.hidden));if(!repostForm.hidden)repostInput.focus();});
 shareBtn.setAttribute('aria-expanded','false');
 const save=postAction('save','',()=>change({action:'save',postId:post.id}));save.classList.add('post-action-quiet');save.setAttribute('aria-label',post.saved?'Remover dos salvos':'Salvar publicação');save.setAttribute('aria-pressed',String(!!post.saved));
 actions.append(reactWrap,commentBtn,heart,shareBtn,save);card.append(actions,repostForm);
 if(post.own){const edit=make('button','Editar','post-delete post-edit');edit.type='button';edit.addEventListener('click',()=>{
  if(card.querySelector('.post-edit-form'))return;
  const f=make('form',undefined,'post-edit-form');const ta=make('textarea');ta.value=post.text||'';ta.maxLength=5000;ta.rows=4;ta.setAttribute('aria-label','Editar publicação');
  const save=make('button','Salvar','opy-primary');save.type='submit';const cancel=button('Cancelar',()=>f.remove(),f);f.prepend(ta);f.append(save);f.append(cancel);
  f.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;try{await change({action:'post_edit',postId:post.id,text:ta.value});}catch(err){showError(err.message);save.disabled=false;}});
  edit.after(f);ta.focus();
 });card.append(edit);}
 if(post.own){const remove=make('button','Excluir minha publicação','post-delete');remove.type='button';remove.addEventListener('click',async()=>{if(!confirm('Excluir esta publicação?'))return;try{await change({action:'delete',postId:post.id});}catch(e){showError(e.message);}});card.append(remove);}
 else if(communityContext?.canModerate&&post.communityId===communityContext.id){
  const modRemove=make('button','Moderação: remover publicação da comunidade','post-delete');modRemove.type='button';
  modRemove.addEventListener('click',async()=>{if(!confirm('Remover esta publicação da comunidade?'))return;try{await change({action:'community_moderate_post',communityId:communityContext.id,postId:post.id});}catch(e){showError(e.message);}});
  card.append(modRemove);
 }
 const COMMENT_LIMIT=2;
 const tops=post.comments.filter(c=>!c.parentId);
 const isExpanded=expandedComments.has(post.id);
 const visibleTops=isExpanded||tops.length<=COMMENT_LIMIT?tops:tops.slice(-COMMENT_LIMIT);
 if(tops.length>COMMENT_LIMIT){
  const moreBtn=make('button',isExpanded?'Ocultar comentários':`Ver comentários anteriores (${tops.length-COMMENT_LIMIT})`,'comments-toggle');
  moreBtn.type='button';moreBtn.onclick=()=>{if(isExpanded)expandedComments.delete(post.id);else expandedComments.add(post.id);render();};
  card.append(moreBtn);
 }
 const renderComment=(comment,isReply)=>{
  const block=make('div',undefined,'preview-comment'+(isReply?' is-reply':''));
  const cKey=comment.authorKey||`name:${comment.author}`;
  const avatar=make('button',comment.author.slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar author-trigger');avatar.type='button';avatar.setAttribute('aria-label','Abrir perfil de '+comment.author);avatar.onclick=()=>openProfile(cKey,comment.author,'');
  const body=make('div',undefined,'preview-comment-body');
  const bubble=make('div',undefined,'comment-bubble');
  const cAuthor=make('button',comment.author,'author-name-btn');cAuthor.type='button';cAuthor.onclick=()=>openProfile(cKey,comment.author,'');
  bubble.append(cAuthor,make('p',comment.text));
  if(comment.likes){const n=make('span','❤ '+comment.likes,'comment-likes');n.setAttribute('aria-label',comment.likes+(comment.likes===1?' curtida':' curtidas'));bubble.append(n);}
  const bar=make('div',undefined,'comment-actions');
  const like=button(comment.liked?'Curtido':'Curtir',()=>change({action:'comment_like',postId:post.id,commentId:comment.id}),bar);like.className='comment-act'+(comment.liked?' is-on':'');like.setAttribute('aria-pressed',String(!!comment.liked));
  const reply=button('Responder',()=>{replyTargets.set(post.id,{id:comment.id,author:comment.author});openCommentForms.add(post.id);render();document.getElementById('comment-'+post.id)?.querySelector('input')?.focus();},bar);reply.className='comment-act';
  if(comment.own||post.own){const del=button('Apagar',async()=>{if(!confirm('Apagar este comentário'+(isReply?'':' e as respostas')+'?'))return;await change({action:'comment_delete',postId:post.id,commentId:comment.id});},bar);del.className='comment-act';}
  bar.append(make('small',date(comment.createdAt)));
  body.append(bubble,bar);block.append(avatar,body);card.append(block);
 };
 for(const top of visibleTops){renderComment(top,false);for(const r of post.comments.filter(c=>c.parentId===top.id))renderComment(r,true);}
 card.append(form);return card;
}
function paintCommunity(){
 // Coluna lateral: comunidades por tema. Pessoas aparecem no contexto delas (comunidade, publicação, busca), não numa lista solta.
 const list=$('#community-people');if(!list)return;
 const all=Array.isArray(state.communities)?state.communities:[];
 const open=all.filter(c=>!c.joined).sort((a,b)=>Number(!!a.pending)-Number(!!b.pending)||(b.membersCount||0)-(a.membersCount||0)).slice(0,4);
 const joined=all.filter(c=>c.joined).slice(0,4);
 const row=c=>{
  const li=make('li',undefined,'rail-community');
  const link=make('a',undefined,'rail-community-link');link.href='/grupos/?c='+encodeURIComponent(c.id);
  link.append(make('span',(c.name||'C').slice(0,1).toLocaleUpperCase('pt-BR'),'rail-community-mark'));
  const info=make('span',undefined,'rail-community-info');
  const n=c.membersCount||0;info.append(make('strong',c.name),make('small',[n+(n===1?' participante':' participantes'),c.visibility==='private'?'privada':''].filter(Boolean).join(' · ')));link.title=c.category?c.name+' · '+c.category:c.name;
  link.append(info);li.append(link);
  if(!c.joined){
   const join=make('button',c.pending?'Pedido enviado':c.visibility==='private'?'Pedir entrada':'Participar','rail-community-join');join.type='button';join.disabled=!!c.pending;
   join.onclick=async()=>{join.disabled=true;try{await joinCommunity(c);}catch(e){join.disabled=false;const st=$('#community-connection');if(st)st.textContent=e.message;}};
   li.append(join);
  }
  return li;
 };
 const items=[];
 if(open.length){items.push(make('li','Para participar','rail-community-group'));items.push(...open.map(row));}
 if(joined.length){items.push(make('li','Suas comunidades','rail-community-group'));items.push(...joined.map(row));}
 const more=make('li',undefined,'rail-community-more');const a=make('a','Ver todas as comunidades');a.href='/grupos/';more.append(a);items.push(more);
 list.replaceChildren(...items);
 const status=$('#community-connection');if(status)status.textContent=all.length?'':'Ainda não há comunidades. Crie a primeira em Grupos.';
}
const plain=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
// Modalidades do feed (documento 6.1–6.9). Descobrir alterna autores para dar visibilidade a quem publica pouco ou chegou agora.
function feedPosts(base){
 const isFollowing=p=>p.following||p.friendStatus==='friends';
 if(view==='following')return base.filter(isFollowing);
 if(view==='discover'){
  const groups=new Map();for(const p of base.filter(p=>!p.own&&!isFollowing(p))){const k=p.authorKey||p.author;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);}
  const out=[];for(let round=0;out.length<base.length;round++){let added=false;for(const list of groups.values())if(list[round]){out.push(list[round]);added=true;}if(!added)break;}return out;
 }
 if(view==='location'){const q=plain($('#feed-location-query')?.value);return base.filter(p=>p.location&&(!q||plain(p.location).includes(q)));}
 if(view==='archive')return base.filter(p=>p.origin==='legacy');
 if(view==='news')return base;
 return base.filter(p=>matchMediaKind(p,view==='files'?'files':view));
}
// Comunicados da administração no topo do feed e atalho para o Centro de gestão de quem modera.
function paintAnnouncements(){
 if(state?.me?.role&&!$('.opy-admin-link')){const anchor=$('.notification-container');if(anchor){const a=make('a','Gestão','opy-admin-link');a.href='/admin/';a.title='Centro de gestão';anchor.before(a);}}
 const feed=$('#preview-feed');if(!feed)return;
 let box=$('#opy-announcements');if(!box){box=make('div');box.id='opy-announcements';const host=$('.feed-chips')||feed;host.before(box);}
 box.replaceChildren(...(state.announcements||[]).map(a=>{const card=make('aside',undefined,'opy-announcement');card.setAttribute('aria-label','Comunicado');const body=make('div');body.append(make('strong',a.title),make('p',a.text));if(a.link){const l=make('a','Saiba mais');l.href=a.link;body.append(l);}const close=make('button','✕');close.type='button';close.setAttribute('aria-label','Fechar comunicado');close.onclick=()=>change({action:'announcement_dismiss',id:a.id}).catch(e=>showError(e.message));card.append(body,close);return card;}));
}
function matchMediaKind(p, kind){
 if(kind==='photos')return p.media?.kind==='image'||!!p.image||p.repostOf?.media?.kind==='image'||!!p.repostOf?.image;
 if(kind==='videos')return p.media?.kind==='video'||p.repostOf?.media?.kind==='video';
 if(kind==='audio')return p.media?.kind==='audio'||p.repostOf?.media?.kind==='audio';
 if(kind==='files')return p.media?.kind==='file'||!!p.file||p.repostOf?.media?.kind==='file'||!!p.repostOf?.file;
 return true;
}
function profileKey(){
 if(document.body.dataset.previewRoute==='profile'){const u=new URLSearchParams(location.search).get('u');if(u)return u;}
 return state?.me?'id:'+state.me.id:'';
}
function photoGrid(urls){const g=make('div',undefined,'pf-photos');for(const u of urls){const img=make('img');img.src=u;img.alt='Foto publicada';img.loading='lazy';g.append(img);}return g;}
function openProfileEdit(){const d=$('#profile-edit-dialog');if(d&&!d.open)d.showModal();}
let profileSignature='';
// Perfil no padrão de rede social: capa, foto, identidade, ações, abas e apresentação.
function renderProfile(){
 const root=$('#profile-page');if(!root||!state)return;
 const key=profileKey();if(!key)return;
 const own=key==='id:'+state.me.id;
 const base=personByKey(key);
 const person=own?{...base,name:state.me.name,username:state.me.username,bio:state.me.bio,affiliation:state.me.affiliation,avatar:state.me.avatar,cover:state.me.cover,joinedAt:state.me.joinedAt,own:true}:base;
 const posts=state.posts.filter(p=>p.authorKey===key);
 const photos=posts.flatMap(p=>[p.media?.kind==='image'?p.media.url:'',p.image||''].filter(Boolean));
 const comms=(state.communities||[]).filter(c=>own?c.joined:(c.members||[]).some(m=>m.key===key));
 const ea=$('#profile-edit-avatar');if(ea)ea.replaceChildren(avatarNode(state.me.name,state.me.avatar,72));
 const ec=$('#profile-edit-cover');if(ec){ec.replaceChildren();if(state.me.cover){const im=make('img');im.src=state.me.cover;im.alt='';ec.append(im);}}
 const signature=JSON.stringify([person,posts.map(p=>[p.id,p.reaction,p.comments?.length,p.saved]),comms.map(c=>c.id),profileTab]);
 if(signature===profileSignature)return;profileSignature=signature;
 document.title=person.name+' · Casa Opy';
 const cover=make('div',undefined,'pf-cover');
 if(person.cover){const img=make('img');img.src=person.cover;img.alt='Capa de '+person.name;cover.append(img);}
 if(own){const b=button('Editar capa',()=>$('#profile-cover-input').click(),cover);b.className='pf-cover-btn';}
 const head=make('div',undefined,'pf-head');
 const av=make('div',undefined,'pf-avatar');av.append(avatarNode(person.name,person.avatar,168));
 if(own){const b=button('',()=>$('#profile-avatar-input').click(),av);b.className='pf-avatar-btn';b.setAttribute('aria-label','Trocar foto do perfil');b.title='Trocar foto do perfil';}
 const id=make('div',undefined,'pf-id');id.append(make('h1',person.name));
 const meta=[person.username?'@'+person.username:(key.startsWith('name:')?'Pessoa do acervo Etnias':''),person.affiliation].filter(Boolean).join(' · ');
 if(meta)id.append(make('p',meta,'pf-meta'));
 const counts=make('p',undefined,'pf-counts');
 const count=(v,one,many)=>{const w=make('span');w.append(make('strong',String(v||0)),document.createTextNode(' '+((v||0)===1?one:many)));return w;};
 counts.append(count(posts.length,'publicação','publicações'),count(person.followersCount,'seguidor','seguidores'),count(person.friendsCount,'amigo','amigos'));
 id.append(counts);
 const actions=make('div',undefined,'pf-actions');
 if(own){const e=button('Editar perfil',openProfileEdit,actions);e.className='opy-primary';}
 else{
  const f=button(person.following?'Seguindo':'Seguir',()=>change({action:'follow',authorKey:key}),actions);f.className=person.following?'preview-secondary':'opy-primary';f.setAttribute('aria-pressed',String(!!person.following));
  if(key.startsWith('id:')){
   const m=button('Mensagem',()=>openPrivateChat(key),actions);m.className='preview-secondary';
   const fr=button(friendLabel(person.friendStatus),()=>change({action:'friend',authorKey:key}),actions);fr.className='preview-secondary';fr.setAttribute('aria-pressed',String(person.friendStatus==='friends'));
  }
 }
 head.append(av,id,actions);
 const tabs=make('nav',undefined,'pf-tabs');tabs.setAttribute('aria-label','Seções do perfil');
 for(const [k,label] of [['posts','Publicações'],['about','Sobre'],['photos','Fotos'],['communities','Comunidades']]){const b=button(label,()=>{profileTab=k;renderProfile();},tabs);b.className='pf-tab';b.setAttribute('aria-pressed',String(profileTab===k));}
 const top=make('section',undefined,'pf-top');top.append(cover,head,tabs);
 const side=make('aside',undefined,'pf-side');
 const intro=make('section',undefined,'pf-card');intro.append(make('h2','Apresentação'));
 if(person.bio)intro.append(make('p',person.bio,'pf-bio'));else intro.append(make('p',own?'Conte quem você é e como participa da rede. Toque em Editar perfil.':'Ainda sem apresentação.','pf-empty'));
 const facts=make('ul',undefined,'pf-facts');
 if(person.affiliation)facts.append(make('li',person.affiliation));
 if(person.joinedAt)facts.append(make('li','Na rede desde '+new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(person.joinedAt))));
 facts.append(make('li',comms.length+(comms.length===1?' comunidade':' comunidades')));
 intro.append(facts);side.append(intro);
 if(photos.length){const pc=make('section',undefined,'pf-card');const h=make('div',undefined,'pf-card-head');h.append(make('h2','Fotos'));const more=button('Ver todas',()=>{profileTab='photos';renderProfile();},h);more.className='pf-link';pc.append(h,photoGrid(photos.slice(0,9)));side.append(pc);}
 const main=make('div',undefined,'pf-main');
 if(profileTab==='posts'){
  if(own){const c=make('a',undefined,'pf-compose');c.href='/#opy-compose';c.append(avatarNode(person.name,person.avatar,40),make('span','No que você está pensando?'));main.append(c);}
  main.append(...posts.map(p=>renderPost(p)));
  if(!posts.length)main.append(make('p',own?'Você ainda não publicou. Sua primeira publicação aparece aqui.':'Nenhuma publicação visível para você.','pf-card pf-empty'));
 }else if(profileTab==='about'){
  const c=make('section',undefined,'pf-card');c.append(make('h2','Sobre'));const dl=make('dl',undefined,'pf-about');
  const row=(t,v)=>{if(v)dl.append(make('dt',t),make('dd',v));};
  row('Nome',person.name);row('Usuário',person.username?'@'+person.username:'');row('Povo, território ou organização',person.affiliation);row('Apresentação',person.bio);
  row('Na rede desde',person.joinedAt?new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(person.joinedAt)):'');
  c.append(dl);main.append(c);
 }else if(profileTab==='photos'){
  const c=make('section',undefined,'pf-card');c.append(make('h2','Fotos'),photos.length?photoGrid(photos):make('p','Nenhuma foto publicada.','pf-empty'));main.append(c);
 }else{
  const c=make('section',undefined,'pf-card');c.append(make('h2','Comunidades'));
  if(!comms.length)c.append(make('p',own?'Você ainda não participa de comunidades.':'Nenhuma comunidade pública.','pf-empty'));
  const ul=make('ul',undefined,'pf-comms');for(const cm of comms){const li=make('li');const a=make('a',cm.name);a.href='/grupos/?c='+encodeURIComponent(cm.id);li.append(a,make('small',[cm.category,(cm.membersCount||0)+' participantes'].filter(Boolean).join(' · ')));ul.append(li);}c.append(ul);main.append(c);
 }
 const body=make('div',undefined,'pf-body');body.append(side,main);
 root.replaceChildren(top,body);
}
function openProfile(key){
 if(!key)return;
 location.href=state?.me&&key==='id:'+state.me.id?'/conta/':'/perfil/?u='+encodeURIComponent(key);
}
async function uploadProfileMedia(kind,input){
 const file=input.files[0];if(!file)return;const st=$('#profile-edit-status');
 try{
  if(file.size>2*1024*1024)throw Error('Escolha uma imagem de até 2 MB.');
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Não foi possível ler a imagem.'));r.readAsDataURL(file);});
  if(st)st.textContent='Enviando imagem…';
  await change({action:'profile_media',kind,media:{name:file.name,data}});
  if(st)st.textContent=kind==='avatar'?'Foto do perfil atualizada.':'Capa atualizada.';
 }catch(e){if(st)st.textContent=e.message;showError(e.message);}
 finally{input.value='';}
}
function openPrivateChat(key){
 if(!key?.startsWith('id:')){showError('Esta pessoa aparece no acervo e ainda não tem conta nesta prévia.');return;}
 location.href='/chat/?p='+encodeURIComponent(key);
}
function renderDockChat(){
 const dock=$('#chat-dock');if(!dock||dock.hidden||!dockChatKey||!state)return;
 const person=personByKey(dockChatKey);
 $('#chat-dock-avatar')?.replaceChildren(avatarNode(person.name,person.avatar,32));
 $('#chat-dock-name').textContent=person.name;
 $('#chat-dock-who').onclick=()=>openProfile(person.key,person.name,person.avatar);
 const myKey=`id:${state.me.id}`;
 const thread=(state.dms||[]).filter(m=>(m.fromKey===myKey&&m.toKey===dockChatKey)||(m.fromKey===dockChatKey&&m.toKey===myKey));
 const log=$('#chat-dock-log');
 if(log){
  log.replaceChildren(...thread.map(m=>{
   const mine=m.fromKey===myKey;
   const bubble=make('div',undefined,'chat-bubble'+(mine?' is-mine':''));
   bubble.append(make('strong',mine?'Você':m.fromName),make('p',m.text),make('small',date(m.createdAt)));
   return bubble;
  }));
  if(!thread.length)log.append(make('p',`Envie a primeira mensagem privada para ${person.name}.`,'chat-empty'));
  log.scrollTop=log.scrollHeight;
 }
}
let communityCategory='', communitySearch='', activeCommunityId=new URLSearchParams(location.search).get('c')||'', activeCommunityTab='feed', communityDialogAction=null;
function openCommunityDialog(title, submitLabel, buildBody, onSubmit){
 const dlg=$('#community-dialog');if(!dlg)return;
 $('#community-dialog-title').textContent=title;
 $('#community-dialog-submit').textContent=submitLabel;
 const err=$('#community-dialog-error');err.hidden=true;err.textContent='';
 const body=$('#community-dialog-body');body.replaceChildren();
 buildBody(body);
 communityDialogAction=onSubmit;
 if(!dlg.open)dlg.showModal();
}
// Pedido de entrada: se a comunidade privada tem perguntas, abre o formulário de respostas antes de enviar.
function joinCommunity(c){
 const qs=c.entryQuestions||[];
 if(c.joined||c.pending||c.requested||!qs.length)return change({action:c.joined?'community_leave':'community_join',communityId:c.id});
 if(!$('#community-dialog')){location.href='/grupos/?c='+encodeURIComponent(c.id);return Promise.resolve();}
 openCommunityDialog('Pedir entrada em '+c.name,'Enviar pedido',body=>{
  body.append(make('p','A coordenação lê suas respostas antes de aprovar a entrada.','community-dialog-hint'));
  qs.forEach((q,i)=>{const l=make('label',q);const t=make('textarea');t.name='answer'+i;t.required=true;t.maxLength=500;t.rows=2;l.append(t);body.append(l);});
 },form=>change({action:'community_join',communityId:c.id,answers:qs.map((_,i)=>form.elements['answer'+i].value)}));
 return Promise.resolve();
}
// Até 3 perguntas de entrada, visíveis só quando a comunidade é privada.
function entryQuestionFields(select,values){
 const box=make('fieldset',undefined,'community-entry-questions');
 box.append(make('legend','Perguntas de entrada (opcional)'),make('small','Quem pedir entrada responde antes do pedido chegar à coordenação.'));
 for(let i=0;i<3;i++){const l=make('label','Pergunta '+(i+1));const inp=make('input');inp.name='entryQuestion'+i;inp.maxLength=200;inp.value=values?.[i]||'';l.append(inp);box.append(l);}
 const sync=()=>{box.hidden=select.value!=='private';};select.addEventListener('change',sync);sync();
 return box;
}
const entryQuestionsOf=form=>[0,1,2].map(i=>form.elements['entryQuestion'+i]?.value.trim()||'').filter(Boolean);
function openCommunityDetail(id){
 activeCommunityId=id||'';
 activeCommunityTab='feed';
 const url=new URL(location.href);
 if(activeCommunityId)url.searchParams.set('c',activeCommunityId);
 else url.searchParams.delete('c');
 history.replaceState(null,'',url.pathname+url.search);
 renderCommunities();
}
const DEFAULT_COMMUNITY_CATEGORIES=['Projeto & Rede','Saberes & Educação','Território & Guardiões','Cultura & Audiovisual','Economia & Articulação'];
function communitiesList(){return Array.isArray(state?.communities)?state.communities:(state?.communities?.list||[]);}
function renderCommunities(){
 const ws=$('#communities-workspace');if(!ws||!state?.communities)return;
 const cList=communitiesList();
 if(!communityCategory)communityCategory=ws.dataset.defaultFilter||'all';
 all('[data-community-cat]',ws).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.communityCat===communityCategory)));
 const discovery=$('#communities-discovery',ws), detail=$('#community-detail',ws);
 const current=activeCommunityId?cList.find(c=>c.id===activeCommunityId):null;
 if(activeCommunityId&&!current)activeCommunityId='';
 if(current){
  const isPrivate=(current.visibility||current.privacy)==='private';
  const isPending=!!(current.pending||current.requested);
  const canViewContent=current.canViewContent!==undefined?current.canViewContent:(!isPrivate||current.joined||current.canModerate);
  discovery.hidden=true;detail.hidden=false;
  detail.replaceChildren();
  const backRow=make('div',undefined,'community-detail-nav');
  const backBtn=make('button','← Todas as comunidades','preview-secondary');backBtn.type='button';
  backBtn.onclick=()=>openCommunityDetail('');
  backRow.append(backBtn);detail.append(backRow);
  const hero=make('header',undefined,'community-hero');
  const cover=make('div',undefined,'community-cover');
  const badgeRow=make('div',undefined,'community-badges');
  badgeRow.append(
   make('span',isPrivate?'Comunidade privada · Somente membros':'Comunidade pública','community-badge'+(isPrivate?' is-private':' is-public')),
   make('span',current.category,'community-badge is-category')
  );
  cover.append(badgeRow);
  const headBody=make('div',undefined,'community-hero-body');
  const titleRow=make('div',undefined,'community-hero-title-row');
  const av=make('span',current.avatar||current.name.slice(0,2).toUpperCase(),'preview-avatar community-detail-avatar');
  const titleWrap=make('div');
  const h2=make('h2',current.name);h2.id='community-detail-title';
  const statsLine=make('small',plural(current.membersCount||0,'participante','participantes')+' · '+plural(current.postsCount||0,'publicação','publicações'));
  if(current.id==='avaliacao-casa-opy')statsLine.dataset.communityMembers='';
  titleWrap.append(h2,statsLine);
  titleRow.append(av,titleWrap);
  const desc=make('p',current.description,'community-hero-desc');
  const leaders=[...(current.admins||[]),...(current.moderators||[])];
  const leaderText=make('small','Coordenação e moderação: '+(leaders.length?leaders.map(l=>`${l.name} (${l.role==='admin'?'Admin':'Mod'})`).join(', '):'Equipe Casa Opy'),'community-leaders');
  const actionBar=make('div',undefined,'community-hero-actions');
  const joinLabel=current.joined?'Sair da comunidade':isPending?'Cancelar solicitação (pendente)':isPrivate?'Solicitar participação':'Participar da comunidade';
  const joinBtn=button(joinLabel,()=>joinCommunity(current),actionBar);
  joinBtn.id='community-detail-join';
  joinBtn.className=current.joined||isPending?'preview-secondary':'opy-primary';
  joinBtn.setAttribute('aria-pressed',String(current.joined));
  if(current.id==='avaliacao-casa-opy')joinBtn.dataset.communityJoin='';
  if(current.joined&&(!isPrivate||current.canModerate)){
   button('Convidar pessoa',()=>{
    openCommunityDialog('Convidar para '+current.name,'Enviar convite',body=>{
     const lbl=make('label','Escolha uma pessoa com conta na prévia');
     const sel=make('select');sel.name='memberKey';sel.required=true;
     const candidates=(state.directory||[]).filter(p=>p.key.startsWith('id:')&&!p.own&&!(current.members||[]).some(m=>m.key===p.key));
     if(!candidates.length){body.append(make('p','Todas as contas ativas já participam desta comunidade.'));return;}
     for(const c of candidates){const o=make('option',`${c.name}${c.username?' (@'+c.username+')':''}`);o.value=c.key;sel.append(o);}
     lbl.append(sel);body.append(lbl);
    },async form=>{
     const key=form.elements.memberKey?.value;if(!key)return;
     await change({action:'community_invite',communityId:current.id,memberKey:key});
    });
   },actionBar);
  }
  button('Denunciar',()=>{
   openCommunityDialog('Denunciar comunidade '+current.name,'Registrar denúncia',body=>{
    const lbl=make('label','Descreva o motivo da denúncia para revisão da moderação');
    const ta=make('textarea');ta.name='reason';ta.required=true;ta.minLength=5;ta.maxLength=500;ta.rows=3;ta.placeholder='Ex.: Descumprimento das regras de convivência ou exposição indevida…';
    lbl.append(ta);body.append(lbl);
   },async form=>{
    await change({action:'community_report',communityId:current.id,reason:form.elements.reason.value});
   });
  },actionBar);
  headBody.append(titleRow,desc,leaderText,actionBar);
  hero.append(cover,headBody);
  detail.append(hero);
  const tabs=make('nav',undefined,'feed-float community-tabs');tabs.setAttribute('aria-label','Seções da comunidade');
  const tabDefs=[['feed',`Feed (${current.postsCount||0})`],['members',`Membros (${current.membersCount||0}${(current.canModerate&&current.pendingRequests?.length)?' · '+current.pendingRequests.length+' pendente(s)':''})`],['rules','Informações e governança']];
  if(current.role==='admin'||current.canManage)tabDefs.push(['settings','Configurações']);
  for(const [id,label] of tabDefs){
   const b=make('button',label);b.type='button';b.dataset.communityTab=id;b.setAttribute('aria-pressed',String(activeCommunityTab===id));
   b.onclick=()=>{activeCommunityTab=id;renderCommunities();};
   tabs.append(b);
  }
  detail.append(tabs);
  const panel=make('div',undefined,'community-tab-panel');
  if(activeCommunityTab==='feed'){
   if(current.joined){
    const cForm=make('form',undefined,'preview-composer community-inline-composer');cForm.id='community-post-form';
    const cLabel=make('label',`Publicar em ${current.name}`,'community-compose-label');cLabel.htmlFor='community-post-text';
    const cText=make('textarea');cText.id='community-post-text';cText.required=true;cText.maxLength=5000;cText.rows=3;
    cText.placeholder=`Compartilhe uma atualização, relato ou debate com os participantes de ${current.name}…`;
    const cRow=make('div',undefined,'preview-publish-row');
    cRow.append(make('small',isPrivate?'Visível somente para membros aprovados desta comunidade.':'Visível no feed da comunidade e no feed geral da plataforma.'));
    const cSubmit=make('button','Publicar na comunidade','opy-primary');cSubmit.type='submit';
    cRow.append(cSubmit);
    const cStatus=make('p',undefined,'preview-feedback');cStatus.setAttribute('role','status');
    cForm.append(cLabel,cText,cRow,cStatus);
    cForm.onsubmit=async e=>{
     e.preventDefault();cSubmit.disabled=true;cStatus.textContent='Publicando…';
     try{await change({action:'publish',text:cText.value,audience:'public',communityId:current.id});cText.value='';cStatus.textContent='Publicação compartilhada na comunidade.';}
     catch(err){cStatus.textContent=err.message;}finally{cSubmit.disabled=false;}
    };
    panel.append(cForm);
   }else if(isPrivate){
    const gate=make('div',undefined,'community-private-gate');
    gate.append(make('h3','Espaço restrito aos participantes'),make('p','Esta comunidade é privada e segue protocolo próprio de visibilidade. Solicite participação acima para acessar e publicar no feed interno.'));
    panel.append(gate);
   }else{
    const hint=make('div',undefined,'community-join-banner');
    hint.append(make('p','Participe desta comunidade para publicar e interagir com os membros.'));
    panel.append(hint);
   }
   if(canViewContent){
    const cPosts=state.posts.filter(p=>p.communityId===current.id);
    if(cPosts.length)panel.append(...cPosts.map(p=>renderPost(p,current)));
    else panel.append(make('p','Nenhuma publicação nesta comunidade ainda. Seja a primeira pessoa a compartilhar!','opy-module-empty'));
   }
  }else if(activeCommunityTab==='members'){
   if(current.canModerate&&current.pendingRequests?.length){
    const reqBox=make('section',undefined,'community-requests-box');
    reqBox.append(make('h3',`Solicitações de entrada pendentes (${current.pendingRequests.length})`));
    for(const req of current.pendingRequests){
     const row=make('div',undefined,'community-member-row');
     row.append(avatarNode(req.name,req.avatar,38),make('strong',req.name));
     const acts=make('div',undefined,'community-member-actions');
     const appBtn=button('Aprovar entrada',()=>change({action:'community_approve',communityId:current.id,memberKey:req.key}),acts);appBtn.className='opy-primary';
     button('Recusar',()=>change({action:'community_reject',communityId:current.id,memberKey:req.key}),acts);
     row.append(acts);reqBox.append(row);
     const answers=req.answers||[];
     if(answers.length){const dl=make('dl',undefined,'community-request-answers');answers.forEach((a,i)=>dl.append(make('dt',(current.entryQuestions||[])[i]||'Pergunta '+(i+1)),make('dd',a||'—')));reqBox.append(dl);}
    }
    panel.append(reqBox);
   }
   const memBox=make('section',undefined,'community-members-list');
   memBox.append(make('h3',`Participantes (${current.membersCount})`));
   for(const m of (current.members||[])){
    const row=make('div',undefined,'community-member-row');
    const whoBtn=make('button',undefined,'community-person');whoBtn.type='button';
    whoBtn.onclick=()=>openProfile(m.key,m.name,m.avatar);
    whoBtn.append(avatarNode(m.name,m.avatar,38),make('strong',m.name));
    const roleBadge=make('span',m.role==='admin'?'Administrador':m.role==='moderator'?'Moderador':'Membro','community-role-badge is-'+m.role);
    row.append(whoBtn,roleBadge);
    if((current.role==='admin'||current.canManage)&&m.key!==`id:${state.me.id}`){
     const acts=make('div',undefined,'community-member-actions');
     const nextRole=m.role==='moderator'?'member':'moderator';
     button(m.role==='moderator'?'Tornar membro':'Tornar moderador',()=>change({action:'community_role',communityId:current.id,memberKey:m.key,role:nextRole}),acts);
     button('Remover',()=>change({action:'community_remove_member',communityId:current.id,memberKey:m.key}),acts);
     row.append(acts);
    }
    memBox.append(row);
   }
   panel.append(memBox);
  }else if(activeCommunityTab==='rules'){
   const rulesCard=make('article',undefined,'community-rules-card');
   rulesCard.append(
    make('h3','Regras de convivência e governança cultural'),
    make('p',current.rules||'Respeito mútuo, escuta ativa e proteção aos saberes tradicionais.'),
    make('h3','Princípios CARE e proteção de conhecimentos'),
    make('p','A Casa Opy reconhece que cada povo, organização e coletivo possui protocolos próprios de comunicação. Informações culturais sensíveis, ritos e conhecimentos tradicionais restritos não devem ser expostos sem autorização expressa de seus guardiões.'),
    make('h3','Visibilidade desta comunidade'),
    make('p',isPrivate?'Comunidade Privada: apenas membros aprovados pelos administradores ou moderadores podem ler e publicar no feed da comunidade.':'Comunidade Pública: aberta à leitura e entrada de contas autenticadas na plataforma, com moderação ativa.')
   );
   panel.append(rulesCard);
  }else if(activeCommunityTab==='settings'&&(current.role==='admin'||current.canManage)){
   const sForm=make('form',undefined,'profile-edit-form community-settings-form');
   sForm.append(make('h3','Configurações da comunidade'));
   const lName=make('label','Nome da comunidade');const iName=make('input');iName.name='name';iName.required=true;iName.maxLength=80;iName.value=current.name;lName.append(iName);
   const lCat=make('label','Categoria');const sCat=make('select');sCat.name='category';
   for(const c of DEFAULT_COMMUNITY_CATEGORIES){const o=make('option',c);o.value=c;if(c===current.category)o.selected=true;sCat.append(o);}
   lCat.append(sCat);
   const lPriv=make('label','Visibilidade e acesso');const sPriv=make('select');sPriv.name='visibility';
   for(const [val,txt] of [['public','Pública (qualquer conta entra e visualiza)'],['private','Privada (entrada mediante aprovação · feed restrito a membros)']]){const o=make('option',txt);o.value=val;if(val===(current.visibility||current.privacy))o.selected=true;sPriv.append(o);}
   lPriv.append(sPriv);
   const lDesc=make('label','Descrição');const tDesc=make('textarea');tDesc.name='description';tDesc.required=true;tDesc.maxLength=600;tDesc.rows=3;tDesc.value=current.description;lDesc.append(tDesc);
   const lRules=make('label','Regras de convivência e protocolo cultural');const tRules=make('textarea');tRules.name='rules';tRules.maxLength=1000;tRules.rows=3;tRules.value=current.rules||'';lRules.append(tRules);
   const sBtn=make('button','Salvar configurações','opy-primary');sBtn.type='submit';
   const sStatus=make('p',undefined,'preview-feedback');sStatus.setAttribute('role','status');
   const qBox=entryQuestionFields(sPriv,current.entryQuestions);
   sForm.append(lName,lCat,lPriv,qBox,lDesc,lRules,sBtn,sStatus);
   sForm.onsubmit=async e=>{
    e.preventDefault();sBtn.disabled=true;
    try{await change({action:'community_update',communityId:current.id,name:iName.value,category:sCat.value,visibility:sPriv.value,description:tDesc.value,rules:tRules.value,entryQuestions:entryQuestionsOf(sForm)});sStatus.textContent='Configurações atualizadas.';}
    catch(err){sStatus.textContent=err.message;}finally{sBtn.disabled=false;}
   };
   panel.append(sForm);
  }
  detail.append(panel);
  return;
 }
 discovery.hidden=false;detail.hidden=true;
 const invBox=$('#communities-invitations',ws);
 const invites=cList.filter(c=>c.invited);
 if(invBox){
  invBox.hidden=!invites.length;
  invBox.replaceChildren(...invites.map(inv=>{
   const row=make('div',undefined,'community-invite-banner');
   row.append(make('p',`Você recebeu um convite para participar de "${inv.name}" (${(inv.visibility||inv.privacy)==='private'?'Privada':'Pública'}).`));
   const acts=make('div',undefined,'community-member-actions');
   const acc=button('Aceitar convite',()=>change({action:'community_accept_invite',communityId:inv.id}),acts);acc.className='opy-primary';
   button('Recusar',()=>change({action:'community_decline_invite',communityId:inv.id}),acts);
   row.append(acts);return row;
  }));
 }
 const q=communitySearch.trim().toLocaleLowerCase('pt-BR');
 const items=cList.filter(c=>{
  if(communityCategory==='joined'&&!c.joined)return false;
  if(communityCategory!=='all'&&communityCategory!=='joined'&&c.category!==communityCategory)return false;
  if(q&&!(`${c.name} ${c.description} ${c.category}`).toLocaleLowerCase('pt-BR').includes(q))return false;
  return true;
 });
 const grid=$('#communities-list',ws);
 if(grid){
  grid.replaceChildren(...items.map(c=>{
   const isPrivate=(c.visibility||c.privacy)==='private';
   const isPending=!!(c.pending||c.requested);
   const card=make('article',undefined,'community-card');card.dataset.communityId=c.id;
   const top=make('div',undefined,'community-card-top');
   const av=make('span',c.avatar||c.name.slice(0,2).toUpperCase(),'preview-avatar community-card-avatar');
   const meta=make('div',undefined,'community-card-meta');
   const badges=make('div',undefined,'community-badges');
   badges.append(
    make('span',isPrivate?'Privada':'Pública','community-badge'+(isPrivate?' is-private':' is-public')),
    make('span',c.category,'community-badge is-category')
   );
   const titleBtn=make('button',c.name,'community-card-title');titleBtn.type='button';
   titleBtn.onclick=()=>openCommunityDetail(c.id);
   const countSpan=make('small',plural(c.membersCount||0,'participante','participantes')+' · '+plural(c.postsCount||0,'publicação','publicações'));
   if(c.id==='avaliacao-casa-opy')countSpan.dataset.communityMembers='';
   meta.append(badges,titleBtn,countSpan);
   top.append(av,meta);
   const desc=make('p',c.description,'community-card-desc');
   const foot=make('div',undefined,'community-card-actions');
   const openBtn=make('button','Abrir comunidade','preview-secondary');openBtn.type='button';
   openBtn.onclick=()=>openCommunityDetail(c.id);
   foot.append(openBtn);
   const jLabel=c.joined?(c.id==='avaliacao-casa-opy'?'Sair da comunidade':'Participando ✓'):isPending?'Pedido enviado':isPrivate?'Pedir entrada':'Participar';
   const jBtn=button(jLabel,()=>joinCommunity(c),foot);
   jBtn.className=c.joined||isPending?'preview-secondary':'opy-primary';
   jBtn.setAttribute('aria-pressed',String(c.joined));
   if(c.id==='avaliacao-casa-opy')jBtn.dataset.communityJoin='';
   card.append(top,desc,foot);
   return card;
  }));
  if(!items.length)grid.append(make('p','Nenhuma comunidade encontrada para este filtro. Você pode criar uma nova comunidade acima.','opy-module-empty'));
 }
}
function render(){if(!state)return;
 all('[data-community-name]').forEach(el=>el.textContent=state.me.name);all('[data-community-username]').forEach(el=>el.textContent='@'+state.me.username);all('[data-community-avatar]').forEach(el=>{if(state.me.avatar){if(el.querySelector('img')?.getAttribute('src')!==state.me.avatar){const im=make('img');im.src=state.me.avatar;im.alt='';el.replaceChildren(im);}}else el.textContent=state.me.name.slice(0,1).toLocaleUpperCase('pt-BR');el.title=state.me.name;});all('[data-community-contact]').forEach(el=>{const digits=state.me.phone||'';const phone=digits.length>=10?digits.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3'):'não informado nesta conta';el.textContent='Chave Google: '+(state.me.googleKey||'não informada nesta conta')+' · Telefone: '+phone;});
 const pForm=$('#profile-edit-form');
 if(pForm&&!pForm.contains(document.activeElement)){
  if($('#profile-edit-name'))$('#profile-edit-name').value=state.me.name||'';
  if($('#profile-edit-affiliation'))$('#profile-edit-affiliation').value=state.me.affiliation||'';
  if($('#profile-edit-bio'))$('#profile-edit-bio').value=state.me.bio||'';
 }
 const cList=communitiesList();
 const commTarget=$('#preview-community-target');
 if(commTarget&&cList.length){
  const prev=commTarget.value;
  const joined=cList.filter(c=>c.joined);
  commTarget.replaceChildren(new Option('Feed geral da aldeia',''),...joined.map(c=>new Option(`Comunidade: ${c.name}${(c.visibility||c.privacy)==='private'?' (Privada)':''}`,c.id)));
  if([...commTarget.options].some(o=>o.value===prev))commTarget.value=prev;
 }
 const chatHeaderLink=$('.messages-notification-container a');
 if(chatHeaderLink){
  let badge=$('.opy-header-badge',chatHeaderLink);
  const count=state.unreadChatCount||0;
  if(count>0){if(!badge){badge=make('span',undefined,'opy-header-badge');chatHeaderLink.append(badge);}badge.textContent=count>99?'99+':String(count);}
  else if(badge)badge.remove();
 }
 const incomingFriends=(state.directory||[]).filter(p=>p.friendStatus==='incoming');
 const commInvites=cList.filter(c=>c.invited);
 const pendingModRequests=cList.filter(c=>c.canModerate&&c.pendingRequests?.length);
 const ownInteractedPosts=state.posts.filter(p=>p.own&&(p.comments.length||Object.values(p.reactions).some(Boolean)));
 const notifCount=incomingFriends.length+commInvites.length+pendingModRequests.reduce((s,c)=>s+c.pendingRequests.length,0)+ownInteractedPosts.length;
 const notifHeaderLink=$('.notification-container a');
 if(notifHeaderLink){
  let badge=$('.opy-header-badge',notifHeaderLink);
  if(notifCount>0){if(!badge){badge=make('span',undefined,'opy-header-badge');notifHeaderLink.append(badge);}badge.textContent=notifCount>99?'99+':String(notifCount);}
  else if(badge)badge.remove();
 }
 paintCommunity();
 paintAnnouncements();
 renderCommunities();
 const stories=$('#story-list');if(stories&&Array.isArray(state.stories)){
  stories.replaceChildren();const create=button('',()=>openStorySheet(),stories);create.classList.add('story-card','story-create');create.append(make('span','+','story-plus'),make('strong','Criar story'));
  for(const item of state.stories){
   const card=button('',()=>openStory(item),stories);card.classList.add('story-card');if(seenStories.has(item.id))card.classList.add('is-seen');
   card.append(make('span',item.author.slice(0,1).toLocaleUpperCase('pt-BR'),'story-avatar'));
   if(item.media?.kind==='image'){const img=make('img',undefined,'story-thumbnail');img.src=item.media.url;img.alt='';img.loading='lazy';card.append(img);}
   else if(item.media?.kind==='video'){const vid=make('video',undefined,'story-thumbnail');vid.src=item.media.url;vid.muted=true;vid.playsInline=true;vid.preload='metadata';vid.setAttribute('aria-hidden','true');card.append(vid);}
   card.append(make('span',item.text||(item.media?.kind==='video'?'Vídeo':'Foto'),'story-card-text'),make('strong',item.author));card.setAttribute('aria-label','Ver story de '+item.author);
  }
  if(!state.stories.length)stories.append(make('p','Compartilhe o primeiro story da comunidade.','story-empty'));
 }
 const feed=$('#preview-feed');if(feed){
  const saved=document.body.dataset.previewRoute==='saved-posts';
  const basePosts=state.posts.filter(p=>(!saved||p.saved)&&(filter==='all'||p.origin===filter));
  const posts=feedPosts(basePosts);
  const locBox=$('.feed-location');if(locBox)locBox.hidden=view!=='location';
  const drafts=new Map(all('.community-post',feed).map(card=>[card.id,{text:$('.preview-comment-form input',card)?.value||'',open:!$('.preview-comment-form',card)?.hidden}]));
  feed.replaceChildren(...posts.map(p=>renderPost(p)));
  all('.community-post',feed).forEach(card=>{const draft=drafts.get(card.id);if(draft){$('.preview-comment-form input',card).value=draft.text;const form=$('.preview-comment-form',card);form.hidden=!draft.open;const toggle=card.querySelector('[aria-controls="'+form.id+'"]');if(toggle)toggle.setAttribute('aria-expanded',String(!!draft.open));}});
  if(!posts.length)feed.append(make('p',saved?'Você ainda não salvou publicações.':view==='following'&&!state.posts.some(p=>p.following||p.friendStatus==='friends')?'Você ainda não segue ninguém. Use Descobrir para conhecer pessoas e seguir quem quiser.':view==='location'?'Nenhuma publicação com esse local. As pessoas informam o local ao publicar.':view==='discover'?'Você já segue todo mundo que publicou por aqui.':'Nenhuma publicação neste filtro.'));
 }
 renderProfile();
 renderDockChat();
 const join=$('[data-community-join]');if(join&&!$('#communities-workspace')){join.textContent=state.group.joined?'Sair do grupo':'Participar do grupo';join.setAttribute('aria-pressed',String(state.group.joined));}if($('[data-community-members]')&&!$('#communities-workspace'))$('[data-community-members]').textContent=state.group.count+' participante(s) neste ambiente.';
 const results=$('#preview-search-results');if(results){
  const rawQuery=new URLSearchParams(location.search).get('query')||'';
  if($('#search-page-input')&&document.activeElement!==$('#search-page-input'))$('#search-page-input').value=rawQuery;
  const query=rawQuery.toLocaleLowerCase('pt-BR');
  results.replaceChildren();
  const matchedComms=(communitiesList()).filter(c=>(c.name+' '+c.description+' '+c.category).toLocaleLowerCase('pt-BR').includes(query));
  if(matchedComms.length){
   const sec=make('section',undefined,'search-result-group');sec.append(make('h2','Comunidades'));
   for(const c of matchedComms){
    const row=make('a',undefined,'search-community-link');row.href='/grupos/?c='+encodeURIComponent(c.id);
    row.append(make('strong',`${c.name} (${(c.visibility||c.privacy)==='private'?'Privada':'Pública'})`),make('p',c.description),make('small',`${c.category} · ${c.membersCount} participante(s)`));
    sec.append(row);
   }
   results.append(sec);
  }
  const matchedPeople=(state.directory||[]).filter(p=>(p.name+' '+(p.username||'')+' '+(p.affiliation||'')).toLocaleLowerCase('pt-BR').includes(query));
  if(matchedPeople.length){
   const sec=make('section',undefined,'search-result-group');sec.append(make('h2','Pessoas na comunidade'));
   for(const p of matchedPeople.slice(0,8)){
    const row=make('div',undefined,'community-member-row');
    const b=make('button',undefined,'community-person');b.type='button';b.onclick=()=>openProfile(p.key,p.name,p.avatar);
    b.append(avatarNode(p.name,p.avatar,36),make('strong',p.name+(p.affiliation?` · ${p.affiliation}`:'')));
    row.append(b);sec.append(row);
   }
   results.append(sec);
  }
  const posts=state.posts.filter(p=>(p.text+' '+p.author+' '+(p.communityName||'')).toLocaleLowerCase('pt-BR').includes(query));
  if(posts.length){
   const sec=make('section',undefined,'search-result-group');sec.append(make('h2','Publicações'));
   for(const p of posts){const a=make('a');a.href='/#post-'+p.id;a.append(make('strong',p.author+(p.communityName?' · '+p.communityName:'')),make('p',p.text.slice(0,240)),make('small',date(p.createdAt)));sec.append(a);}
   results.append(sec);
  }
  if(!matchedComms.length&&!matchedPeople.length&&!posts.length)results.append(make('p','Nenhuma publicação, pessoa ou comunidade encontrada.'));
 }
 const notices=$('#community-notifications');if(notices){
  notices.replaceChildren();
  for(const friend of incomingFriends){
   const card=make('div',undefined,'notification-card');
   card.append(make('strong',`${friend.name} enviou uma solicitação de amizade.`));
   const acts=make('div',undefined,'community-member-actions');
   const acc=button('Aceitar amizade',()=>change({action:'friend',authorKey:friend.key}),acts);acc.className='opy-primary';
   button('Ver perfil',()=>openProfile(friend.key,friend.name,friend.avatar),acts);
   card.append(acts);notices.append(card);
  }
  for(const inv of commInvites){
   const card=make('div',undefined,'notification-card');
   card.append(make('strong',`${inv.fromName} convidou você para a comunidade "${inv.communityName}".`));
   const acts=make('div',undefined,'community-member-actions');
   const acc=button('Aceitar convite',()=>change({action:'community_accept_invite',communityId:inv.communityId}),acts);acc.className='opy-primary';
   button('Recusar',()=>change({action:'community_decline_invite',communityId:inv.communityId}),acts);
   card.append(acts);notices.append(card);
  }
  for(const comm of pendingModRequests){
   const card=make('div',undefined,'notification-card');
   const a=make('a',`${comm.pendingRequests.length} solicitação(ões) de entrada pendente(s) em "${comm.name}"`,'preview-text-link');
   a.href='/grupos/?c='+encodeURIComponent(comm.id);
   card.append(a);notices.append(card);
  }
  for(const p of ownInteractedPosts){
   const card=make('div',undefined,'notification-card');
   const a=make('a',p.comments.length+' comentário(s) e '+Object.values(p.reactions).reduce((a,b)=>a+b,0)+' reação(ões) em "'+p.text.slice(0,70)+'"','preview-text-link');
   a.href='/#post-'+p.id;
   card.append(a);notices.append(card);
  }
  if(!notices.children.length)notices.append(make('p','As solicitações de amizade, convites de comunidades e interações nas suas publicações aparecerão aqui.'));
 }
 if(state.saberes){let myCount=0;all('[data-saber-enroll]').forEach(b=>{const info=state.saberes[b.dataset.saberEnroll]||{enrolled:false,count:0};if(info.enrolled)myCount++;b.setAttribute('aria-pressed',String(info.enrolled));b.textContent=info.enrolled?'Inscrito na trilha (avaliação)':'Inscrever-se na trilha';const meta=$(`[data-saber-count="${b.dataset.saberEnroll}"]`);if(meta)meta.textContent=info.count?`${info.count} inscrição(ões) nesta homologação`:'Em avaliação';});if($('#opy-saberes-summary'))$('#opy-saberes-summary').textContent=myCount>0?`Você acompanha ${myCount} trilha(s) formativa(s) nesta sessão de homologação.`:'Selecione abaixo as trilhas de seu interesse para acompanhar seu painel formativo nesta sessão.';}
 if(state.music){all('[data-music-like]').forEach(b=>{const info=state.music[b.dataset.musicLike]||{liked:false,count:0};b.setAttribute('aria-pressed',String(info.liked));const span=$('span',b);if(span)span.textContent=info.liked?'Faixa apoiada':'Apoiar faixa';const meta=$(`[data-music-count="${b.dataset.musicLike}"]`);if(meta)meta.textContent=`${info.count} apoio(s) na homologação`;});}
 const etniaLog=$('#etnia-log');if(etniaLog&&Array.isArray(state.etnia)){const items=state.etnia;const signature=items.map(item=>item.role+'\n'+item.text+'\n'+(item.sourceTitle||'')).join('\u0001')||'hello';if(etniaLog.dataset.signature!==signature){const nodes=[];if(!items.length)nodes.push(etniaBubble('etnia','Olá. Pergunte como publicar, o que é a Casa Opy ou o que já funciona nesta prévia.',''));for(const item of items)nodes.push(etniaBubble(item.role,item.text,item.sourceTitle?`Fonte: ${item.sourceTitle}${item.revised?' · revisão '+item.revised:''}`:''));etniaLog.dataset.signature=signature;etniaLog.replaceChildren(...nodes);if(etniaLog.dataset.stick!=='0')etniaLog.scrollTop=etniaLog.scrollHeight;}}
 const tickets=$('#iara-tickets');if(tickets&&Array.isArray(state.iaraTickets)){const signature=JSON.stringify(state.iaraTickets);tickets.setAttribute('aria-busy','false');if(tickets.dataset.signature!==signature){tickets.dataset.signature=signature;tickets.replaceChildren(...state.iaraTickets.map(ticket=>{const card=make('article',undefined,'iara-ticket');card.append(make('h3',ticket.sectorTitle),make('small',ticket.protocol),make('p',ticket.status==='cancelado'?'Cancelado':'Aguardando encaminhamento à equipe'),make('p',ticket.description),make('p','Próximo passo: '+ticket.nextAction),make('small','Fonte: '+ticket.sourceTitle+' · '+date(ticket.createdAt)));const actions=make('div',undefined,'iara-ticket-actions');button('Baixar briefing',()=>{const content=[ticket.protocol,'Setor: '+ticket.sector,'Skill: '+ticket.skill,'Status: '+ticket.status,'Criado: '+date(ticket.createdAt),'',ticket.description,'','Proximo passo: '+ticket.nextAction,'','Fonte: '+ticket.sourceTitle,'Recepcao da homologacao. Sem envio ao Hermes ou publicacao externa.'].join('\n');const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=ticket.protocol+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},actions);if(ticket.status!=='cancelado')button('Cancelar pedido',async()=>{if(confirm('Cancelar este pedido?'))await change({action:'iara_cancel',ticketId:ticket.id});},actions);card.append(actions);return card;}));if(!state.iaraTickets.length)tickets.append(make('p','Você ainda não tem pedidos. Descreva o primeiro acima.'));}}
 if(state.submissions){all('[data-opy-submissions]').forEach(box=>{const mod=box.dataset.opySubmissions;const items=state.submissions.filter(s=>s.module===mod);box.replaceChildren(...items.map(s=>{const card=make('article',undefined,'opy-submission-card');card.id='submission-'+s.id;const head=make('div',undefined,'opy-submission-head');head.append(make('span','Protocolo '+s.protocol,'opy-submission-protocol'),make('small',s.category+(s.audience==='private'?' · Somente minha sessão':'')));const meta=make('div',undefined,'opy-submission-meta');meta.append(make('span',`${s.community} · ${s.author} · ${date(s.createdAt)}`));if(s.own)button('Remover registro',()=>change({action:'module_delete',submissionId:s.id}),meta);card.append(head,make('h3',s.title),make('p',s.details),meta);return card;}));if(!items.length)box.append(make('p','Nenhum registro enviado ainda nesta homologação.','opy-module-empty'));});}
}
function etniaBubble(role,text,source){const el=make('article',undefined,'etnia-msg'+(role==='user'?' etnia-msg-user':''));el.append(make('strong',role==='user'?'Você':'EtnIA'),make('p',text));if(source)el.append(make('small',source));return el;}
function safeNext(value){if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||value.includes('://'))return '/';return value;}
function showWelcomeError(message){const el=$('#welcome-error');if(!el)return;el.hidden=false;el.textContent=message;el.focus();}
function bindWelcome(){const login=$('#welcome-login'),register=$('#welcome-register');const tabs=[$('#tab-login'),$('#tab-register')];function show(which){login.hidden=which!=='login';register.hidden=which!=='register';tabs[0].setAttribute('aria-selected',String(which==='login'));tabs[1].setAttribute('aria-selected',String(which==='register'));$('#welcome-error').hidden=true;}
 tabs[0].onclick=()=>show('login');tabs[1].onclick=()=>show('register');
 all('[data-toggle-password]').forEach(button=>button.onclick=()=>{const input=document.getElementById(button.dataset.togglePassword);const visible=input.type==='text';input.type=visible?'password':'text';button.textContent=visible?'Mostrar senha':'Ocultar senha';button.setAttribute('aria-pressed',String(!visible));});
 async function submit(form,action){const statusButton=$('[type=submit]',form);statusButton.disabled=true;const original=statusButton.textContent;statusButton.textContent=action==='login'?'Entrando…':'Criando conta…';try{await api({action,name:form.elements.name?.value,username:form.elements.username.value,password:form.elements.password.value,googleKey:form.elements.googleKey?.value,phone:form.elements.phone?.value});location.replace(safeNext(new URLSearchParams(location.search).get('next')));}catch(error){showWelcomeError(error.message);statusButton.disabled=false;statusButton.textContent=original;}}
 login.onsubmit=event=>{event.preventDefault();submit(login,'login');};
 register.onsubmit=event=>{event.preventDefault();submit(register,'register');};
}
async function refresh(){try{state=await api();if(document.body.dataset.previewRoute==='entrar'){location.replace(safeNext(new URLSearchParams(location.search).get('next')));return;}if(!all('.preview-comment-form input').some(el=>el.value))render();}catch(e){if(e.status===401&&document.body.dataset.previewRoute!=='entrar'){location.replace('/entrar/?next='+encodeURIComponent(location.pathname+location.search));return;}if(document.body.dataset.previewRoute==='entrar')return;showError(e.message);if($('#community-connection'))$('#community-connection').textContent='Conexão indisponível · tente atualizar';}}
all('[data-community-refresh]').forEach(b=>b.onclick=refresh);all('[data-feed-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.feedFilter;all('[data-feed-filter]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();});all('[data-feed-view]').forEach(b=>b.onclick=()=>{view=b.dataset.feedView;all('[data-feed-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));b.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});render();});$('#feed-location-query')?.addEventListener('input',()=>render());
// Barra de modalidades fixa sob o cabeçalho; ganha sombra quando os Stories saem da tela (doc. 5.1 e 6.1).
(()=>{const bar=$('.feed-chips'),stories=$('.story-section'),top=$('.opy-topbar');if(!bar)return;
 const setTop=()=>document.documentElement.style.setProperty('--opy-head',(top?top.getBoundingClientRect().height:0)+'px');
 setTop();addEventListener('resize',setTop);
 if(stories&&'IntersectionObserver' in window)new IntersectionObserver(([e])=>bar.classList.toggle('is-stuck',!e.isIntersecting),{rootMargin:'-120px 0px 0px 0px'}).observe(stories);
})();
$('[data-community-join]')?.addEventListener('click',()=>change({action:'join'}).catch(e=>showError(e.message)));
all('[data-saber-enroll]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await change({action:'enroll_saber',trackId:b.dataset.saberEnroll});}catch(e){showError(e.message);}finally{b.disabled=false;}}));
all('[data-music-like]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await change({action:'like_music',trackId:b.dataset.musicLike});}catch(e){showError(e.message);}finally{b.disabled=false;}}));
all('[data-opy-module-form]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const submit=$('[type=submit]',form);const status=$('[data-opy-module-status]',form);submit.disabled=true;try{const mod=form.dataset.opyModuleForm;await change({action:'module_submit',module:mod,category:form.elements.category?.value||'',community:form.elements.community?.value||'',title:form.elements.title?.value||'',details:form.elements.details?.value||'',audience:form.elements.audience?.value||'public'});const created=state.submissions?.find(s=>s.module===mod&&s.own);form.reset();if(status)status.textContent='Registro salvo na homologação'+(created?' · Protocolo '+created.protocol:'');}catch(err){if(status)status.textContent=err.message;else showError(err.message);}finally{submit.disabled=false;}}));
let storyExpiry,storyRaf=0,storyIndex=0,storyPaused=false,storyElapsed=0,storyLastTick=0,storyMuted=false,holdAt=0,suppressTap=false,swipeStartX=0,swipeStartY=0,cameraFacing='environment',cameraMode='photo';
const STORY_MS=6000;
function activeStories(){return (state?.stories||[]).filter(item=>item.expiresAt>Date.now());}
function storyTime(ts){const mins=Math.max(0,Math.floor((Date.now()-ts)/60000));if(mins<1)return 'Agora';if(mins<60)return `há ${mins} min`;return `há ${Math.floor(mins/60)} h`;}
function syncMuteBtn(){const b=$('#story-mute');if(!b)return;b.textContent=storyMuted?'Ativar som':'Silenciar';b.setAttribute('aria-pressed',String(!storyMuted));}
function tickStory(now){
 const viewer=$('#story-viewer');if(!viewer?.open)return;
 const dt=Math.max(0,now-storyLastTick);storyLastTick=now;
 const video=$('#story-viewer-media video');
 const fill=$('#story-progress')?.children[storyIndex]?.firstElementChild;
 if(!storyPaused){
  const total=video&&Number.isFinite(video.duration)&&video.duration>0?Math.max(STORY_MS,video.duration*1000):STORY_MS;
  storyElapsed+=dt;
  if(video&&video.ended&&storyElapsed<total){video.currentTime=0;video.play().catch(()=>{});}
  const ratio=Math.min(1,storyElapsed/total);
  if(fill)fill.style.width=(ratio*100).toFixed(1)+'%';
  if(ratio>=1){openStoryAt(storyIndex+1);return;}
 }
 storyRaf=requestAnimationFrame(tickStory);
}
function openStory(item){
 const list=activeStories();const idx=list.findIndex(s=>s.id===item.id);
 if(idx<0){refresh();return;}
 openStoryAt(idx);
}
function openStoryAt(index){
 const viewer=$('#story-viewer'),list=activeStories();
 cancelAnimationFrame(storyRaf);clearTimeout(storyExpiry);
 if(!list.length||index>=list.length){if(viewer?.open)viewer.close();return;}
 storyIndex=Math.max(0,index);storyElapsed=0;storyPaused=false;storyLastTick=performance.now();
 const item=list[storyIndex];markStorySeen(item.id);
 all('#story-list .story-card:not(.story-create)').forEach((card,i)=>{if(list[i]?.id===item.id)card.classList.add('is-seen');});
 const progress=$('#story-progress');
 if(progress){progress.replaceChildren(...list.map((_,i)=>{const bar=make('div',undefined,'story-bar');const fill=make('span',undefined,'story-bar-fill');fill.style.width=i<storyIndex?'100%':'0%';bar.append(fill);return bar;}));}
 if($('#story-viewer-avatar'))$('#story-viewer-avatar').textContent=item.author.slice(0,1).toLocaleUpperCase('pt-BR');
 $('#story-viewer-author').textContent=item.author;
 const copy=$('#story-viewer-text');copy.textContent=item.text||'';copy.hidden=!item.text;
 const stage=$('#story-stage');if(stage)stage.dataset.kind=item.media?.kind||'text';
 const media=$('#story-viewer-media');media.replaceChildren();
 const muteBtn=$('#story-mute');if(muteBtn)muteBtn.hidden=item.media?.kind!=='video';
 if(item.media){
  const element=make(item.media.kind==='video'?'video':'img');element.src=item.media.url;
  if(item.media.kind==='video'){
   element.preload='auto';element.playsInline=true;element.setAttribute('playsinline','');element.muted=storyMuted;
   element.setAttribute('aria-label',item.text||'Vídeo de '+item.author);
   syncMuteBtn();
   element.play().catch(()=>{storyMuted=true;element.muted=true;syncMuteBtn();element.play().catch(()=>{});});
  }else element.alt=item.text||'Foto de '+item.author;
  element.addEventListener('error',()=>{media.replaceChildren(make('p','Não foi possível carregar este arquivo. Feche e tente abrir o story novamente.'));});
  media.append(element);
 }
 $('#story-viewer-time').textContent=storyTime(item.createdAt);
 const remove=$('#story-delete');remove.hidden=!item.own;remove.onclick=async()=>{if(!confirm('Excluir este story?'))return;remove.disabled=true;try{await change({action:'story_delete',storyId:item.id});viewer.close();}catch(error){showError(error.message);}finally{remove.disabled=false;}};
 storyExpiry=setTimeout(()=>{viewer.close();refresh();},Math.max(1000,item.expiresAt-Date.now()));
 if(!viewer.open)viewer.showModal();
 storyRaf=requestAnimationFrame(tickStory);
}
$('#story-prev')?.addEventListener('click',()=>{if(suppressTap){suppressTap=false;return;}if(storyIndex>0)openStoryAt(storyIndex-1);else openStoryAt(0);});
$('#story-next')?.addEventListener('click',()=>{if(suppressTap){suppressTap=false;return;}openStoryAt(storyIndex+1);});
$('#story-mute')?.addEventListener('click',()=>{storyMuted=!storyMuted;const v=$('#story-viewer-media video');if(v){v.muted=storyMuted;if(!storyMuted&&v.paused)v.play().catch(()=>{});}syncMuteBtn();});
$('#story-stage')?.addEventListener('pointerdown',event=>{
 holdAt=performance.now();suppressTap=false;swipeStartX=event.clientX;swipeStartY=event.clientY;
 storyPaused=true;$('#story-viewer-media video')?.pause();
});
const releaseStoryHold=event=>{
 if(!holdAt)return;
 const held=performance.now()-holdAt;holdAt=0;
 storyPaused=false;storyLastTick=performance.now();
 const v=$('#story-viewer-media video');if(v&&$('#story-viewer')?.open)v.play().catch(()=>{});
 if(event?.type==='pointerup'){
  const dy=event.clientY-swipeStartY,dx=event.clientX-swipeStartX;
  if(dy>75&&Math.abs(dy)>Math.abs(dx)*1.4){suppressTap=true;$('#story-viewer')?.close();return;}
 }
 if(held>=200)suppressTap=true;
};
$('#story-stage')?.addEventListener('pointerup',releaseStoryHold);
$('#story-stage')?.addEventListener('pointercancel',releaseStoryHold);
$('#story-viewer')?.addEventListener('keydown',event=>{
 if(event.key==='ArrowLeft'){event.preventDefault();openStoryAt(Math.max(0,storyIndex-1));}
 else if(event.key==='ArrowRight'){event.preventDefault();openStoryAt(storyIndex+1);}
});
let cameraStream=null,storyMedia=null,storyRecorder=null,photoAttachment=null;
function stopCamera(){if(storyRecorder){storyRecorder.onstop=null;if(storyRecorder.state==='recording')storyRecorder.stop();storyRecorder=null;$('#story-record')&&($('#story-record').textContent='Gravar');}cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;all('video[data-live]').forEach(video=>{video.srcObject=null;});}
async function startCamera(video,withAudio){stopCamera();if(!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador não abre a câmera. Use a galeria.');const picture={facingMode:cameraFacing};try{cameraStream=await navigator.mediaDevices.getUserMedia(withAudio?{video:picture,audio:true}:{video:picture});}catch(error){if(!withAudio||error.name==='NotAllowedError'||error.name==='NotFoundError')throw Error('Não foi possível abrir a câmera. Permita o acesso ou use a galeria.');cameraStream=await navigator.mediaDevices.getUserMedia({video:picture});}video.srcObject=cameraStream;video.muted=true;try{await video.play();}catch(error){if(video.srcObject!==cameraStream)return;throw error;}}
function snapPhoto(video){const canvas=document.createElement('canvas');const width=video.videoWidth||720,height=video.videoHeight||1280,scale=Math.min(1,1280/Math.max(width,height));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],'foto.jpg',{type:'image/jpeg'})):reject(Error('Não foi possível guardar a foto.')),'image/jpeg',0.82));}
function recorderMime(){const types=['video/webm;codecs=vp8,opus','video/webm','video/mp4'];return types.find(type=>window.MediaRecorder&&MediaRecorder.isTypeSupported(type))||'';}
function setStoryModePill(mode){all('[data-story-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.storyMode===mode)));}
function showStoryStep(step){$('#story-camera').hidden=step!=='camera';$('#story-draft').hidden=step==='camera';$('#story-form').hidden=false;}
function clearStoryMedia(){storyMedia=null;if($('#story-media'))$('#story-media').value='';$('#story-draft-media')?.replaceChildren();paintSlot('story-media-slot',null);$('#story-status').textContent='';}
function openStorySheet(){stopCamera();clearStoryMedia();$('#story-text').value='';setStoryModePill('write');showStoryStep('draft');$('#story-text').focus();}
async function stageStory(file){storyMedia=await readSlot(file);stopCamera();const box=$('#story-draft-media');box.replaceChildren();if(file){const preview=document.createElement(file.type.startsWith('video/')?'video':'img');preview.src=URL.createObjectURL(file);if(preview.tagName==='VIDEO'){preview.controls=true;preview.playsInline=true;preview.muted=true;preview.play().catch(()=>{});}else preview.alt='Prévia do story';box.append(preview);}paintSlot('story-media-slot',storyMedia,'Remover arquivo',clearStoryMedia);showStoryStep('draft');$('#story-text').focus();}
$('#story-modes')?.addEventListener('click',async event=>{const mode=event.target.closest('[data-story-mode]')?.dataset.storyMode;if(!mode)return;$('#story-status').textContent='';setStoryModePill(mode);if(mode==='write'){stopCamera();showStoryStep('draft');$('#story-text').focus();return;}if(mode==='gallery'){$('#story-media').click();return;}cameraMode=mode;showStoryStep('camera');$('#story-shutter').hidden=mode!=='photo';$('#story-record').hidden=mode!=='film';$('#story-record').textContent='Gravar';try{await startCamera($('#story-preview'),mode==='film');}catch(error){$('#story-status').textContent=error.message;setStoryModePill('write');showStoryStep('draft');}});
$('#story-flip')?.addEventListener('click',async()=>{cameraFacing=cameraFacing==='environment'?'user':'environment';try{await startCamera($('#story-preview'),cameraMode==='film');}catch(error){$('#story-status').textContent=error.message;}});
$('#story-shutter')?.addEventListener('click',async()=>{try{await stageStory(await snapPhoto($('#story-preview')));}catch(error){$('#story-status').textContent=error.message;}});
$('#story-record')?.addEventListener('click',()=>{if(storyRecorder&&storyRecorder.state==='recording'){storyRecorder.stop();return;}const mime=recorderMime();if(!mime||!cameraStream){$('#story-status').textContent='Este navegador não filma pela câmera. Use a galeria.';return;}const parts=[];storyRecorder=new MediaRecorder(cameraStream,{mimeType:mime});storyRecorder.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};storyRecorder.onstop=async()=>{const type=mime.startsWith('video/mp4')?'video/mp4':'video/webm';storyRecorder=null;$('#story-record').textContent='Gravar';try{await stageStory(new File([new Blob(parts,{type})],type==='video/mp4'?'filme.mp4':'filme.webm',{type}));}catch(error){$('#story-status').textContent=error.message;showStoryStep('draft');}};storyRecorder.start(250);$('#story-record').textContent='Parar';const watch=setInterval(()=>{if(parts.reduce((total,part)=>total+part.size,0)>1700000&&storyRecorder?.state==='recording')storyRecorder.stop();},300);storyRecorder.addEventListener('stop',()=>clearInterval(watch),{once:true});});
$('#story-media')?.addEventListener('change',async()=>{const file=$('#story-media').files[0];if(!file)return;try{if(!/^(image\/(png|jpeg|gif|webp)|video\/(mp4|webm))$/.test(file.type)&&!/\.(png|jpe?g|gif|webp|mp4|webm)$/i.test(file.name))throw Error('Escolha uma foto ou um vídeo.');await stageStory(file);}catch(error){$('#story-status').textContent=error.message;}});
$('#story-camera-back')?.addEventListener('click',()=>{stopCamera();setStoryModePill('write');showStoryStep('draft');});
$('#story-cancel')?.addEventListener('click',()=>{stopCamera();clearStoryMedia();$('#story-form').hidden=true;});
$('#story-close')?.addEventListener('click',()=>{const v=$('#story-viewer-media video');v?.pause();$('#story-viewer-media')?.replaceChildren();$('#story-viewer').close();});
$('#story-viewer')?.addEventListener('cancel',()=>{$('#story-viewer-media video')?.pause();$('#story-viewer-media')?.replaceChildren();});
$('#story-viewer')?.addEventListener('close',()=>{cancelAnimationFrame(storyRaf);clearTimeout(storyExpiry);storyPaused=false;holdAt=0;suppressTap=false;$('#story-viewer-media video')?.pause();$('#story-viewer-media').replaceChildren();$('.story-create')?.focus();});
$('#story-form')?.addEventListener('submit',async event=>{event.preventDefault();const submit=$('[type=submit]',event.target);submit.disabled=true;try{await change({action:'story_create',text:$('#story-text').value,media:storyMedia});stopCamera();clearStoryMedia();$('#story-text').value='';$('#story-form').hidden=true;$('.story-create')?.focus();}catch(error){$('#story-status').textContent=error.message;}finally{submit.disabled=false;}});
const commWs=$('#communities-workspace');
if(commWs){
 $('#communities-search',commWs)?.addEventListener('input',e=>{communitySearch=e.target.value;renderCommunities();});
 all('[data-community-cat]',commWs).forEach(b=>b.addEventListener('click',()=>{communityCategory=b.dataset.communityCat||'all';renderCommunities();}));
 $('#community-dialog-cancel')?.addEventListener('click',()=>$('#community-dialog')?.close());
 $('#community-dialog-form')?.addEventListener('submit',async e=>{
  e.preventDefault();if(!communityDialogAction)return;
  const submit=$('#community-dialog-submit'),err=$('#community-dialog-error');
  submit.disabled=true;err.hidden=true;
  try{await communityDialogAction(e.target);$('#community-dialog')?.close();}
  catch(error){err.textContent=error.message;err.hidden=false;}
  finally{submit.disabled=false;}
 });
 $('#community-create-open',commWs)?.addEventListener('click',()=>{
  openCommunityDialog('Criar nova comunidade','Criar comunidade',body=>{
   const lName=make('label','Nome da comunidade');const iName=make('input');iName.name='name';iName.id='community-create-name';iName.required=true;iName.minLength=3;iName.maxLength=80;iName.placeholder='Ex.: Rede de Educadores e Saberes';lName.append(iName);
   const lCat=make('label','Categoria');const sCat=make('select');sCat.name='category';sCat.id='community-create-category';
   for(const c of (DEFAULT_COMMUNITY_CATEGORIES)){const o=make('option',c);o.value=c;sCat.append(o);}
   lCat.append(sCat);
   const lPriv=make('label','Visibilidade e governança de acesso');const sPriv=make('select');sPriv.name='visibility';sPriv.id='community-create-privacy';
   sPriv.append(new Option('Pública — leitura e participação abertas a contas autenticadas','public'),new Option('Privada — entrada mediante aprovação e feed restrito aos membros','private'));
   lPriv.append(sPriv);
   const lDesc=make('label','Descrição e propósito');const tDesc=make('textarea');tDesc.name='description';tDesc.id='community-create-description';tDesc.required=true;tDesc.minLength=10;tDesc.maxLength=600;tDesc.rows=3;tDesc.placeholder='Explique o objetivo coletivo desta comunidade…';lDesc.append(tDesc);
   const lRules=make('label','Regras de convivência e proteção cultural');const tRules=make('textarea');tRules.name='rules';tRules.id='community-create-rules';tRules.maxLength=1000;tRules.rows=2;tRules.placeholder='Ex.: Respeito mútuo, não expor conhecimentos restritos sem autorização.';lRules.append(tRules);
   body.append(lName,lCat,lPriv,entryQuestionFields(sPriv),lDesc,lRules);
  },async form=>{
   const prevIds=new Set((communitiesList()).map(c=>c.id));
   await change({
    action:'community_create',
    name:form.elements.name.value,
    category:form.elements.category.value,
    visibility:form.elements.visibility.value,
    description:form.elements.description.value,
    rules:form.elements.rules.value,
    entryQuestions:entryQuestionsOf(form)
   });
   const created=(communitiesList()).find(c=>!prevIds.has(c.id));
   if(created)openCommunityDetail(created.id);
  });
 });
}
$('#profile-edit-form')?.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target;const submit=$('[type=submit]',form);const status=$('#profile-edit-status');
 submit.disabled=true;if(status)status.textContent='Salvando perfil…';
 try{
  await change({action:'profile_update',name:$('#profile-edit-name').value,affiliation:$('#profile-edit-affiliation').value,bio:$('#profile-edit-bio').value});
  if(status)status.textContent='Perfil atualizado com sucesso.';
 }catch(err){if(status)status.textContent=err.message;else showError(err.message);}
 finally{submit.disabled=false;}
});
const publisher=$('#opy-compose');
function typedDataUrl(file, data){const ext=(file.name.split('.').pop()||'').toLowerCase();const mime={pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};let next=data.replace(/^data:(video\/webm);codecs=[^;]+;/,'data:$1;');if(/^data:(?:application\/octet-stream)?;base64,/.test(next)&&mime[ext])next=next.replace(/^data:[^,]*,/,'data:'+mime[ext]+';base64,');return next;}
function paintSlot(id, item, clearLabel, clear){
 const el=$('#'+id);if(!el)return;
 if(!item){el.replaceChildren();el.hidden=true;return;}
 el.hidden=false;el.replaceChildren();
 if(/^data:image\//.test(item.data||'')){
  const img=make('img',undefined,'compose-slot-preview');img.src=item.data;img.alt='Prévia da imagem '+item.name;el.append(img);
 }else if(/^data:video\//.test(item.data||'')){
  const vid=make('video',undefined,'compose-slot-preview');vid.src=item.data;vid.controls=true;vid.playsInline=true;vid.preload='metadata';el.append(vid);
 }
 el.append(make('p',item.name+' · '+Math.max(1,Math.ceil(item.bytes/1024))+' KB'));
 button(clearLabel,()=>{clear();paintSlot(id,null);},el);
}
async function readSlot(file){if(!file)return null;if(file.size>2*1024*1024)throw Error('Escolha um arquivo de até 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});return {name:file.name,data:typedDataUrl(file,data),bytes:file.size};}
function selectFormat(tool){
 const panel={photo:'compose-photo',video:'compose-video',file:'compose-file',location:'compose-location',live:'compose-live'}[tool];
 ['compose-photo','compose-video','compose-file','compose-location','compose-live'].forEach(id=>{const el=$('#'+id);if(el)el.hidden=id!==panel;});
 if(tool!=='live'&&$('#live-stage')&&!$('#live-stage').hidden){stopCamera();$('#live-stage').hidden=true;if($('#live-stop-camera'))$('#live-stop-camera').hidden=true;}
 all('[data-compose-tool]').forEach(item=>{const on=item.dataset.composeTool===tool;item.setAttribute('aria-selected',String(on));item.tabIndex=on?0:-1;});
}
function selectedFormat(){return all('[data-compose-tool]').find(item=>item.getAttribute('aria-selected')==='true')?.dataset.composeTool||'text';}
if(publisher){
 $('#compose-story-open')?.addEventListener('click',()=>{openStorySheet();$('#story-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
 if($('#publisher-photo'))$('#publisher-photo').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-photo').files[0]);if(!next)return;if(!/^data:image\/(png|jpeg|gif|webp);/.test(next.data))throw Error('A imagem precisa ser PNG, JPG, GIF ou WebP.');photoAttachment=next;paintSlot('photo-slot',next,'Remover foto',()=>{photoAttachment=null;$('#publisher-photo').value='';if($('#photo-status')){$('#photo-status').textContent='';$('#photo-status').hidden=true;}});if($('#photo-status')){$('#photo-status').hidden=false;$('#photo-status').textContent='Foto pronta para publicação.';}}catch(e){showError(e.message);$('#publisher-photo').value='';}finally{busy=false;}};
 $('#publisher-video').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-video').files[0]);if(!next)return;if(!/^data:video\/(mp4|webm);/.test(next.data))throw Error('O vídeo precisa ser MP4 ou WebM.');const replaced=!!videoAttachment;videoAttachment=next;paintSlot('video-slot',next,'Remover vídeo',()=>{videoAttachment=null;$('#publisher-video').value='';$('#video-status').textContent='';$('#video-status').hidden=true;});const videoStatus=$('#video-status');videoStatus.hidden=false;videoStatus.textContent=replaced?'O vídeo anterior foi trocado. A publicação leva um único vídeo.':'Vídeo pronto. A publicação leva um único vídeo.';}catch(e){showError(e.message);$('#publisher-video').value='';}finally{busy=false;}};
 $('#publisher-document').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-document').files[0]);if(!next)return;if(!/\.(pdf|txt|docx|doc)$/i.test(next.name))throw Error('O arquivo precisa ser PDF, TXT, DOC ou DOCX.');const replaced=!!fileAttachment;fileAttachment=next;paintSlot('file-slot',next,'Remover arquivo',()=>{fileAttachment=null;$('#publisher-document').value='';$('#file-status').textContent='';$('#file-status').hidden=true;});const fileStatus=$('#file-status');fileStatus.hidden=false;fileStatus.textContent=replaced?'O arquivo anterior foi trocado. A publicação leva um único arquivo.':'Arquivo pronto. A publicação leva um único arquivo.';}catch(e){showError(e.message);$('#file-status').textContent=e.message;$('#publisher-document').value='';}finally{busy=false;}};
 selectFormat('text');all('[data-compose-tool]').forEach(b=>b.onclick=()=>selectFormat(b.getAttribute('aria-selected')==='true'&&b.dataset.composeTool!=='text'?'text':b.dataset.composeTool));
 // Compositor fechado mostra só a linha de entrada; abre ao focar ou escolher um formato e fecha vazio ao sair.
 const composeText=$('#preview-text');
 const growCompose=()=>{if(!publisher.classList.contains('is-open'))return;composeText.style.height='auto';composeText.style.height=Math.min(240,Math.max(96,composeText.scrollHeight))+'px';};
 const openComposer=()=>{publisher.classList.add('is-open');growCompose();};
 // Só o campo de texto abre no foco; botões abrem no clique, para a fileira não se mover sob o dedo.
 publisher.addEventListener('focusin',e=>{if(e.target===composeText)openComposer();});
 all('[data-compose-tool]').forEach(b=>b.addEventListener('click',openComposer));
 composeText?.addEventListener('input',growCompose);
 publisher.addEventListener('focusout',()=>setTimeout(()=>{if(!publisher.contains(document.activeElement)&&!composeText.value.trim()&&selectedFormat()==='text'&&!photoAttachment&&!videoAttachment&&!fileAttachment){publisher.classList.remove('is-open');composeText.style.height='';}},200));$('.compose-tools',publisher)?.addEventListener('keydown',event=>{const tabs=all('[data-compose-tool]',publisher);const index=tabs.indexOf(document.activeElement);if(index<0||(event.key!=='ArrowRight'&&event.key!=='ArrowLeft'))return;event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selectFormat(next.dataset.composeTool);next.focus();});
 $('#choose-photo')?.addEventListener('click',()=>$('#publisher-photo')?.click());
 $('#choose-photo-camera')?.addEventListener('click',()=>$('#compose-camera-open')?.click());
 $('#choose-video').onclick=()=>$('#publisher-video').click();
 $('#compose-camera-open').onclick=async()=>{$('#compose-camera-status').textContent='';$('#compose-camera').hidden=false;try{await startCamera($('#compose-preview'),false);}catch(error){$('#compose-camera-status').textContent=error.message;stopCamera();}};
 $('#compose-camera-close').onclick=()=>{stopCamera();$('#compose-camera').hidden=true;};
 $('#compose-shutter').onclick=async()=>{try{const file=await snapPhoto($('#compose-preview'));photoAttachment=await readSlot(file);stopCamera();$('#compose-camera').hidden=true;selectFormat('text');paintSlot('photo-slot',photoAttachment,'Remover foto',()=>{photoAttachment=null;});}catch(error){$('#compose-camera-status').textContent=error.message;}};
 $('#choose-file').onclick=()=>$('#publisher-document').click();
 $('#live-test-camera')?.addEventListener('click',async()=>{
  const status=$('#live-status');status.textContent='Verificando permissões locais de câmera e microfone…';
  try{
   $('#live-stage').hidden=false;
   await startCamera($('#live-preview'),true);
   const vTrack=cameraStream?.getVideoTracks?.()[0];
   const aTrack=cameraStream?.getAudioTracks?.()[0];
   $('#live-stop-camera').hidden=false;
   status.textContent=`Diagnóstico local concluído: vídeo (${vTrack?.label||'câmera ativa'}) e ${aTrack?'áudio ativo':'sem microfone'}. Nenhuma transmissão foi iniciada porque o servidor RTMP/WHIP não está conectado neste ambiente.`;
  }catch(err){
   $('#live-stage').hidden=true;
   status.textContent=err.message+' (Servidor de Live RTMP/WHIP não conectado neste ambiente).';
  }
 });
 $('#live-stop-camera')?.addEventListener('click',()=>{stopCamera();$('#live-stage').hidden=true;$('#live-stop-camera').hidden=true;$('#live-status').textContent='Teste local de câmera encerrado.';});
 $('#live-switch-video')?.addEventListener('click',()=>{stopCamera();$('#live-stage').hidden=true;selectFormat('video');$('#publisher-video')?.click();});
 $('#live-switch-story')?.addEventListener('click',()=>{stopCamera();$('#live-stage').hidden=true;selectFormat('text');openStorySheet();$('[data-story-mode="film"]')?.click();});
 publisher.onsubmit=async e=>{
  e.preventDefault();const status=$('#preview-form-status');
  if(busy){status.textContent='Aguarde o vídeo ou o arquivo terminar de entrar.';return;}
  const format=selectedFormat();
  if(format==='live'){status.textContent='O modo Ao vivo requer servidor de ingestão RTMP/WHIP. Use "Vídeo" ou "Story 24h" para publicar um vídeo gravado.';return;}
  const submit=$('[type=submit]',publisher);submit.disabled=true;
  const progress=$('#compose-upload-progress');
  try{
   const place=$('#compose-place').value.trim();
   const hasPhoto=(format==='text'||format==='photo')&&!!photoAttachment;
   if(!$('#preview-text').value.trim()&&!hasPhoto)throw Error('Escreva o que fica visível para quem vê a publicação.');
   if(format==='photo'&&!photoAttachment)throw Error('Escolha ou capture uma foto para esta publicação.');
   if(format==='video'&&!videoAttachment)throw Error('Escolha o vídeo desta publicação.');
   if(format==='file'&&!fileAttachment)throw Error('Escolha o arquivo desta publicação.');
   if(format==='location'&&place.length<2)throw Error('Escreva a localização com pelo menos 2 caracteres.');
   if(progress){progress.hidden=false;progress.classList.add('is-busy');}
   const communityId=$('#preview-community-target')?.value||'';
   await change({
    action:'publish',
    text:$('#preview-text').value,
    audience:$('#preview-audience').value,
    communityId,
    media:format==='video'?{name:videoAttachment.name,data:videoAttachment.data}:hasPhoto?{name:photoAttachment.name,data:photoAttachment.data}:null,
    file:format==='file'?{name:fileAttachment.name,data:fileAttachment.data}:null,
    location:format==='location'?place:''
   });
   publisher.reset();videoAttachment=null;fileAttachment=null;photoAttachment=null;
   paintSlot('video-slot',null);paintSlot('file-slot',null);paintSlot('photo-slot',null);
   if($('#photo-status')){$('#photo-status').textContent='';$('#photo-status').hidden=true;}
   $('#video-status').textContent='';$('#video-status').hidden=true;$('#file-status').textContent='';$('#file-status').hidden=true;
   selectFormat('text');publisher.classList.remove('is-open');$('#preview-text').style.height='';
   status.textContent='Publicação compartilhada. O texto fica visível para quem vê.';
  }catch(err){status.textContent=err.message;}
  finally{if(progress){progress.classList.remove('is-busy');progress.hidden=true;}submit.disabled=false;}
 };
}
$('#chat-dock-close')?.addEventListener('click',()=>{const dock=$('#chat-dock');if(dock)dock.hidden=true;dockChatKey='';});
$('#chat-dock-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!dockChatKey)return;const input=$('#chat-dock-input');const status=$('#chat-dock-status');const b=$('[type=submit]',e.target);b.disabled=true;try{await change({action:'dm',toKey:dockChatKey,text:input.value});input.value='';if(status)status.textContent='';}catch(err){if(status)status.textContent=err.message;}finally{b.disabled=false;input?.focus();}});
$('#profile-avatar-input')?.addEventListener('change',e=>uploadProfileMedia('avatar',e.target));
$('#profile-cover-input')?.addEventListener('change',e=>uploadProfileMedia('cover',e.target));
all('[data-remove-media]').forEach(b=>b.addEventListener('click',()=>change({action:'profile_media',kind:b.dataset.removeMedia,media:null}).catch(e=>showError(e.message))));
$('[data-close-edit]')?.addEventListener('click',()=>$('#profile-edit-dialog').close());
$('#iara-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.target;const field=$('#iara-text');const submit=$('[type=submit]',form);const status=$('#iara-status');const description=field.value;submit.disabled=true;status.textContent='Registrando pedido…';try{await change({action:'iara_request',text:description});field.value='';status.textContent='Pedido registrado. Baixe o briefing para encaminhar à equipe.';$('#iara-tickets')?.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
const etniaForm=$('#etnia-form');
if(etniaForm){
 const field=$('#etnia-text');
 const log=$('#etnia-log');
 const grow=()=>{field.style.height='44px';field.style.height=Math.min(120,field.scrollHeight)+'px';};
 const follow=()=>{if(log&&log.dataset.stick!=='0')log.scrollTop=log.scrollHeight;};
 const fit=()=>{const vv=window.visualViewport;if(!vv)return;document.body.style.height=Math.round(vv.height)+'px';window.scrollTo(0,0);};
 field.addEventListener('input',grow);
 log?.addEventListener('scroll',()=>{const gap=log.scrollHeight-log.scrollTop-log.clientHeight;log.dataset.stick=gap<64?'1':'0';});
 if(window.visualViewport){window.visualViewport.addEventListener('resize',fit);window.visualViewport.addEventListener('scroll',fit);fit();}
 grow();
 etniaForm.addEventListener('submit',async e=>{e.preventDefault();const submit=$('[type=submit]',etniaForm);const status=$('#etnia-status');const text=field.value.trim();if(!text){status.textContent='Escreva a pergunta antes de enviar.';return;}submit.disabled=true;status.textContent='';field.value='';grow();if(log){log.dataset.stick='1';const mine=etniaBubble('user',text,'');const wait=etniaBubble('etnia','Consultando o material desta prévia…','');mine.dataset.pending='1';wait.dataset.pending='1';log.append(mine,wait);follow();}try{await change({action:'etnia',text});}catch(err){status.textContent=err.message;field.value=text;grow();log?.querySelectorAll('[data-pending]').forEach(node=>node.remove());}finally{submit.disabled=false;field.focus({preventScroll:true});}});
 field.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();etniaForm.requestSubmit();}});
 all('[data-etnia-suggest]').forEach(b=>b.addEventListener('click',()=>{field.value=b.textContent;etniaForm.requestSubmit();}));
}
$('#preview-logout')?.addEventListener('click',async()=>{const button=$('#preview-logout');button.disabled=true;try{await api({action:'logout'});location.replace('/entrar/');}catch(e){showError(e.message);button.disabled=false;}});
if(document.body.dataset.previewRoute==='entrar')bindWelcome();
refresh().then(()=>{if(location.hash.startsWith('#post-'))document.getElementById(location.hash.slice(1))?.scrollIntoView();});
if(!['entrar','messages'].includes(document.body.dataset.previewRoute))setInterval(()=>{if(!document.hidden&&!busy)refresh();},document.body.dataset.previewRoute==='messages'?4000:20000);
document.addEventListener('pointerdown',event=>{all('.post-react.is-open').forEach(wrap=>{if(!wrap.contains(event.target))wrap.classList.remove('is-open');});});
function offerInstall(){
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  if(standalone)return;
  let deferred=null;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const bar=make('div',undefined,'install-bar');
  bar.setAttribute('role','region');
  bar.setAttribute('aria-label','Instalar o Etnias');
  const mark=document.createElement('img');
  mark.className='install-mark';
  mark.src='/assets/opy/apple-touch-icon.png?v=20261105.2';
  mark.alt='';
  mark.width=44;
  mark.height=44;
  const install=make('button','Toque para instalar','opy-primary');
  install.type='button';
  const steps=document.createElement('p');
  steps.className='install-note';
  steps.hidden=true;
  steps.textContent='No iPhone, o site não abre a instalação. Na barra do Safari: Compartilhar, Adicionar à Tela de Início, Adicionar.';
  const hide=()=>{bar.remove();document.body.classList.remove('has-install');};
  const mount=()=>{
    bar.replaceChildren(mark,install,steps);
    document.body.classList.add('has-install');
    if(!bar.isConnected){
      const panel=document.querySelector('.welcome-panel');
      const notice=document.querySelector('.preview-notice');
      if(panel)panel.prepend(bar);
      else if(notice)notice.insertAdjacentElement('afterend',bar);
      else document.body.prepend(bar);
    }
  };
  install.addEventListener('click',async()=>{
    if(deferred){
      install.disabled=true;
      try{deferred.prompt();const choice=await deferred.userChoice;deferred=null;if(choice.outcome==='accepted')hide();}
      finally{install.disabled=false;}
      return;
    }
    steps.hidden=false;
    install.setAttribute('aria-expanded','true');
  });
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;steps.hidden=true;mount();});
  window.addEventListener('appinstalled',hide);
  if(ios)mount();
}
offerInstall();
if(!window.__opyPressBound){
  window.__opyPressBound=true;
  let pressed=null,timer=0;
  const release=()=>{const node=pressed;pressed=null;if(!node)return;clearTimeout(timer);timer=setTimeout(()=>node.classList.remove('opy-pressed'),220);};
  document.addEventListener('pointerdown',event=>{
    if(event.target.closest('input, textarea, select'))return;
    const control=event.target.closest('a, button, label, summary, [role="button"]');
    if(!control||control.disabled)return;
    clearTimeout(timer);
    if(pressed&&pressed!==control)pressed.classList.remove('opy-pressed');
    pressed=control;
    control.classList.add('opy-pressed');
  },{passive:true});
  document.addEventListener('pointerup',release,{passive:true});
  document.addEventListener('pointercancel',release,{passive:true});
}
})();
