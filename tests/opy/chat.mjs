import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const chat = await import('../../preview/server/chat.mjs').catch(() => ({}));
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana' };
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Beto' };
const outsider = { id: '33333333-3333-4333-8333-333333333333', name: 'Caio' };
const key = p => 'id:' + p.id;
const fresh = () => ({ accounts: [alice, bob, outsider], dms: [] });
const act = (s, who, body, media) => chat.chatAction(s, who, body, media);
const send = (s, who=alice, to=bob, extra={}) => act(s, who, { action:'dm', toKey:key(to), text:'Olá', clientId:randomUUID(), ...extra });
const view = (s, who=alice, other=bob, extra={}) => chat.chatSnapshot(s, who, new URLSearchParams({ key:key(other), ...extra }));
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);

test('destinatários precisam existir e remetente nunca é confiado ao cliente', () => {
 const s=fresh(); assert.equal(typeof chat.chatAction,'function');
 rejects(()=>send(s,alice,bob,{toKey:'name:Acervo'}),404);
 rejects(()=>send(s,alice,bob,{toKey:'id:'+randomUUID()}),404);
 rejects(()=>send(s,alice,alice),400);
 send(s,alice,bob,{fromKey:key(outsider)}); assert.equal(s.dms[0].fromKey,key(alice));
 assert.equal(view(s,outsider,bob).messages.length,0);
});
test('reenvio após perda de resposta não duplica e limite preserva histórico',()=>{
 const s=fresh(), clientId=randomUUID(); send(s,alice,bob,{clientId}); send(s,alice,bob,{clientId});
 assert.equal(s.dms.length,1);
 rejects(()=>send(s,alice,bob,{clientId,text:'Outro texto'}),409);
 s.dms=Array.from({length:10000},(_,i)=>({...s.dms[0],id:String(i),clientId:String(i)}));
 rejects(()=>send(s),409); assert.equal(s.dms.length,10000); assert.equal(s.dms[0].id,'0');
});
test('paginação, busca, preferências e leitura são privadas por conta',()=>{
 const s=fresh(); for(let i=0;i<35;i++)send(s,alice,bob,{text:'mensagem '+i});
 const page=view(s,bob,alice); assert.equal(page.messages.length,30); assert.equal(page.hasMore,true);
 assert.equal(view(s,bob,alice,{before:page.messages[0].id}).messages.length,5);
 assert.equal(view(s,bob,alice,{q:'mensagem 34'}).messages.length,1);
 assert.equal(page.conversations[0].unread,35);
 act(s,bob,{action:'chat_read',key:key(alice),messageId:s.dms[34].id});
 assert.equal(view(s,bob,alice).conversations[0].unread,0);
 act(s,bob,{action:'chat_preferences',key:key(alice),pinned:true,muted:true,archived:true,unread:true});
 assert.equal(view(s,bob,alice).conversations[0].muted,true);
 assert.equal(view(s,alice,bob).conversations[0].muted,false);
});
test('edição, resposta, reações, apagar para mim/todos e IDOR',()=>{
 const s=fresh(); send(s); const id=s.dms[0].id;
 rejects(()=>act(s,bob,{action:'chat_edit',messageId:id,text:'fraude'}),403);
 rejects(()=>act(s,outsider,{action:'chat_react',messageId:id,reaction:'❤️'}),404);
 act(s,alice,{action:'chat_edit',messageId:id,text:'Corrigida'});
 send(s,bob,alice,{replyTo:id}); assert.equal(view(s).messages[1].reply.text,'Corrigida');
 act(s,bob,{action:'chat_react',messageId:id,reaction:'❤️'});
 assert.equal(view(s).messages[0].reactions['❤️'],1);
 rejects(()=>act(s,bob,{action:'chat_react',messageId:id,reaction:'<script>'}),400);
 act(s,bob,{action:'chat_delete',messageId:id,scope:'me'});
 assert.equal(view(s,bob,alice).messages.length,1); assert.equal(view(s).messages.length,2);
 act(s,alice,{action:'chat_delete',messageId:id,scope:'all'});
 assert.equal(view(s).messages[0].text,''); assert.equal(view(s).messages[1].reply.text,'Mensagem apagada');
 assert.equal(view(s).messages[0].deleted,true);
 rejects(()=>act(s,alice,{action:'chat_edit',messageId:id,text:'restaurar'}),409);
});
test('bloqueio bilateral impede mensagens e denúncias não vazam',()=>{
 const s=fresh(); send(s); const id=s.dms[0].id;
 act(s,bob,{action:'chat_block',key:key(alice),blocked:true});
 rejects(()=>send(s),403); rejects(()=>send(s,bob,alice),403);
 act(s,bob,{action:'chat_report',messageId:id,reason:'Assédio'});
 assert.equal(chat.chatSnapshot(s,bob,new URLSearchParams()).reports.length,1);
 assert.equal(chat.chatSnapshot(s,alice,new URLSearchParams()).reports.length,0);
 rejects(()=>act(s,outsider,{action:'chat_report',messageId:id,reason:'Teste'}),404);
});
test('anexos só pertencem aos participantes e deixam de estar acessíveis após exclusão',()=>{
 const s=fresh(), media={id:randomUUID(),kind:'file',name:'aviso.pdf'};
 act(s,alice,{action:'dm',toKey:key(bob),text:'',clientId:randomUUID()},media);
 assert.equal(chat.chatMedia(s,bob,media.id).name,'aviso.pdf');
 assert.equal(chat.chatMedia(s,outsider,media.id),null);
 const id=s.dms[0].id; act(s,bob,{action:'chat_delete',messageId:id,scope:'me'});
 assert.equal(chat.chatMedia(s,bob,media.id),null);
 act(s,alice,{action:'chat_delete',messageId:id,scope:'all'});
 assert.equal(chat.chatMedia(s,alice,media.id),null);
});
test('grupos exigem convite aceito, restringem administração e revogam leitura',()=>{
 const s=fresh(); act(s,alice,{action:'chat_group_create',name:'Organização',members:[key(bob)]});
 const group=s.chatGroups[0], k='group:'+group.id;
 rejects(()=>act(s,bob,{action:'dm',toKey:k,text:'Não aceitei'}),404);
 act(s,bob,{action:'chat_group_accept',key:k});
 act(s,alice,{action:'dm',toKey:k,text:'Reunião',clientId:randomUUID()});
 assert.equal(chat.chatSnapshot(s,bob,new URLSearchParams({key:k})).messages.length,1);
 rejects(()=>act(s,bob,{action:'chat_group_update',key:k,name:'Invadido'}),403);
 rejects(()=>chat.chatSnapshot(s,outsider,new URLSearchParams({key:k})),404);
 act(s,alice,{action:'chat_group_remove',key:k,memberKey:key(bob)});
 rejects(()=>chat.chatSnapshot(s,bob,new URLSearchParams({key:k})),404);
});
test('aceitar convite no mesmo milissegundo não revela mensagem anterior',()=>{
 const s=fresh(),now=Date.now;Date.now=()=>1700000000000;
 try{
  act(s,alice,{action:'chat_group_create',name:'Restrito',members:[key(bob)]});const k='group:'+s.chatGroups[0].id;
  act(s,alice,{action:'dm',toKey:k,text:'Antes do aceite',clientId:randomUUID()});
  act(s,bob,{action:'chat_group_accept',key:k});
  assert.equal(chat.chatSnapshot(s,bob,new URLSearchParams({key:k})).messages.length,0);
  act(s,alice,{action:'dm',toKey:k,text:'Depois do aceite',clientId:randomUUID()});
  assert.equal(chat.chatSnapshot(s,bob,new URLSearchParams({key:k})).messages[0].text,'Depois do aceite');
 }finally{Date.now=now;}
});
test('apagar marcador para mim não torna mensagens antigas não lidas',()=>{
 const s=fresh();send(s);send(s);const last=s.dms.at(-1).id;
 act(s,bob,{action:'chat_read',key:key(alice),messageId:last});
 act(s,bob,{action:'chat_delete',messageId:last,scope:'me'});
 assert.equal(view(s,bob,alice).conversations[0].unread,0);
});
