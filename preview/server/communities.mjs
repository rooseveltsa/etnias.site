import { randomUUID, randomBytes } from 'node:crypto';
import { orphanMediaIds } from './post-media.mjs';

export const communityActions = [
  'community_create',
  'community_join',
  'community_leave',
  'community_approve',
  'community_reject',
  'community_invite',
  'community_accept_invite',
  'community_decline_invite',
  'community_role',
  'community_remove_member',
  'community_update',
  'community_moderate_post',
  'community_report',
  'community_chat',
  'community_link_create',
  'community_link_revoke',
  'community_join_link',
  'community_pin',
  'community_unban',
  'community_comments'
];

export const communityCategories = [
  'Projeto & Rede',
  'Saberes & Educação',
  'Território & Guardiões',
  'Cultura & Audiovisual',
  'Economia & Articulação',
  'Saúde & Bem-viver',
  'Música & Artes',
  'Línguas & Tradução',
  'Mulheres & Juventude',
  'Esporte & Lazer',
  'Notícias & Eventos',
  'Artesanato & Empreendedorismo'
];
// Quem pode publicar no feed da comunidade: 'open' (qualquer participante) ou 'staff' (só administração e moderação).
const postingModes = ['open', 'staff'];
const LINK_DAYS = [1, 7, 30];

const keyOf = me => `id:${me.id}`;
// Perguntas de entrada: até 3, definidas pela administração; respostas só valem enquanto o pedido está pendente.
function questionsOf(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 3) fail(400, 'Use até 3 perguntas de entrada.');
  return value.map(q => text(String(q ?? ''), 200, false)).filter(Boolean);
}
const slugify = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'comunidade';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(400, 'Confira o texto e o limite de caracteres.');
  }
  return value.trim();
}

function personAccount(state, key) {
  const acc = typeof key === 'string' && key.startsWith('id:') && (state.accounts || []).find(a => keyOf(a) === key);
  if (!acc) fail(404, 'Esta pessoa não tem conta nesta prévia.');
  return acc;
}

export function ensureCommunities(state) {
  state.interests ||= {};
  if (!Array.isArray(state.communities) || !state.communities.length) {
    const joinedKeys = Object.entries(state.interests).filter(([, on]) => on).map(([id]) => `id:${id}`);
    state.communities = [
      {
        id: 'avaliacao-casa-opy',
        slug: 'avaliacao-casa-opy',
        name: 'Avaliação do Etnias',
        category: 'Projeto & Rede',
        visibility: 'public',
        coverTone: 'terracotta',
        description: 'Um grupo aberto para acompanhar e conversar sobre a atualização da plataforma, navegação, acessibilidade e próximos passos.',
        rules: 'Respeite a diversidade dos participantes. Compartilhe apenas conteúdos e relatos autorizados. Conhecimentos tradicionais restritos não devem ser publicados.',
        governanceNote: 'Espaço de homologação coordenado pela equipe do projeto Etnias.',
        createdAt: 1762250000000,
        members: [...new Set(joinedKeys)],
        admins: [],
        moderators: [],
        pendingRequests: [],
        invited: []
      },
      {
        id: 'saberes-e-formacao',
        slug: 'saberes-e-formacao',
        name: 'Trilhas de Saberes e Formação',
        category: 'Saberes & Educação',
        visibility: 'public',
        coverTone: 'forest',
        description: 'Espaço de diálogo sobre cursos comunitários, letramento digital, materiais educativos e trocas metodológicas.',
        rules: 'Cite sempre a autoria e a fonte dos materiais compartilhados. Não publique conteúdos pedagógicos de uso restrito sem autorização expressa.',
        governanceNote: 'Comunidade temática aberta com moderação colaborativa.',
        createdAt: 1762250100000,
        members: [],
        admins: [],
        moderators: [],
        pendingRequests: [],
        invited: []
      },
      {
        id: 'articulacao-territorial',
        slug: 'articulacao-territorial',
        name: 'Articulação Territorial e Ambiental',
        category: 'Território & Guardiões',
        visibility: 'private',
        coverTone: 'slate',
        description: 'Comunidade privada com entrada mediante aprovação para organização de registros ambientais e articulação de rede.',
        rules: 'Entrada restrita a membros aprovados. Não exponha coordenadas sensíveis, dados pessoais de terceiros ou situações de emergência imediata.',
        governanceNote: 'Visibilidade privada: publicações e lista detalhada de relatos ficam visíveis apenas para participantes aprovados.',
        createdAt: 1762250200000,
        members: [],
        admins: [],
        moderators: [],
        pendingRequests: [],
        invited: []
      },
      {
        id: 'audiovisual-e-memoria',
        slug: 'audiovisual-e-memoria',
        name: 'Audiovisual, Fotografia e Memória',
        category: 'Cultura & Audiovisual',
        visibility: 'public',
        coverTone: 'ochre',
        description: 'Encontros entre comunicadores, realizadores audiovisuais e fotógrafos para divulgação de acervos e projetos culturais.',
        rules: 'Respeite os direitos de imagem, voz e autoria coletiva. Não gere nem publique representações artificiais atribuídas a povos específicos.',
        governanceNote: 'Respeito aos princípios CARE de soberania e governança sobre mídias e acervos.',
        createdAt: 1762250300000,
        members: [],
        admins: [],
        moderators: [],
        pendingRequests: [],
        invited: []
      }
    ];
  }
  const primary = state.communities.find(c => c.id === 'avaliacao-casa-opy');
  if (primary) {
    for (const [id, on] of Object.entries(state.interests)) {
      const k = `id:${id}`;
      if (on && !primary.members.includes(k)) primary.members.push(k);
    }
  }
  return state.communities;
}

function syncLegacyInterest(state, community, memberKey, joined) {
  if (community.id === 'avaliacao-casa-opy' && memberKey.startsWith('id:')) {
    state.interests ||= {};
    state.interests[memberKey.slice(3)] = !!joined;
  }
}

// Convite por link: o token é aleatório, tem validade (1, 7 ou 30 dias) e a administração ou moderação pode revogar.
const activeLinks = c => (c.inviteLinks || []).filter(l => !l.revoked && (!l.expiresAt || l.expiresAt > Date.now()));

export function canViewCommunityContent(state, me, communityId) {
  if (!communityId) return true;
  const list = ensureCommunities(state);
  const c = list.find(item => item.id === communityId);
  if (!c || c.suspended) return false;
  if (c.visibility !== 'private') return true;
  return !!me && c.members.includes(keyOf(me));
}

export function canPostInCommunity(state, me, communityId) {
  const list = ensureCommunities(state);
  const c = list.find(item => item.id === communityId);
  if (!c || c.suspended) fail(404, 'Comunidade não encontrada.');
  const mine = keyOf(me);
  if (!c.members.includes(mine)) {
    fail(403, 'Participe desta comunidade antes de publicar nela.');
  }
  if (c.postingMode === 'staff' && !isStaff(c, mine)) fail(403, 'Nesta comunidade só a administração e a moderação podem publicar. Você pode comentar e reagir.');
  return c;
}

function roleOf(c, memberKey) {
  if (c.admins?.includes(memberKey)) return 'admin';
  if (c.moderators?.includes(memberKey)) return 'moderator';
  if (c.members?.includes(memberKey)) return 'member';
  return 'none';
}

function isStaff(c, memberKey) {
  return c.admins?.includes(memberKey) || c.moderators?.includes(memberKey);
}

function accountSummary(byKey, memberKey, c) {
  const acc = byKey.get(memberKey);
  return {
    key: memberKey,
    name: acc?.name || 'Participante',
    username: acc?.username || '',
    role: roleOf(c, memberKey)
  };
}

export function projectCommunities(state, me) {
  const mine = keyOf(me);
  const list = ensureCommunities(state);
  // Índices montados uma vez por requisição: buscar conta e contar posts dentro do laço custava O(membros × contas).
  const byKey = new Map((state.accounts || []).map(a => [keyOf(a), a]));
  const postsCounts = new Map();
  for (const p of state.posts || []) if (p.communityId && (p.audience !== 'private' || p.authorId === me.id)) postsCounts.set(p.communityId, (postsCounts.get(p.communityId) || 0) + 1);
  return list.filter(c => !c.suspended).map(c => {
    const joined = c.members.includes(mine);
    const pending = (c.pendingRequests || []).includes(mine);
    const invited = (c.invited || []).includes(mine);
    const role = roleOf(c, mine);
    const staff = isStaff(c, mine);
    const canSeeMembers = c.visibility === 'public' || joined || staff;
    const members = canSeeMembers
      ? c.members.map(k => accountSummary(byKey, k, c))
      : [];
    const postsCount = postsCounts.get(c.id) || 0;
    return {
      id: c.id,
      slug: c.slug || c.id,
      name: c.name,
      category: c.category,
      visibility: c.visibility,
      coverTone: c.coverTone || 'terracotta',
      description: c.description,
      rules: c.rules || '',
      governanceNote: c.governanceNote || '',
      createdAt: c.createdAt,
      membersCount: c.members.length,
      postsCount,
      ownerKey: ownerOf(c),
      isOwner: ownerOf(c) === mine,
      pinnedPostId: c.pinnedPostId || '',
      commentsOff: !!c.commentsOff,
      banned: staff ? (c.banned || []).map(k => accountSummary(byKey, k, c)) : [],
      history: staff ? (c.history || []).slice(-50).reverse().map(h => ({ ...h, whoName: byKey.get(h.who)?.name || 'Alguém', targetName: h.target ? (byKey.get(h.target)?.name || 'Alguém') : '' })) : [],
      joined,
      chatKey: joined ? chatKeyOf(state, c) : '',
      pending,
      invited,
      role,
      canManage: c.admins.includes(mine),
      canModerate: staff,
      members,
      admins: c.admins.map(k => accountSummary(byKey, k, c)),
      moderators: (c.moderators || []).map(k => accountSummary(byKey, k, c)),
      entryQuestions: c.entryQuestions || [],
      postingMode: c.postingMode === 'staff' ? 'staff' : 'open',
      canPost: joined && (c.postingMode !== 'staff' || staff),
      inviteLinks: staff ? activeLinks(c).map(l => ({ token: l.token, createdAt: l.createdAt, expiresAt: l.expiresAt, uses: l.uses || 0 })) : [],
      pendingRequests: staff ? (c.pendingRequests || []).map(k => ({ ...accountSummary(byKey, k, c), answers: c.requestAnswers?.[k]?.answers || [] })) : []
    };
  });
}

// Conversa da comunidade: um grupo do chat cujos participantes são sempre os membros da comunidade
// (entrar, sair, aprovar ou remover na comunidade vale para a conversa). Administração e moderação viram admins do grupo.
function chatKeyOf(state, c) { const g = (state.chatGroups || []).find(item => item.communityId === c.id); return g ? `group:${g.id}` : ''; }
export function syncCommunityChat(state, c) {
  const g = (state.chatGroups || []).find(item => item.communityId === c.id);
  if (!g) return null;
  const now = Date.now();
  g.joinedAt ||= {};
  g.joinedAfter ||= {};
  for (const k of c.members) if (!g.members.includes(k)) { g.joinedAfter[k] = state.dms?.at(-1)?.id || null; g.joinedAt[k] = now; }
  g.name = c.name;
  g.members = [...c.members];
  g.admins = [...new Set([...(c.admins || []), ...(c.moderators || [])])].filter(k => c.members.includes(k));
  g.invited = [];
  return g;
}

// Dono: quem criou (comunidades antigas: a primeira pessoa administradora). Só o dono nomeia ou tira administração e moderação.
export const ownerOf = c => c.createdBy || c.admins?.[0] || '';
// Histórico da comunidade: quem fez o quê, visível para a administração e moderação (últimos 300 registros).
function remember(c, who, type, target = '', extra = {}) { c.history ||= []; c.history.push({ at: Date.now(), type, who, target, ...extra }); if (c.history.length > 300) c.history = c.history.slice(-300); }
const isBanned = (c, key) => (c.banned || []).includes(key);
export function communityAction(state, me, body) {
  const mine = keyOf(me);
  const list = ensureCommunities(state);

  if (body.action === 'community_create') {
    // AUD-14: cota por pessoa; o teto geral só protege o servidor.
    if (list.filter(c => c.createdBy === mine || (!c.createdBy && c.admins?.[0] === mine)).length >= 10) fail(409, 'Você já criou 10 comunidades. Fale com a equipe Etnias se precisar de mais.');
    if (list.length >= 5000) fail(409, 'A rede atingiu o limite de comunidades. Fale com a equipe Etnias.');
    const name = text(body.name, 60);
    if (name.length < 3) fail(400, 'O nome da comunidade precisa ter pelo menos 3 caracteres.');
    const category = communityCategories.includes(body.category) ? body.category : communityCategories[0];
    const visibility = body.visibility === 'private' ? 'private' : 'public';
    const description = text(body.description, 600);
    const rules = text(body.rules || 'Respeite os participantes e compartilhe apenas conteúdos autorizados.', 1000, false);
    const governanceNote = text(body.governanceNote || (visibility === 'private'
      ? 'Comunidade privada: solicitações de entrada passam pela administração.'
      : 'Comunidade aberta: qualquer pessoa autenticada pode participar e publicar.'), 300, false);
    const coverTone = ['terracotta', 'forest', 'slate', 'ochre'].includes(body.coverTone) ? body.coverTone : 'terracotta';
    const baseSlug = slugify(name);
    const id = list.some(c => c.id === baseSlug) ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;
    list.push({
      id,
      slug: id,
      name,
      category,
      visibility,
      coverTone,
      description,
      rules,
      governanceNote,
      entryQuestions: visibility === 'private' ? (questionsOf(body.entryQuestions) || []) : [],
      postingMode: postingModes.includes(body.postingMode) ? body.postingMode : 'open',
      createdAt: Date.now(),
      createdBy: mine,
      members: [mine],
      admins: [mine],
      moderators: [],
      pendingRequests: [],
      invited: []
    });
    return { createdId: id };
  }

  if (body.action === 'community_join_link') {
    const token = typeof body.token === 'string' ? body.token : '';
    const target = token.length >= 20 && token.length <= 64 ? list.find(item => !item.suspended && (item.inviteLinks || []).some(l => l.token === token)) : null;
    const link = target && activeLinks(target).find(l => l.token === token);
    if (!link) fail(404, 'Este convite não vale mais. Peça um novo link a quem convidou.');
    if (isBanned(target, mine)) fail(403, 'Você não pode entrar nesta comunidade. Fale com a administração dela.');
    target.members ||= []; target.admins ||= []; target.moderators ||= []; target.pendingRequests ||= []; target.invited ||= [];
    if (!target.members.includes(mine)) {
      target.members.push(mine);
      target.invited = target.invited.filter(k => k !== mine);
      target.pendingRequests = target.pendingRequests.filter(k => k !== mine);
      link.uses = (link.uses || 0) + 1;
      target.history ||= [];
      target.history.push({ at: Date.now(), type: 'join_link', who: mine });
      syncLegacyInterest(state, target, mine, true);
    }
    return { joinedId: target.id };
  }

  const c = list.find(item => item.id === body.communityId && !item.suspended);
  if (!c) fail(404, 'Comunidade não encontrada.');
  c.members ||= [];
  c.admins ||= [];
  c.moderators ||= [];
  c.pendingRequests ||= [];
  c.invited ||= [];

  if (body.action === 'community_chat') {
    if (!c.members.includes(mine)) fail(403, 'Entre na comunidade para participar da conversa.');
    state.chatGroups ||= [];
    if (!state.chatGroups.some(g => g.communityId === c.id)) state.chatGroups.push({ id: randomUUID(), communityId: c.id, name: c.name, description: '', members: [], admins: [], invited: [], joinedAt: {} });
    syncCommunityChat(state, c);
    return {};
  }

  if (body.action === 'community_link_create') {
    if (!isStaff(c, mine)) fail(403, 'Só a administração ou a moderação cria links de convite.');
    const days = LINK_DAYS.includes(Number(body.days)) ? Number(body.days) : 7;
    c.inviteLinks = activeLinks(c);
    if (c.inviteLinks.length >= 10) fail(409, 'Já existem 10 links ativos. Revogue algum antes de criar outro.');
    c.inviteLinks.push({ token: randomBytes(24).toString('base64url'), createdBy: mine, createdAt: Date.now(), expiresAt: Date.now() + days * 864e5, uses: 0 });
    c.history ||= []; c.history.push({ at: Date.now(), type: 'link_created', who: mine });
    return {};
  }

  if (body.action === 'community_link_revoke') {
    if (!isStaff(c, mine)) fail(403, 'Só a administração ou a moderação revoga links de convite.');
    const link = (c.inviteLinks || []).find(l => l.token === body.token);
    if (!link) fail(404, 'Link não encontrado.');
    link.revoked = true;
    c.history ||= []; c.history.push({ at: Date.now(), type: 'link_revoked', who: mine });
    return {};
  }

  if (body.action === 'community_join') {
    if (c.members.includes(mine)) {
      if (c.admins.includes(mine) && c.admins.length === 1 && c.members.length > 1) {
        fail(409, 'Defina outra pessoa administradora antes de sair da comunidade.');
      }
      c.members = c.members.filter(k => k !== mine);
      c.admins = c.admins.filter(k => k !== mine);
      c.moderators = c.moderators.filter(k => k !== mine);
      syncLegacyInterest(state, c, mine, false);
      return {};
    }
    if (isBanned(c, mine)) fail(403, 'Você não pode entrar nesta comunidade. Fale com a administração dela.');
    if (c.visibility === 'private' && !c.invited.includes(mine)) {
      c.requestAnswers ||= {};
      if (c.pendingRequests.includes(mine)) {
        c.pendingRequests = c.pendingRequests.filter(k => k !== mine);
        delete c.requestAnswers[mine];
      } else {
        const questions = c.entryQuestions || [];
        if (questions.length) {
          if (!Array.isArray(body.answers) || body.answers.length !== questions.length) fail(400, 'Responda às perguntas de entrada da comunidade.');
          c.requestAnswers[mine] = { answers: body.answers.map(a => text(String(a ?? ''), 500)), at: Date.now() };
        }
        c.pendingRequests.push(mine);
      }
      return {};
    }
    c.invited = c.invited.filter(k => k !== mine);
    c.pendingRequests = c.pendingRequests.filter(k => k !== mine);
    c.members.push(mine);
    if (!c.admins.length && c.id !== 'avaliacao-casa-opy' && c.members.length === 1) {
      c.admins.push(mine);
    }
    syncLegacyInterest(state, c, mine, true);
    return {};
  }

  if (body.action === 'community_leave') {
    if (!c.members.includes(mine)) fail(400, 'Você não participa desta comunidade.');
    if (c.admins.includes(mine) && c.admins.length === 1 && c.members.length > 1) {
      fail(409, 'Defina outra pessoa administradora antes de sair da comunidade.');
    }
    c.members = c.members.filter(k => k !== mine);
    c.admins = c.admins.filter(k => k !== mine);
    c.moderators = c.moderators.filter(k => k !== mine);
    syncLegacyInterest(state, c, mine, false);
    return {};
  }

  if (body.action === 'community_accept_invite' || body.action === 'community_decline_invite') {
    if (!c.invited.includes(mine)) fail(404, 'Convite não encontrado.');
    c.invited = c.invited.filter(k => k !== mine);
    c.pendingRequests = c.pendingRequests.filter(k => k !== mine);
    if (body.action === 'community_accept_invite' && isBanned(c, mine)) fail(403, 'Você não pode entrar nesta comunidade. Fale com a administração dela.');
    if (body.action === 'community_accept_invite' && !c.members.includes(mine)) {
      c.members.push(mine);
      syncLegacyInterest(state, c, mine, true);
    }
    return {};
  }

  if (body.action === 'community_invite') {
    if (!c.members.includes(mine)) fail(403, 'Apenas participantes podem convidar pessoas.');
    if (isBanned(c, body.memberKey)) fail(409, 'Esta pessoa foi bloqueada nesta comunidade.');
    if (c.visibility === 'private' && !isStaff(c, mine)) {
      fail(403, 'Em comunidades privadas, apenas a administração ou moderação envia convites diretos.');
    }
    const target = body.memberKey;
    personAccount(state, target);
    if (!c.members.includes(target) && !c.invited.includes(target)) {
      c.invited.push(target);
    }
    return {};
  }

  if (body.action === 'community_approve' || body.action === 'community_reject') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação gerencia solicitações.');
    const target = body.memberKey;
    personAccount(state, target);
    if (!c.pendingRequests.includes(target)) fail(404, 'Solicitação não encontrada.');
    c.pendingRequests = c.pendingRequests.filter(k => k !== target);
    if (c.requestAnswers) delete c.requestAnswers[target];
    remember(c, mine, body.action === 'community_approve' ? 'approve' : 'reject', target);
    if (body.action === 'community_approve' && !c.members.includes(target)) {
      c.members.push(target);
      syncLegacyInterest(state, c, target, true);
    }
    return {};
  }

  if (body.action === 'community_role') {
    if (ownerOf(c) !== mine) fail(403, 'Só quem criou a comunidade nomeia administração e moderação.');
    const target = body.memberKey;
    if (target === ownerOf(c)) fail(409, 'Quem criou a comunidade continua na administração.');
    personAccount(state, target);
    if (!c.members.includes(target)) fail(404, 'Participante não encontrado na comunidade.');
    if (!['admin', 'moderator', 'member'].includes(body.role)) fail(400, 'Papel inválido.');
    if (target === mine && body.role !== 'admin' && c.admins.length === 1) {
      fail(409, 'A comunidade precisa de pelo menos uma pessoa administradora.');
    }
    c.admins = c.admins.filter(k => k !== target);
    c.moderators = c.moderators.filter(k => k !== target);
    if (body.role === 'admin') c.admins.push(target);
    if (body.role === 'moderator') c.moderators.push(target);
    remember(c, mine, 'role', target, { role: body.role });
    return {};
  }

  if (body.action === 'community_remove_member') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação remove participantes.');
    const target = body.memberKey;
    if (target === mine) fail(400, 'Use a opção Sair da comunidade.');
    if (c.admins.includes(target) && !c.admins.includes(mine)) {
      fail(403, 'Moderadores não podem remover administradores.');
    }
    if (target === ownerOf(c)) fail(403, 'Quem criou a comunidade não pode ser removido.');
    // Remover e bloquear: a pessoa não entra de novo (nem por link, pedido ou convite) até ser desbloqueada.
    if (body.ban) { c.banned ||= []; if (!c.banned.includes(target)) c.banned.push(target); c.pendingRequests = c.pendingRequests.filter(k => k !== target); c.invited = c.invited.filter(k => k !== target); }
    remember(c, mine, body.ban ? 'ban' : 'remove', target);
    c.members = c.members.filter(k => k !== target);
    c.admins = c.admins.filter(k => k !== target);
    c.moderators = c.moderators.filter(k => k !== target);
    syncLegacyInterest(state, c, target, false);
    return {};
  }

  if (body.action === 'community_update') {
    if (!c.admins.includes(mine)) fail(403, 'Apenas administradores podem editar as configurações da comunidade.');
    c.name = text(body.name, 60);
    if (c.name.length < 3) fail(400, 'O nome precisa ter pelo menos 3 caracteres.');
    if (body.category && communityCategories.includes(body.category)) c.category = body.category;
    if (body.visibility && ['public', 'private'].includes(body.visibility)) c.visibility = body.visibility;
    if (postingModes.includes(body.postingMode)) c.postingMode = body.postingMode;
    c.description = text(body.description, 600);
    c.rules = text(body.rules || '', 1000, false);
    c.governanceNote = text(body.governanceNote || '', 300, false);
    if (body.coverTone && ['terracotta', 'forest', 'slate', 'ochre'].includes(body.coverTone)) c.coverTone = body.coverTone;
    const questions = questionsOf(body.entryQuestions);
    if (questions !== undefined) c.entryQuestions = questions;
    if (c.visibility === 'public') c.entryQuestions = [];
    return {};
  }

  if (body.action === 'community_moderate_post') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação pode remover publicações da comunidade.');
    const post = (state.posts || []).find(p => p.id === body.postId && p.communityId === c.id);
    if (!post) fail(404, 'Publicação não encontrada nesta comunidade.');
    const remaining = state.posts.filter(p => p.id !== post.id);
    const removedIds = orphanMediaIds(post, remaining);
    state.posts = remaining;
    if (c.pinnedPostId === post.id) delete c.pinnedPostId;
    remember(c, mine, 'post_removed', `id:${post.authorId}`, { excerpt: (post.text || 'Publicação com mídia').slice(0, 120) });
    return { removedIds };
  }

  if (body.action === 'community_unban') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação desbloqueia.');
    c.banned = (c.banned || []).filter(k => k !== body.memberKey);
    remember(c, mine, 'unban', body.memberKey);
    return {};
  }

  if (body.action === 'community_pin') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação fixa publicações.');
    if (body.postId) { if (!(state.posts || []).some(p => p.id === body.postId && p.communityId === c.id)) fail(404, 'Publicação não encontrada nesta comunidade.'); c.pinnedPostId = body.postId; }
    else delete c.pinnedPostId;
    remember(c, mine, body.postId ? 'pin' : 'unpin');
    return {};
  }

  if (body.action === 'community_comments') {
    if (!c.admins.includes(mine)) fail(403, 'Apenas a administração liga ou desliga comentários.');
    c.commentsOff = !!body.off;
    remember(c, mine, c.commentsOff ? 'comments_off' : 'comments_on');
    return {};
  }

  if (body.action === 'community_report') {
    const reason = text(body.reason, 500);
    state.communityReports ||= [];
    if (state.communityReports.filter(r => r.authorKey === mine).length >= 20) {
      fail(409, 'Limite de registros de denúncia atingido.');
    }
    state.communityReports.push({
      id: randomUUID(),
      communityId: c.id,
      postId: body.postId || null,
      authorKey: mine,
      reason,
      createdAt: Date.now()
    });
    return {};
  }

  fail(400, 'Ação de comunidade desconhecida.');
}
