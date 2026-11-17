// Texto que chega com marcação HTML (cola de editor, app antigo) vira texto puro: <br>, </p> e </div> viram quebra de linha
// e as demais tags somem. "a < b" e "<3" ficam como estão, porque só tag de verdade (<nome ...>) é removida.
const TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;
const BREAK = /<\s*(?:br|\/p|\/div|\/li|\/h[1-6])\b[^<>]*>/gi;
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
export function plainText(value) {
  if (typeof value !== 'string' || !TAG.test(value)) { TAG.lastIndex = 0; return value; }
  TAG.lastIndex = 0;
  return value.replace(BREAK, '\n').replace(TAG, '').replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, entity => ENTITIES[entity]).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
