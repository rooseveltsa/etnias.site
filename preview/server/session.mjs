import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const duration = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
export function checkPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const actual = scryptSync(password, Buffer.from(stored.salt, 'hex'), 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const expected = Buffer.from(stored.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`opy-session-v3:${payload}`));
  return Array.from(new Uint8Array(mac), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(accountId, secret, now = Date.now()) {
  const session = { id: crypto.randomUUID(), expiresAt: now + duration };
  const payload = `${accountId}.${session.expiresAt}.${session.id}`;
  return { session, token: `${payload}.${await sign(payload, secret)}` };
}

export async function verifySession(token, secret, now = Date.now()) {
  if (!secret || secret.length < 32 || typeof token !== 'string') return null;
  const parts = token.split('.');
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if (parts.length !== 4 || !uuid.test(parts[0]) || !uuid.test(parts[2]) || !/^\d{13}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[3])) return null;
  const expiresAt = Number(parts[1]);
  if (expiresAt <= now || expiresAt > now + duration) return null;
  const expected = await sign(parts.slice(0, 3).join('.'), secret);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ parts[3].charCodeAt(i);
  return difference ? null : { accountId: parts[0], id: parts[2], expiresAt };
}

export function sessionCookie(req) {
  return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('opy_visitor='))?.slice(12) || '';
}

export function sessionAccount(state, session) {
  if (!session || session.expiresAt <= Date.now()) return null;
  return (state.accounts || []).find(account => account.id === session.accountId && account.sessions?.some(item => item.id === session.id && item.expiresAt === session.expiresAt));
}

export function addSession(account, session) {
  account.sessions = [...(account.sessions || []).filter(item => item.expiresAt > Date.now()), session].slice(-10);
}
