// Presença (PRESENÇA-001): online é automático, pela atividade recente (em memória, sem regravar o banco a cada acesso).
// Disponibilidade é escolha da pessoa: '' (livre), 'busy' (ocupado, azul) ou 'dnd' (não incomodar, vermelho).
// Offline não mostra nada: ocupado/não incomodar só aparecem enquanto a pessoa está online.
// shortcut: memória de um processo só; com mais de um servidor, mover para o banco ou Redis.
const ONLINE_MS = 150_000;
const seen = new Map();
export const AVAILABILITY = ['', 'busy', 'dnd'];
export function touchPresence(accountId, now = Date.now()) { if (accountId) seen.set(accountId, now); }
export function presenceOf(account, now = Date.now()) {
  const at = account && seen.get(account.id);
  if (!at || now - at > ONLINE_MS) return '';
  return account.availability === 'busy' || account.availability === 'dnd' ? account.availability : 'online';
}
// Só das pessoas que aparecem na resposta (autores do feed, diretório, conversas).
export function presenceMap(keys, accountsById, now = Date.now()) {
  const out = {};
  for (const key of keys) {
    if (!String(key).startsWith('id:')) continue;
    const p = presenceOf(accountsById.get(key.slice(3)), now);
    if (p) out[key] = p;
  }
  return out;
}
