const assert=require('node:assert/strict');
const base=process.env.OPY_API_URL||'http://127.0.0.1:8101';
const { registerAccount } = require('./session.cjs');
function visitor(){let cookie='';return async(path='/api/community',body)=>{if(!cookie){const account=await registerAccount(base);if(account.status!==200)throw Error(account.data.error||'cadastro');cookie=account.cookie;}const res=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/json',origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})});cookie=res.headers.get('set-cookie')?.split(';')[0]||cookie;return res;};}
(async()=>{const a=visitor(),b=visitor();await a();await b();
const text='Anexo privado QA '+Date.now();
const invalid=await a('/api/community',{action:'publish',text,audience:'public',media:{name:'falso.png',data:'data:image/png;base64,aGVsbG8='}});assert.equal(invalid.status,400);
const published=await a('/api/community',{action:'publish',text,audience:'private',media:{name:'teste.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\n% Homologacao\n%%EOF').toString('base64')}});assert.equal(published.status,200);const post=(await published.json()).posts.find(p=>p.text===text);assert.ok(post.own);
assert.ok(!(await (await b()).json()).posts.some(p=>p.id===post.id));assert.equal((await b(post.media.url)).status,404);const media=await a(post.media.url);assert.equal(media.status,200);assert.match(media.headers.get('content-disposition'),/attachment/);assert.ok((await media.text()).startsWith('%PDF-'));
assert.equal((await b('/api/community',{action:'comment',postId:post.id,text:'invasao'})).status,404);assert.equal((await a('/api/community',{action:'delete',postId:post.id})).status,200);assert.equal((await a(post.media.url)).status,404);
console.log('PASS mídia real: validação de formato, upload/download, publicação privada, autorização do anexo e exclusão');})().catch(e=>{console.error(e);process.exit(1);});
