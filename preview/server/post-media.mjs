// Arquivos de uma publicação: anexo principal, documento e as fotos do carrossel (photos[0] é o próprio media).
// Fotos dos comentários (COMENT-003) também são da publicação: saem junto quando ela é apagada.
export const ownMediaIds = p => p ? [p.media?.id, p.media?.posterId, p.file?.id, ...(p.photos || []).map(m => m.id), ...(p.comments || []).map(c => c.media?.id)].filter(Boolean) : [];
// Inclui os da publicação repostada, que continuam em uso enquanto o repost existir.
export const postMediaIds = p => p ? [...ownMediaIds(p), ...ownMediaIds(p.repostOf)] : [];
// Ao apagar uma publicação: só os arquivos que nenhuma outra (repost) ainda usa.
export const orphanMediaIds = (post, others) => ownMediaIds(post).filter(id => !others.some(p => p !== post && postMediaIds(p).includes(id)));
// Fotos de uma publicação com o objeto de mídia, para servir /api/media com nome e tipo.
const medias = p => [p.media, p.file, ...(p.photos || []), ...(p.comments || []).map(c => c.media), p.repostOf?.media, p.repostOf?.file, ...(p.repostOf?.photos || [])];
export const findPostMedia = (p, id) => medias(p).find(m => m?.id === id) || (medias(p).some(m => m?.posterId === id) ? { kind: 'image', name: 'capa' } : null);
