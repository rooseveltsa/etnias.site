import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const snapshot=key=>({selected:{name:key,key,members:[]},people:[],conversations:[],messages:[],invitations:[],hasMore:false,me:{id:'A'}});
function setup(){
 const elements=new Map(),requests=[],reads=[];
 const element=()=>({value:'',checked:false,dataset:{},scrollHeight:100,scrollTop:100,clientHeight:100,files:[],append(){},prepend(){},replaceChildren(){},setAttribute(){},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const runtime={Intl,Date,URLSearchParams,AbortController,Map,Set,JSON,Error,TypeError,setTimeout,clearTimeout,setInterval(){},crypto:{randomUUID:()=> '44444444-4444-4444-8444-444444444444'},location:{search:'?p=id:B',pathname:'/chat/'},history:{replaceState(){}},navigator:{onLine:true},document:{hidden:false,querySelector:get,querySelectorAll:()=>[],createElement:element,addEventListener(){}},window:{addEventListener(){}},fetch:()=>new Promise(resolve=>requests.push(resolve)),FileReader:class {readAsDataURL(){reads.push(()=>{this.result='data:text/plain;base64,b2k=';this.onload();});}}};
 const source=fs.readFileSync('preview/chat.js','utf8').replace(/\}\)\(\);\s*$/,'globalThis.check={choose,refresh,send,state:()=>({key,data,sending,attachment})};})();');
 vm.runInNewContext(source,runtime);
 const resolve=payload=>{assert.ok(requests.length);requests.shift()({status:200,ok:true,json:async()=>payload});};
 return {runtime,get,requests,reads,resolve,check:runtime.check};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('troca durante atualização bloqueia envio até confirmar o destinatário correto',async()=>{
 const h=setup();h.resolve(snapshot('id:B'));await tick();const old=h.check.refresh();const chosen=h.check.choose('id:C');
 assert.ok(h.get('#chat-send').disabled || h.get('#chat-form').hidden);
 h.resolve(snapshot('id:B'));await old;
 if(h.requests.length)h.resolve(snapshot('id:C'));await chosen;
 assert.equal(h.check.state().data.selected.key,h.check.state().key);
});
test('sucesso do envio preserva texto escrito depois de apertar Enviar',async()=>{
 const h=setup();h.resolve(snapshot('id:B'));await tick();h.get('#chat-text').value='primeira';const sending=h.check.send();
 h.get('#chat-text').value='rascunho novo';h.resolve(snapshot('id:B'));await sending;
 assert.equal(h.get('#chat-text').value,'rascunho novo');
});
test('FileReader atrasado não anexa arquivo na conversa selecionada depois',async()=>{
 const h=setup();h.resolve(snapshot('id:B'));await tick();
 const read=h.get('#chat-file').onchange({target:{files:[{name:'aviso.txt',size:2,type:'text/plain'}]}});
 const chosen=h.check.choose('id:C');h.resolve(snapshot('id:C'));await chosen;h.reads.shift()();await read;
 assert.equal(h.check.state().attachment,null);
});
