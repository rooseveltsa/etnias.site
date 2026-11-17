// Limites em memória (não gravam no banco): janelas deslizantes por chave. Reiniciar o app zera os contadores.
const hits = new Map();
const MAX_KEYS = 50000;
function fresh(key, windowMs, now) {
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length) hits.set(key, list); else hits.delete(key);
  return list;
}
export function tooMany(key, max, windowMs, now = Date.now()) { return fresh(key, windowMs, now).length >= max; }
export function note(key, windowMs, now = Date.now()) {
  const list = fresh(key, windowMs, now); list.push(now); hits.set(key, list);
  if (hits.size > MAX_KEYS) for (const [k, v] of hits) { if (!v.some(t => now - t < windowMs)) hits.delete(k); if (hits.size <= MAX_KEYS * 0.8) break; }
}
export function clear(key) { hits.delete(key); }
export function clientIp(req) {
  // Atrás do Caddy o endereço real é a última entrada de X-Forwarded-For; a porta do app não é pública.
  return String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket?.remoteAddress || '?';
}
export function _reset() { hits.clear(); }
