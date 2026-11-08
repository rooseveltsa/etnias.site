// Áreas do menu OPY com o conteúdo recuperado do Etnias 1.0 (Blogs, Páginas, Mercado, Eventos, Filmes, Empregos, Coletas).
// Leitura apenas: legado-areas.json é gerado do banco recuperado por scripts/opy-legacy-areas.py (fora do Git).
// Quem publicou é ligado à conta da 2.0 pelo id do 1.0; conteúdo de quem a pessoa bloqueou ou de conta desativada não aparece.
import { readFileSync, existsSync } from 'node:fs';
import { profileAccess } from './account.mjs';

const file = new URL('legado-areas.json', import.meta.url);
const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
export const AREAS = ['blogs', 'paginas', 'mercado', 'eventos', 'filmes', 'empregos', 'coletas'];
const AUTHOR = { blogs: 'authorLegacyId', paginas: 'ownerLegacyId', mercado: 'sellerLegacyId', eventos: 'authorLegacyId', empregos: 'authorLegacyId', coletas: 'authorLegacyId', filmes: '' };
const plain = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export function areaView(state, me, params) {
  const type = String(params.get('type') || '');
  if (!AREAS.includes(type)) fail(404, 'Área não encontrada.');
  const byLegacy = new Map((state.accounts || []).filter(a => a.legacyId).map(a => [a.legacyId, a]));
  const authorOf = item => {
    const acc = AUTHOR[type] ? byLegacy.get(item[AUTHOR[type]]) : null;
    return acc ? { key: 'id:' + acc.id, name: acc.name, avatar: acc.avatarUrl || (acc.avatarId ? `/api/media?id=${acc.avatarId}` : ''), id: acc.id } : null;
  };
  const allowed = item => { const a = authorOf(item); return !a || profileAccess(state, me.id, a.id) !== 'none'; };
  const strip = ({ id, ...a }) => a;
  const items = (data[type] || []).filter(allowed);
  const id = Number(params.get('id'));
  if (id) {
    const item = items.find(x => x.id === id);
    if (!item) fail(404, 'Este conteúdo não existe mais ou não está disponível para você.');
    const author = authorOf(item);
    return { type, item, author: author && strip(author), own: !!author && author.id === me.id };
  }
  const q = plain(params.get('q')).slice(0, 80), cat = String(params.get('category') || '');
  const filtered = items.filter(x => (!q || plain(`${x.title} ${x.summary || ''} ${x.description || ''} ${x.category || ''}`).includes(q)) && (!cat || x.category === cat));
  const summary = x => { const { content, description, ...rest } = x; return { ...rest, excerpt: String(x.summary || description || content || '').replace(/\s+/g, ' ').slice(0, 180), author: (a => a && strip(a))(authorOf(x)) }; };
  return { type, total: items.length, categories: [...new Set(items.map(x => x.category).filter(Boolean))].sort(), items: filtered.slice(0, 60).map(summary), origem: data.origem || '' };
}
export const areasAvailable = () => AREAS.filter(t => (data[t] || []).length);
