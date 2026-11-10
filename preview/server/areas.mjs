// Áreas do menu OPY com o conteúdo recuperado do Etnias 1.0 (Blogs, Páginas, Mercado, Eventos, Filmes, Empregos, Coletas).
// Leitura apenas: legado-areas.json é gerado do banco recuperado por scripts/opy-legacy-areas.py (fora do Git).
// Quem publicou é ligado à conta da 2.0 pelo id do 1.0; conteúdo de quem a pessoa bloqueou ou de conta desativada não aparece.
import { readFileSync, existsSync } from 'node:fs';
import { profileAccess } from './account.mjs';
import { marketList, marketDetail, MARKET_CATEGORIES } from './mercado.mjs';

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
  // Mercado: anúncios dos membros (id texto) vêm antes dos recuperados do 1.0 (id numérico), com a mesma busca e categorias.
  const rawId = String(params.get('id') || '');
  if (type === 'mercado' && rawId && !/^\d+$/.test(rawId)) return { type, ...marketDetail(state, me, rawId) };
  const members = type === 'mercado' ? marketList(state, me) : [];
  const id = Number(rawId);
  if (id) {
    const item = items.find(x => x.id === id);
    if (!item) fail(404, 'Este conteúdo não existe mais ou não está disponível para você.');
    const author = authorOf(item);
    return { type, item, author: author && strip(author), own: !!author && author.id === me.id };
  }
  const q = plain(params.get('q')).slice(0, 80), cat = String(params.get('category') || '');
  const match = x => (!q || plain(`${x.title} ${x.summary || ''} ${x.description || ''} ${x.category || ''}`).includes(q)) && (!cat || x.category === cat);
  const filtered = items.filter(match);
  const summary = x => { const { content, description, ...rest } = x; return { ...rest, excerpt: String(x.summary || description || content || '').replace(/\s+/g, ' ').slice(0, 180), author: (a => a && strip(a))(authorOf(x)) }; };
  const mine = members.filter(match).slice(0, 60).map(({ description, ...x }) => x);
  return { type, total: items.length, categories: [...new Set([...(type === 'mercado' ? MARKET_CATEGORIES : []), ...items.map(x => x.category).filter(Boolean)])].sort(), items: [...mine, ...filtered.slice(0, 60).map(summary)], origem: data.origem || '', ...(type === 'mercado' ? { categoriesFixed: MARKET_CATEGORIES } : {}) };
}
export const areasAvailable = () => AREAS.filter(t => (data[t] || []).length);
