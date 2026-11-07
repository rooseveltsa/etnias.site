(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const all = (s, root=document) => [...root.querySelectorAll(s)];
const make = (tag, text, cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const button=(label, fn, root)=>{const b=make('button',label,'preview-secondary');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){showError(e.message);}finally{b.disabled=false;}});root.append(b);return b;};
const emoji=[['😀','Sorriso'],['❤️','Coração'],['😂','Risada'],['👏','Palmas'],['🙏','Gratidão'],['🌱','Planta'],['💚','Coração verde'],['✨','Brilho']];
const reactions=[['like','👍','Curti'],['heart','❤️','Amei'],['laugh','😂','Haha'],['wow','😮','Surpresa'],['sad','😢','Triste']];
let state, filter='all', view='news', videoAttachment=null, fileAttachment=null, busy=false;
const expandedComments=new Set();
let activeProfileKey='', profileTab='all', activeChatKey='public', dockChatKey='';
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
function postAction(name, label, fn){const b=document.createElement('button');b.type='button';b.className='post-action';b.innerHTML=svg(name);if(label){const span=document.createElement('span');span.textContent=label;b.append(span);}b.addEventListener('click',async event=>{b.disabled=true;try{await fn(event);}catch(e){showError(e.message);}finally{b.disabled=false;}});return b;}
function avatarNode(name, url, size=42){
 const fallback=()=>make('span',(name||'?').slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar');
 if(url&&/^\/assets\/archive\/avatar-[a-f0-9]{20}\.(jpg|jpeg|png|webp|gif)$/.test(url)){
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
function renderPost(post){
 const card=make('article',undefined,'preview-post community-post');card.dataset.origin=post.origin;card.id='post-'+post.id;
 const head=make('div',undefined,'preview-author');
 const pKey=post.authorKey||`name:${post.author}`;
 const avBtn=make('button',undefined,'author-trigger');avBtn.type='button';avBtn.setAttribute('aria-label','Abrir perfil de '+post.author);avBtn.append(avatarNode(post.author,post.avatar,42));avBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 const who=make('div');
 const nameBtn=make('button',post.author,'author-name-btn');nameBtn.type='button';nameBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 who.append(nameBtn,make('small',(post.origin==='legacy'?'Acervo público · ':'')+date(post.createdAt)+(post.audience==='private'?' · Somente eu':'')));
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
 const form=make('form',undefined,'preview-comment-form');form.hidden=true;form.id='comment-'+post.id;
 const input=make('input');input.required=true;input.maxLength=500;input.placeholder='Escreva um comentário (até 500 caracteres)';input.setAttribute('aria-label','Seu comentário');
 const charCount=make('small','0/500','comment-char-count');
 input.addEventListener('input',()=>{charCount.textContent=input.value.length+'/500';});
 const submit=make('button','Enviar','preview-secondary');submit.type='submit';submit.setAttribute('aria-label','Enviar comentário');
 form.append(input,charCount,submit);
 form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const draft=input.value;await change({action:'comment',postId:post.id,text:draft});const sent=document.getElementById('post-'+post.id)?.querySelector('.preview-comment-form input');if(sent){sent.value='';const cc=document.getElementById('post-'+post.id)?.querySelector('.comment-char-count');if(cc)cc.textContent='0/500';}}catch(err){showError(err.message);submit.disabled=false;}});
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
 const commentBtn=postAction('comment','Comentar',()=>{form.hidden=!form.hidden;commentBtn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)input.focus();});
 commentBtn.setAttribute('aria-expanded','false');commentBtn.setAttribute('aria-controls',form.id);
 const heart=postAction('heart','Amei',()=>change({action:'react',postId:post.id,reaction:post.reaction==='heart'?'':'heart'}));
 heart.setAttribute('aria-pressed',String(post.reaction==='heart'));
 const shareBtn=postAction('share','Repostar',()=>{repostForm.hidden=!repostForm.hidden;shareBtn.setAttribute('aria-expanded',String(!repostForm.hidden));if(!repostForm.hidden)repostInput.focus();});
 shareBtn.setAttribute('aria-expanded','false');
 const save=postAction('save','',()=>change({action:'save',postId:post.id}));save.classList.add('post-action-quiet');save.setAttribute('aria-label',post.saved?'Remover dos salvos':'Salvar publicação');save.setAttribute('aria-pressed',String(!!post.saved));
 actions.append(reactWrap,commentBtn,heart,shareBtn,save);card.append(actions,repostForm);
 if(post.own){const remove=make('button','Excluir minha publicação','post-delete');remove.type='button';remove.addEventListener('click',async()=>{if(!confirm('Excluir esta publicação?'))return;try{await change({action:'delete',postId:post.id});}catch(e){showError(e.message);}});card.append(remove);}
 const COMMENT_LIMIT=2;
 const isExpanded=expandedComments.has(post.id);
 const visibleComments=isExpanded||post.comments.length<=COMMENT_LIMIT?post.comments:post.comments.slice(-COMMENT_LIMIT);
 if(post.comments.length>COMMENT_LIMIT){
  const moreBtn=make('button',isExpanded?'Ocultar comentários':`Ver todos os ${post.comments.length} comentários (${post.comments.length-COMMENT_LIMIT} anteriores)`,'comments-toggle');
  moreBtn.type='button';moreBtn.onclick=()=>{if(isExpanded)expandedComments.delete(post.id);else expandedComments.add(post.id);render();};
  card.append(moreBtn);
 }
 for(const comment of visibleComments){
  const block=make('div',undefined,'preview-comment');
  const cKey=comment.authorKey||`name:${comment.author}`;
  const avatar=make('button',comment.author.slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar author-trigger');avatar.type='button';avatar.setAttribute('aria-label','Abrir perfil de '+comment.author);avatar.onclick=()=>openProfile(cKey,comment.author,'');
  const body=make('div',undefined,'preview-comment-body');
  const cAuthor=make('button',comment.author,'author-name-btn');cAuthor.type='button';cAuthor.onclick=()=>openProfile(cKey,comment.author,'');
  body.append(cAuthor,make('small',date(comment.createdAt)),make('p',comment.text));block.append(avatar,body);card.append(block);
 }
 card.append(form);return card;
}
function paintCommunity(){
 const list=$('#community-people');if(!list)return;
 const seen=new Set();const people=[];
 for(const person of (state.directory||[])){
  const key=(person.name||'').trim().toLocaleLowerCase('pt-BR');
  if(!key||seen.has(key)||person.own)continue;
  seen.add(key);people.push(person);if(people.length===8)break;
 }
 list.replaceChildren(...people.map(person=>{
  const li=document.createElement('li');li.className='community-person-row';
  const openBtn=make('button',undefined,'community-person');openBtn.type='button';
  openBtn.onclick=()=>openProfile(person.key,person.name,person.avatar);
  openBtn.append(avatarNode(person.name,person.avatar,36));
  const info=make('span',undefined,'community-person-info');
  info.append(make('strong',person.name));
  if(person.friendStatus==='friends')info.append(make('small','Amigo ✓'));
  else if(person.following)info.append(make('small','Seguindo'));
  openBtn.append(info);
  const dmBtn=make('button','💬','community-dm-btn');dmBtn.type='button';dmBtn.title='Conversar em privado com '+person.name;dmBtn.setAttribute('aria-label','Conversar em privado com '+person.name);
  dmBtn.onclick=()=>openPrivateChat(person.key,person.name,person.avatar);
  li.append(openBtn,dmBtn);return li;
 }));
 const status=$('#community-connection');if(status)status.textContent=people.length?'':'As pessoas das publicações aparecem aqui.';
}
function matchMediaKind(p, kind){
 if(kind==='photos')return p.media?.kind==='image'||!!p.image||p.repostOf?.media?.kind==='image'||!!p.repostOf?.image;
 if(kind==='videos')return p.media?.kind==='video'||p.repostOf?.media?.kind==='video';
 if(kind==='audio')return p.media?.kind==='audio'||p.repostOf?.media?.kind==='audio';
 if(kind==='files')return p.media?.kind==='file'||!!p.file||p.repostOf?.media?.kind==='file'||!!p.repostOf?.file;
 return true;
}
function renderProfile(){
 const sheet=$('#profile-sheet');if(!sheet||!activeProfileKey||!state)return;
 const person=personByKey(activeProfileKey);
 $('#profile-avatar')?.replaceChildren(avatarNode(person.name,person.avatar,72));
 $('#profile-name').textContent=person.name;
 $('#profile-handle').textContent=person.username?'@'+person.username:(person.key.startsWith('name:')?'Membro da comunidade Etnias':'Conta Casa Opy');
 const userPosts=state.posts.filter(p=>p.authorKey===person.key);
 $('#profile-stats')?.replaceChildren(
  make('span',`${userPosts.length} publicação(ões)`),
  make('span',`${person.followersCount||0} seguidor(es)`),
  make('span',`${person.friendsCount||0} amigo(s)`)
 );
 const actions=$('#profile-actions');actions.replaceChildren();
 if(!person.own){
  const friendBtn=button(friendLabel(person.friendStatus),()=>change({action:'friend',authorKey:person.key}),actions);
  friendBtn.className=person.friendStatus==='friends'?'preview-secondary':'opy-primary';
  friendBtn.setAttribute('aria-pressed',String(person.friendStatus==='friends'));
  const followBtn=button(person.following?'Seguindo ✓':'Seguir',()=>change({action:'follow',authorKey:person.key}),actions);
  followBtn.setAttribute('aria-pressed',String(!!person.following));
  const msgBtn=button('Mensagem privada',()=>{sheet.close();openPrivateChat(person.key,person.name,person.avatar);},actions);
  msgBtn.className='preview-secondary';
 }
 all('[data-profile-tab]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.profileTab===profileTab));});
 const filtered=userPosts.filter(p=>profileTab==='all'||matchMediaKind(p,profileTab));
 const box=$('#profile-posts');
 if(box){
  box.replaceChildren(...filtered.map(renderPost));
  if(!filtered.length)box.append(make('p','Nenhuma publicação nesta categoria do perfil.','opy-module-empty'));
 }
}
function openProfile(key, fallbackName='', fallbackAvatar=''){
 if(!key)return;
 activeProfileKey=key;profileTab='all';
 if(state&&!state.directory?.some(p=>p.key===key)){
  state.directory=[...(state.directory||[]),{key,name:fallbackName||key.replace(/^name:/,''),username:'',avatar:fallbackAvatar||'',own:false,following:false,friendStatus:'none',followersCount:0,friendsCount:0,postsCount:0}];
 }
 renderProfile();
 const sheet=$('#profile-sheet');if(sheet&&!sheet.open)sheet.showModal();
}
function openPrivateChat(key, name='', avatar=''){
 if(document.body.dataset.previewRoute==='messages'){
  activeChatKey=key;render();$('#preview-message')?.focus();return;
 }
 dockChatKey=key;
 const dock=$('#chat-dock');if(!dock)return;
 dock.hidden=false;
 renderDockChat();
 $('#chat-dock-input')?.focus();
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
function render(){if(!state)return;
 all('[data-community-name]').forEach(el=>el.textContent=state.me.name);all('[data-community-username]').forEach(el=>el.textContent='@'+state.me.username);all('[data-community-avatar]').forEach(el=>{el.textContent=state.me.name.slice(0,1).toLocaleUpperCase('pt-BR');el.title=state.me.name;});all('[data-community-contact]').forEach(el=>{const digits=state.me.phone||'';const phone=digits.length>=10?digits.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3'):'não informado nesta conta';el.textContent='Chave Google: '+(state.me.googleKey||'não informada nesta conta')+' · Telefone: '+phone;});
 paintCommunity();
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
  const viewNames={news:'Tudo',friends:'Amigos',photos:'Fotos',videos:'Vídeos',files:'Documentos',audio:'Áudios'};
  all('.middlecol > .feed-float [data-feed-view]').forEach(b=>{
   const v=b.dataset.feedView;
   const cnt=basePosts.filter(p=>v==='news'?true:v==='friends'?(p.following||p.friendStatus==='friends'):matchMediaKind(p,v)).length;
   b.textContent=viewNames[v]+(cnt?` (${cnt})`:'');
  });
  const posts=basePosts.filter(p=>(view!=='friends'||p.following||p.friendStatus==='friends')&&(view==='news'||view==='friends'||matchMediaKind(p,view)));
  const drafts=new Map(all('.community-post',feed).map(card=>[card.id,{text:$('.preview-comment-form input',card)?.value||'',open:!$('.preview-comment-form',card)?.hidden}]));
  feed.replaceChildren(...posts.map(renderPost));
  all('.community-post',feed).forEach(card=>{const draft=drafts.get(card.id);if(draft){$('.preview-comment-form input',card).value=draft.text;const form=$('.preview-comment-form',card);form.hidden=!draft.open;const toggle=card.querySelector('[aria-controls="'+form.id+'"]');if(toggle)toggle.setAttribute('aria-expanded',String(!!draft.open));}});
  if(!posts.length)feed.append(make('p',saved?'Você ainda não salvou publicações.':view==='friends'&&!state.posts.some(p=>p.following||p.friendStatus==='friends')?'Você ainda não segue nem adicionou amigos. Toque no nome de alguém para seguir ou adicionar amigo.':'Nenhuma publicação neste filtro.'));
 }
 const chatPeople=$('#chat-people');
 const myKey=`id:${state.me.id}`;
 if(chatPeople){
  const items=[{key:'public',name:'Sala da comunidade',avatar:'',sub:'Todos no ambiente'},...(state.directory||[]).filter(p=>!p.own)];
  chatPeople.replaceChildren(...items.map(item=>{
   const li=document.createElement('li');
   const btn=make('button',undefined,'chat-person-btn'+(activeChatKey===item.key?' is-active':''));btn.type='button';
   btn.setAttribute('aria-pressed',String(activeChatKey===item.key));
   const av=item.key==='public'?make('span','C','preview-avatar'):avatarNode(item.name,item.avatar,38);
   const meta=make('div',undefined,'chat-person-meta');
   const lastDm=item.key==='public'?state.messages.at(-1):[...(state.dms||[])].reverse().find(m=>(m.fromKey===myKey&&m.toKey===item.key)||(m.fromKey===item.key&&m.toKey===myKey));
   meta.append(make('strong',item.name),make('small',lastDm?lastDm.text.slice(0,42):(item.friendStatus==='friends'?'Amigo ✓ · Conversa privada':'Conversa privada')));
   btn.append(av,meta);
   btn.onclick=()=>{activeChatKey=item.key;render();$('#preview-message')?.focus();};
   li.append(btn);return li;
  }));
 }
 const log=$('#preview-messages');if(log){
  const isPublic=activeChatKey==='public';
  const target=isPublic?null:personByKey(activeChatKey);
  if($('#chat-target-name'))$('#chat-target-name').textContent=isPublic?'Sala da comunidade':target.name;
  if($('#chat-target-sub'))$('#chat-target-sub').textContent=isPublic?'Sala aberta de homologação':'Conversa privada · visível somente para vocês dois';
  if($('#chat-target-avatar'))$('#chat-target-avatar').replaceWith((()=>{const n=isPublic?make('span','C','preview-avatar'):avatarNode(target.name,target.avatar,38);n.id='chat-target-avatar';return n;})());
  const profBtn=$('#chat-open-profile');if(profBtn){profBtn.hidden=isPublic;profBtn.onclick=()=>target&&openProfile(target.key,target.name,target.avatar);}
  const msgs=isPublic?state.messages:(state.dms||[]).filter(m=>(m.fromKey===myKey&&m.toKey===activeChatKey)||(m.fromKey===activeChatKey&&m.toKey===myKey));
  log.replaceChildren(...msgs.map(m=>{
   const mine=isPublic?(m.authorKey===myKey||m.author===state.me.name):m.fromKey===myKey;
   const el=make('div',undefined,'preview-message chat-bubble'+(mine?' is-mine':''));
   el.append(make('strong',isPublic?m.author:(mine?'Você':m.fromName)),make('p',m.text),make('small',date(m.createdAt)));
   return el;
  }));
  if(!msgs.length)log.append(make('p',isPublic?'Comece a conversa na sala da comunidade.':`Nenhuma mensagem privada com ${target?.name||'esta pessoa'} ainda. Escreva abaixo!`));
  log.scrollTop=log.scrollHeight;
 }
 renderProfile();
 renderDockChat();
 const join=$('[data-community-join]');if(join){join.textContent=state.group.joined?'Sair do grupo':'Participar do grupo';join.setAttribute('aria-pressed',String(state.group.joined));}if($('[data-community-members]'))$('[data-community-members]').textContent=state.group.count+' participante(s) neste ambiente.';
 const results=$('#preview-search-results');if(results){const query=(new URLSearchParams(location.search).get('query')||'').toLocaleLowerCase('pt-BR');const posts=state.posts.filter(p=>(p.text+' '+p.author).toLocaleLowerCase('pt-BR').includes(query));results.replaceChildren(...posts.map(p=>{const a=make('a');a.href='/#post-'+p.id;a.append(make('strong',p.author),make('p',p.text.slice(0,240)),make('small',date(p.createdAt)));return a;}));if(!posts.length)results.append(make('p','Nenhuma publicação encontrada.'));}
 const notices=$('#community-notifications');if(notices){const posts=state.posts.filter(p=>p.own&&(p.comments.length||Object.values(p.reactions).some(Boolean)));notices.replaceChildren(...posts.map(p=>{const a=make('a',p.comments.length+' comentário(s) e '+Object.values(p.reactions).reduce((a,b)=>a+b,0)+' reação(ões) em '+p.text.slice(0,70),'preview-text-link');a.href='/#post-'+p.id;return a;}));if(!posts.length)notices.append(make('p','As reações e os comentários nas suas publicações aparecerão aqui.'));}
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
all('[data-community-refresh]').forEach(b=>b.onclick=refresh);all('[data-feed-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.feedFilter;all('[data-feed-filter]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();});all('[data-feed-view]').forEach(b=>b.onclick=()=>{view=b.dataset.feedView;all('[data-feed-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();});
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
$('#story-close')?.addEventListener('click',()=>$('#story-viewer').close());
$('#story-viewer')?.addEventListener('close',()=>{cancelAnimationFrame(storyRaf);clearTimeout(storyExpiry);storyPaused=false;holdAt=0;suppressTap=false;$('#story-viewer-media video')?.pause();$('#story-viewer-media').replaceChildren();$('.story-create')?.focus();});
$('#story-form')?.addEventListener('submit',async event=>{event.preventDefault();const submit=$('[type=submit]',event.target);submit.disabled=true;try{await change({action:'story_create',text:$('#story-text').value,media:storyMedia});stopCamera();clearStoryMedia();$('#story-text').value='';$('#story-form').hidden=true;$('.story-create')?.focus();}catch(error){$('#story-status').textContent=error.message;}finally{submit.disabled=false;}});
const publisher=$('#opy-compose');
function typedDataUrl(file, data){const ext=(file.name.split('.').pop()||'').toLowerCase();const mime={pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',mp4:'video/mp4',webm:'video/webm'};let next=data.replace(/^data:(video\/webm);codecs=[^;]+;/,'data:$1;');if(/^data:(?:application\/octet-stream)?;base64,/.test(next)&&mime[ext])next=next.replace(/^data:[^,]*,/,'data:'+mime[ext]+';base64,');return next;}
function paintSlot(id, item, clearLabel, clear){const el=$('#'+id);if(!item){el.replaceChildren();el.hidden=true;return;}el.hidden=false;el.replaceChildren(make('p',item.name+' · '+Math.max(1,Math.ceil(item.bytes/1024))+' KB'));button(clearLabel,()=>{clear();paintSlot(id,null);},el);}
async function readSlot(file){if(!file)return null;if(file.size>2*1024*1024)throw Error('Escolha um arquivo de até 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});return {name:file.name,data:typedDataUrl(file,data),bytes:file.size};}
function selectFormat(tool){const panel={video:'compose-video',file:'compose-file',location:'compose-location'}[tool];['compose-video','compose-file','compose-location'].forEach(id=>{$('#'+id).hidden=id!==panel;});all('[data-compose-tool]').forEach(item=>{const on=item.dataset.composeTool===tool;item.setAttribute('aria-selected',String(on));item.tabIndex=on?0:-1;});}
function selectedFormat(){return all('[data-compose-tool]').find(item=>item.getAttribute('aria-selected')==='true')?.dataset.composeTool||'text';}
if(publisher){
 $('#publisher-video').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-video').files[0]);if(!next)return;if(!/^data:video\/(mp4|webm);/.test(next.data))throw Error('O vídeo precisa ser MP4 ou WebM.');const replaced=!!videoAttachment;videoAttachment=next;paintSlot('video-slot',next,'Remover vídeo',()=>{videoAttachment=null;$('#publisher-video').value='';$('#video-status').textContent='';$('#video-status').hidden=true;});const videoStatus=$('#video-status');videoStatus.hidden=false;videoStatus.textContent=replaced?'O vídeo anterior foi trocado. A publicação leva um único vídeo.':'Vídeo pronto. A publicação leva um único vídeo.';}catch(e){showError(e.message);$('#publisher-video').value='';}finally{busy=false;}};
 $('#publisher-document').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-document').files[0]);if(!next)return;if(!/\.(pdf|txt|docx|doc)$/i.test(next.name))throw Error('O arquivo precisa ser PDF, TXT, DOC ou DOCX.');const replaced=!!fileAttachment;fileAttachment=next;paintSlot('file-slot',next,'Remover arquivo',()=>{fileAttachment=null;$('#publisher-document').value='';$('#file-status').textContent='';$('#file-status').hidden=true;});const fileStatus=$('#file-status');fileStatus.hidden=false;fileStatus.textContent=replaced?'O arquivo anterior foi trocado. A publicação leva um único arquivo.':'Arquivo pronto. A publicação leva um único arquivo.';}catch(e){showError(e.message);$('#file-status').textContent=e.message;$('#publisher-document').value='';}finally{busy=false;}};
 selectFormat('text');all('[data-compose-tool]').forEach(b=>b.onclick=()=>selectFormat(b.dataset.composeTool));$('.compose-tools',publisher)?.addEventListener('keydown',event=>{const tabs=all('[data-compose-tool]',publisher);const index=tabs.indexOf(document.activeElement);if(index<0||(event.key!=='ArrowRight'&&event.key!=='ArrowLeft'))return;event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selectFormat(next.dataset.composeTool);next.focus();});
 $('#choose-video').onclick=()=>$('#publisher-video').click();
$('#compose-camera-open').onclick=async()=>{$('#compose-camera-status').textContent='';$('#compose-camera').hidden=false;try{await startCamera($('#compose-preview'),false);}catch(error){$('#compose-camera-status').textContent=error.message;stopCamera();}};
$('#compose-camera-close').onclick=()=>{stopCamera();$('#compose-camera').hidden=true;};
$('#compose-shutter').onclick=async()=>{try{const file=await snapPhoto($('#compose-preview'));photoAttachment=await readSlot(file);stopCamera();$('#compose-camera').hidden=true;selectFormat('text');paintSlot('photo-slot',photoAttachment,'Remover foto',()=>{photoAttachment=null;});}catch(error){$('#compose-camera-status').textContent=error.message;}};
 $('#choose-file').onclick=()=>$('#publisher-document').click();
 publisher.onsubmit=async e=>{e.preventDefault();const status=$('#preview-form-status');if(busy){status.textContent='Aguarde o vídeo ou o arquivo terminar de entrar.';return;}const submit=$('[type=submit]',publisher);submit.disabled=true;try{const format=selectedFormat();const place=$('#compose-place').value.trim();if(!$('#preview-text').value.trim()&&!(format==='text'&&photoAttachment))throw Error('Escreva o que fica visível para quem vê a publicação.');if(format==='video'&&!videoAttachment)throw Error('Escolha o vídeo desta publicação.');if(format==='file'&&!fileAttachment)throw Error('Escolha o arquivo desta publicação.');if(format==='location'&&place.length<2)throw Error('Escreva a localização com pelo menos 2 caracteres.');await change({action:'publish',text:$('#preview-text').value,audience:$('#preview-audience').value,media:format==='video'?{name:videoAttachment.name,data:videoAttachment.data}:format==='text'&&photoAttachment?{name:photoAttachment.name,data:photoAttachment.data}:null,file:format==='file'?{name:fileAttachment.name,data:fileAttachment.data}:null,location:format==='location'?place:''});publisher.reset();videoAttachment=null;fileAttachment=null;photoAttachment=null;paintSlot('video-slot',null);paintSlot('file-slot',null);paintSlot('photo-slot',null);$('#video-status').textContent='';$('#video-status').hidden=true;$('#file-status').textContent='';$('#file-status').hidden=true;selectFormat('text');status.textContent='Publicação compartilhada. O texto fica visível para quem vê.';}catch(err){status.textContent=err.message;}finally{submit.disabled=false;}};
}
$('#preview-message-form')?.addEventListener('submit',async e=>{e.preventDefault();const b=$('[type=submit]',e.target);b.disabled=true;try{if(activeChatKey&&activeChatKey!=='public'){await change({action:'dm',toKey:activeChatKey,text:$('#preview-message').value});$('#preview-message').value='';$('#preview-message-status').textContent='Mensagem privada enviada.';}else{await change({action:'message',text:$('#preview-message').value});$('#preview-message').value='';$('#preview-message-status').textContent='Mensagem enviada à sala pública.';}}catch(err){$('#preview-message-status').textContent=err.message;}finally{b.disabled=false;}});
$('#chat-dock-close')?.addEventListener('click',()=>{const dock=$('#chat-dock');if(dock)dock.hidden=true;dockChatKey='';});
$('#chat-dock-form')?.addEventListener('submit',async e=>{e.preventDefault();if(!dockChatKey)return;const input=$('#chat-dock-input');const status=$('#chat-dock-status');const b=$('[type=submit]',e.target);b.disabled=true;try{await change({action:'dm',toKey:dockChatKey,text:input.value});input.value='';if(status)status.textContent='';}catch(err){if(status)status.textContent=err.message;}finally{b.disabled=false;input?.focus();}});
$('#profile-close')?.addEventListener('click',()=>$('#profile-sheet')?.close());
all('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>{profileTab=b.dataset.profileTab||'all';renderProfile();}));
$('#account-open-profile')?.addEventListener('click',()=>{if(state.me)openProfile('id:'+state.me.id,state.me.name,'');});
$('#message-emojis')?.addEventListener('click',()=>picker($('#message-picker'),$('#preview-message')));
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
if(document.body.dataset.previewRoute!=='entrar')setInterval(()=>{if(!document.hidden&&!busy)refresh();},document.body.dataset.previewRoute==='messages'?4000:20000);
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
