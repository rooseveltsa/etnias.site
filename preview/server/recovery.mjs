// Recuperação de senha e confirmação de contato por código de 6 dígitos. O envio é plugável: o Etnias entrega o código a um
// "webhook" (OPY_CODE_WEBHOOK_URL) e quem opera liga ali o WhatsApp, o SMS ou o e-mail que preferir. Sem webhook, o recurso fica desligado
// e a senha provisória pela equipe continua sendo o caminho.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_MINUTES = 15;
export const MAX_ATTEMPTS = 5;
export const providerConfigured = (env = process.env) => !!env.OPY_CODE_WEBHOOK_URL;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const hashCode = (code, account, purpose, secret) => createHash('sha256').update(`${secret}|${account.id}|${purpose}|${code}`).digest();

// Contas importadas do Etnias 1.0 têm contato vindo do sistema antigo; as novas só entram na recuperação depois de confirmar o contato.
export const eligibleForRecovery = account => !!(account.contactVerified || account.legacyId != null) && !!contactOf(account);
export function contactOf(account) {
  if (account.googleKey) return { channel: 'email', to: account.googleKey };
  if (account.phone) return { channel: 'phone', to: account.phone };
  return null;
}
export function issueCode(account, purpose, secret, now = Date.now()) {
  const code = newCode();
  account.codes = { ...(account.codes || {}), [purpose]: { hash: hashCode(code, account, purpose, secret).toString('hex'), expiresAt: now + CODE_MINUTES * 60e3, attempts: 0, sentAt: now } };
  return code;
}
export function checkCode(account, purpose, code, secret, now = Date.now()) {
  const slot = account.codes?.[purpose];
  if (!slot) return 'none';
  if (now > slot.expiresAt) { delete account.codes[purpose]; return 'expired'; }
  if (slot.attempts >= MAX_ATTEMPTS) return 'locked';
  const ok = /^\d{6}$/.test(String(code || '')) && timingSafeEqual(hashCode(String(code), account, purpose, secret), Buffer.from(slot.hash, 'hex'));
  if (!ok) { slot.attempts++; return 'wrong'; }
  delete account.codes[purpose];
  return 'ok';
}
// Entrega pelo webhook configurado. Devolve true se o servidor do webhook aceitou.
export async function deliverCode({ channel, to, code, purpose }, env = process.env, doFetch = fetch) {
  if (!providerConfigured(env)) return false;
  const text = purpose === 'recover' ? `Seu código para criar uma nova senha no Etnias: ${code}. Vale ${CODE_MINUTES} minutos. Não compartilhe.` : `Seu código para confirmar o contato no Etnias: ${code}. Vale ${CODE_MINUTES} minutos.`;
  try {
    const response = await doFetch(env.OPY_CODE_WEBHOOK_URL, { method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json', ...(env.OPY_CODE_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.OPY_CODE_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ channel, to, purpose, code, text }) });
    return response.ok;
  } catch { return false; }
}
