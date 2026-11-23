// Verificação em duas etapas por app autenticador (RFC 6238: 6 dígitos, 30 s, HMAC-SHA1). Não depende de provedor de SMS ou e-mail.
import { createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) out += ALPHA[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(text) {
  let bits = 0, value = 0; const out = [];
  for (const ch of text.replace(/[\s=]/g, '').toUpperCase()) { const i = ALPHA.indexOf(ch); if (i < 0) continue; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function codeAt(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest();
  return String((h.readUInt32BE(h[19] & 15) & 0x7fffffff) % 1e6).padStart(6, '0');
}
export const newSecret = () => base32(randomBytes(20));
export const otpauthUri = (secret, label) => `otpauth://totp/${encodeURIComponent('Etnias:' + label)}?secret=${secret}&issuer=Etnias&digits=6&period=30`;
// Aceita ±1 janela (relógio do celular adiantado ou atrasado). Devolve o passo usado, para recusar o mesmo código duas vezes.
export function verifyCode(secret, code, lastStep = -1, now = Date.now()) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6) return -1;
  const step = Math.floor(now / 30000);
  for (const s of [step - 1, step, step + 1]) if (s > lastStep && timingSafeEqual(Buffer.from(codeAt(secret, s)), Buffer.from(c))) return s;
  return -1;
}
const hashBackup = code => createHash('sha256').update(String(code).replace(/[\s-]/g, '').toLowerCase()).digest('hex');
export function newBackupCodes(n = 8) {
  const codes = Array.from({ length: n }, () => randomBytes(5).toString('hex').replace(/(.{5})/, '$1-'));
  return { codes, hashes: codes.map(hashBackup) };
}
// Código reserva: vale uma vez; devolve a lista sem ele, ou null se não confere.
export function useBackup(hashes, code) {
  const h = hashBackup(code);
  return (hashes || []).includes(h) ? hashes.filter(x => x !== h) : null;
}
