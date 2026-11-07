import { randomUUID, createHash } from 'node:crypto';

export const chatActions = ['dm', 'chat_typing', 'chat_edit', 'chat_delete', 'chat_react', 'chat_read', 'chat_preferences', 'chat_block', 'chat_report', 'chat_group_create', 'chat_group_accept', 'chat_group_decline', 'chat_group_update', 'chat_group_invite', 'chat_group_remove', 'chat_group_admin', 'chat_group_leave'];
const keyOf = me => `id:${me.id}`;
const typingBucketKey = (mine, key) => key.startsWith('group:') ? key : [mine, key].sort().join('|');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const reactions = ['👍', '❤️', '👏', '😂', '😢'];
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'Confira o texto e o limite de caracteres.');
  return value.trim();
}
function person(state, key) {
  const account = typeof key === 'string' && key.startsWith('id:') && state.accounts?.find(a => keyOf(a) === key);
  if (!account) fail(404, 'Esta pessoa não tem conta nesta prévia.');
  return account;
}
function groupOf(state, key) { return state.chatGroups?.find(g => `group:${g.id}` === key); }
function blocked(state, a, b) { return !!(state.chatBlocks?.[a]?.includes(b) || state.chatBlocks?.[b]?.includes(a)); }
function thread(state, me, key) {
  const mine = keyOf(me);
  if (typeof key !== 'string') fail(400, 'Escolha uma conversa.');
  if (key.startsWith('group:')) {
    const group = groupOf(state, key);
    if (!group?.members.includes(mine)) fail(404, 'Conversa não encontrada.');
    return { group, members: group.members, name: group.name };
  }
  const other = person(state, key);
  if (key === mine) fail(400, 'Escolha outra pessoa para conversar.');
  return { members: [mine, key], name: other.name };
}
function canRead(state, me, m) {
  const mine = keyOf(me);
  if (m.hiddenFor?.includes(mine)) return false;
  if (m.toKey.startsWith('group:')) {
    const g = groupOf(state, m.toKey);
    const boundary = g?.joinedAfter?.[mine];
    return !!g?.members.includes(mine) && (boundary ? state.dms.indexOf(m) > state.dms.findIndex(item => item.id === boundary) : m.createdAt >= (g.joinedAt?.[mine] || 0));
  }
  return m.fromKey === mine || m.toKey === mine;
}
function messageKey(me, m) { return m.toKey.startsWith('group:') || m.fromKey === keyOf(me) ? m.toKey : m.fromKey; }
function messagesOf(state, me, key) { return (state.dms || []).filter(m => canRead(state, me, m) && messageKey(me, m) === key); }
function messageOf(state, me, id) {
  const m = state.dms?.find(item => item.id === id && canRead(state, me, item));
  if (!m) fail(404, 'Mensagem não encontrada.');
  return m;
}
function project(state, me, m) {
  const reply = m.replyTo && state.dms.find(item => item.id === m.replyTo && canRead(state, me, item));
  return { id: m.id, fromKey: m.fromKey, fromName: m.fromName, own: m.fromKey === keyOf(me), text: m.deleted ? '' : m.text,
    createdAt: m.createdAt, editedAt: m.editedAt || null, deleted: !!m.deleted,
    media: !m.deleted && m.media ? { url: `/api/media?id=${m.media.id}`, kind: m.media.kind, name: m.media.name } : null,
    reply: m.replyTo ? { text: reply && !reply.deleted ? reply.text.slice(0,160) : 'Mensagem apagada', name: reply?.fromName || '' } : null,
    reactions: m.deleted ? {} : Object.fromEntries(reactions.map(r => [r, Object.values(m.reactions || {}).filter(v => v === r).length]).filter(([,n])=>n)),
    reaction: m.deleted ? '' : m.reactions?.[keyOf(me)] || '' };
}
export function chatMedia(state, me, id) {
  return state.dms?.find(m => !m.deleted && m.media?.id === id && canRead(state, me, m))?.media || null;
}
export function chatSnapshot(state, me, params = new URLSearchParams()) {
  const mine = keyOf(me), key = params.get('key') || '';
  const people = (state.accounts || []).filter(a => a.id !== me.id).map(a => ({ key:keyOf(a), name:a.name, username:a.username || '', blocked:!!state.chatBlocks?.[mine]?.includes(keyOf(a)) }));
  const keys = new Set((state.dms || []).filter(m => canRead(state, me, m)).map(m => messageKey(me, m)));
  for (const g of state.chatGroups || []) if (g.members.includes(mine)) keys.add(`group:${g.id}`);
  const conversations = [...keys].flatMap(k => {
    let t; try { t = thread(state, me, k); } catch { return []; }
    const list = messagesOf(state, me, k), last = list.at(-1), p = state.chatPreferences?.[mine]?.[k] || {};
    const readIndex = p.readId ? (state.dms || []).findIndex(m => m.id === p.readId) : -1;
    const unread = list.filter(m => m.fromKey !== mine && (state.dms || []).indexOf(m) > readIndex).length;
    return [{ key:k, name:t.name, group:!!t.group, last: last ? (last.deleted ? 'Mensagem apagada' : last.text || 'Anexo') : '', at:last?.createdAt || 0,
      unread:p.unread ? Math.max(1, unread) : unread,
      pinned:!!p.pinned, muted:!!p.muted, archived:!!p.archived }];
  }).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.at-a.at);
  let list = [], selected = null, hasMore = false;
  if (key) {
    const t = thread(state, me, key);
    const fullList = messagesOf(state, me, key);
    const otherAcc = !t.group ? person(state, key) : null;
    const now = Date.now();
    const bucket = typingBucketKey(mine, key);
    const typing = Object.entries(state.chatTyping?.[bucket] || {})
      .filter(([k, ts]) => k !== mine && now - ts < 6500 && t.members.includes(k) && !blocked(state, mine, k))
      .map(([k]) => { try { return person(state, k).name; } catch { return ''; } })
      .filter(Boolean);
    const sharedMedia = fullList.filter(m => !m.deleted && m.media).slice(-12).reverse().map(m => ({ id: m.media.id, url: `/api/media?id=${m.media.id}`, kind: m.media.kind, name: m.media.name, at: m.createdAt }));
    selected = { key, name:t.name, username:otherAcc?.username || '', bio:otherAcc?.bio || '', affiliation:otherAcc?.affiliation || '', group:!!t.group, blocked:t.members.some(k=>k!==mine && blocked(state,mine,k)), admin:!!t.group?.admins.includes(mine),
      description:t.group?.description || '', typing, sharedMedia, members:t.group ? t.members.map(k => { const a=person(state,k);return {key:k,name:a.name,username:a.username||'',admin:t.group.admins.includes(k)}; }) : [] };
    list = fullList;
    const q = text(params.get('q') || '',100,false).toLocaleLowerCase('pt-BR');
    if(q)list=list.filter(m=>!m.deleted && m.text.toLocaleLowerCase('pt-BR').includes(q));
    const before=params.get('before');
    if(before){ const i=list.findIndex(m=>m.id===before); if(i<0)fail(400,'Atualize a conversa para carregar o histórico.'); list=list.slice(0,i); }
    hasMore=list.length>30; list=list.slice(-30).map(m=>project(state,me,m));
  }
  return { me:{id:me.id,name:me.name}, people, conversations, selected, messages:list, hasMore,
    invitations:(state.chatGroups || []).filter(g=>g.invited.includes(mine)).map(g=>({key:`group:${g.id}`,name:g.name})),
    reports:(state.chatReports || []).filter(r=>r.authorKey===mine).map(r=>({id:r.id,createdAt:r.createdAt,status:'Registrada; revisão humana ainda não conectada'})) };
}
export function chatAction(state, me, body, upload) {
  const mine=keyOf(me), key=body.key || body.toKey;
  state.dms ||= [];
  if(body.action==='chat_typing') {
    const t=thread(state,me,key);
    if(t.members.some(k=>k!==mine && blocked(state,mine,k)))fail(403,'Conversa bloqueada.');
    const bucket=typingBucketKey(mine,key);
    state.chatTyping ||= {}; state.chatTyping[bucket] ||= {};
    if(body.typing===false) delete state.chatTyping[bucket][mine];
    else state.chatTyping[bucket][mine]=Date.now();
    return {};
  }
  if(body.action==='dm') {
    const t=thread(state,me,body.toKey);
    if(t.members.some(k=>k!==mine && blocked(state,mine,k)))fail(403,'Conversa bloqueada. Não é possível enviar mensagens.');
    const copy=text(body.text || '',2000,false);
    if(!copy && !upload)fail(400,'Escreva uma mensagem ou escolha um anexo.');
    if(body.clientId!==undefined && !uuid.test(body.clientId))fail(400,'Identificador de envio inválido.');
    const digest=createHash('sha256').update(JSON.stringify([body.toKey,copy,body.replyTo || '',upload?.name || '',upload?.bytes || null])).digest('hex');
    const previous=body.clientId && state.dms.find(m=>m.fromKey===mine && m.clientId===body.clientId);
    if(previous){if(previous.digest!==digest)fail(409,'Este envio já foi usado. Abra um novo rascunho.');return {duplicate:true};}
    if(state.dms.length>=10000)fail(409,'A prévia atingiu o limite de mensagens. O histórico foi preservado.');
    if(body.replyTo){const reply=messageOf(state,me,body.replyTo);if(reply.deleted || messageKey(me,reply)!==body.toKey)fail(400,'Escolha uma mensagem desta conversa para responder.');}
    const bucket=typingBucketKey(mine,body.toKey);
    if(state.chatTyping?.[bucket]) delete state.chatTyping[bucket][mine];
    state.dms.push({id:randomUUID(),clientId:body.clientId || randomUUID(),digest,fromKey:mine,fromName:me.name,toKey:body.toKey,toName:t.name,text:copy,createdAt:Date.now(),replyTo:body.replyTo || null,...(upload ? {media:{id:upload.id,name:upload.name,kind:upload.kind}} : {})});
    return {};
  }
  if(['chat_edit','chat_delete','chat_react','chat_report'].includes(body.action)) {
    const m=messageOf(state,me,body.messageId);
    if(body.action==='chat_report') {
      const reason=text(body.reason,500); state.chatReports ||= [];
      if(state.chatReports.filter(r=>r.authorKey===mine).length>=20)fail(409,'Limite de registros atingido.');
      if(!state.chatReports.some(r=>r.authorKey===mine && r.messageId===m.id))state.chatReports.push({id:randomUUID(),authorKey:mine,messageId:m.id,reason,createdAt:Date.now()});
      return {};
    }
    if(body.action==='chat_delete') {
      if(!['me','all'].includes(body.scope))fail(400,'Escolha como apagar.');
      if(body.scope==='me'){m.hiddenFor=[...new Set([...(m.hiddenFor || []),mine])];return {};}
      if(m.fromKey!==mine)fail(403,'Só quem enviou pode apagar para todos.');
      const removedId=m.media?.id; m.text='';m.deleted=true;m.reactions={};delete m.media;delete m.replyTo;
      return {removedId};
    }
    if(m.deleted)fail(409,'Esta mensagem foi apagada.');
    const t=thread(state,me,messageKey(me,m));
    if(t.members.some(k=>k!==mine && blocked(state,mine,k)))fail(403,'Conversa bloqueada.');
    if(body.action==='chat_edit'){if(m.fromKey!==mine)fail(403,'Só quem enviou pode editar.');m.text=text(body.text,2000);m.editedAt=Date.now();}
    else {if(!reactions.includes(body.reaction) && body.reaction!=='')fail(400,'Escolha uma reação disponível.');m.reactions ||= {};m.reactions[mine]=body.reaction;}
    return {};
  }
  if(body.action==='chat_block') {
    person(state,key);if(key===mine)fail(400,'Escolha outra pessoa.');if(typeof body.blocked!=='boolean')fail(400,'Escolha bloquear ou desbloquear.');
    state.chatBlocks ||= {};const set=new Set(state.chatBlocks[mine] || []);body.blocked?set.add(key):set.delete(key);state.chatBlocks[mine]=[...set];return {};
  }
  if(['chat_read','chat_preferences'].includes(body.action)) {
    thread(state,me,key); state.chatPreferences ||= {};state.chatPreferences[mine] ||= {};const p=state.chatPreferences[mine][key] ||= {};
    if(body.action==='chat_read'){const list=messagesOf(state,me,key);if(!list.some(m=>m.id===body.messageId))fail(404,'Mensagem não encontrada.');const i=state.dms.findIndex(m=>m.id===body.messageId),old=state.dms.findIndex(m=>m.id===p.readId);if(i>=old)p.readId=body.messageId;p.unread=false;}
    else for(const field of ['pinned','muted','archived','unread'])if(body[field]!==undefined){if(typeof body[field]!=='boolean')fail(400,'Preferência inválida.');p[field]=body[field];}
    return {};
  }
  if(body.action==='chat_group_create') {
    const name=text(body.name,60);state.chatGroups ||= [];
    if(state.chatGroups.length>=100)fail(409,'Limite de grupos da prévia atingido.');
    if(!Array.isArray(body.members) || body.members.length<1 || body.members.length>11)fail(400,'Convide de 1 a 11 pessoas.');
    const invited=[...new Set(body.members)];for(const k of invited){person(state,k);if(k===mine || blocked(state,mine,k))fail(403,'Não é possível convidar esta pessoa.');}
    state.chatGroups.push({id:randomUUID(),name,description:'',members:[mine],admins:[mine],invited,joinedAt:{[mine]:Date.now()}});return {};
  }
  const g=groupOf(state,key);
  if(!g)fail(404,'Grupo não encontrado.');
  if(['chat_group_accept','chat_group_decline'].includes(body.action)) {
    if(!g.invited.includes(mine))fail(404,'Convite não encontrado.');
    if(body.action==='chat_group_accept'){
      if(g.members.some(k=>blocked(state,mine,k)))fail(403,'Há um bloqueio entre participantes deste grupo.');
      g.joinedAfter ||= {};g.joinedAfter[mine]=state.dms.at(-1)?.id || null;
      g.members.push(mine);g.joinedAt[mine]=Date.now();
    }
    g.invited=g.invited.filter(k=>k!==mine);return {};
  }
  thread(state,me,key);
  if(body.action==='chat_group_leave') {
    if(g.admins.includes(mine) && g.admins.length===1 && g.members.length>1)fail(409,'Defina outra pessoa administradora antes de sair.');
    g.members=g.members.filter(k=>k!==mine);g.admins=g.admins.filter(k=>k!==mine);g.invited=g.members.length ? g.invited : [];return {};
  }
  if(!g.admins.includes(mine))fail(403,'Apenas administradores podem alterar o grupo.');
  if(body.action==='chat_group_update'){g.name=text(body.name,60);g.description=text(body.description || '',500,false);return {};}
  const target=body.memberKey;person(state,target);
  if(body.action==='chat_group_invite'){
    if(g.members.length+g.invited.length>=12)fail(409,'Este grupo aceita até 12 pessoas nesta prévia.');
    if(g.members.some(k=>blocked(state,k,target)))fail(403,'Não é possível convidar esta pessoa.');
    if(!g.members.includes(target) && !g.invited.includes(target))g.invited.push(target);return {};
  }
  if(body.action==='chat_group_admin'){
    if(!g.members.includes(target))fail(404,'Participante não encontrado.');
    if(!g.admins.includes(target))g.admins.push(target);return {};
  }
  if(body.action==='chat_group_remove') {
    if(target===mine)fail(400,'Use Sair do grupo.');
    g.members=g.members.filter(k=>k!==target);g.invited=g.invited.filter(k=>k!==target);g.admins=g.admins.filter(k=>k!==target);return {};
  }
  fail(400,'Ação desconhecida.');
}
