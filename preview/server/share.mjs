// Compartilhamento por link (WhatsApp, Telegram, etc.): /p/<id> devolve uma página mínima com as tags Open Graph da
// publicação (título, texto e foto), no lugar do logo fixo do Etnias. Só publicações realmente públicas expõem conteúdo:
// as demais mostram a identidade genérica do Etnias, sem vazar texto, foto nem nome.
import { readState, readMedia } from './store.mjs';
import { plainText } from './plain-text.mjs';
import { isSuspended } from './admin.mjs';
import { isInactive } from './account.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ID = /^[A-Za-z0-9_-]{6,64}$/;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function publicPost(state, id) {
  if (!ID.test(id || '')) return null;
  const post = (state.posts || []).find(p => p.id === id);
  if (!post || post.audience !== 'public' || post.hidden || post.removed) return null;
  if (post.communityId) { const c = (state.communities || []).find(x => x.id === post.communityId); if (!c || c.visibility !== 'public') return null; }
  const author = (state.accounts || []).find(a => a.id === post.authorId);
  if (post.authorId && (!author || isSuspended(author) || isInactive(state, author.id) || author.privacy?.profile === 'friends')) return null;
  return post;
}
const shareImageId = post => {
  const pics = [post.photos?.[0], post.media?.kind === 'image' ? post.media : null, post.media?.posterId ? { id: post.media.posterId } : null].filter(Boolean);
  return pics[0]?.id || '';
};
function origin(req) {
  const proto = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? 'https' : 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
  return host ? `${proto}://${host}` : 'https://etnias.site';
}
const clip = (text, max) => { const t = plainText(String(text || '')).replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };

export default async function shareHandler(req, res) {
  const url = new URL(req.url, 'http://local');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); return res.end(); }
  try {
    const state = (await readState()).data;
    const match = url.pathname.match(/^\/p\/([^/]+)\/?$/);
    const id = decodeURIComponent(match?.[1] || url.searchParams.get('id') || '');
    if (url.pathname.replace(/\/$/, '').endsWith('/share-image')) {
      const post = publicPost(state, id);
      const imageId = post ? shareImageId(post) : '';
      const media = imageId ? await readMedia(imageId) : null;
      if (!media || media.statusCode !== 200 || !IMAGE_TYPES.has(media.blob.contentType)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', media.blob.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(media.buffer || Buffer.from(await new Response(media.stream).arrayBuffer()));
    }
    const base = origin(req);
    const post = publicPost(state, id);
    const dest = post ? `/#post-${post.id}` : '/';
    let title = 'Etnias — a rede dos povos', description = 'Entre no Etnias e acompanhe a aldeia digital.', image = `${base}/assets/og-etnias.png`, alt = 'Etnias';
    let size = ['1200', '630'];
    if (post) {
      title = clip(`${post.author || 'Alguém'} no Etnias`, 70);
      description = clip(post.text, 200) || 'Veja esta publicação no Etnias.';
      if (shareImageId(post)) { image = `${base}/api/share-image?id=${encodeURIComponent(post.id)}`; alt = `Imagem da publicação de ${clip(post.author, 40)}`; size = []; }
    }
    const canonical = `${base}/p/${encodeURIComponent(post ? post.id : id.slice(0, 64))}/`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"><meta name="robots" content="noindex,nofollow">
<meta property="og:type" content="article"><meta property="og:site_name" content="Etnias"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">${size.length ? `<meta property="og:image:width" content="${size[0]}"><meta property="og:image:height" content="${size[1]}">` : ''}<meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="${size.length ? 'summary' : 'summary_large_image'}"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(dest)}"><link rel="canonical" href="${esc(canonical)}"></head><body><p><a href="${esc(dest)}">Abrir no Etnias</a></p></body></html>`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.end(req.method === 'HEAD' ? undefined : html);
  } catch {
    res.statusCode = 404; return res.end();
  }
}
