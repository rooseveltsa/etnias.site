// Arquivos de uma publicação: anexo principal, documento e as fotos do carrossel (photos[0] é o próprio media).
export const ownMediaIds = p => p ? [p.media?.id, p.file?.id, ...(p.photos || []).map(m => m.id)].filter(Boolean) : [];
// Inclui os da publicação repostada, que continuam em uso enquanto o repost existir.
export const postMediaIds = p => p ? [...ownMediaIds(p), ...ownMediaIds(p.repostOf)] : [];
// Ao apagar uma publicação: só os arquivos que nenhuma outra (repost) ainda usa.
export const orphanMediaIds = (post, others) => ownMediaIds(post).filter(id => !others.some(p => p !== post && postMediaIds(p).includes(id)));
// Fotos de uma publicação com o objeto de mídia, para servir /api/media com nome e tipo.
export const findPostMedia = (p, id) => [p.media, p.file, ...(p.photos || []), p.repostOf?.media, p.repostOf?.file, ...(p.repostOf?.photos || [])].find(m => m?.id === id) || null;
