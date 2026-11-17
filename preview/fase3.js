/* Etnias — ajustes de navegação e usabilidade (fase 3). Carregado depois de preview.js.
   Os interruptores abaixo ocultam sem apagar código: troque para true para voltar o item. */
(function(){
'use strict';
const FLAGS={
 aldeia:false,          // "Onde publicar" (aldeia/comunidade) no compositor do feed
 barraSaberes:false,    // Saberes na barra inferior (continua no menu lateral)
 barraComunidades:false // Comunidades na barra inferior (continua no menu lateral)
};
const root=document.documentElement;
root.dataset.flagAldeia=FLAGS.aldeia?'on':'off';
root.dataset.flagBarSaberes=FLAGS.barraSaberes?'on':'off';
root.dataset.flagBarComunidades=FLAGS.barraComunidades?'on':'off';
window.OpyFlags=FLAGS;
const $=(s,r=document)=>r.querySelector(s),all=(s,r=document)=>[...r.querySelectorAll(s)];
const ns='http://www.w3.org/2000/svg';
function icon(d,fill){const s=document.createElementNS(ns,'svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('class','opy-mini-icon');const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill',fill?'currentColor':'none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.8');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');s.append(p);return s;}

// 11/12 — compositor: quem vê em 3 opções curtas e botão Publicar no alto, sempre ao alcance.
function tuneComposer(){
 const form=$('#opy-compose');if(!form||form.dataset.tuned)return;form.dataset.tuned='1';
 const aud=$('#preview-audience');
 if(aud){
  const short={public:'Público',friends:'Amigos',private:'Só eu'};
  for(const o of aud.options){o.dataset.full=o.textContent;o.textContent=short[o.value]||o.textContent;}
  aud.setAttribute('aria-label','Quem vê esta publicação');aud.title='Quem vê esta publicação';
 }
 const submit=$('.preview-publish-row > button[type=submit]',form),head=$('.compose-head',form),text=$('#preview-text');
 if(submit&&head&&text){
  submit.classList.add('compose-publish-top');head.append(submit);
  const sync=()=>{const has=text.value.trim().length>0||all('.compose-slot:not([hidden]) *',form).length>0;form.classList.toggle('has-content',has);};
  text.addEventListener('input',sync);form.addEventListener('change',sync);new MutationObserver(sync).observe(form,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});sync();
 }
}

// 13 — filtros de mídia com ícone e nome.
const CHIP_ICONS={
 news:'M4 6h16M4 12h16M4 18h10',
 following:'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c.6-4 4-6 8-6s7.4 2 8 6',
 discover:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
 photos:'M4 6h16v12H4zM4 16l5-5 4 4 2-2 5 5M9 10a1 1 0 1 0 0-.01',
 videos:'M3 7h12v10H3zM15 11l6-3v8l-6-3',
 files:'M7 3h7l5 5v13H7zM14 3v5h5',
 audio:'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
 location:'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
 archive:'M3 5h18v4H3zM5 9v10h14V9M10 13h4'
};
function tuneChips(){
 all('[data-feed-view]').forEach(b=>{
  if(b.dataset.iconed)return;b.dataset.iconed='1';
  const label=b.textContent.trim();b.textContent='';
  const d=CHIP_ICONS[b.dataset.feedView];if(d)b.append(icon(d));
  const t=document.createElement('span');t.textContent=label;b.append(t);
 });
}

// 8 — botão de criar flutuante: no computador sempre, no celular quando a barra inferior se esconde ao rolar.
function addFab(){
 if($('.opy-fab')||document.body.dataset.previewRoute==='entrar')return;
 const a=document.createElement('a');a.className='opy-fab';a.href='/#opy-compose';a.setAttribute('data-opy-compose','');
 a.setAttribute('aria-label','Criar publicação');a.title='Criar publicação';
 a.append(icon('M12 5v14M5 12h14'));const s=document.createElement('span');s.textContent='Criar';a.append(s);
 a.addEventListener('click',e=>{
  if(document.body.dataset.previewRoute==='home'&&!matchMedia('(max-width:700px)').matches){
   e.preventDefault();const t=$('#preview-text');if(t){t.scrollIntoView({block:'center',behavior:'smooth'});t.focus({preventScroll:true});}
  }
 });
 document.body.append(a);
}

// Figurinhas: seletor com abas por pacote. onPick recebe {id,name,url}. Usado nos comentários e no chat.
const stickerCache={at:0,data:null};
async function stickerCatalog(){
 if(stickerCache.data&&Date.now()-stickerCache.at<60000)return stickerCache.data;
 const r=await fetch('/api/community?view=stickers',{credentials:'same-origin',cache:'no-store'});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Não foi possível carregar as figurinhas.');
 stickerCache.at=Date.now();stickerCache.data=j;return j;
}
window.OpyStickers={
 open(root,onPick){
  root.classList.add('opy-stickers');root.hidden=false;
  const status=document.createElement('p');status.className='opy-stickers-status';status.textContent='Carregando figurinhas…';root.replaceChildren(status);
  stickerCatalog().then(cat=>{
   const packs=cat.packs.filter(p=>p.items.length);
   if(!packs.length){status.textContent='Ainda não há figurinhas. A equipe do Etnias está preparando os pacotes.';return;}
   let current=packs[0].id;
   const tabs=document.createElement('div');tabs.className='opy-stickers-tabs';tabs.setAttribute('role','tablist');
   const grid=document.createElement('div');grid.className='opy-stickers-grid';
   const paint=()=>{
    for(const b of tabs.children)b.setAttribute('aria-selected',String(b.dataset.pack===current));
    const pack=packs.find(p=>p.id===current);
    grid.replaceChildren(...pack.items.map(it=>{const b=document.createElement('button');b.type='button';b.className='opy-sticker-btn';b.setAttribute('aria-label',it.name);
     const im=document.createElement('img');im.src='/api/media?id='+it.mediaId;im.alt='';im.width=72;im.height=72;im.loading='lazy';im.decoding='async';b.append(im);
     b.onclick=()=>onPick({id:it.id,name:it.name,url:im.src});return b;}));
   };
   for(const p of packs){const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.dataset.pack=p.id;b.textContent=p.name;b.title=p.category;b.onclick=()=>{current=p.id;paint();};tabs.append(b);}
   root.replaceChildren(tabs,grid);paint();
  }).catch(e=>{status.textContent=e.message;});
 }
};

// Composer: botão "Usar minha localização" no painel de local (só com o toque da pessoa; guarda apenas cidade/UF).
function addGeoButton(){
 const place=document.getElementById('compose-place');if(!place||document.getElementById('compose-geo'))return;
 const b=document.createElement('button');b.type='button';b.id='compose-geo';b.className='preview-secondary compose-geo';b.textContent='Usar minha localização';
 const note=document.createElement('p');note.className='compose-geo-note';note.setAttribute('role','status');note.textContent='Opcional. Só a cidade e a UF vão para a publicação.';
 b.onclick=()=>{
  if(!navigator.geolocation){note.textContent='Este navegador não oferece localização. Digite o local.';return;}
  b.disabled=true;note.textContent='Pedindo a localização ao navegador…';
  navigator.geolocation.getCurrentPosition(async pos=>{
   try{const r=await fetch('/api/community?view=geo&lat='+pos.coords.latitude.toFixed(2)+'&lon='+pos.coords.longitude.toFixed(2),{credentials:'same-origin'});const j=await r.json();
    if(!r.ok)throw Error(j.error||'Falhou');place.value=[j.city,j.uf].filter(Boolean).join(', ');place.dispatchEvent(new Event('input',{bubbles:true}));note.textContent='Local preenchido: '+place.value+'. Você pode editar.';}
   catch(e){note.textContent=e.message||'Não foi possível descobrir a cidade agora.';}finally{b.disabled=false;}
  },err=>{b.disabled=false;note.textContent=err.code===1?'Permissão negada. Digite o local ou libere nas configurações do navegador.':'Não foi possível obter a localização agora.';},{timeout:12000,maximumAge:600000});
 };
 place.insertAdjacentElement('afterend',note);place.insertAdjacentElement('afterend',b);
}
function init(){tuneComposer();tuneChips();addFab();addGeoButton();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
