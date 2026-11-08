// Live Experience da Casa Opy. Usa os globais de preview.js ($, all, make, button, api, apiGet, change, S.state, toast, showError,
// avatarNode, openProfile, plural, S.cameraStream, startCamera, stopCamera, S.cameraFacing, S.liveSession, S.liveMode, S.liveViewer).
// Arquitetura: o anfitrião captura câmera e microfone, compõe o quadro (sozinho ou com um convidado) num canvas e publica
// por WHIP no MediaMTX; espectadores assistem por WHEP (um para muitos, escala no servidor). O convidado conversa com o
// anfitrião por WebRTC direto (1:1, baixa latência, TURN próprio); só o quadro composto vai para o público.
const S=window.OpyShared;const {$,all,make,button,api,apiGet,change,toast,showError,avatarNode,openProfile,plural,startCamera,stopCamera}=S;
const LIVE_POLL_MS=2000, LIVE_BEAT_MS=15000, LIVE_FPS=24;
const liveReactionSet=['❤️','👏','🔥','😂','🙏','😮'];
let liveFormat=matchMedia('(min-width:1024px)').matches?'landscape':'portrait';
const fmtElapsed=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');};

// ---------- UI do estúdio (compositor) ----------
function liveUi(mode){
 const el=id=>$('#'+id);if(!el('compose-live'))return;S.liveMode=mode;
 if(S.state&&!S.state.liveEnabled){el('live-intro').textContent='A transmissão ao vivo ainda não está ativa neste servidor. Enquanto isso, publique um vídeo ou um Story.';['live-start','live-flip','live-cancel','live-stop','live-mic','live-cam','live-add'].forEach(id=>{el(id).hidden=true;});el('live-stage').hidden=true;el('live-format').hidden=true;el('live-host-panel').hidden=true;return;}
 el('live-format').hidden=mode==='live';
 all('[data-live-format]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.liveFormat===liveFormat)));
 el('live-start').hidden=mode==='live';el('live-start').textContent=mode==='preview'?'Começar a transmitir':'Abrir câmera';
 el('live-flip').hidden=mode==='idle';el('live-cancel').hidden=mode!=='preview';el('live-stop').hidden=mode!=='live';
 el('live-mic').hidden=mode!=='live';el('live-cam').hidden=mode!=='live';el('live-add').hidden=mode!=='live';
 el('live-stage').hidden=mode==='idle';el('live-stage').dataset.format=liveFormat;el('live-pill').textContent=mode==='live'?'AO VIVO':'PRÉVIA · FORA DO AR';el('live-pill').classList.toggle('is-live',mode==='live');
 el('live-meta').hidden=mode!=='live';el('live-host-panel').hidden=mode!=='live';
 el('live-preview').hidden=mode==='live';el('live-canvas').hidden=mode!=='live';
}
function liveBlock(item){
 const box=make('div',undefined,'post-media post-live');box.dataset.count='1';box.dataset.format=item.live.format||'portrait';
 const watch=make('button','Assistir à live','opy-primary');watch.type='button';watch.onclick=()=>openLiveViewer(item);
 const who=make('strong',item.own?'Você está ao vivo':item.author+' está ao vivo agora','post-live-title');
 const meta=make('small',(item.live.viewers?plural(item.live.viewers,'pessoa assistindo','pessoas assistindo'):'Começando agora')+(item.live.guest?' · com '+item.live.guest:''),'post-live-meta');
 box.append(make('span','AO VIVO','live-on'),who,meta,watch);return box;
}

// ---------- WebRTC utilitários ----------
async function waitIce(pc){if(pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const timer=setTimeout(resolve,2500);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve();}});});}
// Oferta SDP completa (sem trickle) → resposta do MediaMTX. Devolve o endereço da sessão, usado para encerrar (DELETE).
async function sdpExchange(pc,url,headers){await pc.setLocalDescription(await pc.createOffer());await waitIce(pc);const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/sdp',...headers},body:pc.localDescription.sdp});if(response.status!==201)throw Error(response.status===401||response.status===404?'Esta live não está mais no ar.':'Não foi possível conectar ao servidor de vídeo. Tente de novo em instantes.');await pc.setRemoteDescription({type:'answer',sdp:await response.text()});return response.headers.get('Location')||'';}
// H.264 primeiro: é o que o MP4 da gravação aceita e o que o iPhone toca depois.
function preferH264(pc){const t=pc.getTransceivers().find(x=>x.sender?.track?.kind==='video');if(!t?.setCodecPreferences||!window.RTCRtpSender?.getCapabilities)return;const rank=c=>/h264/i.test(c.mimeType)?0:/vp9/i.test(c.mimeType)?1:/vp8/i.test(c.mimeType)?2:3;t.setCodecPreferences([...RTCRtpSender.getCapabilities('video').codecs].sort((a,b)=>rank(a)-rank(b)));}
function liveApi(body){return api(body);}

// ---------- Composição do quadro (anfitrião) ----------
// Desenha a câmera do anfitrião (e a do convidado, quando houver) num canvas no formato escolhido; o áudio é misturado
// pela Web Audio. O stream do canvas é o que vai para o MediaMTX, então trocar de convidado não interrompe a transmissão.
let comp=null;
function coverDraw(ctx,video,x,y,w,h){
 if(!video||video.readyState<2||!video.videoWidth){ctx.fillStyle='#0e1713';ctx.fillRect(x,y,w,h);return;}
 const vr=video.videoWidth/video.videoHeight,r=w/h;let sw=video.videoWidth,sh=video.videoHeight,sx=0,sy=0;
 if(vr>r){sw=sh*r;sx=(video.videoWidth-sw)/2;}else{sh=sw/r;sy=(video.videoHeight-sh)/2;}
 ctx.drawImage(video,sx,sy,sw,sh,x,y,w,h);
}
function startComposite(format){
 const canvas=$('#live-canvas');const portrait=format==='portrait';canvas.width=portrait?720:1280;canvas.height=portrait?1280:720;
 const ctx=canvas.getContext('2d');
 const audioCtx=new (window.AudioContext||window.webkitAudioContext)();const dest=audioCtx.createMediaStreamDestination();
 const hostAudio=S.cameraStream.getAudioTracks().length?audioCtx.createMediaStreamSource(new MediaStream(S.cameraStream.getAudioTracks())):null;hostAudio?.connect(dest);
 const stream=canvas.captureStream(LIVE_FPS);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
 comp={canvas,ctx,audioCtx,dest,stream,hostVideo:$('#live-preview'),guestVideo:null,guestSource:null,cameraOff:false,raf:0,portrait};
 const draw=()=>{if(!comp)return;const {width:W,height:H}=canvas;
  if(comp.guestVideo){if(portrait){coverDraw(ctx,comp.cameraOff?null:comp.hostVideo,0,0,W,H/2);coverDraw(ctx,comp.guestVideo,0,H/2,W,H/2);}else{coverDraw(ctx,comp.cameraOff?null:comp.hostVideo,0,0,W/2,H);coverDraw(ctx,comp.guestVideo,W/2,0,W/2,H);}}
  else coverDraw(ctx,comp.cameraOff?null:comp.hostVideo,0,0,W,H);
  comp.raf=requestAnimationFrame(draw);};
 draw();return stream;
}
function compositeGuest(stream){
 if(!comp)return;if(comp.guestVideo){comp.guestVideo.srcObject=null;comp.guestVideo.remove();comp.guestSource?.disconnect();}
 if(!stream){comp.guestVideo=null;comp.guestSource=null;return;}
 const v=make('video');v.muted=true;v.playsInline=true;v.autoplay=true;v.srcObject=stream;v.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';document.body.append(v);v.play().catch(()=>{});
 comp.guestVideo=v;if(stream.getAudioTracks().length){comp.guestSource=comp.audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));comp.guestSource.connect(comp.dest);}
 if(comp.audioCtx.state==='suspended')comp.audioCtx.resume().catch(()=>{});
}
function stopComposite(){if(!comp)return;cancelAnimationFrame(comp.raf);compositeGuest(null);comp.stream.getTracks().forEach(t=>t.stop());comp.audioCtx.close().catch(()=>{});comp=null;}

// ---------- Anfitrião ----------
async function publishWhip(postId,key,stream){
 const pc=new RTCPeerConnection();stream.getTracks().forEach(track=>pc.addTransceiver(track,{direction:'sendonly',streams:[stream]}));preferH264(pc);
 const location=await sdpExchange(pc,'/live/'+postId+'/whip',{Authorization:'Bearer '+key});return {pc,location};
}
async function goLive(){
 const status=$('#live-status');
 if(!S.cameraStream?.active){liveUi('idle');throw Error('A câmera foi fechada. Toque em "Abrir câmera" de novo.');}
 status.textContent='Conectando…';
 await change({action:'live_start',text:$('#preview-text').value.trim().slice(0,300),format:liveFormat,communityId:$('#preview-community-target')?.value||''});
 const {postId,key}=S.state.live||{};
 const stream=startComposite(liveFormat);
 S.liveSession={postId,key,format:liveFormat,pc:null,location:'',since:0,guestPc:null,guestCandidates:0,timers:[],attempts:0,chat:new Map()};
 try{const out=await publishWhip(postId,key,stream);S.liveSession.pc=out.pc;S.liveSession.location=out.location;}
 catch(error){S.liveSession=null;stopComposite();await change({action:'delete',postId}).catch(()=>{});throw error;}
 watchPublisher();
 liveUi('live');status.textContent='Você está ao vivo. Quem segue você foi avisado.';
 S.liveSession.startedAt=Date.now();
 S.liveSession.timers.push(setInterval(hostTick,LIVE_POLL_MS),setInterval(()=>{if(S.liveSession)$('#live-elapsed').textContent=fmtElapsed(Date.now()-S.liveSession.startedAt);},1000));
 hostTick();
}
// Queda da publicação (rede móvel): publica de novo com o mesmo quadro, sem encerrar a live.
function watchPublisher(){
 const s=S.liveSession,pc=s.pc;
 pc.onconnectionstatechange=async()=>{if(!S.liveSession||S.liveSession.pc!==pc)return;
  if(pc.connectionState==='failed'||pc.connectionState==='disconnected'){
   await new Promise(r=>setTimeout(r,pc.connectionState==='disconnected'?4000:500));if(!S.liveSession||S.liveSession.pc!==pc||pc.connectionState==='connected')return;
   if(S.liveSession.attempts>=5){$('#live-status').textContent='A conexão com o servidor de vídeo caiu várias vezes. Encerre e tente de novo.';return;}
   S.liveSession.attempts++;$('#live-status').textContent='Reconectando a transmissão…';
   try{pc.close();const out=await publishWhip(S.liveSession.postId,S.liveSession.key,comp.stream);S.liveSession.pc=out.pc;S.liveSession.location=out.location;watchPublisher();$('#live-status').textContent='Transmissão reconectada.';}
   catch(error){$('#live-status').textContent=error.message;}
  }};
}
async function endLive(){
 const s=S.liveSession;if(!s)return;
 s.timers.forEach(clearInterval);try{s.guestPc?.close();}catch{}
 try{if(s.location)await fetch(s.location,{method:'DELETE',credentials:'same-origin'});}catch{}
 s.pc?.close();S.liveSession=null;stopComposite();stopCamera();liveUi('idle');
 const status=$('#live-status');status.textContent='Encerrando e guardando a gravação…';$('#live-host-chat').replaceChildren();$('#live-requests').replaceChildren();
 for(let attempt=0;attempt<3;attempt++){
  try{await change({action:'live_stop',postId:s.postId});status.textContent='Live encerrada. A gravação ficou na sua publicação.';return;}
  catch(error){status.textContent=error.message+(attempt<2?' Tentando encerrar de novo…':' Abra a publicação no feed e exclua-a se continuar "ao vivo".');await new Promise(r=>setTimeout(r,3000));}
 }
}
// Estado da live para o anfitrião: audiência, pedidos, convites, bate-papo e sinalização do convidado.
async function hostTick(){
 const s=S.liveSession;if(!s)return;
 let view;try{view=await apiGet({view:'live',id:s.postId,since:s.since});}catch{return;}
 if(!S.liveSession||S.liveSession!==s)return;
 $('#live-viewers').textContent=plural(view.live.viewers,'pessoa assistindo','pessoas assistindo');
 paintChat($('#live-host-chat'),view,s,true);paintPinned($('#live-host-pinned'),view);
 paintRequests(view);
 if($('#live-slow').value!==String(view.live.slowSeconds)&&document.activeElement!==$('#live-slow'))$('#live-slow').value=String(view.live.slowSeconds);
 $('#live-requests-open').checked=view.live.requestsOpen;
 await syncGuestAsHost(view);
}
function paintRequests(view){
 const box=$('#live-requests');box.replaceChildren();
 for(const r of view.requests||[]){const row=make('div',undefined,'live-request');row.append(avatarNode(r.name,r.avatar,32),make('strong',r.name+' pediu para participar'));
  button('Aceitar',()=>liveApi({action:'live_request_respond',postId:S.liveSession.postId,userId:r.userId,accept:true}).then(hostTick),row).className='opy-primary';
  button('Recusar',()=>liveApi({action:'live_request_respond',postId:S.liveSession.postId,userId:r.userId,accept:false}).then(hostTick),row);box.append(row);}
 for(const i of (view.invites||[]).filter(x=>x.status==='pending')){const row=make('div',undefined,'live-request');row.append(make('strong','Convite enviado a '+i.name),make('small',i.expiresAt?'válido por '+Math.max(0,Math.round((i.expiresAt-Date.now())/1000))+' s':''));button('Cancelar',()=>liveApi({action:'live_invite_cancel',postId:S.liveSession.postId,userId:i.userId}).then(hostTick),row);box.append(row);}
 if(view.live.guest){const row=make('div',undefined,'live-request is-guest');row.append(avatarNode(view.live.guest.name,view.live.guest.avatar,32),make('strong',view.live.guest.name+' está participando'+(view.live.guest.mic?'':' · sem microfone')+(view.live.guest.camera?'':' · sem câmera')));button('Remover',()=>liveApi({action:'live_guest_remove',postId:S.liveSession.postId}).then(hostTick),row).className='preview-secondary';box.append(row);}
}
// Sinalização com o convidado (lado do anfitrião): oferta → resposta → candidatos. A oferta leva câmera e microfone do anfitrião.
async function syncGuestAsHost(view){
 const s=S.liveSession;const guest=view.live.guest;
 if(!guest){if(s.guestPc){s.guestPc.close();s.guestPc=null;compositeGuest(null);s.guestKey='';}return;}
 if(s.guestPc&&s.guestKey!==guest.key){s.guestPc.close();s.guestPc=null;compositeGuest(null);}
 if(!s.guestPc){
  const pc=new RTCPeerConnection({iceServers:view.iceServers||[]});s.guestPc=pc;s.guestKey=guest.key;s.guestCandidates=0;s.guestAnswered=false;
  S.cameraStream.getTracks().forEach(t=>pc.addTrack(t,S.cameraStream));
  const incoming=new MediaStream();pc.ontrack=e=>{incoming.addTrack(e.track);compositeGuest(incoming);};
  pc.onicecandidate=e=>{if(e.candidate)liveApi({action:'live_signal',postId:s.postId,candidate:e.candidate.toJSON()}).catch(()=>{});};
  pc.onconnectionstatechange=()=>{if(s.guestPc===pc&&pc.connectionState==='failed'){toast('A conexão com '+guest.name+' caiu.');}};
  await pc.setLocalDescription(await pc.createOffer());
  await liveApi({action:'live_signal',postId:s.postId,offer:{type:'offer',sdp:pc.localDescription.sdp}}).catch(()=>{});
  return;
 }
 const sig=view.signal;if(!sig)return;
 if(sig.answer&&!s.guestAnswered&&s.guestPc.signalingState==='have-local-offer'){s.guestAnswered=true;await s.guestPc.setRemoteDescription(sig.answer).catch(()=>{});}
 if(s.guestAnswered)for(const c of (sig.candidates||[]).slice(s.guestCandidates)){s.guestCandidates++;await s.guestPc.addIceCandidate(c).catch(()=>{});}
}
async function flipCamera(){
 const facing=S.cameraFacing==='environment'?'user':'environment';
 try{const fresh=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing}});const track=fresh.getVideoTracks()[0];
  const old=S.cameraStream.getVideoTracks()[0];S.cameraStream.removeTrack(old);old.stop();S.cameraStream.addTrack(track);$('#live-preview').srcObject=S.cameraStream;
  // Convidado também passa a receber a câmera nova.
  S.liveSession?.guestPc?.getSenders().find(x=>x.track?.kind==='video')?.replaceTrack(track);
  S.cameraFacing=facing;}catch(error){$('#live-status').textContent='Não foi possível trocar de câmera.';}
}
function openInviteDialog(){
 const dlg=make('dialog');dlg.className='opy-dialog live-dialog';dlg.setAttribute('aria-label','Adicionar participante');
 const h=make('h2','Adicionar participante');const input=make('input');input.type='search';input.placeholder='Nome ou @usuário';input.setAttribute('aria-label','Buscar pessoa');
 const list=make('ul',undefined,'live-people');const close=make('button','Fechar','preview-secondary');close.type='button';close.onclick=()=>dlg.close();
 dlg.append(h,make('p','Quem está assistindo aparece primeiro. A pessoa precisa aceitar e liberar câmera e microfone.','chat-hint'),input,list,close);dlg.addEventListener('close',()=>dlg.remove());document.body.append(dlg);dlg.showModal();
 const row=p=>{const li=make('li');const b=make('button',undefined,'chat-person-btn');b.type='button';b.append(avatarNode(p.name,p.avatar,36),make('strong',p.name));b.onclick=async()=>{b.disabled=true;try{await liveApi({action:'live_invite',postId:S.liveSession.postId,userId:p.userId});toast('Convite enviado a '+p.name+'.');dlg.close();hostTick();}catch(e){showError(e.message);b.disabled=false;}};li.append(b);return li;};
 const paint=async()=>{list.replaceChildren();const q=input.value.trim();
  try{if(q.length>=2){const d=await apiGet({view:'search',q});for(const p of (d.people||[]).filter(x=>!x.own&&x.key?.startsWith('id:')).slice(0,12))list.append(row({userId:p.key.slice(3),name:p.name,avatar:p.avatar}));}
   else{const v=await apiGet({view:'live',id:S.liveSession.postId,since:Date.now()});const aud=(v.audience||[]).filter(a=>a.userId!==S.state.me.id);if(!aud.length)list.append(make('li','Ninguém assistindo ainda. Busque alguém pelo nome.','chat-list-empty'));for(const a of aud)list.append(row(a));}}
  catch(e){list.append(make('li',e.message,'chat-list-empty'));}};
 let wait;input.oninput=()=>{clearTimeout(wait);wait=setTimeout(paint,300);};paint();
}
function bindLiveStudio(){
 if(!$('#compose-live'))return;
 all('[data-live-format]').forEach(b=>b.addEventListener('click',()=>{if(S.liveMode==='live')return;liveFormat=b.dataset.liveFormat;liveUi(S.liveMode);}));
 $('#live-start').addEventListener('click',async()=>{const status=$('#live-status'),b=$('#live-start');b.disabled=true;
  try{if(S.liveMode==='idle'){S.cameraFacing='user';await startCamera($('#live-preview'),true);liveUi('preview');status.textContent=S.cameraStream.getAudioTracks().length?'Confira o enquadramento e toque em "Começar a transmitir".':'Sem microfone: a live sai sem som. Confira o enquadramento e toque em "Começar a transmitir".';return;}await goLive();}
  catch(error){status.textContent=error.message;if(!S.liveSession){stopCamera();liveUi('idle');}}finally{b.disabled=false;}});
 $('#live-flip').addEventListener('click',async()=>{if(S.liveSession)return flipCamera();S.cameraFacing=S.cameraFacing==='environment'?'user':'environment';try{await startCamera($('#live-preview'),true);}catch(error){$('#live-status').textContent=error.message;}});
 $('#live-cancel').addEventListener('click',()=>{stopCamera();liveUi('idle');$('#live-status').textContent='';});
 $('#live-stop').addEventListener('click',()=>{$('#live-stop').disabled=true;endLive().finally(()=>{$('#live-stop').disabled=false;});});
 $('#live-mic').addEventListener('click',()=>{const on=$('#live-mic').getAttribute('aria-pressed')!=='true';S.cameraStream?.getAudioTracks().forEach(t=>t.enabled=on);$('#live-mic').setAttribute('aria-pressed',String(on));$('#live-mic').textContent=on?'Microfone':'Microfone desligado';});
 $('#live-cam').addEventListener('click',()=>{const on=$('#live-cam').getAttribute('aria-pressed')!=='true';if(comp)comp.cameraOff=!on;S.liveSession?.guestPc?.getSenders().forEach(x=>{if(x.track?.kind==='video')x.track.enabled=on;});$('#live-cam').setAttribute('aria-pressed',String(on));$('#live-cam').textContent=on?'Câmera':'Câmera desligada';});
 $('#live-add').addEventListener('click',openInviteDialog);
 $('#live-slow').addEventListener('change',()=>S.liveSession&&liveApi({action:'live_slow',postId:S.liveSession.postId,seconds:Number($('#live-slow').value)}).catch(e=>showError(e.message)));
 $('#live-requests-open').addEventListener('change',()=>S.liveSession&&liveApi({action:'live_requests',postId:S.liveSession.postId,open:$('#live-requests-open').checked}).catch(e=>showError(e.message)));
 const sendHost=async()=>{const input=$('#live-host-text');const copy=input.value.trim();if(!copy||!S.liveSession)return;input.value='';try{await liveApi({action:'live_chat',postId:S.liveSession.postId,text:copy});hostTick();}catch(err){showError(err.message);input.value=copy;}};
 $('#live-host-send').addEventListener('click',sendHost);$('#live-host-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendHost();}});
 window.addEventListener('pagehide',()=>{if(S.liveSession)fetch('/api/community',{method:'POST',keepalive:true,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'live_stop',postId:S.liveSession.postId})}).catch(()=>{});});
}

// ---------- Bate-papo (compartilhado por anfitrião e visualizador) ----------
function paintChat(list,view,sess,asHost){
 if(!list)return;let added=false;
 for(const m of view.chat||[]){if(sess.chat.has(m.id))continue;sess.chat.set(m.id,m);added=true;
  const li=make('li',undefined,'live-msg'+(m.isHost?' is-host':''));li.dataset.id=m.id;
  li.append(avatarNode(m.author,m.avatar,24),make('strong',m.author+(m.isHost?' · anfitrião':'')),make('span',m.text));
  if(asHost||m.own){const tools=make('span',undefined,'live-msg-tools');
   if(asHost){const pin=make('button','Fixar',undefined);pin.type='button';pin.onclick=()=>liveApi({action:'live_pin',postId:sess.postId,msgId:m.id}).then(()=>asHost?hostTick():viewerTick()).catch(e=>showError(e.message));tools.append(pin);
    if(!m.isHost){const mute=make('button','Silenciar',undefined);mute.type='button';mute.onclick=()=>liveApi({action:'live_mute',postId:sess.postId,userId:m.authorId}).then(()=>toast(m.author+' não pode mais escrever nesta live.')).catch(e=>showError(e.message));tools.append(mute);}}
   const del=make('button','Apagar',undefined);del.type='button';del.onclick=()=>liveApi({action:'live_chat_delete',postId:sess.postId,msgId:m.id}).then(()=>{li.remove();}).catch(e=>showError(e.message));tools.append(del);li.append(tools);}
  list.append(li);sess.since=Math.max(sess.since,m.createdAt);}
 while(list.children.length>200)list.firstElementChild.remove();
 if(added&&list.scrollHeight-list.scrollTop-list.clientHeight<160)list.scrollTop=list.scrollHeight;
}
function paintPinned(box,view){if(!box)return;const p=view.live.pinned;box.hidden=!p;if(p){box.replaceChildren(make('span','Fixado · '+p.author,'live-pinned-who'),make('span',p.text));}}

// ---------- Visualizador (espectador e convidado) ----------
function closeLiveViewer(){const v=S.liveViewer;if(!v)return;S.liveViewer=null;v.timers?.forEach(clearInterval);if(v.location)fetch(v.location,{method:'DELETE',credentials:'same-origin'}).catch(()=>{});v.pc?.close();v.guestPc?.close();v.localStream?.getTracks().forEach(t=>t.stop());const video=$('#live-viewer video.live-main');if(video){video.pause();video.srcObject=null;}if(document.fullscreenElement)document.exitFullscreen?.();}
async function connectWhep(post,v,video,status){
 const pc=new RTCPeerConnection();pc.addTransceiver('video',{direction:'recvonly'});pc.addTransceiver('audio',{direction:'recvonly'});v.pc=pc;
 const stream=new MediaStream();pc.ontrack=event=>{if(S.liveViewer!==v||v.asGuest)return;stream.addTrack(event.track);if(video.srcObject!==stream){video.srcObject=stream;video.muted=false;video.play().catch(()=>{video.muted=true;video.play().catch(()=>{});status.textContent='Toque no vídeo para ativar o som.';});}};
 pc.onconnectionstatechange=async()=>{if(S.liveViewer!==v||v.pc!==pc)return;if(pc.connectionState==='connected')status.textContent='';
  else if(['failed','disconnected'].includes(pc.connectionState)){status.textContent='Reconectando…';await new Promise(r=>setTimeout(r,1500));if(S.liveViewer!==v||v.pc!==pc||v.asGuest)return;pc.close();try{v.location=await connectWhep(post,v,video,status);}catch(e){status.textContent='A transmissão terminou ou caiu.';}}};
 return sdpExchange(pc,'/live/'+post.id+'/whep',{});
}
async function openLiveViewer(post){
 let dlg=$('#live-viewer');
 if(!dlg){
  dlg=make('dialog');dlg.id='live-viewer';dlg.setAttribute('aria-label','Transmissão ao vivo');
  const head=make('div',undefined,'live-viewer-head');const who=make('button',undefined,'live-viewer-who');who.type='button';head.append(who);
  const actions=make('div',undefined,'live-viewer-actions');
  const follow=make('button','Seguir','story-icon-btn live-follow');follow.type='button';const share=make('button','Compartilhar','story-icon-btn live-share');share.type='button';const full=make('button','Tela cheia','story-icon-btn live-full');full.type='button';const close=make('button','Fechar','story-icon-btn live-close');close.type='button';close.onclick=()=>dlg.close();
  actions.append(follow,share,full,close);head.append(actions);
  const stage=make('div',undefined,'live-stage-view');const video=make('video',undefined,'live-main');video.autoplay=true;video.playsInline=true;video.setAttribute('playsinline','');video.controls=false;
  const badge=make('div',undefined,'live-badges');badge.append(make('span','AO VIVO','live-on'),make('span','00:00','live-elapsed'),make('span','','live-count'));
  const burst=make('div',undefined,'live-burst');burst.setAttribute('aria-hidden','true');const self=make('video',undefined,'live-self');self.autoplay=true;self.muted=true;self.playsInline=true;self.hidden=true;
  const status=make('p',undefined,'live-viewer-status');status.setAttribute('role','status');
  stage.append(video,self,badge,burst,status);
  const side=make('div',undefined,'live-side');const banner=make('div',undefined,'live-banner');banner.hidden=true;const pinned=make('div',undefined,'live-pinned');pinned.hidden=true;
  const chat=make('ol',undefined,'live-chat');chat.setAttribute('aria-live','polite');chat.setAttribute('aria-label','Bate-papo da live');
  const reacts=make('div',undefined,'live-react-row');reacts.setAttribute('role','group');reacts.setAttribute('aria-label','Reagir');
  for(const e of liveReactionSet){const b=make('button',e,undefined);b.type='button';b.setAttribute('aria-label','Reagir com '+e);b.onclick=()=>{if(!S.liveViewer)return;floatReaction(burst,e);liveApi({action:'live_react',postId:S.liveViewer.post.id,emoji:e}).catch(()=>{});};reacts.append(b);}
  const form=make('form',undefined,'live-chat-form');const input=make('input');input.maxLength=300;input.placeholder='Comente ao vivo…';input.setAttribute('aria-label','Comentar na live');const send=make('button','Enviar','opy-primary');send.type='submit';
  const join=make('button','Pedir para participar','preview-secondary live-join');join.type='button';form.append(input,send);
  const guestBar=make('div',undefined,'live-guest-bar');guestBar.hidden=true;
  side.append(banner,pinned,chat,reacts,form,join,guestBar);
  dlg.append(head,stage,side);dlg.addEventListener('close',closeLiveViewer);document.body.append(dlg);
  form.onsubmit=async e=>{e.preventDefault();const copy=input.value.trim();if(!copy||!S.liveViewer)return;input.value='';try{await liveApi({action:'live_chat',postId:S.liveViewer.post.id,text:copy});viewerTick();}catch(err){status.textContent=err.message;input.value=copy;}};
  join.onclick=async()=>{if(!S.liveViewer)return;try{await liveApi({action:'live_request',postId:S.liveViewer.post.id});viewerTick();}catch(err){status.textContent=err.message;}};
  full.onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else (stage.requestFullscreen?.()||video.webkitEnterFullscreen?.());};
  share.onclick=()=>{const url=location.origin+'/#post-'+S.liveViewer.post.id;if(navigator.share)navigator.share({title:'Live de '+S.liveViewer.post.author+' · Casa Opy',url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(()=>toast('Link da live copiado.')).catch(()=>{});};
  follow.onclick=()=>{const key=S.liveViewer?.view?.live.host.key;if(key)change({action:'follow',authorKey:key}).then(viewerTick).catch(e=>showError(e.message));};
  who.onclick=()=>{const key=S.liveViewer?.view?.live.host.key;if(key)openProfile(key);};
 }
 closeLiveViewer();
 const video=$('video.live-main',dlg),status=$('.live-viewer-status',dlg);status.textContent='Conectando à transmissão…';
 $('.live-viewer-who',dlg).replaceChildren(avatarNode(post.author,post.avatar,36),make('strong',post.author));
 dlg.dataset.format=post.live?.format||'portrait';$('.live-chat',dlg).replaceChildren();$('.live-banner',dlg).hidden=true;$('.live-guest-bar',dlg).hidden=true;$('.live-join',dlg).hidden=false;
 const v={post,pc:null,location:'',since:0,chat:new Map(),timers:[],asGuest:false,view:null};S.liveViewer=v;
 if(!dlg.open)dlg.showModal();
 v.timers.push(setInterval(viewerTick,LIVE_POLL_MS),setInterval(()=>liveApi({action:'live_watch',postId:post.id}).catch(()=>{}),LIVE_BEAT_MS),setInterval(()=>{if(v.view)$('.live-elapsed',dlg).textContent=fmtElapsed(Date.now()-v.view.live.startedAt);},1000));
 liveApi({action:'live_watch',postId:post.id}).catch(()=>{});viewerTick();
 try{v.location=await connectWhep(post,v,video,status);}catch(error){if(S.liveViewer===v)status.textContent=error.message;}
}
function floatReaction(burst,emoji){const s=make('span',emoji,'live-float');s.style.left=(20+Math.random()*60)+'%';burst.append(s);setTimeout(()=>s.remove(),2200);}
async function viewerTick(){
 const v=S.liveViewer;if(!v)return;const dlg=$('#live-viewer');
 let view;try{view=await apiGet({view:'live',id:v.post.id,since:v.since});}catch{return;}
 if(S.liveViewer!==v)return;v.view=view;
 $('.live-count',dlg).textContent=plural(view.live.viewers,'pessoa','pessoas');dlg.dataset.format=view.live.format;
 const follow=$('.live-follow',dlg);follow.hidden=view.live.role==='host';follow.textContent=view.live.host.following?'Seguindo':'Seguir';follow.setAttribute('aria-pressed',String(!!view.live.host.following));
 paintChat($('.live-chat',dlg),view,v,false);paintPinned($('.live-pinned',dlg),view);
 for(const r of (view.quick?.recent||[]).filter(r=>r.at>(v.lastBurst||0)))floatReaction($('.live-burst',dlg),r.emoji);if(view.quick?.recent?.length)v.lastBurst=Math.max(v.lastBurst||0,...view.quick.recent.map(r=>r.at));
 const input=$('.live-chat-form input',dlg);input.disabled=view.live.muted;input.placeholder=view.live.muted?'Quem transmite silenciou você nesta live.':view.live.slowSeconds?'Modo lento: 1 mensagem a cada '+view.live.slowSeconds+' s':'Comente ao vivo…';
 if(!view.live.active){$('.live-viewer-status',dlg).textContent='Esta live terminou.'+(view.live.media?' A gravação está na publicação.':'');$('.live-join',dlg).hidden=true;$('.live-banner',dlg).hidden=true;v.timers.forEach(clearInterval);return;}
 // Convite para participar.
 const banner=$('.live-banner',dlg),join=$('.live-join',dlg);
 if(view.live.role==='guest'){join.hidden=true;banner.hidden=true;await syncGuestAsGuest(view);}
 else if(view.live.myInvite==='pending'){join.hidden=true;banner.hidden=false;banner.replaceChildren(make('strong',view.live.host.name+' convidou você para participar com câmera e microfone.'));const ok=button('Entrar na live',()=>openGuestPreview(view),banner);ok.className='opy-primary';button('Recusar',()=>liveApi({action:'live_invite_respond',postId:v.post.id,accept:false}).then(viewerTick),banner);}
 else{banner.hidden=true;join.hidden=view.live.role==='host'||!view.live.requestsOpen&&view.live.myInvite!=='requested';join.textContent=view.live.myInvite==='requested'?'Cancelar pedido para participar':'Pedir para participar';join.setAttribute('aria-pressed',String(view.live.myInvite==='requested'));
  if(v.asGuest){leaveGuestLocally(v,'Você saiu da participação. Continua assistindo.');}}
}
// Prévia de câmera e microfone antes de entrar: a pessoa escolhe os aparelhos e confirma. Nada é enviado antes disso.
async function openGuestPreview(view){
 const v=S.liveViewer;if(!v)return;
 const dlg=make('dialog');dlg.className='opy-dialog live-dialog';dlg.setAttribute('aria-label','Entrar na live');
 const h=make('h2','Entrar na live de '+view.live.host.name);const prev=make('video');prev.autoplay=true;prev.muted=true;prev.playsInline=true;prev.className='live-guest-preview';
 const camSel=make('select'),micSel=make('select');const l1=make('label','Câmera');l1.append(camSel);const l2=make('label','Microfone');l2.append(micSel);
 const status=make('p',undefined,'preview-feedback');const row=make('div',undefined,'adm-dialog-actions');
 const cancel=make('button','Agora não','preview-secondary');cancel.type='button';cancel.onclick=()=>dlg.close();const go=make('button','Entrar com câmera e microfone','opy-primary');go.type='button';go.disabled=true;row.append(cancel,go);
 dlg.append(h,make('p','Você aparece ao lado de quem transmite. Pode sair quando quiser e voltar a só assistir.','chat-hint'),prev,l1,l2,status,row);dlg.addEventListener('close',()=>{if(!dlg.dataset.keep)dlg._stream?.getTracks().forEach(t=>t.stop());dlg.remove();});document.body.append(dlg);dlg.showModal();
 const open=async()=>{dlg._stream?.getTracks().forEach(t=>t.stop());try{dlg._stream=await navigator.mediaDevices.getUserMedia({video:camSel.value?{deviceId:{exact:camSel.value}}:{facingMode:'user'},audio:micSel.value?{deviceId:{exact:micSel.value}}:true});prev.srcObject=dlg._stream;go.disabled=false;status.textContent='';
   const devs=await navigator.mediaDevices.enumerateDevices();for(const [sel,kind] of [[camSel,'videoinput'],[micSel,'audioinput']]){const cur=sel.value;sel.replaceChildren(...devs.filter(d=>d.kind===kind).map((d,i)=>new Option(d.label||(kind==='videoinput'?'Câmera ':'Microfone ')+(i+1),d.deviceId)));if(cur)sel.value=cur;}}
  catch(e){status.textContent='Não foi possível abrir câmera e microfone. Permita o acesso e tente de novo.';go.disabled=true;}};
 camSel.onchange=open;micSel.onchange=open;await open();
 go.onclick=async()=>{go.disabled=true;try{const res=await liveApi({action:'live_invite_respond',postId:v.post.id,accept:true});v.guestToken=res.live?.guestToken||'';v.localStream=dlg._stream;dlg.dataset.keep='1';dlg.close();v.asGuest=true;v.guestCandidates=0;
   const self=$('#live-viewer video.live-self');self.srcObject=v.localStream;self.hidden=false;paintGuestBar(v);$('.live-viewer-status',$('#live-viewer')).textContent='Conectando com quem transmite…';viewerTick();}
  catch(e){status.textContent=e.message;go.disabled=false;}};
}
function paintGuestBar(v){
 const bar=$('.live-guest-bar',$('#live-viewer'));bar.hidden=false;bar.replaceChildren(make('strong','Você está participando'));
 const mic=button('Microfone',()=>{const t=v.localStream.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;mic.setAttribute('aria-pressed',String(t.enabled));mic.textContent=t.enabled?'Microfone':'Microfone desligado';return liveApi({action:'live_guest_media',postId:v.post.id,mic:t.enabled});},bar);mic.setAttribute('aria-pressed','true');
 const cam=button('Câmera',()=>{const t=v.localStream.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;cam.setAttribute('aria-pressed',String(t.enabled));cam.textContent=t.enabled?'Câmera':'Câmera desligada';return liveApi({action:'live_guest_media',postId:v.post.id,camera:t.enabled});},bar);cam.setAttribute('aria-pressed','true');
 button('Sair da participação',async()=>{await liveApi({action:'live_guest_leave',postId:v.post.id}).catch(()=>{});leaveGuestLocally(v,'Você saiu da participação. Continua assistindo.');viewerTick();},bar);
}
function leaveGuestLocally(v,message){
 v.asGuest=false;v.guestPc?.close();v.guestPc=null;v.localStream?.getTracks().forEach(t=>t.stop());v.localStream=null;
 const dlg=$('#live-viewer');$('.live-guest-bar',dlg).hidden=true;const self=$('video.live-self',dlg);self.hidden=true;self.srcObject=null;
 const main=$('video.live-main',dlg),status=$('.live-viewer-status',dlg);main.srcObject=null;status.textContent=message;
 // Volta ao caminho de espectador (WHEP).
 connectWhep(v.post,v,main,status).then(loc=>{v.location=loc;}).catch(()=>{});
}
// Sinalização do lado do convidado: recebe a oferta do anfitrião, responde, troca candidatos. O vídeo do anfitrião chega direto (baixa latência).
async function syncGuestAsGuest(view){
 const v=S.liveViewer;if(!v.asGuest)return;const sig=view.signal;if(!sig?.offer)return;
 if(!v.guestPc){
  if(v.pc){v.pc.close();v.pc=null;if(v.location)fetch(v.location,{method:'DELETE',credentials:'same-origin'}).catch(()=>{});v.location='';}
  const pc=new RTCPeerConnection({iceServers:view.iceServers||[]});v.guestPc=pc;v.guestCandidates=0;
  v.localStream.getTracks().forEach(t=>pc.addTrack(t,v.localStream));
  const main=$('#live-viewer video.live-main'),status=$('#live-viewer .live-viewer-status');const incoming=new MediaStream();
  pc.ontrack=e=>{incoming.addTrack(e.track);if(main.srcObject!==incoming){main.srcObject=incoming;main.muted=false;main.play().catch(()=>{main.muted=true;main.play().catch(()=>{});});}};
  pc.onicecandidate=e=>{if(e.candidate)liveApi({action:'live_signal',postId:v.post.id,token:v.guestToken,candidate:e.candidate.toJSON()}).catch(()=>{});};
  pc.onconnectionstatechange=()=>{if(v.guestPc!==pc)return;if(pc.connectionState==='connected')status.textContent='';else if(pc.connectionState==='failed')status.textContent='A conexão com quem transmite caiu. Saia e entre de novo.';};
  await pc.setRemoteDescription(sig.offer);await pc.setLocalDescription(await pc.createAnswer());
  await liveApi({action:'live_signal',postId:v.post.id,token:v.guestToken,answer:{type:'answer',sdp:pc.localDescription.sdp}}).catch(e=>{status.textContent=e.message;});
 }
 for(const c of (sig.candidates||[]).slice(v.guestCandidates)){v.guestCandidates++;await v.guestPc.addIceCandidate(c).catch(()=>{});}
}
bindLiveStudio();
