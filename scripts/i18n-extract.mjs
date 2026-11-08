// Extrai os textos de interface (HTML exportado + JS do cliente + mensagens do servidor) para preview/i18n/source.json.
// Uso: node scripts/i18n-extract.mjs   (rode depois de exportar as páginas)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const out = new Set();
const clean = s => s.replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const looksLikeText = s => s.length >= 2 && /[A-Za-zÀ-ú]/.test(s) && (/[À-ú]/.test(s) || /\s/.test(s) || /^[A-ZÀ-Ú][a-zà-ú]+$/.test(s))
  && !/^(https?:|\/|#|\.|\[|data:|image\/|video\/|application\/)/.test(s) && !/[<>;=]|=>|\$\(|\d(px|ms|s)\b|display-mode|\b(rem|var\(|function|const|return)\b/.test(s);
const add = s => { s = clean(decode(s)); if (looksLikeText(s) && s.length <= 400) out.add(s); };
function walk(dir, files = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p, files) : files.push(p); } return files; }
for (const file of walk(join(root, 'preview/dist/public')).filter(f => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, '');
  for (const m of html.matchAll(/>([^<>]+)</g)) add(m[1]);
  for (const m of html.matchAll(/\s(?:placeholder|aria-label|title|alt)="([^"]+)"/g)) add(m[1]);
}
const js = ['preview/preview.js', 'preview/chat.js', 'preview/calls.js', 'preview/live.js', 'preview/stories.js', 'preview/admin.js'].map(f => join(root, f));
const server = readdirSync(join(root, 'preview/server')).filter(f => f.endsWith('.mjs')).map(f => join(root, 'preview/server', f));
for (const file of [...js, ...server]) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"));
  for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) { let i = 0; add(m[1].replace(/\$\{[^}]*\}/g, () => `{${i++}}`)); }
}
// Frases montadas em tempo de execução (plural(), tempo relativo) que o varredor não vê.
for (const extra of ['{0} participante', '{0} participantes', '{0} publicação', '{0} publicações', '{0} comentário', '{0} comentários', '{0} seguidor', '{0} seguidores', '{0} amigo', '{0} amigos', '{0} membro', '{0} membros', '{0} pessoa', '{0} pessoas']) out.add(extra);
const list = [...out].sort((a, b) => a.localeCompare(b, 'pt-BR'));
writeFileSync(join(root, 'preview/i18n/source.json'), JSON.stringify(list, null, 1) + '\n');
console.log(`${list.length} textos em preview/i18n/source.json`);
