// Gestão da própria conta (missão "Conta e experiência", Prioridade 2): privacidade do perfil, quem pode mandar mensagem,
// bloqueio geral (usa a mesma lista do chat, que a moderação já acompanha), sessões por aparelho, seguidores,
// desativar a conta e pedir a exclusão. Tudo é aplicado no servidor: o cliente só mostra o que recebe.
import { checkPassword } from './session.mjs';
import { exportAccountData, recordConsent, DELETION_GRACE_DAYS as GRACE } from './lgpd.mjs';
import { tooMany, note } from './throttle.mjs';

export const accountActions = ['video_prefs', 'privacy_update', 'session_revoke', 'sessions_revoke_others', 'follower_remove', 'block_set', 'account_deactivate', 'account_delete_request', 'data_export', 'consent_update'];
export const DELETION_GRACE_DAYS = GRACE;
const DAY = 864e5;
const keyOf = id => `id:${id}`;

function fail(status, message) { const error = new Error(message); error.status = status; throw error; }

// Regras de visibilidade calculadas uma vez por estado (o feed consulta isso para cada publicação).
const rulesCache = new WeakMap();
// Sobe a cada mudança de privacidade ou desativação feita por este módulo: invalida o cache sem varrer as contas a cada publicação.
let rulesVersion = 0;
function rulesOf(state) {
  const accounts = state.accounts || [];
  const cached = rulesCache.get(state);
  if (cached && cached.accounts === accounts && cached.count === accounts.length && cached.version === rulesVersion) return cached;
  const inactive = new Set(), friendsOnly = new Set();
  for (const a of accounts) {
    if (a.deactivatedAt) inactive.add(a.id);
    if (a.privacy?.profile === 'friends') friendsOnly.add(a.id);
  }
  const rules = { accounts, count: accounts.length, version: rulesVersion, inactive, friendsOnly };
  rulesCache.set(state, rules);
  return rules;
}

export function isBlockedPair(state, aKey, bKey) {
  return !!(state.chatBlocks?.[aKey]?.includes(bKey) || state.chatBlocks?.[bKey]?.includes(aKey));
}
export function areFriends(state, aKey, bKey) { return (state.friends?.[aKey] || []).includes(bKey); }
export function isInactive(state, accountId) { return rulesOf(state).inactive.has(accountId); }
// O que outra pessoa pode ver de um perfil: 'none' (bloqueio ou conta desativada), 'limited' (perfil só para amizades) ou 'full'.
export function profileAccess(state, viewerId, ownerId) {
  if (!ownerId || viewerId === ownerId) return 'full';
  const rules = rulesOf(state);
  if (rules.inactive.has(ownerId)) return 'none';
  if (isBlockedPair(state, keyOf(viewerId), keyOf(ownerId))) return 'none';
  if (rules.friendsOnly.has(ownerId) && !areFriends(state, keyOf(ownerId), keyOf(viewerId))) return 'limited';
  return 'full';
}
export function canMessage(state, fromId, toKey) {
  if (!String(toKey).startsWith('id:')) return true;
  const to = (state.accounts || []).find(a => keyOf(a.id) === toKey);
  if (!to) return true;
  if (to.deactivatedAt) return false;
  return to.privacy?.messages !== 'friends' || areFriends(state, toKey, keyOf(fromId));
}

const deviceOf = ua => {
  const s = String(ua || '');
  const os = /iPhone|iPad/.test(s) ? 'iPhone/iPad' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'Aparelho';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'navegador';
  return `${browser} · ${os}`;
};
// Chamado ao criar a sessão (cadastro e entrada): guarda só o rótulo do aparelho, nunca o user-agent inteiro nem IP.
export function stampSession(session, userAgent, now = Date.now()) { session.createdAt = now; session.device = deviceOf(userAgent); return session; }

export function accountView(state, account, currentSessionId, now = Date.now()) {
  const key = keyOf(account.id);
  const byKey = new Map((state.accounts || []).map(a => [keyOf(a.id), a]));
  const card = k => { const a = byKey.get(k); return a ? { key: k, name: a.name, username: a.username || '', avatar: a.avatarUrl || (a.avatarId ? `/api/media?id=${a.avatarId}` : '') } : null; };
  const followers = Object.entries(state.follows || {}).filter(([, list]) => Array.isArray(list) && list.includes(key)).map(([id]) => card(keyOf(id))).filter(Boolean);
  return {
    privacy: { profile: account.privacy?.profile === 'friends' ? 'friends' : 'public', messages: account.privacy?.messages === 'friends' ? 'friends' : 'everyone' },
    sessions: (account.sessions || []).filter(s => s.expiresAt > now).map(s => ({ id: s.id, device: s.device || 'Aparelho sem identificação', createdAt: s.createdAt || 0, expiresAt: s.expiresAt, current: s.id === currentSessionId }))
      .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt - a.createdAt),
    followers,
    following: (state.follows?.[account.id] || []).map(card).filter(Boolean),
    blocked: (state.chatBlocks?.[key] || []).map(card).filter(Boolean),
    verified: !!account.verified,
    deletionGraceDays: DELETION_GRACE_DAYS
  };
}

// Ao entrar de novo, a conta desativada volta. Um pedido de exclusão só é cancelado se a pessoa confirmar (o login recusa antes disso).
export function reactivateOnLogin(account) {
  const was = !!(account.deactivatedAt || account.deletionRequestedAt);
  delete account.deactivatedAt; delete account.deletionRequestedAt; delete account.deletionDueAt;
  if (was) rulesVersion++;
  return was;
}

export function accountAction(state, account, body, currentSessionId, now = Date.now()) {
  const key = keyOf(account.id);
  switch (body.action) {
    // MOMENTOS: a pessoa escolhe se os vídeos do feed tocam sozinhos. O padrão é não tocar (economiza dados) e a escolha fica na conta.
    case 'video_prefs': {
      if (!['on', 'off'].includes(body.autoplay)) fail(400, 'Escolha se os vídeos tocam sozinhos ou só ao toque.');
      account.videoAutoplay = body.autoplay;
      return {};
    }
    case 'privacy_update': {
      const profile = body.profile ?? account.privacy?.profile ?? 'public';
      const messages = body.messages ?? account.privacy?.messages ?? 'everyone';
      if (!['public', 'friends'].includes(profile)) fail(400, 'Escolha quem pode ver seu perfil.');
      if (!['everyone', 'friends'].includes(messages)) fail(400, 'Escolha quem pode mandar mensagem.');
      account.privacy = { profile, messages };
      rulesVersion++;
      return {};
    }
    case 'session_revoke': {
      if (typeof body.sessionId !== 'string') fail(400, 'Escolha o aparelho.');
      if (body.sessionId === currentSessionId) fail(400, 'Para sair deste aparelho, use "Sair".');
      const before = (account.sessions || []).length;
      account.sessions = (account.sessions || []).filter(s => s.id !== body.sessionId);
      if (account.sessions.length === before) fail(404, 'Este aparelho já saiu da conta.');
      return {};
    }
    case 'sessions_revoke_others':
      account.sessions = (account.sessions || []).filter(s => s.id === currentSessionId);
      return {};
    case 'follower_remove': {
      const who = String(body.key || '');
      if (!/^id:[a-f0-9-]{36}$/.test(who)) fail(400, 'Escolha a pessoa.');
      const list = state.follows?.[who.slice(3)];
      if (!Array.isArray(list) || !list.includes(key)) fail(404, 'Esta pessoa não segue você.');
      state.follows[who.slice(3)] = list.filter(k => k !== key);
      return {};
    }
    case 'block_set': {
      const who = String(body.key || '');
      if (!/^id:[a-f0-9-]{36}$/.test(who) || !(state.accounts || []).some(a => keyOf(a.id) === who)) fail(404, 'Pessoa não encontrada.');
      if (who === key) fail(400, 'Escolha outra pessoa.');
      if (typeof body.blocked !== 'boolean') fail(400, 'Escolha bloquear ou desbloquear.');
      state.chatBlocks ||= {};
      const set = new Set(state.chatBlocks[key] || []);
      if (body.blocked) {
        set.add(who);
        // Bloquear desfaz os laços nos dois sentidos: amizade, pedidos e seguir.
        state.friends ||= {}; state.friendRequests ||= {}; state.follows ||= {};
        state.friends[key] = (state.friends[key] || []).filter(k => k !== who);
        state.friends[who] = (state.friends[who] || []).filter(k => k !== key);
        state.friendRequests[key] = (state.friendRequests[key] || []).filter(k => k !== who);
        state.friendRequests[who] = (state.friendRequests[who] || []).filter(k => k !== key);
        if (Array.isArray(state.follows[account.id])) state.follows[account.id] = state.follows[account.id].filter(k => k !== who);
        if (Array.isArray(state.follows[who.slice(3)])) state.follows[who.slice(3)] = state.follows[who.slice(3)].filter(k => k !== key);
      } else set.delete(who);
      state.chatBlocks[key] = [...set].slice(-500);
      return {};
    }
    case 'account_deactivate':
    case 'account_delete_request': {
      // Ação sensível: confirma a senha atual mesmo com a sessão aberta.
      if (!account.password || !checkPassword(String(body.password || ''), account.password)) fail(403, 'A senha não confere.');
      account.deactivatedAt = now;
      rulesVersion++;
      if (body.action === 'account_delete_request') { account.deletionRequestedAt = now; account.deletionDueAt = now + DELETION_GRACE_DAYS * DAY; }
      account.sessions = [];
      return { signOut: true };
    }
    // LGPD art. 18 (portabilidade/acesso): baixa os dados da própria conta. Pesado, então no máximo 3 por hora.
    case 'data_export': {
      if (tooMany('export:' + account.id, 3, 3600e3)) fail(429, 'Você já pediu seus dados algumas vezes. Tente de novo daqui a uma hora.');
      note('export:' + account.id, 3600e3);
      return { exportData: exportAccountData(state, account, now) };
    }
    // Consentimentos revogáveis a qualquer momento: dados sensíveis (povo e pertencimento) e cidade no perfil.
    case 'consent_update': {
      if (body.sensitive === false) { delete account.belonging; delete account.povo; recordConsent(account, 'sensitive', false); }
      if (body.location === false) { delete account.location; recordConsent(account, 'location', false); }
      if (body.sensitive !== false && body.location !== false) fail(400, 'Só é possível retirar um consentimento por aqui.');
      return {};
    }
  }
  fail(400, 'Ação de conta desconhecida.');
}
