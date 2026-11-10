(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const all = (s, root=document) => [...root.querySelectorAll(s)];
const make = (tag, text, cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const button=(label, fn, root)=>{const b=make('button',label,'preview-secondary');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){showError(e.message);}finally{b.disabled=false;}});root.append(b);return b;};
// Emojis do Etnias antigo (1.570 em 8 categorias), carregados uma vez de /assets/emojis.json (gerado por scripts/opy-emojis.mjs).
// shortcut: a busca usa as palavras-chave da base, em inglês; traduzir as palavras-chave quando houver pedido da comunidade.
let emojiData=null,emojiRecent=[];try{emojiRecent=JSON.parse(localStorage.getItem('opy-emoji-recentes')||'[]');}catch{emojiRecent=[];}
async function loadEmojis(){if(emojiData)return emojiData;const response=await fetch('/assets/emojis.json',{credentials:'same-origin'});if(!response.ok)throw Error('Não foi possível carregar os emojis.');emojiData=await response.json();return emojiData;}
function insertEmoji(target,symbol){const start=target.selectionStart??target.value.length;target.setRangeText(symbol,start,target.selectionEnd??start,'end');target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();emojiRecent=[symbol,...emojiRecent.filter(s=>s!==symbol)].slice(0,24);try{localStorage.setItem('opy-emoji-recentes',JSON.stringify(emojiRecent));}catch{}}
const reactions=[['like','👍','Curti'],['heart','❤️','Amei'],['laugh','😂','Haha'],['wow','😮','Surpresa'],['sad','😢','Triste']];
let state, filter='all', view='news', videoAttachment=null, fileAttachment=null, busy=false;
// Feed, perfil, comunidade e busca vêm paginados do servidor; o cliente guarda só o que está na tela.
const feed={key:'',posts:[],hasMore:false,loading:false};
const profileData={key:'',person:null,posts:[],hasMore:false,loading:false};
const communityPosts={id:'',posts:[],hasMore:false,loading:false};
const searchData={q:null,people:[],posts:[],loading:false};
const notifData={loaded:false,items:[],loading:true};
const exploreData={loaded:false,posts:[]};
let suggestionsClosed=(()=>{try{return sessionStorage.getItem('opy_suggest_closed')==='1';}catch{return false;}})();
function findPost(id){return feed.posts.find(p=>p.id===id)||profileData.posts.find(p=>p.id===id)||communityPosts.posts.find(p=>p.id===id)||(feed.pinned?.id===id?feed.pinned:null)||(state?.posts||[]).find(p=>p.id===id);}
function upsertPost(list,post){const i=list.findIndex(p=>p.id===post.id);if(i>=0)list[i]=post;}
function dropPost(id){for(const l of [feed.posts,profileData.posts,communityPosts.posts,state?.posts||[]]){const i=l.findIndex(p=>p.id===id);if(i>=0)l.splice(i,1);}}
const byNewest=(a,b)=>b.createdAt-a.createdAt||(a.id<b.id?1:-1);
function mergePage(list,page){const seen=new Set(page.map(p=>p.id));return [...page,...list.filter(p=>!seen.has(p.id))].sort(byNewest);}
const apiGet=params=>api(null,'?'+new URLSearchParams(params));
const expandedComments=new Set(), openCommentForms=new Set(), replyTargets=new Map();
let profileTab='posts', dockChatKey='';
const seenStories=new Set((()=>{try{return JSON.parse(localStorage.getItem('opy_seen_stories')||'[]');}catch{return[];}})());
const markStorySeen=id=>{seenStories.add(id);try{localStorage.setItem('opy_seen_stories',JSON.stringify([...seenStories].slice(-200)));}catch{}};
const fullDate=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
// Tempo relativo até 7 dias, como nas redes que as pessoas já usam; depois, a data completa.
const date=value=>{const d=(Date.now()-new Date(value).getTime())/1000;if(d<45)return 'agora';if(d<3600)return `há ${Math.max(1,Math.round(d/60))} min`;if(d<86400)return `há ${Math.round(d/3600)} h`;if(d<172800)return 'ontem';if(d<604800)return `há ${Math.round(d/86400)} dias`;return fullDate(value);};
function showError(message){let el=$('#community-error');if(!el){el=make('p',undefined,'preview-feedback');el.id='community-error';el.setAttribute('role','alert');$('.middlecol').prepend(el);}el.textContent=message;}
async function api(body,query=''){const response=await fetch('/api/community'+query,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));if(!response.ok){const error=Error(data.error||'Não foi possível carregar. Tente novamente.');error.status=response.status;throw error;}return data;}
// Estado vazio com próximo passo: título, explicação e ações (href ou função).
function emptyState(title,text,actions=[]){
 const box=make('div',undefined,'opy-empty');box.append(make('strong',title),make('p',text));
 if(actions.length){const row=make('div',undefined,'opy-empty-actions');actions.forEach(([label,go],i)=>{const el=typeof go==='string'?make('a',label):make('button',label);if(typeof go==='string')el.href=go;else{el.type='button';el.onclick=go;}el.className=i?'preview-secondary':'opy-primary';row.append(el);});box.append(row);}
 return box;
}
// Aviso curto e acessível depois de uma ação concluída.
function toast(msg){
 let host=$('#opy-toast');if(!host){host=make('div');host.id='opy-toast';host.setAttribute('role','status');host.setAttribute('aria-live','polite');document.body.append(host);}
 const t=make('div',msg,'opy-toast');host.append(t);setTimeout(()=>t.classList.add('is-out'),2600);setTimeout(()=>t.remove(),3000);
}
const TOASTS={publish:'Publicado',repost:'Repostado no seu perfil',delete:'Publicação excluída',post_edit:'Alterações salvas',profile_update:'Perfil atualizado',story_create:'Story publicado por 24 horas',community_create:'Comunidade criada',community_invite:'Convite enviado',community_update:'Configurações salvas',community_approve:'Entrada aprovada',community_accept_invite:'Você entrou na comunidade'};
function toastFor(body){
 if(body.action==='save'){const p=findPost(body.postId);return p?(p.saved?'Salvo para ler depois':'Removido dos salvos'):'';}
 if(body.action==='community_join'){const c=communitiesList().find(x=>x.id===body.communityId);return !c?'':c.joined?'Você entrou em '+c.name:(c.pending||c.requested)?'Pedido enviado à coordenação':'Pedido cancelado';}
 if(body.action==='community_leave')return 'Você saiu da comunidade';
 return TOASTS[body.action]||'';
}
function closePostMenus(){all('.post-menu').forEach(m=>{m.hidden=true;m.previousElementSibling?.setAttribute('aria-expanded','false');});}
document.addEventListener('click',closePostMenus);document.addEventListener('keydown',e=>{if(e.key==='Escape')closePostMenus();});
// Uma atualização periódica que começou antes de uma ação não pode sobrescrever o resultado dela.
let feedGen=0;
// Reação e salvar: mostra o resultado na hora e confirma com o servidor; se falhar, volta ao estado anterior.
async function optimistic(post,patch,body){
 const before={reaction:post.reaction,reactions:{...post.reactions},saved:post.saved};
 Object.assign(post,patch);for(const l of [feed.posts,profileData.posts,communityPosts.posts])upsertPost(l,post);render();
 try{await change(body);}catch(error){Object.assign(post,before);for(const l of [feed.posts,profileData.posts,communityPosts.posts])upsertPost(l,post);render();throw error;}
}
function reactPatch(post,next){const reactions={...post.reactions};if(post.reaction)reactions[post.reaction]=Math.max(0,(reactions[post.reaction]||1)-1);if(next)reactions[next]=(reactions[next]||0)+1;return {reaction:next,reactions};}
async function change(body){const next=await api(body);feedGen++;const touched=next.touched;delete next.touched;state=next;
 if(touched){for(const l of [feed.posts,profileData.posts,communityPosts.posts])upsertPost(l,touched);if(feed.pinned?.id===touched.id)feed.pinned=touched;}
 else if(body.action==='delete'||body.action==='community_moderate_post'){dropPost(body.postId);if(feed.pinned?.id===body.postId)feed.pinned=null;}
 if(['friend','follow','community_accept_invite','community_decline_invite','community_approve','community_reject'].includes(body.action))notifData.loaded=false;
 // Só a publicação própria volta ao topo do feed; excluir e repostar já atualizam o que está carregado (sem perder a paginação).
 if(body.action==='publish'){feed.key='';profileData.key='';communityPosts.id='';}
 if(body.action==='follow'){const d=(state.directory||[]).find(p=>p.key===body.authorKey);const person=profileData.key===body.authorKey?profileData.person:null;
  // A pessoa pode não estar no diretório (top 20): sem ela, a resposta do servidor é o inverso do estado anterior.
  const following=d?d.following:person?!person.following:undefined;
  if(following!==undefined){for(const l of [feed.posts,profileData.posts,communityPosts.posts])(l||[]).forEach(p=>{if(p.authorKey===body.authorKey)p.following=following;});
   if(person&&person.following!==following){person.following=following;person.followersCount=Math.max(0,(person.followersCount||0)+(following?1:-1));profileSignature='';}}}
 render();const msg=toastFor(body);if(msg)toast(msg);}
// Seletor de emojis com busca, categorias e recentes. `onPick` fecha o que o abriu (caixa do comentário, diálogo do chat).
function picker(root,target,onPick=()=>{root.hidden=true;}){
 root.classList.add('opy-emoji');root.replaceChildren(make('p','Carregando emojis…','opy-emoji-status'));root.hidden=false;
 loadEmojis().then(groups=>{
  let cat=emojiRecent.length?'recentes':groups[0][0],q='';
  const search=make('input');search.type='search';search.placeholder='Buscar emoji';search.setAttribute('aria-label','Buscar emoji');
  const tabs=make('div',undefined,'opy-emoji-tabs');tabs.setAttribute('role','tablist');const grid=make('div',undefined,'opy-emoji-grid');
  const paint=()=>{
   const groupTabs=[...(emojiRecent.length?[['recentes','Recentes']]:[]),...groups.map(([id,label])=>[id,label])];
   tabs.replaceChildren(...groupTabs.map(([id,label])=>{const b=make('button',label,'opy-emoji-tab');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(cat===id&&!q));b.onclick=()=>{cat=id;q='';search.value='';paint();};return b;}));
   const list=q?groups.flatMap(([,,items])=>items.filter(([,keys])=>keys.includes(q))).slice(0,120):cat==='recentes'?emojiRecent.map(s=>[s,'']):(groups.find(([id])=>id===cat)||groups[0])[2];
   grid.replaceChildren(...list.map(([symbol])=>{const b=make('button',symbol,'opy-emoji-btn');b.type='button';b.onclick=()=>{insertEmoji(target,symbol);onPick();};return b;}));
   if(!list.length)grid.append(make('p',q?'Nenhum emoji para essa busca.':'Nenhum emoji recente.','opy-emoji-status'));
  };
  search.addEventListener('input',()=>{q=search.value.trim().toLowerCase();paint();});
  root.replaceChildren(search,tabs,grid);paint();
 }).catch(error=>{root.replaceChildren(make('p',error.message,'opy-emoji-status'));});
}
// Botão de emoji + caixa do seletor para um campo de texto (tela Criar, bate-papo da live). O chamador posiciona os dois.
function emojiToggle(input){
 const btn=make('button','😊','comment-emoji-btn');btn.type='button';btn.setAttribute('aria-label','Inserir emoji');btn.setAttribute('aria-expanded','false');
 const box=make('div',undefined,'comment-emoji-picker');box.hidden=true;
 btn.onclick=()=>{box.hidden=!box.hidden;btn.setAttribute('aria-expanded',String(!box.hidden));if(!box.hidden)picker(box,input,()=>{box.hidden=true;btn.setAttribute('aria-expanded','false');input.dispatchEvent(new Event('input',{bubbles:true}));});};
 return [btn,box];
}
window.OpyEmoji={open:picker,toggle:emojiToggle};
const glyph={
 // Curtir é o maracá (desenho da Lari, larissamato/etnias), redesenhado no grid de 24 e no traço dos outros ícones.
 like:'<g class="maraca" transform="rotate(45 12 12) translate(12 12) scale(1.3) translate(-12 -11.7)" stroke-width="1.4"><path class="maraca-pluma" d="M12 4.1C10.3 1.7 8.1 1.9 8.6 3.9c.4.9 2.1.8 3.4.2zM12 4.1c1.7-2.4 3.9-2.2 3.4-.2-.4.9-2.1.8-3.4.2z"/><ellipse class="maraca-cabaca" cx="12" cy="9.6" rx="4.7" ry="5.4"/><path class="maraca-grafismo" d="M7.6 9.1l2.2 2 2.2-2.4 2.2 2.4 2.2-2"/><path d="M10 15.2h4M10.9 15.2l-.4 5.6c0 .9 3 .9 3 0l-.4-5.6"/></g>',
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
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
// O menu vem do legado ("Grupos"); na prévia o nome é Comunidades, como no resto da tela.
document.querySelectorAll('[data-opy-destination="grupos"] span:not(.opy-pending)').forEach(el=>{el.textContent='Comunidades';});
function postAction(name, label, fn){const b=document.createElement('button');b.type='button';b.className='post-action';b.innerHTML=svg(name);if(label){const span=document.createElement('span');span.textContent=label;b.append(span);}b.addEventListener('click',async event=>{b.disabled=true;try{await fn(event);}catch(e){showError(e.message);}finally{b.disabled=false;}});return b;}
// Atalho do chat no cabeçalho (telas largas): painel com as conversas recentes, como o Messenger no Facebook. No celular o ícone abre /chat/.
async function openInboxPopover(event){
 if(window.innerWidth<1024||document.body.dataset.previewRoute==='messages')return;
 event.preventDefault();
 let pop=$('#opy-inbox');
 if(pop){pop.remove();return;}
 pop=make('div',undefined,'opy-inbox');pop.id='opy-inbox';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Mensagens recentes');pop.open=true;
 const head=make('div',undefined,'opy-inbox-head');head.append(make('h2','Mensagens'));const all=make('a','Ver todas','opy-inbox-all');all.href='/chat/';head.append(all);
 const list=make('ul',undefined,'opy-inbox-list');list.append(make('li','Carregando…','opy-inbox-empty'));pop.append(head,list);
 document.body.append(pop);
 const close=e=>{if(e.type==='keydown'&&e.key!=='Escape')return;if(e.type==='click'&&pop.contains(e.target))return;pop.remove();document.removeEventListener('click',close);document.removeEventListener('keydown',close);};
 setTimeout(()=>{document.addEventListener('click',close);document.addEventListener('keydown',close);});
 try{
  const inbox=await api(null,'?view=chat');const items=(inbox.conversations||[]).filter(c=>!c.archived).slice(0,8);
  list.replaceChildren();
  if(!items.length){const empty=make('li',undefined,'opy-inbox-empty');empty.append('Nenhuma conversa ainda. ',Object.assign(make('a','Encontre alguém para conversar'),{href:'/chat/'}));list.append(empty);}
  for(const c of items){
   const li=make('li');const a=make('a',undefined,'opy-inbox-item');a.href='/chat/?p='+encodeURIComponent(c.key);
   const meta=make('span',undefined,'opy-inbox-meta');meta.append(make('strong',c.name),make('small',c.last||(c.group?'Grupo privado':'Conversa privada')));
   const side=make('span',undefined,'opy-inbox-side');if(c.at)side.append(make('small',date(c.at)));if(c.unread){const u=make('span',String(c.unread),'opy-header-badge');u.setAttribute('aria-label',c.unread+' não lidas');side.append(u);}
   a.append(avatarNode(c.name,c.avatar,40),meta,side);if(c.unread)a.classList.add('is-unread');li.append(a);list.append(li);
  }
  if(inbox.requests?.length){const r=make('li');const ra=make('a',undefined,'opy-inbox-item opy-inbox-requests');ra.href='/chat/';ra.append(make('strong',inbox.requests.length===1?'1 solicitação de conversa':inbox.requests.length+' solicitações de conversa'));r.append(ra);list.append(r);}
 }catch(error){list.replaceChildren(make('li',error.message,'opy-inbox-empty'));}
}
const chatHeaderLink=()=>$('.messages-notification-container a');
function avatarNode(name, url, size=42){
 const fallback=()=>make('span',(name||'?').slice(0,1).toLocaleUpperCase('pt-BR'),'preview-avatar');
 if(url&&(/^\/assets\/archive\/avatar-[a-f0-9]{20}\.(jpg|jpeg|png|webp|gif)$/.test(url)||/^\/api\/media\?id=[a-f0-9-]{36}$/.test(url)||/^\/legado\/upload\/[\w./%-]+\.(jpg|jpeg|png|webp|gif)$/i.test(url))){
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
 return {key:key||`name:${fallbackName}`,name:fallbackName||'Comunidade',username:'',avatar:fallbackAvatar||'',own:key===myKey,following:false,friendStatus:'none',followersCount:0,followingCount:0,friendsCount:0,postsCount:0};
}
function mountAudio(media, parent){const audio=document.createElement('audio');audio.preload='metadata';audio.tabIndex=-1;audio.setAttribute('aria-hidden','true');audio.src=media.url;const box=make('div',undefined,'opy-player');const toggle=make('button',undefined,'opy-player-toggle');toggle.type='button';toggle.innerHTML=svg('play');toggle.setAttribute('aria-label','Reproduzir');const body=make('div',undefined,'opy-player-body');const meta=make('div',undefined,'opy-player-meta');const title=make('strong',media.name);const time=make('span','0:00 / 0:00','opy-player-time');meta.append(title,time);const range=document.createElement('input');range.type='range';range.min='0';range.max='1000';range.value='0';range.className='opy-player-range';range.setAttribute('aria-label','Avançar no áudio');range.setAttribute('aria-valuemin','0');range.setAttribute('aria-valuemax','1000');let seeking=false;const paint=()=>{const duration=audio.duration||0;const ratio=duration?audio.currentTime/duration:0;if(!seeking)range.value=String(Math.round(ratio*1000));range.setAttribute('aria-valuenow',range.value);range.setAttribute('aria-valuetext',clock(audio.currentTime)+' de '+clock(duration));time.textContent=clock(audio.currentTime)+' / '+clock(duration);range.style.setProperty('--opy-progress',(ratio*100)+'%');};toggle.addEventListener('click',async()=>{if(audio.paused){all('audio').forEach(other=>{if(other!==audio)other.pause();});try{await audio.play();}catch(e){showError('Não foi possível reproduzir este áudio.');}}else audio.pause();});audio.addEventListener('play',()=>{toggle.innerHTML=svg('pause');toggle.setAttribute('aria-label','Pausar');});audio.addEventListener('pause',()=>{toggle.innerHTML=svg('play');toggle.setAttribute('aria-label','Reproduzir');});audio.addEventListener('timeupdate',paint);audio.addEventListener('loadedmetadata',paint);audio.addEventListener('ended',()=>{audio.currentTime=0;paint();});range.addEventListener('pointerdown',()=>{seeking=true;});range.addEventListener('input',()=>{const duration=audio.duration||0;const ratio=Number(range.value)/1000;range.style.setProperty('--opy-progress',(ratio*100)+'%');time.textContent=clock(ratio*duration)+' / '+clock(duration);});range.addEventListener('change',()=>{if(audio.duration)audio.currentTime=(Number(range.value)/1000)*audio.duration;seeking=false;paint();});body.append(meta,range);box.append(toggle,body,audio);parent.append(box);}
function appendFile(media, parent){const file=document.createElement('a');file.className='post-file';file.href=media.url;file.setAttribute('download',media.name);file.innerHTML=svg('file');const label=make('span');label.append(make('strong',media.name),make('small','Baixar'));file.append(label);parent.append(file);}
// Mídia em destaque, como nos apps que as pessoas já usam: imagem de borda a borda, carrossel para álbuns,
// duplo toque curte, um toque amplia, vídeo toca sem som quando aparece na tela.
function heartBurst(box){const h=make('span',undefined,'post-heart-burst');h.innerHTML=svg('heart');box.append(h);h.addEventListener('animationend',()=>h.remove(),{once:true});setTimeout(()=>h.remove(),1200);}
function bindMediaTaps(box,item,onTap){
 let timer=0,last=0;
 box.addEventListener('click',e=>{
  if(e.target.closest('.post-media-counter,.post-media-arrow'))return;
  const now=Date.now();
  if(now-last<320){clearTimeout(timer);last=0;heartBurst(box);if(item.id&&item.reaction!=='heart')optimistic(item,reactPatch(item,'heart'),{action:'react',postId:item.id,reaction:'heart'}).catch(err=>showError(err.message));return;}
  last=now;timer=setTimeout(()=>{last=0;onTap();},320);
 });
}
// Fotos do Etnias antigo são os originais (até 8 MB); o feed usa a miniatura (/legado/thumbs/, com o original como reserva no servidor) e só o visualizador abre o original.
const thumbUrl=u=>u.startsWith('/legado/upload/')?u.replace('/legado/upload/','/legado/thumbs/upload/'):u;
function mediaBlock(item,urls){
 const box=make('div',undefined,'post-media');box.dataset.count=String(urls.length);
 const track=make('div',undefined,'post-media-track');
 if(urls.length>1){track.setAttribute('role','group');track.setAttribute('aria-roledescription','carrossel');track.setAttribute('aria-label',plural(urls.length,'imagem','imagens'));}
 urls.forEach((u,i)=>{const slide=make('button',undefined,'post-media-slide');slide.type='button';slide.setAttribute('aria-label',(urls.length>1?`Ampliar imagem ${i+1} de ${urls.length}`:'Ampliar imagem')+' da publicação de '+item.author);const img=make('img');img.src=thumbUrl(u);img.alt='';img.loading='lazy';img.decoding='async';const ready=()=>img.classList.add('is-loaded');img.onload=ready;img.onerror=ready;if(img.complete&&img.naturalWidth)ready();slide.append(img);track.append(slide);});
 box.append(track);
 const current=()=>urls.length>1?Math.min(urls.length-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))):0;
 if(urls.length>1){
  const counter=make('span','1/'+urls.length,'post-media-counter');const dots=make('div',undefined,'post-media-dots');dots.setAttribute('aria-hidden','true');urls.forEach((_,i)=>dots.append(make('i',undefined,i?'':'is-on')));box.append(counter,dots);
  // Setas no computador (como no Instagram); no toque, desliza com o dedo.
  const go=d=>track.scrollTo({left:(current()+d)*track.clientWidth,behavior:'smooth'});
  const prev=make('button','‹','post-media-arrow is-prev'),next=make('button','›','post-media-arrow is-next');
  prev.type=next.type='button';prev.setAttribute('aria-label','Foto anterior');next.setAttribute('aria-label','Próxima foto');prev.hidden=true;
  prev.onclick=e=>{e.stopPropagation();go(-1);};next.onclick=e=>{e.stopPropagation();go(1);};box.append(prev,next);
  track.addEventListener('scroll',()=>{const i=current();prev.hidden=i===0;next.hidden=i===urls.length-1;counter.textContent=(i+1)+'/'+urls.length;all('i',dots).forEach((d,j)=>d.classList.toggle('is-on',j===i));},{passive:true});
 }
 bindMediaTaps(box,item,()=>openLightbox(urls,current(),item.author));
 return box;
}
let nearObserver=null;let videoObserver=null;
function autoplayWhenVisible(video){
 if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 videoObserver||=new IntersectionObserver(entries=>{for(const e of entries){const v=e.target;if(e.intersectionRatio>=0.6){if(v.paused&&!v.dataset.userPaused)v.play().catch(()=>{});}else if(!v.paused){v.dataset.autoPaused='1';v.pause();}}},{threshold:[0,0.6]});
 videoObserver.observe(video);
 // Perto da tela, carrega só os metadados (tamanho e duração): o quadro ganha a altura certa antes de aparecer, sem baixar o vídeo inteiro.
 nearObserver||=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.preload='metadata';nearObserver.unobserve(e.target);}},{rootMargin:'900px'});
 nearObserver.observe(video);
 video.addEventListener('pause',()=>{if(video.dataset.autoPaused)delete video.dataset.autoPaused;else video.dataset.userPaused='1';});
 video.addEventListener('play',()=>{delete video.dataset.userPaused;all('video.preview-post-video').forEach(o=>{if(o!==video&&!o.paused){o.dataset.autoPaused='1';o.pause();}});});
}
function videoBlock(item){
 const box=make('div',undefined,'post-media post-media-video');box.dataset.count='1';
 const video=document.createElement('video');video.className='preview-post-video';video.src=item.media.url;video.controls=true;video.preload='none';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('aria-label','Vídeo da publicação de '+item.author);
 // Gravação de live (MP4 fragmentado): carrega o começo para mostrar o primeiro quadro em vez da tela preta no iPhone.
 if(item.live){video.preload='metadata';video.src=item.media.url+'#t=0.1';}
 // Live que caiu e voltou fica gravada em partes: toca a seguinte quando uma termina.
 const parts=item.media.parts||[];if(parts.length>1){let i=0;video.addEventListener('ended',()=>{if(++i>=parts.length){i=0;video.src=parts[0];return;}video.src=parts[i];video.play().catch(()=>{});});}
 box.append(video);autoplayWhenVisible(video);return box;
}
function openLightbox(urls,index,author){
 let dlg=$('#opy-lightbox');
 if(!dlg){
  dlg=make('dialog');dlg.id='opy-lightbox';dlg.className='opy-lightbox';dlg.setAttribute('aria-label','Imagem ampliada');
  const close=make('button','✕','opy-lightbox-close');close.type='button';close.setAttribute('aria-label','Fechar');close.onclick=()=>dlg.close();
  const prev=make('button','‹','opy-lightbox-nav is-prev');prev.type='button';prev.setAttribute('aria-label','Imagem anterior');
  const next=make('button','›','opy-lightbox-nav is-next');next.type='button';next.setAttribute('aria-label','Próxima imagem');
  const img=make('img');const cap=make('p',undefined,'opy-lightbox-caption');
  dlg.append(close,prev,img,next,cap);document.body.append(dlg);
  dlg._show=i=>{const list=dlg._list;dlg._i=(i+list.length)%list.length;img.src=list[dlg._i];img.alt=`Imagem ${dlg._i+1} de ${list.length}`+(dlg._who?' de '+dlg._who:'');cap.textContent=list.length>1?`${dlg._i+1} / ${list.length}`:'';prev.hidden=next.hidden=list.length<2;};
  prev.onclick=()=>dlg._show(dlg._i-1);next.onclick=()=>dlg._show(dlg._i+1);
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();prev.click();}else if(e.key==='ArrowRight'){e.preventDefault();next.click();}});
  let sx=0;dlg.addEventListener('pointerdown',e=>{sx=e.clientX;},{passive:true});dlg.addEventListener('pointerup',e=>{const dx=e.clientX-sx;if(Math.abs(dx)>60&&dlg._list.length>1)dlg._show(dlg._i+(dx<0?1:-1));},{passive:true});
 }
 dlg._list=urls;dlg._who=author;dlg._show(index);if(!dlg.open)dlg.showModal();
}
// Links no texto: só http(s), abrem em outra aba sem passar a origem; o restante continua texto puro (nada vira HTML).
const URL_RE=/\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
function linkified(text){
 const frag=document.createDocumentFragment();let last=0;
 for(const m of text.matchAll(URL_RE)){
  let ok=false;try{ok=['http:','https:'].includes(new URL(m[0]).protocol);}catch{}
  if(!ok)continue;
  frag.append(text.slice(last,m.index));const a=make('a',m[0].length>60?m[0].slice(0,57)+'…':m[0],'post-inline-link');a.href=m[0];a.target='_blank';a.rel='noopener noreferrer nofollow';frag.append(a);last=m.index+m[0].length;
 }
 frag.append(text.slice(last));return frag;
}
// YouTube: o primeiro link vira cartão com a miniatura; o player (youtube-nocookie) só carrega quando a pessoa toca.
function youtubeId(text){
 for(const m of String(text||'').matchAll(URL_RE)){
  let u;try{u=new URL(m[0]);}catch{continue;}
  const host=u.hostname.replace(/^(www\.|m\.|music\.)/,'');let id='';
  if(host==='youtu.be')id=u.pathname.slice(1).split('/')[0];
  else if(host==='youtube.com'||host==='youtube-nocookie.com'){id=u.searchParams.get('v')||'';const parts=u.pathname.split('/').filter(Boolean);if(!id&&['shorts','embed','live','v'].includes(parts[0]))id=parts[1]||'';}
  if(/^[A-Za-z0-9_-]{11}$/.test(id))return id;
 }
 return '';
}
function youtubeCard(id,author){
 const box=make('div',undefined,'post-youtube');
 const play=make('button',undefined,'post-youtube-play');play.type='button';play.setAttribute('aria-label','Assistir ao vídeo do YouTube compartilhado por '+author);
 const img=make('img');img.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
 const icon=make('span',undefined,'post-youtube-icon');icon.setAttribute('aria-hidden','true');
 play.append(img,icon);
 const meta=make('a','Assistir no YouTube','post-youtube-meta');meta.href='https://www.youtube.com/watch?v='+id;meta.target='_blank';meta.rel='noopener noreferrer nofollow';
 play.onclick=()=>{const f=make('iframe');f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&playsinline=1';f.title='Vídeo do YouTube compartilhado por '+author;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';play.replaceWith(f);f.focus();};
 box.append(play,meta);return box;
}
function appendPostBody(item, parent){
 if(item.feeling)parent.append(make('small','Sentindo-se '+item.feeling,'post-feeling'));
 if(item.text&&item.text.trim()){const copy=make('p',undefined,'post-copy');copy.append(linkified(item.text));parent.append(copy);
  // Texto longo fica recolhido com "Ver mais", como nos apps; o texto completo continua no DOM para leitores de tela.
  if(item.text.length>420||item.text.split('\n').length>8){copy.classList.add('is-clamped');const more=make('button','Ver mais','post-more-text');more.type='button';more.setAttribute('aria-expanded','false');more.onclick=()=>{const open=copy.classList.toggle('is-clamped');more.textContent=open?'Ver mais':'Ver menos';more.setAttribute('aria-expanded',String(!open));};parent.append(more);}}
 const safeImage=u=>u&&(u.startsWith('/assets/archive/')||u.startsWith('/legado/')||u.startsWith('/api/media?id='));
 const urls=item.images&&item.images.length>1?item.images.filter(safeImage):safeImage(item.image)?[item.image]:item.media&&item.media.kind==='image'?[item.media.url]:[];
 if(urls.length)parent.append(mediaBlock(item,urls));
 else if(!item.media&&!item.live){const yt=youtubeId(item.text);if(yt)parent.append(youtubeCard(yt,item.author));}
 if(item.link&&item.link.url){const a=make('a',undefined,'post-link');a.href=item.link.url;a.target='_blank';a.rel='noopener noreferrer';let host='';try{host=new URL(item.link.url).hostname.replace(/^www\./,'');}catch{}a.append(make('strong',item.link.title||host||item.link.url),make('small',host));parent.append(a);}
 if(item.live?.active)parent.append(liveBlock(item));
 else if(item.live&&!item.media)parent.append(make('small',item.live.recording==='none'?'A live terminou e a gravação não ficou disponível.':'A live terminou. A gravação está sendo preparada.','post-live-note'));
 if(item.media&&item.media.kind==='audio')mountAudio(item.media,parent);
 else if(item.media&&item.media.kind==='file')appendFile(item.media,parent);
 else if(item.media&&item.media.kind==='video'){if(item.live)parent.append(make('small','Gravação da live','post-live-note'));parent.append(videoBlock(item));}
 if(item.file)appendFile(item.file,parent);
 if(item.location)parent.append(make('p','Localização · '+item.location,'post-place'));
}
function renderPost(post, communityContext=null){
 const card=make('article',undefined,'preview-post community-post');card.dataset.origin=post.origin;card.id='post-'+post.id;
 if(post.sponsored){const tag=make('p',post.sponsored.label+(post.sponsored.test?' · teste':''),'post-sponsored');card.dataset.boost=post.sponsored.boostId;card.classList.add('is-sponsored');card.append(tag);}
 const head=make('div',undefined,'preview-author');
 const pKey=post.authorKey||`name:${post.author}`;
 const avBtn=make('button',undefined,'author-trigger');avBtn.type='button';avBtn.setAttribute('aria-label','Abrir perfil de '+post.author);avBtn.append(avatarNode(post.author,post.avatar,42));avBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 const who=make('div');
 const nameBtn=make('button',post.author,'author-name-btn');nameBtn.type='button';nameBtn.onclick=()=>openProfile(pKey,post.author,post.avatar);
 if(post.verified){const v=make('span','✓','opy-verified');v.setAttribute('role','img');v.setAttribute('aria-label','Conta verificada');nameBtn.append(v);}
 const metaLine=make('small');metaLine.title=fullDate(post.createdAt);
 // "Acervo público" só para publicações do acervo sem conta por trás; o Etnias antigo faz parte da rede.
 if(post.origin==='legacy'&&!pKey.startsWith('id:'))metaLine.append(make('span','Acervo público'),' · ');
 const when=make('time',date(post.createdAt));when.dateTime=new Date(post.createdAt).toISOString();metaLine.append(when);
 if(post.editedAt)metaLine.append(' ',make('span','· editada'));
 if(post.audience==='private')metaLine.append(' ',make('span','· Somente eu'));else if(post.audience==='friends')metaLine.append(' ',make('span','· Amigos'));
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
 const charCount=make('small','0/500','comment-char-count');charCount.hidden=true;
 input.addEventListener('input',()=>{charCount.textContent=input.value.length+'/500';charCount.hidden=input.value.length<400;});
 // Campo no padrão das redes: pílula larga com o texto; emoji e enviar (seta) ficam dentro dela; enviar só acende com texto.
 const submit=make('button',undefined,'comment-send');submit.type='submit';submit.setAttribute('aria-label','Enviar comentário');submit.disabled=true;
 submit.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/></svg>';
 input.addEventListener('input',()=>{submit.disabled=!input.value.trim();});
 const target=replyTargets.get(post.id);
 if(target){const chip=make('p',undefined,'comment-reply-chip');chip.append(make('span','Respondendo a '+target.author));const x=button('Cancelar',()=>{replyTargets.delete(post.id);render();},chip);x.className='comment-reply-cancel';x.setAttribute('aria-label','Cancelar resposta a '+target.author);form.append(chip);input.placeholder='Responder a '+target.author.split(' ')[0]+'…';}
 const emojiBtn=make('button',undefined,'comment-emoji-btn');emojiBtn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/></svg>';emojiBtn.type='button';emojiBtn.setAttribute('aria-label','Inserir emoji');emojiBtn.setAttribute('aria-expanded','false');
 const emojiBox=make('div',undefined,'comment-emoji-picker');emojiBox.hidden=true;
 emojiBtn.onclick=()=>{emojiBox.hidden=!emojiBox.hidden;emojiBtn.setAttribute('aria-expanded',String(!emojiBox.hidden));if(!emojiBox.hidden)picker(emojiBox,input,()=>{emojiBox.hidden=true;emojiBtn.setAttribute('aria-expanded','false');});};
 const box=make('div',undefined,'comment-box');box.append(input,emojiBtn,submit);
 form.append(box,charCount,emojiBox);
 form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{openCommentForms.add(post.id);const draft=input.value;const replyTo=replyTargets.get(post.id)?.id;replyTargets.delete(post.id);try{await change({action:'comment',postId:post.id,text:draft,...(replyTo?{replyTo}:{})});}catch(error){if(replyTo)replyTargets.set(post.id,{id:replyTo,author:''});throw error;}const sent=document.getElementById('post-'+post.id)?.querySelector('.preview-comment-form input');if(sent){sent.value='';const cc=document.getElementById('post-'+post.id)?.querySelector('.comment-char-count');if(cc)cc.textContent='0/500';}}catch(err){showError(err.message);submit.disabled=false;}});
 const repostForm=make('form',undefined,'preview-repost-form');repostForm.hidden=true;
 const repostInput=make('input');repostInput.maxLength=1000;repostInput.placeholder='Adicione um comentário ao repostar (opcional)…';repostInput.setAttribute('aria-label','Comentário do repost');
 const repostSubmit=make('button','Repostar agora','opy-primary');repostSubmit.type='submit';
 if(navigator.share){const shareNative=make('button','Compartilhar…','preview-secondary');shareNative.type='button';shareNative.onclick=()=>navigator.share({title:'Casa Opy · '+post.author,text:(post.text||'').slice(0,140),url:location.origin+'/#post-'+post.id}).catch(()=>{});repostForm.append(shareNative);}
 const copyLink=make('button','Copiar link','preview-secondary');copyLink.type='button';
 copyLink.onclick=async()=>{const url=location.origin+'/#post-'+post.id;try{await navigator.clipboard.writeText(url);copyLink.textContent='Link copiado ✓';setTimeout(()=>{copyLink.textContent='Copiar link';},1800);}catch{prompt('Link da publicação:',url);}};
 repostForm.append(repostInput,repostSubmit,copyLink);
 repostForm.addEventListener('submit',async e=>{e.preventDefault();repostSubmit.disabled=true;try{await change({action:'repost',postId:post.id,text:repostInput.value});repostInput.value='';repostForm.hidden=true;}catch(err){showError(err.message);}finally{repostSubmit.disabled=false;}});
 if(total||post.comments.length||sharesCount){
  const summary=make('div',undefined,'post-summary');
  const left=make('span');
  if(total){
   const who=(post.reactedBy||[]).slice(0,2).map((n,i)=>i===0?n.charAt(0).toLocaleUpperCase('pt-BR')+n.slice(1):n);const rest=total-who.length;
   const names=!who.length?String(total):rest>0?`${who.join(', ')} e mais ${rest}`:who.join(' e ');
   left.setAttribute('aria-label',total+(total===1?' reação':' reações')+': '+reacted.map(([, ,label])=>label).join(', ')+(who.length?' · '+names:''));left.replaceChildren(...reacted.map(([id,icon])=>{if(id!=='like')return document.createTextNode(icon+' ');const m=make('span',undefined,'post-react-maraca');m.innerHTML=svg('like');return m;}),document.createTextNode(names));
  }
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
 // O botão mostra a reação escolhida (Curti, Amei, Haha…); tocar de novo desfaz; segurar abre a bandeja.
 const chosen=reactions.find(([id])=>id===post.reaction);
 const like=postAction(chosen?chosen[0]:'like',chosen?chosen[2]:'Curtir',()=>{if(like.dataset.held==='1'){like.dataset.held='';return;}return optimistic(post,reactPatch(post,post.reaction?'':'like'),{action:'react',postId:post.id,reaction:post.reaction?'':'like'});});
 like.classList.add('post-react-main');if(chosen)like.classList.add('is-'+chosen[0]);
 like.setAttribute('aria-pressed',String(!!post.reaction));like.setAttribute('aria-haspopup','true');
 let hold;like.addEventListener('pointerdown',()=>{like.dataset.held='';hold=setTimeout(()=>{like.dataset.held='1';reactWrap.classList.add('is-open');},450);});
 const endHold=()=>clearTimeout(hold);like.addEventListener('pointerup',endHold);like.addEventListener('pointercancel',endHold);like.addEventListener('contextmenu',event=>event.preventDefault());
 const tray=make('div',undefined,'post-react-tray');tray.setAttribute('role','group');tray.setAttribute('aria-label','Reações');
 for(const [id,icon,label] of [['like','like','Curti'],['heart','heart','Amei'],['laugh','laugh','Haha'],['wow','wow','Surpresa'],['sad','sad','Triste']]){const choice=postAction(icon,'',()=>optimistic(post,reactPatch(post,post.reaction===id?'':id),{action:'react',postId:post.id,reaction:post.reaction===id?'':id}));choice.classList.add('post-react-choice','is-'+id);choice.setAttribute('aria-label',label);choice.title=label;choice.setAttribute('aria-pressed',String(post.reaction===id));tray.append(choice);}
 reactWrap.append(like,tray);
 const commentBtn=postAction('comment','Comentar',()=>{form.hidden=!form.hidden;if(form.hidden)openCommentForms.delete(post.id);else openCommentForms.add(post.id);commentBtn.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden)input.focus();});
 commentBtn.setAttribute('aria-expanded',String(!form.hidden));commentBtn.setAttribute('aria-controls',form.id);
 const shareBtn=postAction('share','Repostar',()=>{repostForm.hidden=!repostForm.hidden;shareBtn.setAttribute('aria-expanded',String(!repostForm.hidden));if(!repostForm.hidden)repostInput.focus();});
 shareBtn.setAttribute('aria-expanded','false');
 const save=postAction('save','',()=>optimistic(post,{saved:!post.saved},{action:'save',postId:post.id}));save.classList.add('post-action-quiet');save.setAttribute('aria-label',post.saved?'Remover dos salvos':'Salvar publicação');save.setAttribute('aria-pressed',String(!!post.saved));
 actions.append(reactWrap,commentBtn,shareBtn,save);card.append(actions,repostForm);
 // Ações da própria pessoa (e da moderação) ficam num menu ⋯ no cabeçalho, como nas redes que as pessoas já usam.
 const menuItems=[];
 if(post.own){
  menuItems.push(['Editar',()=>{
   if(card.querySelector('.post-edit-form'))return;
   const f=make('form',undefined,'post-edit-form');const ta=make('textarea');ta.value=post.text||'';ta.maxLength=5000;ta.rows=4;ta.setAttribute('aria-label','Editar publicação');
   const save=make('button','Salvar','opy-primary');save.type='submit';const cancel=button('Cancelar',()=>f.remove(),f);f.prepend(ta);f.append(save);f.append(cancel);
   f.addEventListener('submit',async ev=>{ev.preventDefault();save.disabled=true;try{await change({action:'post_edit',postId:post.id,text:ta.value});}catch(err){showError(err.message);save.disabled=false;}});
   actions.before(f);ta.focus();
  }]);
  if(post.audience==='public'&&!post.communityId&&!post.live)menuItems.push(['Impulsionar publicação',()=>openBoostDialog(post)]);
  menuItems.push(['Excluir publicação',async()=>{if(!confirm('Excluir esta publicação?'))return;try{await change({action:'delete',postId:post.id});}catch(e){showError(e.message);}}]);
 }else if(communityContext?.canModerate&&post.communityId===communityContext.id){
  menuItems.push(['Remover da comunidade (moderação)',async()=>{if(!confirm('Remover esta publicação da comunidade?'))return;try{await change({action:'community_moderate_post',communityId:communityContext.id,postId:post.id});}catch(e){showError(e.message);}}]);
 }
 if(menuItems.length){
  const more=make('div',undefined,'post-more');const mb=make('button','⋯','post-more-btn');mb.type='button';mb.setAttribute('aria-label','Mais opções');mb.setAttribute('aria-haspopup','menu');mb.setAttribute('aria-expanded','false');
  const menu=make('div',undefined,'post-menu');menu.setAttribute('role','menu');menu.hidden=true;
  for(const [label,fn] of menuItems){const it=make('button',label,'post-menu-item'+(/^(Excluir|Remover)/.test(label)?' is-danger':''));it.type='button';it.setAttribute('role','menuitem');it.onclick=()=>{closePostMenus();fn();};menu.append(it);}
  mb.onclick=e=>{e.stopPropagation();const open=menu.hidden;closePostMenus();menu.hidden=!open;mb.setAttribute('aria-expanded',String(open));};
  more.append(mb,menu);head.append(more);
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
  const avatar=make('button',undefined,'author-trigger comment-avatar');avatar.type='button';avatar.setAttribute('aria-label','Abrir perfil de '+comment.author);avatar.append(avatarNode(comment.author,comment.avatar,isReply?28:36));avatar.onclick=()=>openProfile(cKey,comment.author,comment.avatar||'');
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
  const small=make('small',plural(c.membersCount||0,'participante','participantes'));if(c.visibility==='private')small.append(' · ',make('span','Privada'));info.append(make('strong',c.name),small);link.title=c.category?c.name+' · '+c.category:c.name;
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
const feedState=()=>feed;
// P\u00edlula "N novas publica\u00e7\u00f5es": aparece quando a atualiza\u00e7\u00e3o trouxe posts e a pessoa est\u00e1 rolada para baixo.
function paintNewPostsPill(fs){
 let pill=$('#opy-new-posts');const n=fs.pending?.length||0;
 if(!n){pill?.remove();return;}
 if(!pill){pill=make('button',undefined,'opy-new-posts');pill.id='opy-new-posts';pill.type='button';document.body.append(pill);pill.onclick=()=>{fs.posts=mergePage(fs.posts,fs.pending);fs.pending=[];window.scrollTo({top:0,behavior:'smooth'});render();};}
 pill.textContent='\u2191 '+plural(n,'nova publica\u00e7\u00e3o','novas publica\u00e7\u00f5es');
}
// "Pessoas para seguir": sugest\u00f5es com motivo (mesma comunidade, amizade em comum ou popular), entre as primeiras publica\u00e7\u00f5es.
function suggestionsRow(){
 const people=(state.directory||[]).filter(p=>p.suggested&&!p.own&&!p.following).slice(0,10);
 if(!people.length)return null;
 const sec=make('section',undefined,'opy-suggest');sec.setAttribute('aria-labelledby','opy-suggest-title');
 const head=make('div',undefined,'opy-suggest-head');const h=make('h2','Pessoas para seguir');h.id='opy-suggest-title';
 const close=make('button','\u2715','opy-suggest-close');close.type='button';close.setAttribute('aria-label','Fechar sugest\u00f5es por agora');close.onclick=()=>{suggestionsClosed=true;try{sessionStorage.setItem('opy_suggest_closed','1');}catch{}render();};
 head.append(h,close);
 const row=make('div',undefined,'opy-suggest-row');
 for(const p of people){
  const card=make('article',undefined,'opy-suggest-card');
  const who=make('button',undefined,'opy-suggest-who');who.type='button';who.onclick=()=>openProfile(p.key,p.name,p.avatar);
  who.append(avatarNode(p.name,p.avatar,64),make('strong',p.name),make('small',p.reason||''));
  card.append(who);
  const f=button('Seguir',()=>change({action:'follow',authorKey:p.key}),card);f.className='opy-primary opy-suggest-follow';
  row.append(card);
 }
 sec.append(head,row);return sec;
}
// Publica\u00e7\u00e3o aberta por link (/#post-<id>) fora da p\u00e1gina carregada: busca s\u00f3 ela e mostra no topo.
async function openHashPost(){
 const id=location.hash.startsWith('#post-')?location.hash.slice(6):'';
 if(!id||!$('#preview-feed'))return;
 const el=document.getElementById('post-'+id);if(el){el.scrollIntoView();return;}
 try{const d=await apiGet({view:'posts',id});if(d.posts[0]){feed.pinned=d.posts[0];render();document.getElementById('post-'+id)?.scrollIntoView({block:'start'});}else showError('Esta publica\u00e7\u00e3o n\u00e3o existe mais ou n\u00e3o est\u00e1 dispon\u00edvel para voc\u00ea.');}
 catch(e){showError(e.message);}
}
// Puxar para atualizar, s\u00f3 com toque e com a p\u00e1gina no topo.
function bindPullToRefresh(){
 if(!('ontouchstart' in window)||!$('#preview-feed'))return;
 let y0=0,pulling=false;
 const ind=make('div','Puxe para atualizar','opy-pull');ind.setAttribute('aria-hidden','true');document.body.append(ind);
 document.addEventListener('touchstart',e=>{pulling=window.scrollY<=0&&!busy&&!document.querySelector('dialog[open]');y0=e.touches[0].clientY;},{passive:true});
 document.addEventListener('touchmove',e=>{if(!pulling)return;const dy=e.touches[0].clientY-y0;if(dy<12){ind.classList.remove('is-on');return;}ind.classList.add('is-on');ind.style.setProperty('--pull',Math.min(80,dy*0.45)+'px');ind.textContent=dy>110?'Solte para atualizar':'Puxe para atualizar';},{passive:true});
 document.addEventListener('touchend',async e=>{if(!pulling)return;pulling=false;const dy=e.changedTouches[0].clientY-y0;if(dy>110){ind.textContent='Atualizando\u2026';ind.classList.add('is-busy');try{await refresh();toast('Feed atualizado');}finally{ind.classList.remove('is-busy','is-on');}}else ind.classList.remove('is-on');},{passive:true});
}
// Parâmetros do feed resolvidos no servidor; vazio = primeira página padrão, que já vem no snapshot.
function feedParams(saved){
 const p={};
 if(saved)p.feed='saved';else if(['following','discover','archive'].includes(view))p.feed=view;
 if(['photos','videos','audio','files'].includes(view))p.kind=view;
 if(view==='location')p.location=$('#feed-location-query')?.value||'';
 if(filter&&filter!=='all')p.origin=filter;
 return p;
}
async function loadMoreFeed(){
 const f=feedState();if(f.loading||!f.posts.length)return;f.loading=true;const key=f.key;const last=f.posts.at(-1);
 try{const d=await apiGet({view:'posts',...feedParams(document.body.dataset.previewRoute==='saved-posts'),before:last.createdAt,beforeId:last.id});if(f.key!==key)return;f.posts=mergePage(f.posts,d.posts);f.hasMore=d.hasMore;}
 finally{f.loading=false;}
 render();
}
// Comunicados da administração no topo do feed e atalho para o Centro de gestão de quem modera.
// Primeiros passos de quem chegou agora: some quando tudo está feito ou quando a pessoa fecha.
// Entra como primeiro cartão do feed (no lugar do esqueleto), para não empurrar a página quando os dados chegam.
function welcomeCard(){
 if(!state?.me)return null;
 const key='opy-welcome-closed-'+state.me.id;let closed=false;try{closed=localStorage.getItem(key)==='1';}catch{}
 const steps=[
  ['Coloque uma foto no perfil',!!state.me.avatar,'/perfil/'],
  ['Conte quem você é na apresentação',!!state.me.bio,'/perfil/'],
  ['Entre em uma comunidade',communitiesList().some(c=>c.joined&&c.id!=='avaliacao-casa-opy'),'/grupos/'],
  ['Siga 3 pessoas',(state.directory||[]).filter(p=>p.following).length>=3,()=>$('[data-feed-view="discover"]')?.click()],
  ['Faça sua primeira publicação',((state.directory||[]).find(p=>p.own)?.postsCount||0)>0||state.posts.some(p=>p.own),()=>{const t=$('#opy-compose textarea');t?.scrollIntoView({block:'center'});t?.focus();}]
 ];
 const done=steps.filter(s=>s[1]).length;
 if(closed||done===steps.length)return null;
 const box=make('section',undefined,'opy-welcome');box.id='opy-welcome';box.setAttribute('aria-labelledby','opy-welcome-title');box.dataset.sig=done+'|'+steps.map(s=>Number(s[1])).join('');
 const head=make('div',undefined,'opy-welcome-head');const h=make('h2',`Boas-vindas à Casa Opy, ${state.me.name.split(' ')[0]}`);h.id='opy-welcome-title';
 const close=make('button','✕','opy-welcome-close');close.type='button';close.setAttribute('aria-label','Fechar primeiros passos');close.onclick=()=>{try{localStorage.setItem(key,'1');}catch{}box.remove();};
 head.append(h,close);
 const bar=make('div',undefined,'opy-welcome-bar');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(steps.length));bar.setAttribute('aria-valuenow',String(done));bar.setAttribute('aria-label','Primeiros passos');const fill=make('span');fill.style.width=(done/steps.length*100)+'%';bar.append(fill);
 const list=make('ol',undefined,'opy-welcome-steps');
 for(const [label,ok,go] of steps){const li=make('li',undefined,ok?'is-done':'');const el=ok?make('span',label):typeof go==='string'?make('a',label):make('button',label);if(!ok){if(typeof go==='string')el.href=go;else{el.type='button';el.onclick=go;}}li.append(el);list.append(li);}
 box.replaceChildren(head,make('p',`${done} de ${steps.length} passos para aproveitar a rede.`,'opy-welcome-sub'),bar,list);
 return box;
}
function paintAnnouncements(){
 const staff=$('[data-opy-staff-links]');
 if(staff&&!staff.dataset.ready&&(state?.me?.role||state?.i18n?.translates?.length)){staff.dataset.ready='1';staff.hidden=false;const hr=make('hr');staff.append(hr);
  if(state.me.role){const a=make('a','Centro de gestão');a.href='/admin/';a.setAttribute('role','menuitem');staff.append(a);}
  if(state.i18n?.translates?.length){const a=make('a','Traduções');a.href='/admin/#traducoes';a.setAttribute('role','menuitem');staff.append(a);}}
 const liveLink=$('[data-opy-live-link]');if(liveLink)liveLink.hidden=!state?.liveEnabled;
 const feed=$('#preview-feed');if(!feed)return;
 let box=$('#opy-announcements');if(!box){box=make('div');box.id='opy-announcements';const host=$('.feed-chips')||feed;host.before(box);}
 box.replaceChildren(...(state.announcements||[]).map(a=>{const card=make('aside',undefined,'opy-announcement');card.setAttribute('aria-label','Comunicado');const body=make('div');body.append(make('strong',a.title),make('p',a.text));if(a.link){const l=make('a','Saiba mais');l.href=a.link;body.append(l);}const close=make('button','✕');close.type='button';close.setAttribute('aria-label','Fechar comunicado');close.onclick=()=>change({action:'announcement_dismiss',id:a.id}).catch(e=>showError(e.message));card.append(body,close);return card;}));
}
function profileKey(){
 if(document.body.dataset.previewRoute==='profile'){const u=new URLSearchParams(location.search).get('u');if(u)return u;}
 return state?.me?'id:'+state.me.id:'';
}
// Grade de fotos do perfil: tocar amplia (visualizador com navegação); a própria pessoa pode excluir cada foto, com confirmação.
function photoGrid(items,{manage=false}={}){
 const g=make('div',undefined,'pf-photos');const urls=items.map(i=>typeof i==='string'?i:i.url);
 items.forEach((it,i)=>{const item=typeof it==='string'?{url:it}:it;const cell=make('div',undefined,'pf-photo');const open=make('button',undefined,'pf-photo-open');open.type='button';open.setAttribute('aria-label','Ampliar foto '+(i+1)+' de '+items.length);
  const img=make('img');img.src=item.url;img.alt='Foto publicada';img.loading='lazy';open.append(img);open.onclick=()=>openLightbox(urls,i,item.author||'');cell.append(open);
  if(manage&&item.own&&item.postId){const del=make('button','Excluir','pf-photo-delete');del.type='button';del.setAttribute('aria-label','Excluir esta foto');del.onclick=async()=>{if(!confirm('Excluir esta foto? A publicação dela também sai do feed.'))return;del.disabled=true;try{await change({action:'delete',postId:item.postId});profileSignature='';renderProfile();}catch(e){showError(e.message);del.disabled=false;}};cell.append(del);}
  g.append(cell);});
 return g;
}
async function addProfilePhoto(input){
 let file=input.files[0];if(!file)return;
 try{file=await shrinkPhoto(file);if(file.size>2*1024*1024)throw Error('Escolha uma imagem de até 2 MB.');if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('A foto precisa ser PNG, JPG, GIF ou WebP.');
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(Error('Não foi possível ler a imagem.'));r.readAsDataURL(file);});
  await change({action:'publish',text:'',audience:'public',communityId:'',media:{name:file.name,data},file:null,location:''});profileData.key='';render();toast('Foto adicionada ao seu perfil.');}
 catch(e){showError(e.message);}finally{input.value='';}
}
function openProfileEdit(){const d=$('#profile-edit-dialog');if(d&&!d.open)d.showModal();}
let profileSignature='';
// Perfil no padrão de rede social: capa, foto, identidade, ações, abas e apresentação.
// Configurações da própria conta (missão "Conta e experiência", P2). Tudo o que muda aqui é aplicado no servidor;
// a acessibilidade (texto maior, menos movimento) é preferência do aparelho, aplicada antes da pintura por theme.js.
let settingsData=null,settingsLoading=false;
function prefGet(k,d){try{return localStorage.getItem(k)||d;}catch{return d;}}
function applyA11y(){const r=document.documentElement;r.dataset.text=prefGet('opy-text','normal');r.dataset.motion=prefGet('opy-motion','auto');}
let plansData=null;
async function loadSettings(){settingsLoading=true;try{const [a,p]=await Promise.all([apiGet({view:'account'}),apiGet({view:'plans'})]);settingsData=a;plansData=p;}catch(e){showError(e.message);}finally{settingsLoading=false;renderSettings();}}
async function accountChange(body,ok){try{const next=await change(body);if(next?.account)settingsData=next.account;if(next?.plans)plansData=next.plans;if(!next?.account&&!next?.plans)await loadSettings();if(ok)toast(ok);renderSettings();}catch(e){showError(e.message);}}
// Planos, verificação e impulsionamentos (P2/P3/P4): textos e formatos usados nas configurações e no diálogo de impulsionar.
const money=(cents,cur)=>{try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:cur||'BRL'}).format((cents||0)/100);}catch{return ((cents||0)/100).toFixed(2)+' '+(cur||'');}};
const dayBR=ts=>ts?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(ts)):'';
const STATUS_PT={ativo:'Ativo',aguardando_pagamento:'Aguardando pagamento',encerrado:'Encerrado',cancelado:'Cancelado',recusado:'Recusado',pendente:'Em análise',aprovado:'Aprovado',rejeitado:'Rejeitado'};
const BENEFIT_PT={ativo:'Disponível',bloqueado:'Indisponível na 2.0',pendente:'Em preparação',decisao:'Aguardando decisão',nao_se_aplica:'Não se aplica'};
function planCard(card,p){
 const c=card('Plano',undefined,'plano');const cur=p.current;
 const now=make('div',undefined,'set-plan-now');
 if(cur.id==='gratuito')now.append(make('strong','Conta gratuita'),make('small','Tudo o que a rede oferece hoje continua disponível sem custo.'));
 else{const chip=make('span',cur.nome,'pf-plan-chip');chip.style.setProperty('--plan',cur.cor||'#bd171c');now.append(chip);now.append(make('small',[cur.ativo?'Ativo':'Encerrado',cur.origem==='legado'?'herdado do Etnias 1.0':cur.origem==='teste'?'ativado em teste':'',cur.until?(cur.ativo?'válido até ':'terminou em ')+dayBR(cur.until):'vitalício'].filter(Boolean).join(' · ')));}
 c.append(now);
 const ben=make('ul',undefined,'set-benefits');for(const b of p.beneficios){const li=make('li');li.append(make('span',b.texto),make('small',BENEFIT_PT[b.estado]||b.estado,'is-'+b.estado));if(b.motivo)li.title=b.motivo;ben.append(li);}
 c.append(make('h3','Benefícios dos planos na 2.0'),ben);
 const list=make('div',undefined,'set-plans');
 for(const pl of p.planos){const box=make('div',undefined,'set-plan');box.style.setProperty('--plan',pl.cor);box.append(make('strong',pl.nome),make('small',(pl.impulsosPublicacoes?plural(pl.impulsosPublicacoes,'publicação impulsionada','publicações impulsionadas')+' ao mesmo tempo':'Sem impulsionamento de publicações')+' · '+(pl.periodo==='vitalicio'?'vitalício':'mensal')));
  if(p.contratacaoAberta){box.append(make('p',(pl.preco!=null?pl.moeda+' '+pl.preco:'')+(p.pagamentoTeste?' (ambiente de teste)':''),'set-plan-price'));const b=button('Contratar',()=>accountChange({action:'plan_request',planId:pl.id},'Pedido registrado. O plano é ativado quando o pagamento for confirmado.'),box);b.className='opy-primary';b.disabled=cur.ativo&&cur.id===pl.id||p.pedidos.some(r=>r.status==='aguardando_pagamento');}
  list.append(box);}
 c.append(make('h3','Planos do Etnias'),list);
 if(!p.contratacaoAberta)c.append(make('p','A contratação de planos está em definição: valores, moeda e forma de pagamento ainda vão ser aprovados. Nenhuma cobrança é feita pela rede neste momento.','set-desc'));
 if(p.pedidos.length){const ul=make('ul',undefined,'set-people');for(const r of p.pedidos){const li=make('li');const t=make('div');t.append(make('strong',r.nome+' · '+(STATUS_PT[r.status]||r.status)),make('small','Pedido em '+dayBR(r.createdAt)+(r.teste?' · teste':'')+(r.note?' · '+r.note:'')));li.append(t);if(r.status==='aguardando_pagamento'){const x=button('Cancelar pedido',()=>accountChange({action:'plan_request_cancel',requestId:r.id},'Pedido cancelado.'),li);x.className='preview-secondary';}ul.append(li);}c.append(make('h3','Seus pedidos'),ul);}
}
function verificationBlock(c,v){
 c.append(make('p',v.verificado?'✓ Perfil verificado pela equipe do Etnias.':'Perfil ainda não verificado.',v.verificado?'set-verified':'set-desc'));
 c.append(make('p',v.celularVerificado?'✓ Celular verificado.':'Celular não verificado. A confirmação por SMS ainda não está disponível; seu número nunca aparece no perfil.','set-desc'));
 if(v.verificado)return;
 const last=v.pedidos[0];
 if(last?.status==='pendente'){const row=make('div',undefined,'set-actions');row.append(make('p','Pedido de verificação em análise desde '+dayBR(last.createdAt)+'.','set-desc'));const x=button('Cancelar pedido',()=>accountChange({action:'verification_cancel'},'Pedido cancelado.'),row);x.className='preview-secondary';c.append(row);return;}
 if(last?.status==='rejeitado')c.append(make('p','Seu último pedido não foi aprovado: '+last.motivo,'set-desc'));
 const f=make('form',undefined,'set-verify');const l1=make('label','Por que seu perfil deve ser verificado?');const ta=make('textarea');ta.rows=3;ta.maxLength=600;ta.required=true;ta.placeholder='Ex.: sou liderança, artista ou comunicador(a) do meu povo e…';l1.append(ta);
 const l2=make('label','Link que confirme quem você é (opcional)');const li=make('input');li.type='url';li.maxLength=300;li.placeholder='https://';l2.append(li);
 const send=make('button','Pedir verificação','opy-primary');send.type='submit';f.append(l1,l2,send);
 f.onsubmit=async e=>{e.preventDefault();send.disabled=true;await accountChange({action:'verification_request',message:ta.value,link:li.value},'Pedido enviado para análise.');send.disabled=false;};
 c.append(f);
}
function boostsCard(card,fin){
 const c=card('Impulsionamentos e histórico financeiro','Resultados vêm só do que aconteceu de verdade: pessoas que viram a publicação patrocinada e interagiram com ela.','impulsos');
 const t=fin.totais;const sum=make('div',undefined,'set-money');
 for(const [label,v] of [['Investido',t.investidoCents],['Aguardando pagamento',t.aguardandoCents],...(t.testeCents?[['Pagamentos de teste',t.testeCents]]:[])]){const b=make('div');b.append(make('small',label),make('strong',money(v,t.moeda)));sum.append(b);}
 c.append(sum);
 if(!fin.pagamentoOnline)c.append(make('p',fin.pagamentoTeste?'Ambiente de teste: a equipe pode confirmar pagamentos de teste para ativar campanhas.':'Pagamento online ainda não está disponível: campanhas ficam aguardando pagamento e não aparecem no feed até serem confirmadas.','set-desc'));
 if(!fin.items.length)c.append(make('p','Você ainda não impulsionou publicações. Use o menu ⋯ de uma publicação sua.','pf-empty'));
 const ul=make('ul',undefined,'set-boosts');
 for(const b of fin.items){const li=make('li');const top=make('div',undefined,'set-boost-top');top.append(make('strong',b.excerpt),make('span',STATUS_PT[b.status]||b.status,'set-status is-'+b.status));li.append(top);
  const meta=[b.kind==='plano'?'Crédito do plano':money(b.budgetCents,b.currency)+' · '+plural(b.days,'dia','dias'),b.startAt?'início '+dayBR(b.startAt):'pedido '+dayBR(b.createdAt),b.endAt?'fim '+dayBR(b.endAt):'',b.endReason,b.test?'teste':''].filter(Boolean).join(' · ');
  li.append(make('small',meta));
  const r=b.results;const res=make('div',undefined,'set-results');for(const [k,v] of [['Alcance',r.alcance],['Visualizações',r.visualizacoes],['Engajamento',r.engajamento]]){const x=make('span');x.append(make('strong',String(v)),make('small',k));res.append(x);}li.append(res);
  if(b.status==='aguardando_pagamento'||(b.status==='ativo'&&b.kind==='plano')){const x=button(b.status==='ativo'?'Encerrar':'Cancelar',()=>accountChange({action:'boost_cancel',boostId:b.id},'Impulsionamento encerrado.'),li);x.className='preview-secondary';}
  ul.append(li);}
 c.append(ul);
 c.append(make('p','Impulsionar páginas: '+fin.paginas.motivo,'set-desc'));
}
async function openBoostDialog(post){
 let p;try{p=await apiGet({view:'plans'});}catch(e){showError(e.message);return;}
 const dlg=make('dialog');dlg.className='opy-dialog live-dialog boost-dialog';dlg.setAttribute('aria-label','Impulsionar publicação');
 dlg.append(make('h2','Impulsionar publicação'),make('p',(post.text||'Publicação com mídia').slice(0,120),'chat-hint'));
 const used=p.finance.items.filter(b=>b.kind==='plano'&&b.status==='ativo').length;
 const running=p.finance.items.find(b=>b.postId===post.id&&['ativo','aguardando_pagamento'].includes(b.status));
 if(running){dlg.append(make('p','Esta publicação já está '+(running.status==='ativo'?'impulsionada':'com uma campanha aguardando pagamento')+'. Acompanhe ou encerre no histórico.','set-desc'));const row0=make('div',undefined,'adm-dialog-actions');const h0=make('a','Ver histórico e resultados','preview-text-link');h0.href='/configuracoes/#impulsos';const c0=make('button','Fechar','preview-secondary');c0.type='button';c0.onclick=()=>dlg.close();row0.append(h0,c0);dlg.append(row0);dlg.addEventListener('close',()=>dlg.remove());document.body.append(dlg);dlg.showModal();return;}
 const go=async body=>{try{await change({...body,postId:post.id});dlg.close();toast(body.mode==='plano'?'Publicação impulsionada.':'Campanha criada. Ela aparece no feed quando o pagamento for confirmado.');}catch(e){showError(e.message);}};
 if(p.current.ativo&&p.current.impulsosPublicacoes){const box=make('section',undefined,'boost-option');box.append(make('h3','Usar o seu plano '+p.current.nome),make('p',`Você usa ${used} de ${p.current.impulsosPublicacoes} publicações impulsionadas ao mesmo tempo. Fica no ar até você encerrar.`,'set-desc'));const b=button('Impulsionar com o plano',()=>go({action:'boost_create',mode:'plano'}),box);b.className='opy-primary';b.disabled=used>=p.current.impulsosPublicacoes;dlg.append(box);}
 const camp=make('form',undefined,'boost-option');camp.append(make('h3','Campanha patrocinada'));
 const cur=p.finance.totais.moeda;const l1=make('label','Orçamento ('+cur+')');const amount=make('input');amount.type='number';amount.min='1';amount.max='10000';amount.step='1';amount.required=true;amount.value='20';l1.append(amount);
 const l2=make('label','Duração');const sel=make('select');for(const d of p.finance.duracoes)sel.append(new Option(plural(d,'dia','dias'),String(d)));sel.value='7';l2.append(sel);
 camp.append(l1,l2,make('p',p.finance.pagamentoTeste?'Ambiente de teste: a campanha é ativada quando a equipe confirmar um pagamento de teste.':'O pagamento online ainda não está disponível. A campanha fica aguardando pagamento e só aparece no feed depois de confirmada. Nada é cobrado agora.','set-desc'));
 const send=make('button','Criar campanha','opy-primary');send.type='submit';camp.append(send);camp.onsubmit=e=>{e.preventDefault();go({action:'boost_create',mode:'campanha',budget:Number(amount.value),days:Number(sel.value)});};
 dlg.append(camp);const row=make('div',undefined,'adm-dialog-actions');const hist=make('a','Ver histórico e resultados','preview-text-link');hist.href='/configuracoes/#impulsos';const close=make('button','Fechar','preview-secondary');close.type='button';close.onclick=()=>dlg.close();row.append(hist,close);dlg.append(row);
 dlg.addEventListener('close',()=>dlg.remove());document.body.append(dlg);dlg.showModal();
}
function radioGroup(name,legend,options,value,onPick){
 const fs=make('fieldset',undefined,'set-radios');fs.append(make('legend',legend));
 for(const [v,label,hint] of options){const l=make('label',undefined,'pf-radio');const r=make('input');r.type='radio';r.name=name;r.value=v;r.checked=v===value;r.onchange=()=>onPick(v);const t=make('span',label);if(hint)t.append(make('small',hint));l.append(r,t);fs.append(l);}
 return fs;
}
function personRow(p,actionLabel,onAction){
 const li=make('li',undefined,'set-person');li.append(avatarNode(p.name,p.avatar,36));const who=make('a',p.name);who.href='/perfil/?u='+encodeURIComponent(p.key);if(p.username)who.append(make('small','@'+p.username));li.append(who);
 if(actionLabel){const b=button(actionLabel,()=>onAction(p),li);b.className='preview-secondary';b.setAttribute('aria-label',actionLabel+' '+p.name);}
 return li;
}
function peopleList(list,empty,actionLabel,onAction){const ul=make('ul',undefined,'set-people');if(!list.length)ul.append(make('li',empty,'pf-empty'));for(const p of list)ul.append(personRow(p,actionLabel,onAction));return ul;}
function confirmPasswordDialog(title,text,confirmLabel,onConfirm){
 const dlg=make('dialog');dlg.className='opy-dialog live-dialog';dlg.setAttribute('aria-label',title);
 const form=make('form');form.method='dialog';form.append(make('h2',title),make('p',text,'chat-hint'));
 const l=make('label','Sua senha atual');const inp=make('input');inp.type='password';inp.required=true;inp.autocomplete='current-password';l.append(inp);
 const status=make('p',undefined,'preview-feedback');status.setAttribute('role','status');
 const row=make('div',undefined,'adm-dialog-actions');const go=make('button',confirmLabel,'pf-danger');go.type='submit';const cancel=make('button','Cancelar','preview-secondary');cancel.type='button';cancel.onclick=()=>dlg.close();row.append(go,cancel);
 form.append(l,status,row);dlg.append(form);
 form.onsubmit=async e=>{e.preventDefault();go.disabled=true;try{await onConfirm(inp.value);}catch(err){status.textContent=err.message;go.disabled=false;}};
 dlg.addEventListener('close',()=>dlg.remove());document.body.append(dlg);dlg.showModal();inp.focus();
}
async function leaveAccount(action,password,message){
 const res=await api({action,password});if(!res?.signedOut)throw Error('Não foi possível concluir. Tente de novo.');
 try{const list=JSON.parse(localStorage.getItem('opy-accounts')||'[]').filter(a=>a.username!==state.me.username);localStorage.setItem('opy-accounts',JSON.stringify(list));}catch{}
 try{sessionStorage.setItem('opy-left',message);}catch{}
 location.replace('/entrar/');
}
function renderSettings(){
 const root=$('#profile-page');if(!root||!state)return;
 if(!settingsData){if(!settingsLoading)loadSettings();root.replaceChildren(make('p','Carregando configurações…','pf-loading'));return;}
 const d=settingsData;const page=make('div',undefined,'set-page');page.append(make('h1','Configurações'));
 const card=(title,desc,id)=>{const c=make('section',undefined,'pf-card set-card');if(id)c.id=id;c.append(make('h2',title));if(desc)c.append(make('p',desc,'set-desc'));page.append(c);return c;};
 const priv=card('Privacidade','Vale para todo mundo, inclusive na busca e no feed.','privacidade');
 priv.append(radioGroup('set-profile','Quem pode ver seu perfil e suas publicações',[['public','Todas as pessoas da rede'],['friends','Só amizades','Quem não é amizade vê só seu nome, foto e apresentação.']],d.privacy.profile,v=>accountChange({action:'privacy_update',profile:v},'Privacidade atualizada.')));
 priv.append(radioGroup('set-messages','Quem pode mandar mensagem',[['everyone','Todas as pessoas da rede'],['friends','Só amizades']],d.privacy.messages,v=>accountChange({action:'privacy_update',messages:v},'Privacidade atualizada.')));
 const sess=card('Segurança','Troque a senha e saia de aparelhos que você não reconhece ou não usa mais.','seguranca');
 const pwRow=make('div',undefined,'set-actions');const pw0=button('Alterar senha',()=>openPasswordDialog(false),pwRow);pw0.className='preview-secondary';sess.append(pwRow,make('h3','Aparelhos conectados'));
 const ul=make('ul',undefined,'set-sessions');
 for(const x of d.sessions){const li=make('li');const info=make('div');info.append(make('strong',x.device+(x.current?' (este aparelho)':'')));if(x.createdAt)info.append(make('small','Entrou em '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(x.createdAt))));li.append(info);
  if(!x.current){const b=button('Sair deste aparelho',()=>accountChange({action:'session_revoke',sessionId:x.id},'O aparelho saiu da conta.'),li);b.className='preview-secondary';}
  ul.append(li);}
 sess.append(ul);
 if(d.sessions.length>1){const all=button('Sair de todos os outros aparelhos',()=>{if(confirm('Sair de todos os outros aparelhos? Só este continua conectado.'))accountChange({action:'sessions_revoke_others'},'Os outros aparelhos saíram da conta.');},sess);all.className='preview-secondary';}
 const fol=card('Seguidores','Quem segue você vê suas publicações no feed de "Seguindo".');
 fol.append(peopleList(d.followers,'Ninguém segue você ainda.','Remover',p=>{if(confirm('Remover '+p.name+' dos seus seguidores? A pessoa não é avisada.'))accountChange({action:'follower_remove',key:p.key},'Seguidor removido.');}));
 const fing=card('Seguindo');
 fing.append(peopleList(d.following,'Você ainda não segue ninguém.','Deixar de seguir',p=>accountChange({action:'follow',authorKey:p.key},'Você deixou de seguir '+p.name+'.')));
 const blk=card('Pessoas bloqueadas','Quem está bloqueado não vê seu perfil nem suas publicações, não manda mensagem e não pede amizade. A pessoa não é avisada.');
 blk.append(peopleList(d.blocked,'Você não bloqueou ninguém.','Desbloquear',p=>accountChange({action:'block_set',key:p.key,blocked:false},p.name+' foi desbloqueado(a).')));
 const look=card('Aparência','Preferência deste aparelho.','aparencia');
 look.append(radioGroup('set-theme','Tema',[['light','Dia'],['terra','Terra'],['dark','Noite']],['dark','terra'].includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:'light',v=>applyTheme(v)));
 const a11y=card('Acessibilidade','Preferências deste aparelho.');
 a11y.append(radioGroup('set-text','Tamanho do texto',[['normal','Normal'],['large','Grande']],prefGet('opy-text','normal'),v=>{try{localStorage.setItem('opy-text',v);}catch{}applyA11y();}));
 a11y.append(radioGroup('set-motion','Animações',[['auto','Seguir o aparelho'],['reduce','Reduzir movimento']],prefGet('opy-motion','auto'),v=>{try{localStorage.setItem('opy-motion',v);}catch{}applyA11y();}));
 if(plansData){planCard(card,plansData);boostsCard(card,plansData.finance);}
 const acc=card('Verificação e conta',undefined,'verificacao');
 if(plansData)verificationBlock(acc,plansData.verificacao);else acc.append(make('p',d.verified?'✓ Conta verificada pela equipe do Etnias.':'Perfil ainda não verificado.','set-desc'));
 const row=make('div',undefined,'set-actions');
 const off=button('Desativar conta',()=>confirmPasswordDialog('Desativar conta','Seu perfil, suas publicações e seus comentários somem da rede até você entrar de novo. Nada é apagado. Todos os aparelhos saem.','Desativar',p=>leaveAccount('account_deactivate',p,'Sua conta foi desativada. Para voltar, é só entrar de novo.')),row);off.className='preview-secondary';
 const del=button('Excluir conta',()=>confirmPasswordDialog('Excluir conta','A conta fica desativada agora e é excluída pela equipe depois de '+d.deletionGraceDays+' dias. Se mudar de ideia, entre de novo antes do prazo e o pedido é cancelado.','Pedir exclusão',p=>leaveAccount('account_delete_request',p,'Pedido de exclusão registrado. Se mudar de ideia, entre de novo em até '+d.deletionGraceDays+' dias.')),row);del.className='pf-danger';
 acc.append(row);
 root.replaceChildren(page);
 // Vindo do menu pessoal (Privacidade, Segurança, Verificação): leva à seção pedida uma vez.
 const target=location.hash.slice(1);if(target&&!renderSettings.scrolled){const el=document.getElementById(target);if(el){renderSettings.scrolled=true;el.scrollIntoView({block:'start'});el.querySelector('input,button')?.focus({preventScroll:true});}}
}
function renderProfile(){
 if(document.body.dataset.previewRoute==='setting')return renderSettings();
 const root=$('#profile-page');if(!root||!state)return;
 const key=profileKey();if(!key)return;
 const own=key==='id:'+state.me.id;
 if(profileData.key!==key){profileData.key=key;profileData.person=null;profileData.posts=[];profileData.hasMore=false;profileData.loading=true;profileSignature='';
  apiGet({view:'profile',key}).then(d=>{if(profileData.key!==key)return;profileData.person=d.person;profileData.posts=d.posts;profileData.hasMore=d.hasMore;profileData.loading=false;renderProfile();}).catch(e=>{profileData.loading=false;root.replaceChildren(emptyState(e.status===404?'Pessoa não encontrada':'Não foi possível carregar o perfil',e.status===404?'Este perfil não existe ou não está disponível.':e.message,[['Voltar ao feed','/']]));});
  return;
 }
 if(profileData.loading&&!profileData.person)return;
 const base=profileData.person||personByKey(key);
 const person=own?{...base,name:state.me.name,username:state.me.username,bio:state.me.bio,affiliation:state.me.affiliation,belonging:state.me.belonging,povo:state.me.povo,avatar:state.me.avatar,cover:state.me.cover,joinedAt:state.me.joinedAt,own:true}:base;
 const posts=profileData.posts;
 const photoItems=posts.flatMap(p=>[p.media?.kind==='image'?p.media.url:'',p.image||''].filter(Boolean).map(url=>({url,postId:p.id,own:p.own,author:p.author})));const photos=photoItems.map(i=>i.url);
 const comms=(state.communities||[]).filter(c=>own?c.joined:(c.members||[]).some(m=>m.key===key));
 const ea=$('#profile-edit-avatar');if(ea)ea.replaceChildren(avatarNode(state.me.name,state.me.avatar,72));
 const ec=$('#profile-edit-cover');if(ec){ec.replaceChildren();if(state.me.cover){const im=make('img');im.src=state.me.cover;im.alt='';ec.append(im);}}
 const signature=JSON.stringify([person,posts.map(p=>[p.id,p.reaction,p.comments?.length,p.saved,p.editedAt]),comms.map(c=>c.id),profileTab,profileData.hasMore]);
 if(signature===profileSignature)return;profileSignature=signature;
 document.title=person.name+' · Casa Opy';
 const cover=make('div',undefined,'pf-cover');
 if(person.cover){const img=make('img');img.src=person.cover;img.alt='Capa de '+person.name;cover.append(img);}
 if(own){const b=button('Editar capa',()=>$('#profile-cover-input').click(),cover);b.className='pf-cover-btn';}
 const head=make('div',undefined,'pf-head');
 const av=make('div',undefined,'pf-avatar');av.append(avatarNode(person.name,person.avatar,168));
 if(own){const b=button('',()=>$('#profile-avatar-input').click(),av);b.className='pf-avatar-btn';b.setAttribute('aria-label','Trocar foto do perfil');b.title='Trocar foto do perfil';}
 const id=make('div',undefined,'pf-id');const h1=make('h1',person.name);if(person.verified){const v=make('span','✓','opy-verified');v.setAttribute('role','img');v.setAttribute('aria-label','Conta verificada');h1.append(' ',v);}if(person.plan){const chip=make('span',person.plan.nome,'pf-plan-chip');chip.style.setProperty('--plan',person.plan.cor);chip.title='Plano '+person.plan.nome;h1.append(' ',chip);}id.append(h1);
 const meta=[person.username?'@'+person.username:(key.startsWith('name:')?'Pessoa do acervo Etnias':''),person.affiliation].filter(Boolean).join(' · ');
 if(meta)id.append(make('p',meta,'pf-meta'));
 const counts=make('p',undefined,'pf-counts');
 const count=(v,one,many)=>{const w=make('span');w.append(make('strong',String(v||0)),document.createTextNode(' '+((v||0)===1?one:many)));return w;};
 counts.append(count(person.postsCount??posts.length,'publicação','publicações'),count(person.followersCount,'seguidor','seguidores'),count(person.followingCount,'seguindo','seguindo'),count(person.friendsCount,'amigo','amigos'));
 id.append(counts);
 const actions=make('div',undefined,'pf-actions');
 if(own){const e=button('Editar perfil',openProfileEdit,actions);e.className='opy-primary';}
 else{
  const liveOn=(state.lives||[]).find(l=>l.authorKey===key);if(liveOn){const w=button('Assistir ao vivo',()=>openLiveViewer({id:liveOn.postId,author:person.name,avatar:person.avatar,live:{format:liveOn.format}}),actions);w.className='opy-primary live-profile-btn';}
  const f=button(person.following?'Seguindo':'Seguir',()=>change({action:'follow',authorKey:key}),actions);f.className=person.following?'preview-secondary':'opy-primary';f.setAttribute('aria-pressed',String(!!person.following));
  if(key.startsWith('id:')){
   const m=button('Mensagem',()=>openPrivateChat(key),actions);m.className='preview-secondary';
   const fr=button(friendLabel(person.friendStatus),()=>change({action:'friend',authorKey:key}),actions);fr.className='preview-secondary';fr.setAttribute('aria-pressed',String(person.friendStatus==='friends'));
   const bl=button('Bloquear',async()=>{if(!confirm('Bloquear '+person.name+'? Vocês deixam de se ver na rede, a amizade e o seguir são desfeitos. A pessoa não é avisada. Dá para desbloquear em Configurações.'))return;try{await change({action:'block_set',key,blocked:true});toast(person.name+' foi bloqueado(a).');location.href='/';}catch(e){showError(e.message);}},actions);bl.className='preview-secondary pf-block';
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
 if(photos.length){const pc=make('section',undefined,'pf-card');const h=make('div',undefined,'pf-card-head');h.append(make('h2','Fotos'));const more=button('Ver todas',()=>{profileTab='photos';renderProfile();},h);more.className='pf-link';pc.append(h,photoGrid(photoItems.slice(0,9)));side.append(pc);}
 const main=make('div',undefined,'pf-main');
 if(profileTab==='posts'){
  if(own){const c=make('a',undefined,'pf-compose');c.href='/#opy-compose';c.append(avatarNode(person.name,person.avatar,40),make('span','No que você está pensando?'));main.append(c);}
  main.append(...posts.map(p=>renderPost(p)));
  if(!posts.length)main.append(make('p',own?'Você ainda não publicou. Sua primeira publicação aparece aqui.':'Nenhuma publicação visível para você.','pf-card pf-empty'));
  if(profileData.hasMore){const more=button('Ver publicações anteriores',async()=>{const last=posts.at(-1);const d=await apiGet({view:'profile',key,before:last.createdAt,beforeId:last.id});if(profileData.key!==key)return;profileData.posts=mergePage(profileData.posts,d.posts);profileData.hasMore=d.hasMore;profileSignature='';renderProfile();},main);more.className='feed-more';}
 }else if(profileTab==='about'){
  const c=make('section',undefined,'pf-card');c.append(make('h2','Sobre'));const dl=make('dl',undefined,'pf-about');
  const row=(t,v)=>{if(v)dl.append(make('dt',t),make('dd',v));};
  row('Nome',person.name);row('Usuário',person.username?'@'+person.username:'');row('Pertencimento',person.belonging==='indigena'?'Indígena'+(person.povo?' · '+person.povo:''):person.belonging==='nao_indigena'?'Não indígena':'');row('Povo, território ou organização',person.affiliation);row('Apresentação',person.bio);
  row('Na rede desde',person.joinedAt?new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(person.joinedAt)):'');
  c.append(dl);main.append(c);
 }else if(profileTab==='photos'){
  const c=make('section',undefined,'pf-card');const head=make('div',undefined,'pf-card-head');head.append(make('h2','Fotos'));
  if(own){const lab=make('label','Adicionar foto','preview-secondary pf-file');const inp=make('input');inp.type='file';inp.accept='image/jpeg,image/png,image/webp,image/gif';inp.hidden=true;inp.onchange=()=>addProfilePhoto(inp);lab.append(inp);head.append(lab);}
  c.append(head,photos.length?photoGrid(photoItems,{manage:own}):make('p',own?'Você ainda não publicou fotos. Toque em "Adicionar foto".':'Nenhuma foto publicada.','pf-empty'));main.append(c);
 }else{
  const c=make('section',undefined,'pf-card');c.append(make('h2','Comunidades'));
  if(!comms.length)c.append(make('p',own?'Você ainda não participa de comunidades.':'Nenhuma comunidade pública.','pf-empty'));
  const ul=make('ul',undefined,'pf-comms');for(const cm of comms){const li=make('li');const a=make('a',cm.name);a.href='/grupos/?c='+encodeURIComponent(cm.id);li.append(a,make('small',[cm.category,(cm.membersCount||0)+' participantes'].filter(Boolean).join(' · ')));ul.append(li);}c.append(ul);main.append(c);
 }
 if(person.locked){const lock=make('section',undefined,'pf-card pf-locked');lock.append(make('h2','Perfil visível só para amizades'),make('p',person.name+' mostra publicações, fotos e comunidades só para amizades. Peça amizade para ver.','pf-empty'));root.replaceChildren(top,lock);return;}
 const body=make('div',undefined,'pf-body');body.append(side,main);
 root.replaceChildren(top,body);
}
function openProfile(key){
 if(!key)return;
 location.href=state?.me&&key==='id:'+state.me.id?'/conta/':'/perfil/?u='+encodeURIComponent(key);
}
async function uploadProfileMedia(kind,input){
 let file=input.files[0];if(!file)return;const st=$('#profile-edit-status');
 try{
  file=await shrinkPhoto(file);
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
     const lbl=make('label','Procure a pessoa pelo nome ou usuário');
     const q=make('input');q.type='search';q.name='q';q.autocomplete='off';q.placeholder='Nome, @usuário ou povo';lbl.append(q);
     const hidden=make('input');hidden.type='hidden';hidden.name='memberKey';
     const list=make('div',undefined,'invite-results');list.setAttribute('role','listbox');
     let timer;q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{const term=q.value.trim();if(term.length<2){list.replaceChildren();return;}try{const d=await apiGet({view:'search',q:term,excludeCommunity:current.id});list.replaceChildren(...d.people.filter(p=>!p.own).map(p=>{const b=make('button',undefined,'community-person');b.type='button';b.setAttribute('role','option');b.append(avatarNode(p.name,p.avatar,32),make('strong',p.name+(p.username?' · @'+p.username:'')));b.onclick=()=>{hidden.value=p.key;all('.community-person',list).forEach(x=>x.setAttribute('aria-selected',String(x===b)));};return b;}));if(!d.people.length)list.append(make('p','Ninguém com esse nome fora da comunidade.'));}catch(e){showError(e.message);}},250);});
     body.append(lbl,hidden,list);
    },async form=>{
     const key=form.elements.memberKey?.value;if(!key){showError('Escolha uma pessoa na lista.');return;}
     await change({action:'community_invite',communityId:current.id,memberKey:key});
    });
   },actionBar);
  }
  const reportBtn=button('Denunciar',()=>{
   openCommunityDialog('Denunciar comunidade '+current.name,'Registrar denúncia',body=>{
    const lbl=make('label','Descreva o motivo da denúncia para revisão da moderação');
    const ta=make('textarea');ta.name='reason';ta.required=true;ta.minLength=5;ta.maxLength=500;ta.rows=3;ta.placeholder='Ex.: Descumprimento das regras de convivência ou exposição indevida…';
    lbl.append(ta);body.append(lbl);
   },async form=>{
    await change({action:'community_report',communityId:current.id,reason:form.elements.reason.value});
   });
  },actionBar);reportBtn.className='post-delete';
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
    if(communityPosts.id!==current.id){communityPosts.id=current.id;communityPosts.posts=[];communityPosts.hasMore=false;communityPosts.loading=true;apiGet({view:'posts',community:current.id}).then(d=>{if(communityPosts.id!==current.id)return;communityPosts.posts=d.posts;communityPosts.hasMore=d.hasMore;communityPosts.loading=false;renderCommunities();}).catch(e=>{communityPosts.loading=false;showError(e.message);});}
    const cPosts=communityPosts.posts;
    if(cPosts.length)panel.append(...cPosts.map(p=>renderPost(p,current)));
    else if(communityPosts.loading)panel.append(make('p','Carregando publicações…','pf-empty'));
    else panel.append(emptyState('Nenhuma publicação ainda','Seja a primeira pessoa a compartilhar algo com esta comunidade.'));
    if(communityPosts.hasMore){const more=button('Ver publicações anteriores',async()=>{const last=cPosts.at(-1);const d=await apiGet({view:'posts',community:current.id,before:last.createdAt,beforeId:last.id});if(communityPosts.id!==current.id)return;communityPosts.posts=mergePage(communityPosts.posts,d.posts);communityPosts.hasMore=d.hasMore;renderCommunities();},panel);more.className='feed-more';}
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
   const jLabel=c.joined?(c.id==='avaliacao-casa-opy'?'Sair da comunidade':'Participando ✓'):isPending?'Pedido enviado':isPrivate?'Pedir entrada':'Participar';
   const jBtn=button(jLabel,()=>joinCommunity(c),foot);
   jBtn.className=c.joined||isPending?'preview-secondary':'opy-primary';
   jBtn.setAttribute('aria-pressed',String(c.joined));
   if(c.id==='avaliacao-casa-opy')jBtn.dataset.communityJoin='';
   card.append(top,desc,foot);
   return card;
  }));
  if(!items.length)grid.append(emptyState('Nenhuma comunidade neste filtro','Tente outra categoria ou crie uma comunidade para reunir quem compartilha esse tema.',[['Criar comunidade',()=>$('#community-create-open')?.click()]]));
 }
}
// Tema claro/escuro (preferência guardada no aparelho; preview/theme.js aplica antes da pintura).
function applyTheme(theme){document.documentElement.dataset.theme=theme;try{localStorage.setItem('opy-theme',theme);}catch{}$('#opy-theme-toggle')?.setAttribute('aria-checked',String(theme==='dark'));$('meta[name=theme-color]')?.setAttribute('content',{dark:'#101c20',terra:'#f4ede4'}[theme]||'#ffffff');}
$('#opy-theme-toggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
$('#opy-theme-toggle')?.setAttribute('aria-checked',String(document.documentElement.dataset.theme==='dark'));
// Contas deste aparelho (só nome, @ e foto; nunca senha): trocar exige entrar de novo, por segurança.
const knownAccounts=()=>{try{return JSON.parse(localStorage.getItem('opy-accounts')||'[]');}catch{return [];}};
function rememberAccount(me){if(!me?.username)return;const list=knownAccounts().filter(a=>a.username!==me.username);list.unshift({username:me.username,name:me.name,avatar:me.avatar||''});try{localStorage.setItem('opy-accounts',JSON.stringify(list.slice(0,6)));}catch{}}
function openSwitchAccount(){
 const dlg=make('dialog');dlg.className='opy-dialog live-dialog';dlg.setAttribute('aria-label','Trocar de conta');
 dlg.append(make('h2','Trocar de conta'),make('p','A conta atual sai e você entra na outra com a senha dela. Nada fica misturado: cada conta tem suas mensagens e avisos.','chat-hint'));
 const list=make('ul',undefined,'opy-switch-list');const others=knownAccounts().filter(a=>a.username!==state.me.username);
 if(!others.length)list.append(make('li','Nenhuma outra conta usada neste aparelho ainda.','chat-list-empty'));
 for(const a of others){const li=make('li');li.append(avatarNode(a.name,a.avatar,36));const who=make('strong',a.name);who.append(make('small','@'+a.username));li.append(who);
  const go=button('Entrar',async()=>{await api({action:'logout'});location.replace('/entrar/?user='+encodeURIComponent(a.username));},li);go.className='opy-primary';
  const rm=button('Remover',()=>{try{localStorage.setItem('opy-accounts',JSON.stringify(knownAccounts().filter(x=>x.username!==a.username)));}catch{}li.remove();},li);rm.setAttribute('aria-label','Remover '+a.name+' deste aparelho');list.append(li);}
 dlg.append(list);const row=make('div',undefined,'adm-dialog-actions');
 const add=button('Adicionar outra conta',async()=>{await api({action:'logout'});location.replace('/entrar/');},row);add.className='opy-primary';
 const close=make('button','Fechar','preview-secondary');close.type='button';close.onclick=()=>dlg.close();row.append(close);dlg.append(row);
 dlg.addEventListener('close',()=>dlg.remove());document.body.append(dlg);dlg.showModal();
}
$('#opy-switch-account')?.addEventListener('click',openSwitchAccount);
// Atalhos que o cabeçalho abre por endereço (Recursos e menu pessoal): uma vez, depois da primeira carga; o # sai do endereço.
// Celular: o botão Postagem da barra de baixo abre a tela Criar (Publicação · Story · Live), como o + do Instagram.
document.addEventListener('click',e=>{const link=e.target.closest('[data-opy-compose]');if(!link||!window.OpyCreator||!matchMedia('(max-width:700px)').matches||document.body.dataset.previewRoute!=='home')return;e.preventDefault();e.stopImmediatePropagation();window.OpyCreator.open('post');},true);
function handleHashActions(){
 const h=location.hash,route=document.body.dataset.previewRoute;let done=true;
 if(route==='home'&&h==='#criar'){const t=$('#preview-text');t?.scrollIntoView({block:'center'});t?.focus({preventScroll:true});}
 else if(route==='home'&&h==='#criar-story')window.OpyCreator?window.OpyCreator.open('story'):$('#compose-story-open')?.click();
 else if(route==='home'&&h==='#criar-live')window.OpyCreator?window.OpyCreator.open('live'):$('[data-compose-tool="live"]')?.click();
 else if(route==='home'&&h==='#opy-compose'&&matchMedia('(max-width:700px)').matches&&window.OpyCreator)window.OpyCreator.open('post');
 else if(route==='suggested-groups'&&h==='#criar')$('#community-create-open')?.click();
 else if(route==='account'&&h==='#editar')openProfileEdit();
 else done=false;
 if(done)history.replaceState(null,'',location.pathname+location.search);
}
// Pesquisa do cabeçalho: sugestões reais do serviço de busca existente (pessoas e publicações), teclado e "ver todos".
(function(){
 const input=$('#opy-search-query'),box=$('#opy-search-results'),form=$('#opy-search');if(!input||!box||!form)return;
 let timer=0,seq=0;
 const options=()=>all('a',box);
 const hide=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
 const select=i=>{const list=options();list.forEach((a,j)=>a.setAttribute('aria-selected',String(j===i)));if(list[i]){input.setAttribute('aria-activedescendant',list[i].id);list[i].scrollIntoView({block:'nearest'});}};
 async function suggest(){
  const q=input.value.trim();if(q.length<2){hide();return;}
  const mine=++seq;let d;try{d=await apiGet({view:'search',q});}catch{return;}if(mine!==seq)return;
  const nodes=[];
  (d.people||[]).slice(0,5).forEach((p,i)=>{const a=make('a');a.id='opy-sug-'+i;a.href='/perfil/?u='+encodeURIComponent(p.key);a.setAttribute('role','option');a.append(avatarNode(p.name,p.avatar,32));const t=make('span',p.name);t.append(make('small',p.username?'@'+p.username:(p.affiliation||'Pessoa')));a.append(t);nodes.push(a);});
  if(!nodes.length)nodes.push(make('p','Nenhuma pessoa com esse nome. Veja publicações e comunidades em "Ver todos os resultados".'));
  const all_=make('a','Ver todos os resultados para “'+q+'”','opy-search-all');all_.id='opy-sug-all';all_.href='#';all_.setAttribute('role','option');all_.onclick=e=>{e.preventDefault();form.requestSubmit();};nodes.push(all_);
  box.replaceChildren(...nodes);box.hidden=false;input.setAttribute('aria-expanded','true');
 }
 // Termo preservado: a página de resultados é estática, então o campo recebe o termo pelo endereço.
 const fromUrl=new URLSearchParams(location.search).get('query');if(fromUrl&&!input.value){input.value=fromUrl.slice(0,200);const c=$('.opy-search-clear');if(c)c.hidden=false;}
 input.setAttribute('role','combobox');input.setAttribute('aria-expanded','false');
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(suggest,220);});
 input.addEventListener('focus',()=>{if(input.value.trim().length>=2)suggest();});
 input.addEventListener('keydown',e=>{
  if(box.hidden)return;const list=options();const cur=list.findIndex(a=>a.getAttribute('aria-selected')==='true');
  if(e.key==='ArrowDown'){e.preventDefault();select((cur+1)%list.length);}
  else if(e.key==='ArrowUp'){e.preventDefault();select((cur-1+list.length)%list.length);}
  else if(e.key==='Enter'&&cur>=0){e.preventDefault();list[cur].click();}
 });
 document.addEventListener('click',e=>{if(!form.contains(e.target))hide();});
})();
// Botão de conexões no cabeçalho (como no Etnias antigo): pedidos de amizade com Aceitar/Recusar e pessoas para seguir.
function paintRequests(){
 const box=$('[data-opy-requests]'),toggle=$('.opy-requests-toggle');if(!box||!toggle||!state)return;
 const people=state.directory||[];
 const incoming=people.filter(p=>p.friendStatus==='incoming');
 const suggest=people.filter(p=>p.suggested&&!p.following&&p.friendStatus==='none').slice(0,5);
 let badge=$('.opy-header-badge',toggle);
 if(incoming.length){if(!badge){badge=make('span',undefined,'opy-header-badge');toggle.append(badge);}badge.textContent=incoming.length>99?'99+':String(incoming.length);toggle.setAttribute('aria-label',`Solicitações e pessoas para seguir (${plural(incoming.length,'pedido','pedidos')} de amizade)`);}
 else{badge?.remove();toggle.setAttribute('aria-label','Solicitações e pessoas para seguir');}
 const sig=JSON.stringify([incoming.map(p=>p.key),suggest.map(p=>[p.key,p.following])]);if(box.dataset.sig===sig)return;box.dataset.sig=sig;
 const row=(p,actions)=>{const li=make('div',undefined,'opy-req-row');const who=make('a',undefined,'opy-req-who');who.href='/perfil/?u='+encodeURIComponent(p.key);who.append(avatarNode(p.name,p.avatar,40));const t=make('span');t.append(make('strong',p.name),make('small',p.reason||(p.username?'@'+p.username:p.affiliation||'')));who.append(t);li.append(who,actions);return li;};
 const act=(label,cls,fn)=>{const b=make('button',label,cls);b.type='button';b.dataset.keepOpen='1';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){showError(e.message);b.disabled=false;}};return b;};
 const nodes=[make('p','Pedidos de amizade','opy-pop-title')];
 if(!incoming.length)nodes.push(make('p','Nenhum pedido no momento.','opy-req-empty'));
 for(const p of incoming){const a=make('div',undefined,'opy-req-actions');a.append(act('Aceitar','opy-primary',()=>change({action:'friend',authorKey:p.key})),act('Recusar','preview-secondary',()=>change({action:'friend_decline',authorKey:p.key})));nodes.push(row(p,a));}
 if(suggest.length){nodes.push(make('p','Pessoas para seguir','opy-pop-title'));for(const p of suggest){const a=make('div',undefined,'opy-req-actions');a.append(act('Seguir','opy-primary',()=>change({action:'follow',authorKey:p.key})));nodes.push(row(p,a));}}
 const all_=make('a','Encontrar mais pessoas','opy-req-more');all_.href='/search/';nodes.push(all_);
 box.replaceChildren(...nodes);
}
const boostSeen=new Set();
const boostObserver='IntersectionObserver' in window?new IntersectionObserver(entries=>{for(const en of entries){const id=en.target.dataset.boost;if(!id||boostSeen.has(id))continue;
 if(en.isIntersecting){en.target._boostTimer=setTimeout(()=>{if(boostSeen.has(id))return;boostSeen.add(id);boostObserver.unobserve(en.target);api({action:'boost_seen',boostId:id}).catch(()=>{});},1000);}else clearTimeout(en.target._boostTimer);}},{threshold:0.5}):null;
function watchSponsored(){if(!boostObserver)return;all('[data-boost]').forEach(el=>{if(!boostSeen.has(el.dataset.boost)&&!el._boostWatched){el._boostWatched=true;boostObserver.observe(el);}});}
// Áreas do menu OPY (Blogs, Páginas, Mercado, Eventos, Filmes, Empregos, Coletas) com o conteúdo recuperado do Etnias 1.0.
// Leitura do que já existia; as ações reais (conversar com quem vende, candidatar-se, salvar na agenda) usam o que a 2.0 já tem.
const AREA_META={
 blogs:{titulo:'Blogs',sub:'Textos e artigos da comunidade',vazio:'Nenhum texto encontrado.'},
 paginas:{titulo:'Páginas',sub:'Projetos, coletivos e instituições',vazio:'Nenhuma página encontrada.'},
 mercado:{titulo:'Mercado',sub:'Artesanato, saberes e serviços da rede',vazio:'Nenhum item encontrado.'},
 eventos:{titulo:'Eventos',sub:'Agenda de encontros e atividades',vazio:'Nenhum evento encontrado.'},
 filmes:{titulo:'Filmes',sub:'Produções audiovisuais indígenas',vazio:'Nenhum filme encontrado.'},
 empregos:{titulo:'Empregos',sub:'Oportunidades de trabalho',vazio:'Nenhuma vaga encontrada.'},
 coletas:{titulo:'Coleta',sub:'Campanhas e iniciativas da comunidade',vazio:'Nenhuma campanha encontrada.'}
};
const areaDate=v=>{if(!v)return '';const d=typeof v==='number'?new Date(v):new Date(String(v).replace(' ','T'));return isNaN(d)?'':new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',...(typeof v==='string'&&/\d:\d/.test(v)&&!/00:00:00$/.test(v)?{timeStyle:'short'}:{})}).format(d);};
const areaMoney=(v,cur)=>{try{return new Intl.NumberFormat('pt-BR',{style:'currency',currency:cur||'BRL'}).format(v||0);}catch{return (v||0)+' '+(cur||'');}};
const areaCover=x=>x.cover||x.image||(x.images&&x.images[0])||x.avatar||'';
function areaLink(type,extra){const u=new URL(location.href);for(const [k,v] of Object.entries(extra)){if(v)u.searchParams.set(k,v);else u.searchParams.delete(k);}return u.pathname+u.search;}
function areaAuthor(a,label){const box=make('div',undefined,'area-author');if(!a){box.append(make('small','Publicado no Etnias 1.0'));return box;}const link=make('a',undefined,'area-author-link');link.href='/perfil/?u='+encodeURIComponent(a.key);link.append(avatarNode(a.name,a.avatar,32),make('span',(label?label+' ':'')+a.name));box.append(link);return box;}
// Títulos e textos escritos pelas pessoas não passam pela tradução automática da interface.
const noI18n=el=>{el.dataset.noI18n='';return el;};
function renderArea(root){
 const type=root.dataset.area,meta=AREA_META[type];if(!meta)return;
 const params=new URLSearchParams(location.search),id=params.get('id')||'',q=params.get('q')||'',cat=params.get('categoria')||'';
 // Mercado: ?anunciar=novo abre o formulário de anúncio; ?anunciar=ID edita um anúncio próprio.
 const sell=type==='mercado'?params.get('anunciar')||'':'',target=sell&&sell!=='novo'?sell:id;
 const key=[type,id,q,cat,sell].join('|');if(root.dataset.key===key)return;root.dataset.key=key;
 apiGet({view:'area',type,...(target?{id:target}:{}),...(q?{q}:{}),...(cat?{category:cat}:{})}).then(d=>{if(root.dataset.key!==key)return;root.replaceChildren(sell?marketForm(d,sell!=='novo'):id?areaDetail(type,meta,d):areaList(type,meta,d,q,cat));if(id)document.title=d.item.title+' · Etnias';}).catch(e=>{root.replaceChildren(emptyState('Não foi possível abrir',e.message,[['Voltar para '+meta.titulo,location.pathname]]));});
}
function areaList(type,meta,d,q,cat){
 const box=make('div',undefined,'area-list');
 const head=make('header',undefined,'area-head');head.append(make('p',meta.sub+' · '+plural(d.total,'item','itens')+' recuperados do Etnias 1.0','area-sub'));
 const f=make('form',undefined,'area-search');f.setAttribute('role','search');const i=make('input');i.type='search';i.name='q';i.value=q;i.placeholder='Buscar em '+meta.titulo;i.setAttribute('aria-label','Buscar em '+meta.titulo);const b=make('button','Buscar','preview-secondary');b.type='submit';f.append(i,b);
 f.onsubmit=e=>{e.preventDefault();location.href=areaLink(type,{q:i.value.trim(),categoria:'',id:''});};head.append(f);
 if(type==='mercado'){const add=make('a','Anunciar no Mercado','opy-primary area-new');add.href=areaLink(type,{anunciar:'novo',id:'',q:'',categoria:''});head.append(add);}
 if(d.categories.length>1){const chips=make('nav',undefined,'area-chips');chips.setAttribute('aria-label','Categorias');for(const c of ['',...d.categories]){const a=make('a',c||'Todas','area-chip');a.href=areaLink(type,{categoria:c,id:''});if(c===cat)a.setAttribute('aria-current','true');chips.append(a);}head.append(chips);}
 box.append(head);
 if(!d.items.length){box.append(emptyState(meta.vazio,q?'Tente outra palavra.':'Ainda não há itens nesta área.',[]));return box;}
 const grid=make('div',undefined,'area-grid area-grid-'+type);
 for(const x of d.items){const a=make('a',undefined,'area-card');a.href=areaLink(type,{id:String(x.id),q:'',categoria:''});
  const cover=areaCover(x);const fig=make('div',undefined,'area-card-cover');const noCover=()=>{fig.classList.add('is-empty');fig.replaceChildren(make('span',(x.title||'?').trim().slice(0,1).toLocaleUpperCase('pt-BR'),'area-card-initial'));};if(cover){const img=make('img');img.src=cover;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=noCover;fig.append(img);}else noCover();
  if(type==='mercado'&&x.sold)fig.append(make('span','Vendido','area-badge'));if(type==='empregos'&&!x.open)fig.append(make('span','Encerrada','area-badge'));
  const body=make('div',undefined,'area-card-body');
  const line=type==='mercado'?(x.member?x.price:areaMoney(x.price,x.currency)):type==='eventos'?areaDate(x.start):type==='coletas'?'Meta '+areaMoney(x.goal,'BRL'):type==='filmes'?[x.genre,x.release].filter(Boolean).join(' · '):type==='empregos'?[x.type,x.location].filter(Boolean).join(' · '):[x.category,x.createdAt?areaDate(x.createdAt):''].filter(Boolean).join(' · ');
  if(line)body.append(noI18n(make('small',line,'area-card-meta')));body.append(noI18n(make('strong',x.title)));if(x.excerpt)body.append(noI18n(make('p',x.excerpt,'area-card-excerpt')));
  if(x.rating?.count)body.append(make('small',marketStars(x.rating),'area-card-rating'));
  if(x.author)body.append(make('small',x.author.name,'area-card-who'));
  a.append(fig,body);grid.append(a);}
 box.append(grid,make('p',type==='mercado'?'Anúncios dos membros aparecem primeiro; os demais foram recuperados do Etnias 1.0. Não há pagamento pelo site: combine direto com quem vende, pelo chat.':'Conteúdo recuperado do Etnias 1.0. Publicar novos itens nesta área chega numa próxima etapa da 2.0.','area-note'));
 return box;
}
function areaICS(x){
 const p=v=>{const d=new Date(String(v).replace(' ','T'));return isNaN(d)?null:d;};const s=p(x.start),e=p(x.end)||(s&&new Date(s.getTime()+2*3600e3));if(!s)return null;
 const f=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const esc=t=>String(t||'').replace(/[\\,;]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Etnias//Eventos//PT','BEGIN:VEVENT','UID:evento-'+x.id+'@etnias.site','DTSTAMP:'+f(new Date()),'DTSTART:'+f(s),'DTEND:'+f(e),'SUMMARY:'+esc(x.title),'LOCATION:'+esc(x.location),'DESCRIPTION:'+esc(x.description.slice(0,800)),'END:VEVENT','END:VCALENDAR'].join('\r\n');
 return URL.createObjectURL(new Blob([body],{type:'text/calendar'}));
}
function areaDetail(type,meta,d){
 const x=d.item,a=d.author;const box=make('article',undefined,'area-detail area-detail-'+type);
 const back=make('a','← '+meta.titulo,'area-back');back.href=location.pathname;box.append(back);
 const cover=type==='mercado'?'':(x.cover||x.image||'');
 if(type==='filmes'&&x.youtube)box.append(youtubeCard(x.youtube,x.title));
 else if(cover){const img=make('img',undefined,'area-cover');img.src=cover;img.alt='';box.append(img);}
 if(type==='mercado'&&x.images.length){const g=make('div',undefined,'area-gallery');x.images.forEach((u,k)=>{const b=make('button',undefined,'area-thumb');b.type='button';b.setAttribute('aria-label','Ampliar foto '+(k+1)+' de '+x.images.length);const img=make('img');img.src=u;img.alt='';b.append(img);b.onclick=()=>openLightbox(x.images,k,a?.name||'');g.append(b);});box.append(g);}
 const head=make('header',undefined,'area-detail-head');
 if(type==='paginas'&&x.avatar){const av=make('img',undefined,'area-page-avatar');av.src=x.avatar;av.alt='';head.append(av);}
 const h=noI18n(make('h1',x.title));if(type==='paginas'&&x.verified){const v=make('span','✓','opy-verified');v.setAttribute('role','img');v.setAttribute('aria-label','Página verificada');h.append(' ',v);}head.append(h);
 const facts=[];
 if(type==='blogs')facts.push(x.category,areaDate(x.createdAt),x.views?plural(x.views,'leitura','leituras'):'');
 if(type==='paginas')facts.push(x.category);
 if(type==='mercado')facts.push(x.member?x.price:areaMoney(x.price,x.currency),x.member?'':x.condition==='usado'?'Usado':'Novo',x.location,x.category,x.sold?'Vendido':'');
 if(type==='eventos')facts.push((areaDate(x.start)||'')+(x.end&&x.end!==x.start?' até '+areaDate(x.end):''),x.location);
 if(type==='filmes')facts.push(x.genre,x.release,x.duration?x.duration+' min':'',x.country);
 if(type==='empregos')facts.push(x.type,x.location,(x.minimum||x.maximum)?areaMoney(Number(x.minimum),x.currency)+' a '+areaMoney(Number(x.maximum),x.currency)+(x.salaryPer?' por '+x.salaryPer:''):'',x.open?'Vaga aberta':'Vaga encerrada');
 const ul=make('ul',undefined,'area-facts');for(const t of facts.filter(Boolean)){ul.append(make('li',t));}head.append(ul);if(x.member)head.append(make('p',d.rating.count?marketStars(d.rating):'Ainda sem avaliações','market-rating'));box.append(head);
 if(type==='coletas'){const pct=x.goal?Math.min(100,Math.round(x.raised/x.goal*100)):0;const bar=make('div',undefined,'area-progress');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(pct));const fill=make('span');fill.style.width=pct+'%';bar.append(fill);box.append(bar,make('p',areaMoney(x.raised,'BRL')+' arrecadados de '+areaMoney(x.goal,'BRL')+' ('+pct+'%)','area-sub'));}
 if(type==='filmes'&&(x.stars||x.producer))box.append(make('p',[x.producer?'Produção: '+x.producer:'',x.stars?'Elenco: '+x.stars:''].filter(Boolean).join(' · '),'area-sub'));
 const text=x.content||x.description||'';if(text){const body=noI18n(make('div',undefined,'area-body'));for(const para of text.split(/\n{2,}/)){const pEl=make('p');pEl.append(linkified(para));body.append(pEl);}box.append(body);}
 if(type==='paginas'){const links=make('div',undefined,'area-links');for(const [k,label] of [['website','Site'],['instagram','Instagram'],['youtube','YouTube']])if(x[k]){const l=make('a',label,'preview-secondary');l.href=x[k];l.target='_blank';l.rel='noopener noreferrer nofollow';links.append(l);}if(links.children.length)box.append(links);}
 const actions=make('div',undefined,'area-actions');
 const chat=(label)=>{if(a&&!d.own){const b=button(label,()=>openPrivateChat(a.key),actions);b.className='opy-primary';}};
 if(type==='mercado'&&!x.sold&&a&&!d.own){const b=button(x.member?'Tenho interesse':'Falar com quem vende',()=>marketInterest(a.key,x.title),actions);b.className='opy-primary';}
 if(x.member&&d.own){const l=make('a','Editar anúncio','preview-secondary');l.href=areaLink(type,{anunciar:x.id,id:''});actions.append(l);}
 if(x.member&&d.canRemove)button(d.own?'Remover anúncio':'Remover anúncio (moderação)',async()=>{if(!confirm(d.own?'Remover este anúncio? As fotos e as avaliações também saem.':'Remover o anúncio de '+(a?.name||'outra pessoa')+'? A remoção fica no registro da gestão.'))return;await api({action:'market_delete',id:x.id});location.href=location.pathname;},actions);
 if(type==='empregos'&&x.open)chat('Candidatar-se pelo chat');
 if(type==='coletas'){chat('Falar com quem organiza');actions.append(make('p','Contribuições pela 2.0 ainda não estão disponíveis; nenhum pagamento é feito por esta tela.','area-note'));}
 if(type==='eventos'){const url=areaICS(x);if(url){const l=make('a','Adicionar à agenda','preview-secondary');l.href=url;l.download='evento-etnias-'+x.id+'.ics';actions.append(l);}}
 if(actions.children.length)box.append(actions);
 if(x.member)box.append(marketReviews(x,d,box));
 box.append(areaAuthor(a,type==='mercado'?'Vendido por':type==='paginas'?'Responsável:':type==='empregos'?'Vaga de':type==='coletas'?'Organizado por':'Por'));
 return box;
}
// Mercado dos membros: estrelas, interesse pelo chat (mensagem sugerida e editável, nada é enviado sozinho),
// avaliações (uma por conta, editável) e o formulário de anúncio. Sem carrinho nem pagamento.
const marketStars=r=>'★ '+r.avg.toLocaleString('pt-BR')+' · '+plural(r.count,'avaliação','avaliações');
function marketInterest(key,title){try{sessionStorage.setItem('opy_chat_draft',JSON.stringify({key,text:'Olá! Tenho interesse no seu anúncio "'+title+'" no Mercado do Etnias. Ainda está disponível?'}));}catch{}openPrivateChat(key);}
function marketReviews(x,d,box){
 const sec=make('section',undefined,'market-reviews');sec.setAttribute('aria-labelledby','market-reviews-title');const h=make('h2','Avaliações');h.id='market-reviews-title';sec.append(h);
 if(!d.reviews.length)sec.append(make('p',d.own?'Seu anúncio ainda não recebeu avaliações.':'Ninguém avaliou ainda. Já negociou com esta pessoa? Conte como foi.','area-sub'));
 const ul=make('ul',undefined,'market-review-list');
 for(const r of d.reviews){const li=make('li');const who=make('a',undefined,'area-author-link');who.href='/perfil/?u='+encodeURIComponent(r.key);who.append(avatarNode(r.name,r.avatar,28),make('span',r.own?'Você':r.name));const st=make('span','★'.repeat(r.stars)+'☆'.repeat(5-r.stars),'market-review-stars');st.setAttribute('role','img');st.setAttribute('aria-label',r.stars+' de 5 estrelas');li.append(who,st);if(r.text)li.append(noI18n(make('p',r.text)));li.append(make('small',date(r.at),'area-sub'));ul.append(li);}
 if(d.reviews.length)sec.append(ul);
 if(d.own)return sec;
 const f=make('form',undefined,'set-verify market-review-form');const fs=make('fieldset',undefined,'market-stars');fs.append(make('legend',d.myReview?'Sua avaliação':'Avaliar'));const row=make('div',undefined,'market-stars-row');
 for(let n=5;n>=1;n--){const i=make('input',undefined,'opy-sr-only');i.type='radio';i.name='stars';i.value=String(n);i.id='market-star-'+n;i.required=true;if(d.myReview?.stars===n)i.checked=true;const l=make('label','★');l.htmlFor=i.id;l.title=plural(n,'estrela','estrelas');l.append(make('span',plural(n,'estrela','estrelas'),'opy-sr-only'));row.append(i,l);}
 fs.append(row);const lt=make('label','Comentário (opcional)');const ta=make('textarea');ta.maxLength=300;ta.rows=2;ta.value=d.myReview?.text||'';lt.append(ta);
 const send=make('button',d.myReview?'Atualizar avaliação':'Enviar avaliação','opy-primary');send.type='submit';f.append(fs,lt,send);
 f.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{const r=await api({action:'market_review',id:x.id,stars:Number(f.elements.stars.value),text:ta.value});toast('Avaliação salva');box.replaceWith(areaDetail('mercado',AREA_META.mercado,r));}catch(err){showError(err.message);}finally{send.disabled=false;}};
 sec.append(f);return sec;
}
function marketForm(d,editing){
 const x=editing?d.item:null;const back=make('a','← Mercado','area-back');back.href=location.pathname;
 if(editing&&!d.own)return emptyState('Somente quem anunciou pode editar','Este anúncio é de outra pessoa.',[['Voltar ao Mercado',location.pathname]]);
 const f=make('form',undefined,'area-detail set-verify market-form');f.append(back,make('h2',editing?'Editar anúncio':'Anunciar no Mercado'));
 const field=(label,value,max,rows,required=true)=>{const l=make('label',label);const i=make(rows?'textarea':'input');i.value=value||'';i.maxLength=max;i.required=required;if(rows)i.rows=rows;l.append(i);f.append(l);return i;};
 const title=field('Título',x?.title,100),description=field('Descrição',x?.description,2000,5),price=field('Preço',x?.price,40);price.placeholder='Ex.: R$ 80 ou A combinar';
 const lc=make('label','Categoria');const cat=make('select');cat.required=true;cat.append(new Option('Escolha uma categoria',''),...d.categoriesFixed.map(c=>new Option(c,c,false,c===x?.category)));lc.append(cat);f.append(lc);
 const place=field('Cidade/UF (opcional)',x?.location,80,0,false);place.placeholder='Ex.: Manaus/AM';
 const kept=(x?.photoIds||[]).map((id,k)=>({id,url:x.images[k]})),added=[];
 const fotos=make('div',undefined,'market-photos');const pick=make('input');pick.type='file';pick.multiple=true;pick.accept='image/png,image/jpeg,image/webp,image/gif';const lp=make('label','Fotos (até 4)');lp.append(pick);
 const paint=()=>{fotos.replaceChildren(...[...kept.map(p=>[p.url,()=>kept.splice(kept.indexOf(p),1)]),...added.map(p=>[p.data,()=>added.splice(added.indexOf(p),1)])].map(([src,drop],k)=>{const fig=make('figure');const img=make('img');img.src=src;img.alt='Foto '+(k+1);const rm=make('button','✕','market-photo-remove');rm.type='button';rm.setAttribute('aria-label','Tirar a foto '+(k+1));rm.onclick=()=>{drop();paint();pick.focus();};fig.append(img,rm);return fig;}));lp.hidden=kept.length+added.length>=4;};
 pick.onchange=async()=>{const files=[...pick.files];pick.value='';try{if(kept.length+added.length+files.length>4)throw Error('Escolha até 4 fotos por anúncio.');for(const file of files){const p=await readSlot(file,900*1024);if(!/^data:image\/(png|jpeg|gif|webp);/.test(p.data))throw Error('As fotos precisam ser PNG, JPG, GIF ou WebP.');added.push(p);}}catch(e){showError(e.message);}paint();};
 paint();f.append(lp,fotos,make('p','Sem pagamento pelo site: quem tiver interesse fala com você pelo chat.','area-note'));
 const save=make('button',editing?'Salvar alterações':'Publicar anúncio','opy-primary');save.type='submit';const st=make('p','','area-note');st.setAttribute('role','status');f.append(save,st);
 f.onsubmit=async e=>{e.preventDefault();save.disabled=true;st.textContent='Salvando…';try{const r=await api({action:'market_save',...(editing?{id:x.id,keepPhotos:kept.map(p=>p.id)}:{}),title:title.value,description:description.value,price:price.value,category:cat.value,location:place.value,photos:added.map(p=>({name:p.name,data:p.data}))});location.href=location.pathname+'?id='+encodeURIComponent(r.item.id);}catch(err){st.textContent=err.message;showError(err.message);save.disabled=false;}};
 return f;
}
function render(){if(!state)return;setTimeout(watchSponsored,0);const areaApp=$('#area-app');if(areaApp)renderArea(areaApp);window.OpyI18n?.sync(state.i18n);liveUi(liveMode);rememberAccount(state.me);
 all('[data-community-name]').forEach(el=>el.textContent=state.me.name);all('[data-community-username]').forEach(el=>el.textContent='@'+state.me.username);all('[data-community-avatar]').forEach(el=>{if(state.me.avatar){if(el.querySelector('img')?.getAttribute('src')!==state.me.avatar){const im=make('img');im.src=state.me.avatar;im.alt='';el.replaceChildren(im);}}else el.textContent=state.me.name.slice(0,1).toLocaleUpperCase('pt-BR');el.title=state.me.name;});all('[data-community-contact]').forEach(el=>{const digits=state.me.phone||'';const phone=digits.length>=10?digits.replace(/(\d{2})(\d{4,5})(\d{4})/,'($1) $2-$3'):'não informado nesta conta';el.textContent='Chave Google: '+(state.me.googleKey||'não informada nesta conta')+' · Telefone: '+phone;});
 const pForm=$('#profile-edit-form');
 if(pForm&&!pForm.contains(document.activeElement)){
  if($('#profile-edit-name'))$('#profile-edit-name').value=state.me.name||'';
  if($('#profile-edit-povo')){const b=state.me.belonging||'';all('#profile-edit-form input[name=belonging]').forEach(r=>{r.checked=r.value===b;r.onchange=()=>{$('#profile-edit-povo-label').hidden=r.value!=='indigena';if(r.value==='indigena')$('#profile-edit-povo').focus();};});$('#profile-edit-povo').value=state.me.povo||'';$('#profile-edit-povo-label').hidden=b!=='indigena';const dl=$('#povos-list');if(dl&&dl.children.length!==(state.povos||[]).length)dl.replaceChildren(...(state.povos||[]).map(n=>new Option(n)));}
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
 if(chatHeaderLink&&!chatHeaderLink.dataset.inbox){chatHeaderLink.dataset.inbox='1';chatHeaderLink.addEventListener('click',openInboxPopover);}
 if(chatHeaderLink){
  let badge=$('.opy-header-badge',chatHeaderLink);
  const count=state.unreadChatCount||0;
  if(count>0){if(!badge){badge=make('span',undefined,'opy-header-badge');chatHeaderLink.append(badge);}badge.textContent=count>99?'99+':String(count);}
  else if(badge)badge.remove();
 }
 paintRequests();
 const notifCount=state.unreadNotifications||0;
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
  // Stories em anel: círculo com a foto, borda viva quando ainda não visto, cinza depois. A mídia aparece no visualizador.
  stories.replaceChildren();const create=button('',()=>window.OpyCreator?window.OpyCreator.open('story'):openStorySheet(),stories);create.classList.add('story-pill','story-create');
  const myRing=make('span',undefined,'story-ring');myRing.append(avatarNode(state.me.name,state.me.avatar,56),make('b','+','story-plus'));create.append(myRing,make('strong','Seu story'));create.setAttribute('aria-label','Criar story');
  // Quem está ao vivo aparece primeiro no anel, com o selo, e abre a transmissão.
  for(const l of (state.lives||[]).filter(l=>!l.own)){const card=button('',()=>openLiveViewer({id:l.postId,author:l.author,avatar:l.avatar,live:{format:l.format}}),stories);card.classList.add('story-pill','is-live');const ring=make('span',undefined,'story-ring');ring.append(avatarNode(l.author,l.avatar,56),make('b','AO VIVO','story-live'));card.append(ring,make('strong',l.author.split(' ')[0]));card.setAttribute('aria-label',`Assistir à live de ${l.author}`);}
  const byAuthor=new Map();for(const item of state.stories){const k=item.authorKey||item.author;if(!byAuthor.has(k))byAuthor.set(k,[]);byAuthor.get(k).push(item);}
  for(const [,group] of byAuthor){
   const item=group[0];const allSeen=group.every(s=>seenStories.has(s.id));
   const card=button('',()=>window.OpyStories?.open((group.find(s=>!seenStories.has(s.id))||item).id),stories);card.classList.add('story-pill');if(allSeen)card.classList.add('is-seen');
   const ring=make('span',undefined,'story-ring');ring.append(avatarNode(item.author,item.avatar,56));if(group.length>1)ring.append(make('b',String(group.length),'story-count'));
   card.append(ring,make('strong',item.own?'Você':item.author.split(' ')[0]));card.setAttribute('aria-label',`Ver ${plural(group.length,'story','stories')} de ${item.author}`+(allSeen?' (já visto)':''));
  }
  if(!state.stories.length)stories.append(make('p','Compartilhe o primeiro story da comunidade.','story-empty'));
 }
 const feedEl=$('#preview-feed');if(feedEl){const fs=feedState();
  const saved=document.body.dataset.previewRoute==='saved-posts';
  const params=feedParams(saved);const key=new URLSearchParams(params).toString();
  if(fs.key!==key){
   fs.key=key;fs.hasMore=false;fs.pending=[];
   if(!key){fs.posts=state.posts;fs.hasMore=!!state.postsHasMore;fs.loading=false;}
   else{fs.posts=[];fs.loading=true;feedEl.setAttribute('aria-busy','true');apiGet({view:'posts',...params}).then(d=>{if(fs.key!==key)return;fs.posts=d.posts;fs.hasMore=d.hasMore;fs.loading=false;render();}).catch(e=>{fs.loading=false;feedEl.removeAttribute('aria-busy');showError(e.message);});}
  }else if(!key){
   // Publicações novas que chegam pela atualização periódica não empurram o que a pessoa está lendo: viram a pílula "novas publicações".
   const newest=fs.posts[0]?.createdAt||0;const fresh=state.posts.filter(p=>p.createdAt>newest&&!fs.posts.some(q=>q.id===p.id));
   if(fresh.length&&window.scrollY>400&&!fresh.some(p=>p.own)){fs.pending=fresh;}
   else{fs.pending=[];fs.posts=mergePage(fs.posts,state.posts);if(state.postsHasMore&&fs.posts.length<=state.posts.length)fs.hasMore=true;}
  }
  if(!fs.loading)feedEl.removeAttribute('aria-busy');
  paintNewPostsPill(fs);
  const posts=fs.posts;
  const locBox=$('.feed-location');if(locBox)locBox.hidden=view!=='location';
  // Redesenhar o feed só quando algo mudou: evita pausar áudio e vídeo e fechar menus a cada atualização periódica.
  const welcome=!key&&!saved?welcomeCard():null;
  const postSig=p=>JSON.stringify([p.sponsored?.boostId,p.reaction,p.comments?.length,p.saved,p.editedAt,p.live?.active,p.live?.recording,p.following,p.shares,p.reactions,p.media?.url,p.text,p.poll?.counts,p.repostOf?.id,expandedComments.has(p.id),replyTargets.has(p.id)]);
  // O patrocinado fica o mesmo enquanto a pessoa lê: o rodízio do servidor só vale na próxima abertura do feed (sem redesenhar a lista).
  if(!key&&!saved&&fs.sponsored===undefined&&state.sponsored!==undefined)fs.sponsored=state.sponsored||null;
  const sponsoredPost=!key&&!saved?(fs.sponsored||null):null;
  const frameSig=JSON.stringify([key,saved,suggestionsClosed,fs.loading,fs.hasMore,view,fs.pinned?.id,welcome?.dataset.sig||'',posts.map(p=>p.id),sponsoredPost?.id||'']);
  const sugSig=JSON.stringify((state.directory||[]).map(p=>p.key+p.following));
  const feedSig=frameSig+sugSig+posts.map(postSig).join('');
  // Só a publicação que mudou (curtida, comentário, edição) é trocada no lugar: o resto do feed e a posição de leitura ficam como estão.
  if(feedEl.dataset.sig!==feedSig&&feedEl.dataset.frame===frameSig&&feedEl._sigs){
   for(const p of posts){const sig=postSig(p);if(feedEl._sigs.get(p.id)!==sig){const card=document.getElementById('post-'+p.id);if(card){const draft=$('.preview-comment-form input',card)?.value||'';const fresh=renderPost(p);const input=$('.preview-comment-form input',fresh);if(input&&draft&&!input.value)input.value=draft;card.replaceWith(fresh);}feedEl._sigs.set(p.id,sig);}}
   if(feedEl.dataset.sug!==sugSig){feedEl.dataset.sug=sugSig;const old=$('.opy-suggest',feedEl);const sug=!key&&!saved&&!suggestionsClosed?suggestionsRow():null;if(old&&sug)old.replaceWith(sug);else if(old)old.remove();}
   feedEl.dataset.sig=feedSig;
  }
  if(feedEl.dataset.sig!==feedSig){feedEl.dataset.sig=feedSig;feedEl.dataset.frame=frameSig;feedEl.dataset.sug=sugSig;feedEl._sigs=new Map(posts.map(p=>[p.id,postSig(p)]));
  const drafts=new Map(all('.community-post',feedEl).map(card=>[card.id,{text:$('.preview-comment-form input',card)?.value||'',open:!$('.preview-comment-form',card)?.hidden}]));
  const feed=feedEl;
  // Aba Vídeos: grade no formato rápido (preview/videos.js); o toque abre um vídeo por tela.
  const vgrid=view==='videos'&&!saved&&posts.length&&window.OpyVideos;
  const cards=vgrid?[window.OpyVideos.grid(posts)]:posts.map(p=>renderPost(p));
  if(!vgrid&&!key&&!saved&&!suggestionsClosed){const sug=suggestionsRow();if(sug)cards.splice(Math.min(2,cards.length),0,sug);}
  if(!vgrid&&sponsoredPost&&!posts.some(p=>p.id===sponsoredPost.id)){const sp=renderPost(sponsoredPost);sp.id='sponsored-'+sponsoredPost.id;cards.splice(Math.min(4,cards.length),0,sp);}
  if(welcome)cards.unshift(welcome);
  if(fs.pinned&&!posts.some(p=>p.id===fs.pinned.id)){const wrap=make('section',undefined,'opy-pinned');wrap.setAttribute('aria-label','Publicação aberta pelo link');const bar=make('div',undefined,'opy-pinned-bar');bar.append(make('strong','Publicação'));const back=button('Ver feed',()=>{fs.pinned=null;history.replaceState(null,'',location.pathname+location.search);render();},bar);back.className='pf-link';wrap.append(bar,renderPost(fs.pinned));cards.unshift(wrap);}
  feed.replaceChildren(...cards);
  if(fs.loading&&!posts.length)feed.append(make('div',undefined,'opy-skeleton'),make('div',undefined,'opy-skeleton'));
  all('.community-post',feed).forEach(card=>{const draft=drafts.get(card.id);if(draft){const di=$('.preview-comment-form input',card);di.value=draft.text;di.dispatchEvent(new Event('input'));const form=$('.preview-comment-form',card);form.hidden=!draft.open;const toggle=card.querySelector('[aria-controls="'+form.id+'"]');if(toggle)toggle.setAttribute('aria-expanded',String(!!draft.open));}});
  if(!posts.length&&!fs.loading){
   const showView=v=>$(`[data-feed-view="${v}"]`)?.click();
   feed.append(saved?emptyState('Nada salvo ainda','Toque no marcador de uma publicação para guardá-la aqui e ler depois.',[['Ir para o feed','/']])
    :view==='following'&&!(state.directory||[]).some(p=>!p.own&&(p.following||p.friendStatus==='friends'))?emptyState('Você ainda não segue ninguém','Siga pessoas para ver aqui o que elas publicam.',[['Descobrir pessoas',()=>showView('discover')]])
    :view==='location'?emptyState('Nenhuma publicação com esse local','As pessoas informam o local ao publicar. Tente outro nome de cidade, região ou território.')
    :view==='discover'?emptyState('Você já segue todo mundo','Quem publicou por aqui já está no seu feed.',[['Ver tudo',()=>showView('news')]])
    :emptyState('Nada neste filtro','Ainda não há publicações deste tipo.',[['Ver tudo',()=>showView('news')]]));
  }
  if(fs.restoreY){const y=fs.restoreY,anchor=fs.restoreAnchor;fs.restoreY=0;fs.restoreAnchor=null;
   // Alinha a publicação âncora e repete enquanto fotos e vídeos acima ganham altura; para se a pessoa já rolou.
   let placed=null;const align=()=>{if(placed!==null&&Math.abs(window.scrollY-placed)>2)return;const card=anchor&&document.getElementById(anchor.id);const target=card?Math.max(0,card.getBoundingClientRect().top+window.scrollY-anchor.top):y;window.scrollTo(0,target);placed=window.scrollY;};
   requestAnimationFrame(align);[400,1200,2500].forEach(ms=>setTimeout(align,ms));}
  if(posts.length&&fs.hasMore){const more=button('Ver publicações anteriores',loadMoreFeed,feed);more.className='feed-more';more.id='feed-more';if('IntersectionObserver' in window){new IntersectionObserver((entries,obs)=>{if(entries[0].isIntersecting){obs.disconnect();more.click();}},{rootMargin:'600px 0px'}).observe(more);}}
  }
 }
 renderProfile();
 renderDockChat();
 const join=$('[data-community-join]');if(join&&!$('#communities-workspace')){join.textContent=state.group.joined?'Sair do grupo':'Participar do grupo';join.setAttribute('aria-pressed',String(state.group.joined));}if($('[data-community-members]')&&!$('#communities-workspace'))$('[data-community-members]').textContent=state.group.count+' participante(s) neste ambiente.';
 const results=$('#preview-search-results');if(results){
  const rawQuery=new URLSearchParams(location.search).get('query')||'';
  if($('#search-page-input')&&document.activeElement!==$('#search-page-input'))$('#search-page-input').value=rawQuery;
  const query=rawQuery.toLocaleLowerCase('pt-BR');
  results.replaceChildren();
  if(!rawQuery.trim()){
   // Sem termo: Explorar, uma grade de fotos recentes da rede e as comunidades com mais gente.
   if(!exploreData.loaded){exploreData.loaded=true;apiGet({view:'posts',kind:'photos',limit:30}).then(d=>{exploreData.posts=d.posts;render();}).catch(e=>showError(e.message));}
   const sec=make('section',undefined,'search-result-group opy-explore');sec.append(make('h2','Explorar'));
   const grid=make('div',undefined,'opy-explore-grid');
   for(const p of exploreData.posts){const u=(p.images&&p.images[0])||p.image||(p.media?.kind==='image'?p.media.url:'');if(!u)continue;const a=make('a',undefined,'opy-explore-tile');a.href='/#post-'+p.id;a.setAttribute('aria-label','Publicação de '+p.author);const img=make('img');img.src=thumbUrl(u);img.alt='';img.loading='lazy';a.append(img);if(p.images&&p.images.length>1)a.append(make('span','▣','opy-explore-multi'));grid.append(a);}
   if(grid.children.length)sec.append(grid);else sec.append(make('p',exploreData.posts.length||!exploreData.loaded?'Ainda não há fotos publicadas.':'Carregando fotos…','pf-empty'));
   results.append(sec);
   const top=communitiesList().slice().sort((a,b)=>(b.membersCount||0)-(a.membersCount||0)).slice(0,6);
   if(top.length){const cs=make('section',undefined,'search-result-group');cs.append(make('h2','Comunidades com mais gente'));for(const c of top){const row=make('a',undefined,'search-community-link');row.href='/grupos/?c='+encodeURIComponent(c.id);row.append(make('strong',c.name),make('small',plural(c.membersCount||0,'participante','participantes')));cs.append(row);}results.append(cs);}
  }else{
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
  if(searchData.q!==rawQuery){searchData.q=rawQuery;searchData.people=[];searchData.posts=[];if(rawQuery.trim()){searchData.loading=true;apiGet({view:'search',q:rawQuery}).then(d=>{if(searchData.q!==rawQuery)return;searchData.people=d.people;searchData.posts=d.posts;searchData.loading=false;render();}).catch(e=>{searchData.loading=false;showError(e.message);});}}
  const matchedPeople=searchData.people;
  if(matchedPeople.length){
   const sec=make('section',undefined,'search-result-group');sec.append(make('h2','Pessoas na comunidade'));
   for(const p of matchedPeople){
    const row=make('div',undefined,'community-member-row');
    const b=make('button',undefined,'community-person');b.type='button';b.onclick=()=>openProfile(p.key,p.name,p.avatar);
    b.append(avatarNode(p.name,p.avatar,36),make('strong',p.name+(p.username?' · @'+p.username:'')+(p.affiliation?` · ${p.affiliation}`:'')));
    row.append(b);sec.append(row);
   }
   results.append(sec);
  }
  const posts=searchData.posts;
  if(posts.length){
   const sec=make('section',undefined,'search-result-group');sec.append(make('h2','Publicações'));
   for(const p of posts){const a=make('a');a.href='/#post-'+p.id;a.append(make('strong',p.author+(p.communityName?' · '+p.communityName:'')),make('p',p.text.slice(0,240)),make('small',date(p.createdAt)));sec.append(a);}
   results.append(sec);
  }
  if(searchData.loading)results.append(make('p','Buscando…','pf-empty'));
  else if(!matchedComms.length&&!matchedPeople.length&&!posts.length)results.append(emptyState('Nada encontrado para “'+rawQuery+'”','Confira a grafia ou tente uma palavra mais curta, como o nome de uma pessoa, povo ou tema.',[['Ver comunidades','/grupos/']]));

  }
 }
 const notices=$('#community-notifications');if(notices){
  // Notificações agregadas vêm do servidor; abrir a página marca as não acionáveis como vistas.
  if(!notifData.loaded){notifData.loaded=true;notifData.loading=true;apiGet({view:'notifications'}).then(d=>{notifData.items=d.items;notifData.loading=false;render();if(d.items.some(i=>i.unread&&!i.actionable))change({action:'notifications_seen'}).catch(()=>{});}).catch(e=>{notifData.loading=false;showError(e.message);});}
  const item=i=>{
   const followBack=i.kind==='follow'&&i.canFollow&&!i.following;
   const card=make(i.href&&!i.actionable&&!followBack?'a':'div',undefined,'notification-card'+(i.unread?' is-unread':''));if(card.tagName==='A')card.href=i.href;
   card.append(avatarNode(i.text.split(' ')[0],i.avatar,44));
   const body=make('div',undefined,'notification-body');body.append(make('p',i.text));
   if(!i.actionable&&i.createdAt)body.append(make('small',date(i.createdAt)));
   if(i.kind==='friend'){const acts=make('div',undefined,'community-member-actions');const acc=button('Aceitar amizade',()=>change({action:'friend',authorKey:i.key}),acts);acc.className='opy-primary';button('Ver perfil',()=>openProfile(i.key),acts);body.append(acts);}
   else if(i.kind==='invite'){const acts=make('div',undefined,'community-member-actions');const acc=button('Aceitar convite',()=>change({action:'community_accept_invite',communityId:i.communityId}),acts);acc.className='opy-primary';button('Recusar',()=>change({action:'community_decline_invite',communityId:i.communityId}),acts);body.append(acts);}
   else if(i.kind==='pending'){const a=make('a','Ver pedidos','preview-text-link');a.href=i.href;body.append(a);}
   else if(followBack){const acts=make('div',undefined,'community-member-actions');const f=button('Seguir de volta',async()=>{await change({action:'follow',authorKey:i.key});i.following=true;render();},acts);f.className='opy-primary';button('Ver perfil',()=>openProfile(i.key),acts);body.append(acts);}
   card.append(body);return card;
  };
  notices.replaceChildren(...notifData.items.map(item));
  if(state.pushPublicKey&&'serviceWorker' in navigator&&'PushManager' in window)notices.prepend(pushCard());
  if(notifData.loading&&!notifData.items.length)notices.append(make('div',undefined,'opy-skeleton'),make('div',undefined,'opy-skeleton'));
  else if(!notifData.items.length)notices.append(emptyState('Tudo em silêncio por aqui','Quando alguém pedir sua amizade, convidar você para uma comunidade ou interagir com o que você publicou, o Maracá avisa aqui.',[['Encontrar pessoas','/search/'],['Ver comunidades','/grupos/']]));
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
// Avisos no aparelho: inscrição Web Push gravada no servidor (push_subscribe). No iPhone só funciona com o site na tela de início.
let pushSub;// undefined = ainda não consultado; null = sem inscrição neste aparelho
function pushCard(){
 const card=make('section',undefined,'opy-push-card');card.setAttribute('aria-label','Avisos no aparelho');
 const body=make('div');body.append(make('strong','Avisos no aparelho'));
 const iosNoApp=/iPhone|iPad/.test(navigator.userAgent)&&!navigator.standalone;
 const denied=typeof Notification!=='undefined'&&Notification.permission==='denied';
 body.append(make('p',iosNoApp?'No iPhone, adicione o Etnias à tela de início (Compartilhar › Adicionar à Tela de Início) para receber avisos.':denied?'Os avisos estão bloqueados nas configurações do navegador para este site.':'Saiba na hora quando comentarem, pedirem sua amizade ou mandarem mensagem, mesmo com o site fechado.'));
 card.append(body);
 if(iosNoApp||denied)return card;
 if(pushSub===undefined){pushSub=null;navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>{if(s){pushSub=s;render();}}).catch(()=>{});}
 const b=button(pushSub?'Desativar avisos':'Ativar avisos',async()=>{
  const reg=await navigator.serviceWorker.ready;
  if(pushSub){await api({action:'push_unsubscribe',endpoint:pushSub.endpoint});await pushSub.unsubscribe();pushSub=null;toast('Avisos desativados');}
  else{
   if(await Notification.requestPermission()!=='granted')throw Error('Permita as notificações para ativar os avisos.');
   const key=Uint8Array.from(atob(state.pushPublicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   pushSub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   await api({action:'push_subscribe',subscription:pushSub.toJSON()});toast('Avisos ativados neste aparelho');
  }
  render();
 },card);
 b.className=pushSub?'preview-secondary':'opy-primary';
 return card;
}
// Troca de senha; obrigatória (sem fechar) quando a pessoa entrou com uma senha provisória emitida pela gestão.
function openPasswordDialog(forced){
 if($('#opy-password-dialog'))return;
 const dlg=make('dialog',undefined,'community-dialog');dlg.id='opy-password-dialog';
 const form=make('form');form.method='dialog';
 form.append(make('h2',forced?'Crie sua nova senha':'Alterar senha'));
 if(forced)form.append(make('p','Você entrou com uma senha provisória. Escolha agora uma senha só sua, com no mínimo 8 caracteres.'));
 const field=(label,name,auto)=>{const l=make('label',label);const i=make('input');i.type='password';i.name=name;i.required=true;i.minLength=8;i.maxLength=72;i.autocomplete=auto;l.append(i);form.append(l);return i;};
 const current=field(forced?'Senha provisória':'Senha atual','current','current-password'),next=field('Nova senha','next','new-password'),again=field('Repita a nova senha','again','new-password');
 const err=make('p',undefined,'welcome-error');err.setAttribute('role','alert');err.hidden=true;form.append(err);
 const row=make('div',undefined,'community-dialog-actions');
 if(!forced)button('Cancelar',()=>dlg.close(),row);
 const ok=make('button','Salvar senha','opy-primary');ok.type='submit';row.append(ok);form.append(row);dlg.append(form);document.body.append(dlg);
 if(forced)dlg.addEventListener('cancel',e=>e.preventDefault());
 form.onsubmit=async e=>{e.preventDefault();if(next.value!==again.value){err.textContent='As senhas não são iguais.';err.hidden=false;return;}ok.disabled=true;try{await api({action:'password_change',current:current.value,next:next.value});if(state?.me)state.me.mustChangePassword=false;dlg.close();toast('Senha atualizada.');}catch(x){err.textContent=x.message;err.hidden=false;ok.disabled=false;}};
 dlg.addEventListener('close',()=>dlg.remove());dlg.showModal();
}
function bindWelcome(){const login=$('#welcome-login'),register=$('#welcome-register');const tabs=[$('#tab-login'),$('#tab-register')];function show(which){login.hidden=which!=='login';register.hidden=which!=='register';tabs[0].setAttribute('aria-selected',String(which==='login'));tabs[1].setAttribute('aria-selected',String(which==='register'));$('#welcome-error').hidden=true;}
 tabs[0].onclick=()=>show('login');tabs[1].onclick=()=>show('register');
 try{const left=sessionStorage.getItem('opy-left');if(left){sessionStorage.removeItem('opy-left');toast(left);}}catch{}
 const presetUser=new URLSearchParams(location.search).get('user');if(presetUser&&$('#login-username')){$('#login-username').value=presetUser.slice(0,80);show('login');setTimeout(()=>$('#login-password')?.focus(),50);}
 all('[data-toggle-password]').forEach(button=>button.onclick=()=>{const input=document.getElementById(button.dataset.togglePassword);const visible=input.type==='text';input.type=visible?'password':'text';button.textContent=visible?'Mostrar senha':'Ocultar senha';button.setAttribute('aria-pressed',String(!visible));});
 async function submit(form,action){const statusButton=$('[type=submit]',form);statusButton.disabled=true;const original=statusButton.textContent;statusButton.textContent=action==='login'?'Entrando…':'Criando conta…';try{await api({action,name:form.elements.name?.value,username:form.elements.username.value,password:form.elements.password.value,googleKey:form.elements.googleKey?.value,phone:form.elements.phone?.value});location.replace(safeNext(new URLSearchParams(location.search).get('next')));}catch(error){showWelcomeError(error.message);statusButton.disabled=false;statusButton.textContent=original;}}
 login.onsubmit=event=>{event.preventDefault();submit(login,'login');};
 register.onsubmit=event=>{event.preventDefault();submit(register,'register');};
}
// Ao voltar de um perfil ou publicação, o feed reaparece como estava (mesmas publicações, mesma posição), sem recarregar do zero.
const FEED_RESTORE='opy_feed_restore';
if(document.body.dataset.previewRoute==='home'){
 try{history.scrollRestoration='manual';}catch{}
 // Guarda a publicação que estava no alto da tela (e não só os pixels): as imagens carregam em outra ordem na volta.
 window.addEventListener('pagehide',()=>{try{if(!feed.posts.length)return;const card=all('.community-post').find(c=>c.getBoundingClientRect().bottom>220)||null;sessionStorage.setItem(FEED_RESTORE,JSON.stringify({posts:feed.posts.slice(0,90),hasMore:feed.hasMore,y:window.scrollY,anchor:card?.id||'',anchorTop:card?card.getBoundingClientRect().top:0,view,at:Date.now()}));}catch{}});
}
function restoreFeedFromSession(){
 if(document.body.dataset.previewRoute!=='home'||feed.posts.length)return;
 try{const saved=JSON.parse(sessionStorage.getItem(FEED_RESTORE)||'null');sessionStorage.removeItem(FEED_RESTORE);
  if(!saved||Date.now()-saved.at>15*60*1000||performance.getEntriesByType('navigation')[0]?.type!=='back_forward')return;
  if(saved.view&&saved.view!==view){view=saved.view;all('[data-feed-view]').forEach(v=>v.setAttribute('aria-pressed',String(v.dataset.feedView===view)));}
  feed.posts=saved.posts;feed.hasMore=saved.hasMore;feed.restoreY=saved.y||1;feed.restoreAnchor=saved.anchor?{id:saved.anchor,top:saved.anchorTop}:null;}catch{}
}
async function refresh(){try{const g=feedGen;const next=await api();if(g!==feedGen)return;state=next;restoreFeedFromSession();if(document.body.dataset.previewRoute==='entrar'){location.replace(safeNext(new URLSearchParams(location.search).get('next')));return;}if(state.me?.mustChangePassword)openPasswordDialog(true);if(!all('#preview-feed input, #preview-feed textarea').some(el=>el.value))render();}catch(e){if(e.status===401&&document.body.dataset.previewRoute!=='entrar'){location.replace('/entrar/?next='+encodeURIComponent(location.pathname+location.search));return;}if(document.body.dataset.previewRoute==='entrar')return;showError(e.message);if($('#community-connection'))$('#community-connection').textContent='Conexão indisponível · tente atualizar';}}
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
let cameraFacing='environment',cameraMode='photo';
// O visualizador de stories vive em preview/stories.js (carregado depois deste arquivo).
let cameraStream=null,storyMedia=null,storyRecorder=null,photoAttachments=[];
// Live (Fase 4): a mídia vai por WebRTC ao MediaMTX; a sinalização WHIP (quem transmite) e WHEP (quem assiste) passa pelo app em /live/<id>/….
let liveSession=null,liveMode='idle',liveViewer=null;
// Estúdio, convidado e visualizador da live vivem em preview/live.js (carregado depois deste arquivo).
function stopCamera(){if(liveSession)return;if(liveMode==='preview')liveUi('idle');if(storyRecorder){storyRecorder.onstop=null;if(storyRecorder.state==='recording')storyRecorder.stop();storyRecorder=null;$('#story-record')&&($('#story-record').textContent='Gravar');}cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;all('video[data-live]').forEach(video=>{video.srcObject=null;});}
async function startCamera(video,withAudio){if(liveSession&&video!==$('#live-preview'))throw Error('Encerre a live antes de usar a câmera em outro lugar.');stopCamera();if(!navigator.mediaDevices?.getUserMedia)throw Error('Este navegador não abre a câmera. Use a galeria.');const picture={facingMode:cameraFacing};try{cameraStream=await navigator.mediaDevices.getUserMedia(withAudio?{video:picture,audio:true}:{video:picture});}catch(error){if(!withAudio||error.name==='NotAllowedError'||error.name==='NotFoundError')throw Error('Não foi possível abrir a câmera. Permita o acesso ou use a galeria.');cameraStream=await navigator.mediaDevices.getUserMedia({video:picture});}video.srcObject=cameraStream;video.muted=true;try{await video.play();}catch(error){if(video.srcObject!==cameraStream)return;throw error;}}
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
  const belonging=$('#profile-edit-form input[name=belonging]:checked')?.value||'';
  await change({action:'profile_update',name:$('#profile-edit-name').value,affiliation:$('#profile-edit-affiliation').value,bio:$('#profile-edit-bio').value,belonging,povo:belonging==='indigena'?$('#profile-edit-povo').value:''});
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
// Fotos de celular passam de 2 MB: reduz no aparelho (lado maior 1600 px, JPEG) antes de enviar, como as redes fazem.
async function shrinkPhoto(file,limit=1.5*1024*1024){
 if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||file.size<=limit)return file;
 let img;try{img=await createImageBitmap(file);}catch{img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(Error('Não foi possível abrir esta foto. Tente outra ou tire pela câmera.'));i.src=URL.createObjectURL(file);});}
 const w=img.width||img.naturalWidth,h=img.height||img.naturalHeight;
 for(const [side,q] of [[1600,.85],[1280,.8],[1080,.72]]){
  const k=Math.min(1,side/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',q));
  if(blob&&blob.size<=1.9*1024*1024)return new File([blob],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'});
 }
 return file;
}
async function readSlot(file,limit){if(!file)return null;file=await shrinkPhoto(file,limit);if(file.size>2*1024*1024)throw Error('Escolha um arquivo de até 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});return {name:file.name,data:typedDataUrl(file,data),bytes:file.size};}
// Carrossel no padrão do Instagram: até 10 fotos, reduzidas no aparelho (carrossel mais leve: acima de 900 KB vira JPEG de até 1600 px).
const MAX_PHOTOS=10,MAX_PHOTOS_BYTES=13*1024*1024;
function paintPhotos(){
 const el=$('#photo-slot'),st=$('#photo-status'),n=photoAttachments.length;if(!el)return;
 el.replaceChildren();el.hidden=!n;
 photoAttachments.forEach((p,i)=>{const fig=make('figure',undefined,'compose-thumb');const img=make('img');img.src=p.data;img.alt='Foto '+(i+1)+' de '+n;fig.append(img);if(n>1)fig.append(make('span',String(i+1),'compose-thumb-n'));const x=button('×',()=>{photoAttachments.splice(i,1);paintPhotos();},fig);x.className='compose-thumb-remove';x.setAttribute('aria-label','Remover foto '+(i+1));el.append(fig);});
 if(n&&n<MAX_PHOTOS){const add=button('+',()=>$('#publisher-photo')?.click(),el);add.className='compose-thumb-add';add.setAttribute('aria-label','Adicionar mais fotos');}
 if(st){st.hidden=!n;st.textContent=n>1?n+' fotos em carrossel. Quem vê desliza para o lado.':n?'Foto pronta. Adicione mais para virar carrossel (até '+MAX_PHOTOS+').':'';}
}
function selectFormat(tool){
 // Live abre na tela Criar em tela cheia (câmera, título e botão de transmitir no padrão do Instagram).
 if(tool==='live'&&window.OpyCreator){window.OpyCreator.open('live');tool='text';}
 const panel={photo:'compose-photo',video:'compose-video',file:'compose-file',location:'compose-location',live:'compose-live'}[tool];
 ['compose-photo','compose-video','compose-file','compose-location','compose-live'].forEach(id=>{const el=$('#'+id);if(el)el.hidden=id!==panel;});
 if(liveSession&&tool!=='live'){toast('Você está ao vivo. Encerre a live para usar outro formato.');return;}
 if(tool!=='live'&&liveMode==='preview'){stopCamera();liveUi('idle');}
 all('[data-compose-tool]').forEach(item=>{const on=item.dataset.composeTool===tool;item.setAttribute('aria-selected',String(on));item.tabIndex=on?0:-1;});
}
function selectedFormat(){return all('[data-compose-tool]').find(item=>item.getAttribute('aria-selected')==='true')?.dataset.composeTool||'text';}
if(publisher){
 $('#compose-story-open')?.addEventListener('click',()=>{if(window.OpyCreator){window.OpyCreator.open('story');return;}openStorySheet();$('#story-form')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
 if($('#publisher-photo'))$('#publisher-photo').onchange=async()=>{const input=$('#publisher-photo');const files=[...input.files];input.value='';if(!files.length)return;busy=true;try{if(photoAttachments.length+files.length>MAX_PHOTOS)throw Error('Escolha até '+MAX_PHOTOS+' fotos por publicação.');for(const f of files){const next=await readSlot(f,photoAttachments.length+files.length>1?900*1024:undefined);if(!/^data:image\/(png|jpeg|gif|webp);/.test(next.data))throw Error('A imagem precisa ser PNG, JPG, GIF ou WebP.');if(photoAttachments.reduce((t,p)=>t+p.bytes,0)+next.bytes>MAX_PHOTOS_BYTES)throw Error('As fotos passaram de 13 MB juntas. Tire alguma ou escolha fotos menores.');photoAttachments.push(next);}}catch(e){showError(e.message);}finally{busy=false;paintPhotos();}};
 $('#publisher-video').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-video').files[0]);if(!next)return;if(!/^data:video\/(mp4|webm);/.test(next.data))throw Error('O vídeo precisa ser MP4 ou WebM.');const replaced=!!videoAttachment;videoAttachment=next;paintSlot('video-slot',next,'Remover vídeo',()=>{videoAttachment=null;$('#publisher-video').value='';$('#video-status').textContent='';$('#video-status').hidden=true;});const videoStatus=$('#video-status');videoStatus.hidden=false;videoStatus.textContent=replaced?'O vídeo anterior foi trocado. A publicação leva um único vídeo.':'Vídeo pronto. A publicação leva um único vídeo.';}catch(e){showError(e.message);$('#publisher-video').value='';}finally{busy=false;}};
 $('#publisher-document').onchange=async()=>{busy=true;try{const next=await readSlot($('#publisher-document').files[0]);if(!next)return;if(!/\.(pdf|txt|docx|doc)$/i.test(next.name))throw Error('O arquivo precisa ser PDF, TXT, DOC ou DOCX.');const replaced=!!fileAttachment;fileAttachment=next;paintSlot('file-slot',next,'Remover arquivo',()=>{fileAttachment=null;$('#publisher-document').value='';$('#file-status').textContent='';$('#file-status').hidden=true;});const fileStatus=$('#file-status');fileStatus.hidden=false;fileStatus.textContent=replaced?'O arquivo anterior foi trocado. A publicação leva um único arquivo.':'Arquivo pronto. A publicação leva um único arquivo.';}catch(e){showError(e.message);$('#file-status').textContent=e.message;$('#publisher-document').value='';}finally{busy=false;}};
 selectFormat('text');all('[data-compose-tool]').forEach(b=>b.onclick=()=>selectFormat(b.getAttribute('aria-selected')==='true'&&b.dataset.composeTool!=='text'?'text':b.dataset.composeTool));
 // Compositor fechado mostra só a linha de entrada; abre ao focar ou escolher um formato e fecha vazio ao sair.
 const composeText=$('#preview-text');
 const growCompose=()=>{if(!publisher.classList.contains('is-open'))return;composeText.style.height='auto';composeText.style.height=Math.min(240,Math.max(96,composeText.scrollHeight))+'px';};
 const openComposer=()=>{publisher.classList.add('is-open');growCompose();};
 $('#compose-emoji')?.addEventListener('click',()=>{const box=$('#compose-emoji-box'),btn=$('#compose-emoji');if(!box.hidden){box.hidden=true;btn.setAttribute('aria-expanded','false');return;}openComposer();btn.setAttribute('aria-expanded','true');picker(box,composeText,()=>{box.hidden=true;btn.setAttribute('aria-expanded','false');});});
 // Só o campo de texto abre no foco; botões abrem no clique, para a fileira não se mover sob o dedo.
 publisher.addEventListener('focusin',e=>{if(e.target===composeText)openComposer();});
 all('[data-compose-tool]').forEach(b=>b.addEventListener('click',openComposer));
 composeText?.addEventListener('input',growCompose);
 publisher.addEventListener('focusout',()=>setTimeout(()=>{if(!publisher.contains(document.activeElement)&&!composeText.value.trim()&&selectedFormat()==='text'&&!photoAttachments.length&&!videoAttachment&&!fileAttachment&&!liveSession){publisher.classList.remove('is-open');composeText.style.height='';if($('#compose-emoji-box')){$('#compose-emoji-box').hidden=true;$('#compose-emoji').setAttribute('aria-expanded','false');}}},200));$('.compose-tools',publisher)?.addEventListener('keydown',event=>{const tabs=all('[data-compose-tool]',publisher);const index=tabs.indexOf(document.activeElement);if(index<0||(event.key!=='ArrowRight'&&event.key!=='ArrowLeft'))return;event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selectFormat(next.dataset.composeTool);next.focus();});
 $('#choose-photo')?.addEventListener('click',()=>$('#publisher-photo')?.click());
 $('#choose-photo-camera')?.addEventListener('click',()=>$('#compose-camera-open')?.click());
 $('#choose-video').onclick=()=>$('#publisher-video').click();
 $('#compose-camera-open').onclick=async()=>{$('#compose-camera-status').textContent='';$('#compose-camera').hidden=false;try{await startCamera($('#compose-preview'),false);}catch(error){$('#compose-camera-status').textContent=error.message;stopCamera();}};
 $('#compose-camera-close').onclick=()=>{stopCamera();$('#compose-camera').hidden=true;};
 $('#compose-shutter').onclick=async()=>{try{const file=await snapPhoto($('#compose-preview'));if(photoAttachments.length>=MAX_PHOTOS)throw Error('Escolha até '+MAX_PHOTOS+' fotos por publicação.');photoAttachments.push(await readSlot(file,photoAttachments.length?900*1024:undefined));stopCamera();$('#compose-camera').hidden=true;selectFormat('text');paintPhotos();}catch(error){$('#compose-camera-status').textContent=error.message;}};
 $('#choose-file').onclick=()=>$('#publisher-document').click();
 // Botões do estúdio da live: preview/live.js (bindLiveStudio).
 publisher.onsubmit=async e=>{
  e.preventDefault();const status=$('#preview-form-status');
  if(busy){status.textContent='Aguarde o vídeo ou o arquivo terminar de entrar.';return;}
  const format=selectedFormat();
  if(format==='live'){status.textContent=liveSession?'Você está ao vivo. Toque em "Encerrar live" quando terminar.':'Para transmitir, toque em "Abrir câmera" e depois em "Começar a transmitir".';return;}
  const submit=$('[type=submit]',publisher);submit.disabled=true;
  const progress=$('#compose-upload-progress');
  try{
   const place=$('#compose-place').value.trim();
   const hasPhoto=(format==='text'||format==='photo')&&photoAttachments.length>0;
   if(!$('#preview-text').value.trim()&&!hasPhoto)throw Error('Escreva o que fica visível para quem vê a publicação.');
   if(format==='photo'&&!photoAttachments.length)throw Error('Escolha ou capture uma foto para esta publicação.');
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
    // O que foi anexado vai junto, mesmo que a pessoa tenha voltado para outra aba antes de publicar.
    media:videoAttachment?{name:videoAttachment.name,data:videoAttachment.data}:photoAttachments.length===1?{name:photoAttachments[0].name,data:photoAttachments[0].data}:null,
    ...(!videoAttachment&&photoAttachments.length>1?{photos:photoAttachments.map(p=>({name:p.name,data:p.data}))}:{}),
    file:fileAttachment?{name:fileAttachment.name,data:fileAttachment.data}:null,
    location:place
   });
   publisher.reset();videoAttachment=null;fileAttachment=null;photoAttachments=[];if($('#compose-emoji-box')){$('#compose-emoji-box').hidden=true;$('#compose-emoji').setAttribute('aria-expanded','false');}
   paintSlot('video-slot',null);paintSlot('file-slot',null);paintPhotos();
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
$('#preview-password')?.addEventListener('click',()=>openPasswordDialog(false));
all('#preview-logout,#opy-account-logout,[data-opy-logout]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api({action:'logout'});location.replace('/entrar/');}catch(e){showError(e.message);button.disabled=false;}}));
if(document.body.dataset.previewRoute==='entrar')bindWelcome();
refresh().then(()=>{openHashPost();handleHashActions();const sid=new URLSearchParams(location.search).get('story');if(sid&&window.OpyStories)window.OpyStories.open(sid,{fromLink:true});});window.addEventListener('hashchange',handleHashActions);window.addEventListener('hashchange',openHashPost);bindPullToRefresh();
// Com o visualizador de stories ou a live abertos, a atualização periódica espera: redesenhar a página atrás deles só trava a animação.
if(!['entrar','messages'].includes(document.body.dataset.previewRoute))setInterval(()=>{if(!document.hidden&&!busy&&!$('#story-viewer')?.open&&!$('#live-viewer')?.open)refresh();},document.body.dataset.previewRoute==='messages'?4000:20000);
document.addEventListener('pointerdown',event=>{all('.post-react.is-open').forEach(wrap=>{if(!wrap.contains(event.target))wrap.classList.remove('is-open');});});
function offerInstall(){
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  // Dentro do app nativo (Capacitor) não há o que instalar.
  if(standalone||window.Capacitor)return;
  let deferred=null;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const android=/android/i.test(navigator.userAgent);
  const apk=make('a','Baixar o app para Android','preview-secondary install-apk');
  apk.href='/assets/app/etnias-android.apk';
  apk.setAttribute('download','etnias.apk');
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
    apk.className=(deferred?'preview-secondary':'opy-primary')+' install-apk';
    bar.replaceChildren(mark,...(deferred||ios?[install]:[]),...(android?[apk]:[]),steps);
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
  if(ios||android)mount();
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
// Ponte para preview/live.js (estúdio, convidado e visualizador da live), que vive fora deste escopo.
window.OpyShared={$,all,make,button,api,apiGet,change,toast,showError,emptyState,youtubeCard,linkified,openLightbox,avatarNode,openProfile,plural,startCamera,stopCamera,render:()=>render(),refresh:()=>refresh(),isSeen:id=>seenStories.has(id),markSeen:id=>markStorySeen(id),snapPhoto,shrinkPhoto,recorderMime,readSlot,
 get state(){return state;},get cameraStream(){return cameraStream;},get cameraFacing(){return cameraFacing;},set cameraFacing(v){cameraFacing=v;},
 get liveSession(){return liveSession;},set liveSession(v){liveSession=v;},get liveMode(){return liveMode;},set liveMode(v){liveMode=v;},get liveViewer(){return liveViewer;},set liveViewer(v){liveViewer=v;}};
})();
