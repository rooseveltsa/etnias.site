// LGPD (art. 18): exportação dos dados da própria pessoa, consentimentos e eliminação definitiva da conta.
// RASCUNHO técnico: os textos jurídicos e os prazos precisam de revisão de advogado antes de valerem como compromisso.
import { ownMediaIds } from './post-media.mjs';

export const TERMS_VERSION = '2026-11-rascunho';
const key = id => `id:${id}`;
const UUID = /^[a-f0-9-]{36}$/;
const withoutId = (list, id) => Array.isArray(list) ? list.filter(x => x !== id) : list;

// ----- Exportação -----
export function exportAccountData(state, account, now = Date.now()) {
  const id = account.id, me = key(id);
  const byKey = new Map((state.accounts || []).map(a => [key(a.id), a]));
  const who = k => { const a = byKey.get(k); return a ? { key: k, name: a.name, username: a.username || '' } : { key: k }; };
  const mine = (state.posts || []).filter(p => p.authorId === id);
  const comments = [];
  const reactions = [];
  const saved = [];
  for (const p of state.posts || []) {
    for (const c of p.comments || []) if (c.authorKey === me) comments.push({ postId: p.id, id: c.id, text: c.text, createdAt: c.createdAt });
    if (p.reactions?.[id]) reactions.push({ postId: p.id, reaction: p.reactions[id] });
    if (Array.isArray(p.saves) && p.saves.includes(id)) saved.push(p.id);
  }
  const mediaIds = new Set([...mine.flatMap(ownMediaIds), account.avatarId, account.coverId].filter(Boolean));
  const { password, legacyPassword, sessions, ...profile } = account;
  return {
    formato: 'etnias-meus-dados-v1',
    geradoEm: new Date(now).toISOString(),
    aviso: 'Estes são os dados que o Etnias guarda sobre a sua conta. Fotos, vídeos e arquivos podem ser baixados em /api/media?id=<código> enquanto você estiver conectado(a).',
    conta: profile,
    consentimentos: account.consent || {},
    aparelhos: (sessions || []).map(s => ({ aparelho: s.device || '', criadoEm: s.createdAt || 0, expiraEm: s.expiresAt || 0 })),
    publicacoes: mine.map(p => ({ id: p.id, texto: p.text, criadaEm: p.createdAt, audiencia: p.audience, comunidade: p.communityName || '', local: p.location || '', midias: ownMediaIds(p), comentarios: (p.comments || []).length })),
    comentarios: comments,
    reacoes: reactions,
    salvos: saved,
    stories: (state.stories || []).filter(s => s.authorId === id).map(s => ({ id: s.id, texto: s.text, criadoEm: s.createdAt, midia: s.media?.id || '' })),
    mensagensDiretas: (state.dms || []).filter(m => m.fromKey === me || m.toKey === me).map(m => ({ id: m.id, de: m.fromKey === me ? 'você' : who(m.fromKey), para: m.toKey === me ? 'você' : who(m.toKey), texto: m.text, em: m.createdAt, midia: m.media?.id || '' })),
    amizades: (state.friends?.[me] || []).map(who),
    seguindo: (state.follows?.[id] || []).map(who),
    seguidores: Object.entries(state.follows || {}).filter(([, l]) => Array.isArray(l) && l.includes(me)).map(([k]) => who(key(k))),
    bloqueios: (state.chatBlocks?.[me] || []).map(who),
    comunidades: (state.communities || []).filter(c => (c.members || []).includes(me)).map(c => ({ id: c.id, nome: c.name })),
    anuncios: (state.market || []).filter(m => m.sellerId === id).map(m => ({ id: m.id, titulo: m.title, descricao: m.description, preco: m.price, fotos: m.photos || [] })),
    conversaComIara: state.etnia?.[id] || [],
    interesses: state.interests?.[id] ?? null,
    pedidosDeVerificacao: (state.verificationRequests || []).filter(v => v.userId === id),
    avisosNoAparelho: (state.pushSubscriptions?.[id] || []).length,
    arquivosDeMidia: [...mediaIds]
  };
}

// ----- Consentimentos -----
export function recordConsent(account, kind, value, now = Date.now()) {
  account.consent ||= {};
  if (value) account.consent[kind] = kind === 'terms' ? { version: TERMS_VERSION, at: now } : { at: now };
  else delete account.consent[kind];
}
// Povo e pertencimento revelam origem étnica (dado sensível, art. 11): exigem consentimento específico, registrado e revogável.
export function sensitiveChange(account, nextBelonging, nextPovo) {
  const belongingChanged = nextBelonging !== undefined && nextBelonging !== (account.belonging || '') && nextBelonging !== '';
  const povoChanged = !!nextPovo && nextPovo !== (account.povo || '');
  return belongingChanged || povoChanged;
}

// ----- Eliminação -----
export const DELETION_GRACE_DAYS = 30;
export const dueForPurge = (account, now = Date.now()) => !!account.deletionRequestedAt && now >= (account.deletionDueAt || account.deletionRequestedAt + DELETION_GRACE_DAYS * 864e5);

// Apaga a conta e tudo o que for dela; devolve os arquivos de mídia a remover do disco. Mensagens, comentários e reações vão embora;
// reposts de terceiros mantêm só um aviso de "conta excluída". O registro de moderação é mantido sem nome (prestação de contas).
export function purgeAccount(state, accountId) {
  const account = (state.accounts || []).find(a => a.id === accountId);
  if (!account) return { mediaIds: [] };
  const me = key(accountId);
  const media = new Set([account.avatarId, account.coverId].filter(Boolean));
  const name = account.name;

  const gone = new Set();
  state.posts = (state.posts || []).filter(p => {
    if (p.authorId !== accountId) return true;
    gone.add(p.id); ownMediaIds(p).forEach(m => media.add(m)); return false;
  });
  for (const p of state.posts) {
    if (p.repostOf && (gone.has(p.repostOf.id) || p.repostOf.authorKey === me)) p.repostOf = { id: p.repostOf.id, author: 'Conta excluída', authorKey: '', createdAt: p.repostOf.createdAt, text: '', removed: true };
    if (p.comments) {
      p.comments = p.comments.filter(c => c.authorKey !== me);
      for (const c of p.comments) if (Array.isArray(c.likes)) c.likes = withoutId(c.likes, me);
    }
    if (p.reactions) delete p.reactions[accountId];
    if (p.saves) p.saves = withoutId(p.saves, accountId);
    if (p.poll?.votes) delete p.poll.votes[accountId];
    if (p.mentions) p.mentions = withoutId(p.mentions, accountId);
  }
  for (const s of state.stories || []) {
    if (s.authorId === accountId && s.media?.id) media.add(s.media.id);
    if (Array.isArray(s.views)) s.views = withoutId(s.views, accountId);
    if (s.reactions && !Array.isArray(s.reactions)) delete s.reactions[accountId];
  }
  state.stories = (state.stories || []).filter(s => s.authorId !== accountId);
  state.dms = (state.dms || []).filter(m => {
    const mineMsg = m.fromKey === me;
    if (mineMsg && m.media?.id) media.add(m.media.id);
    return !mineMsg && m.toKey !== me;
  });
  state.calls = (state.calls || []).filter(c => c.fromKey !== me && c.toKey !== me);
  for (const g of state.groupCalls || []) if (Array.isArray(g.members)) g.members = withoutId(g.members, me);
  for (const [k] of Object.entries(state.chatConsent || {})) if (k.split('|').includes(me)) delete state.chatConsent[k];
  for (const holder of [state.chatPreferences, state.chatTyping, state.interests, state.saberes, state.musicLikes, state.limits, state.i18n, state.etnia, state.pushSubscriptions, state.announcementDismiss]) if (holder) delete holder[accountId];
  for (const c of state.communities || []) for (const f of ['members', 'admins', 'moderators', 'pendingRequests', 'invited']) if (Array.isArray(c[f])) c[f] = withoutId(c[f], me);
  for (const g of state.chatGroups || []) {
    for (const f of ['members', 'admins', 'invited']) if (Array.isArray(g[f])) g[f] = withoutId(g[f], me);
    for (const f of ['joinedAt', 'joinedAfter']) if (g[f]) delete g[f][me];
  }
  // Relações nos dois sentidos.
  for (const holder of [state.follows, state.friends, state.friendRequests, state.chatBlocks]) {
    if (!holder) continue;
    delete holder[accountId]; delete holder[me];
    for (const k of Object.keys(holder)) if (Array.isArray(holder[k])) holder[k] = holder[k].filter(x => x !== me && x !== accountId);
  }
  state.followEvents = (state.followEvents || []).filter(e => e.from !== accountId && e.to !== me && e.from !== me && e.to !== accountId);
  // Anúncios: da pessoa saem com as fotos; avaliações dela em anúncios de outros saem.
  state.market = (state.market || []).filter(m => {
    if (m.sellerId !== accountId) { if (m.reviews && !Array.isArray(m.reviews)) delete m.reviews[accountId]; return true; }
    for (const ph of m.photos || []) { const id = typeof ph === 'string' ? ph : ph?.id; if (UUID.test(id || '')) media.add(id); }
    return false;
  });
  state.verificationRequests = (state.verificationRequests || []).filter(v => v.userId !== accountId);
  for (const b of state.boosts || []) if (b.userId === accountId) b.userId = '';
  for (const e of state.adminLog || []) { if (e.by === accountId) { e.by = ''; e.byName = 'Conta excluída'; } if (e.target === name) e.target = 'Conta excluída'; }
  state.accounts = state.accounts.filter(a => a.id !== accountId);
  return { mediaIds: [...media].filter(id => UUID.test(id)) };
}
