// Backup da Casa Opy no armazenamento privado da Vercel. Roda dentro da imagem casa-opy (que já tem @vercel/blob).
// Uso: node blob.mjs upload <arquivo> <caminho> | list <prefixo> | prune <prefixo> <dias> | download <caminho> <saida> | restore <pasta> <prefixo> | remove <prefixo>
import { put, list, del, get } from '@vercel/blob';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const [cmd, a, b] = process.argv.slice(2);
const opts = { access: 'private' };
async function all(prefix) { const out = []; let cursor; do { const page = await list({ prefix, cursor, limit: 1000 }); out.push(...page.blobs); cursor = page.cursor; } while (cursor); return out; }
if (cmd === 'upload') {
  await put(b, await readFile(a), { ...opts, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream' });
  console.log('enviado', b);
} else if (cmd === 'list') {
  for (const x of await all(a)) console.log(x.pathname, x.size, x.uploadedAt.toISOString());
} else if (cmd === 'prune') {
  const limit = Date.now() - Number(b) * 864e5, old = (await all(a)).filter(x => x.uploadedAt.getTime() < limit);
  if (old.length) await del(old.map(x => x.url));
  console.log('removidos', old.length);
} else if (cmd === 'download') {
  const r = await get(a, opts); if (!r) throw new Error('não encontrado: ' + a);
  await writeFile(b, Buffer.from(await new Response(r.stream).arrayBuffer())); console.log('baixado', a);
} else if (cmd === 'restore') {
  // Converte o formato do disco da VPS (community.json + media-<id>.json) no formato do Blob usado pela Vercel.
  await put(`${b}/community.json`, await readFile(join(a, 'community.json')), { ...opts, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  let n = 0;
  for (const f of await readdir(a)) {
    const m = /^media-([a-f0-9-]{36})\.json$/.exec(f); if (!m) continue;
    const { type, bytes } = JSON.parse(await readFile(join(a, f), 'utf8'));
    await put(`${b}/media/${m[1]}`, Buffer.from(bytes, 'base64'), { ...opts, addRandomSuffix: false, allowOverwrite: true, contentType: type }); n++;
  }
  console.log('restaurado em', b, '· anexos:', n);
} else if (cmd === 'remove') {
  const items = await all(a); if (items.length) await del(items.map(x => x.url)); console.log('removidos', items.length);
} else { console.error('comando desconhecido'); process.exit(2); }
