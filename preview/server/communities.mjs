import { randomUUID } from 'node:crypto';

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
  'community_report'
];

export const communityCategories = [
  'Projeto & Rede',
  'Saberes & Educação',
  'Território & Guardiões',
  'Cultura & Audiovisual',
  'Economia & Articulação'
];

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
        name: 'Avaliação da Casa Opy',
        category: 'Projeto & Rede',
        visibility: 'public',
        coverTone: 'terracotta',
        description: 'Um grupo aberto para acompanhar e conversar sobre a atualização da plataforma, navegação, acessibilidade e próximos passos.',
        rules: 'Respeite a diversidade dos participantes. Compartilhe apenas conteúdos e relatos autorizados. Conhecimentos tradicionais restritos não devem ser publicados.',
        governanceNote: 'Espaço de homologação coordenado pela equipe do projeto Casa Opy.',
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

export function canViewCommunityContent(state, me, communityId) {
  if (!communityId) return true;
  const list = ensureCommunities(state);
  const c = list.find(item => item.id === communityId);
  if (!c) return false;
  if (c.visibility !== 'private') return true;
  return !!me && c.members.includes(keyOf(me));
}

export function canPostInCommunity(state, me, communityId) {
  const list = ensureCommunities(state);
  const c = list.find(item => item.id === communityId);
  if (!c) fail(404, 'Comunidade não encontrada.');
  const mine = keyOf(me);
  if (!c.members.includes(mine)) {
    fail(403, 'Participe desta comunidade antes de publicar nela.');
  }
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

function accountSummary(state, memberKey, c) {
  const acc = (state.accounts || []).find(a => keyOf(a) === memberKey);
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
  return list.map(c => {
    const joined = c.members.includes(mine);
    const pending = (c.pendingRequests || []).includes(mine);
    const invited = (c.invited || []).includes(mine);
    const role = roleOf(c, mine);
    const staff = isStaff(c, mine);
    const canSeeMembers = c.visibility === 'public' || joined || staff;
    const members = canSeeMembers
      ? c.members.map(k => accountSummary(state, k, c))
      : [];
    const postsCount = (state.posts || []).filter(p => p.communityId === c.id && (p.audience !== 'private' || p.authorId === me.id)).length;
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
      joined,
      pending,
      invited,
      role,
      canManage: c.admins.includes(mine),
      canModerate: staff,
      members,
      admins: c.admins.map(k => accountSummary(state, k, c)),
      moderators: (c.moderators || []).map(k => accountSummary(state, k, c)),
      entryQuestions: c.entryQuestions || [],
      pendingRequests: staff ? (c.pendingRequests || []).map(k => ({ ...accountSummary(state, k, c), answers: c.requestAnswers?.[k]?.answers || [] })) : []
    };
  });
}

export function communityAction(state, me, body) {
  const mine = keyOf(me);
  const list = ensureCommunities(state);

  if (body.action === 'community_create') {
    if (list.length >= 60) fail(409, 'Limite de comunidades desta prévia atingido.');
    const name = text(body.name, 60);
    if (name.length < 3) fail(400, 'O nome da comunidade precisa ter pelo menos 3 caracteres.');
    const category = communityCategories.includes(body.category) ? body.category : communityCategories[0];
    const visibility = body.visibility === 'private' ? 'private' : 'public';
    const description = text(body.description, 400);
    const rules = text(body.rules || 'Respeite os participantes e compartilhe apenas conteúdos autorizados.', 600, false);
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
      createdAt: Date.now(),
      members: [mine],
      admins: [mine],
      moderators: [],
      pendingRequests: [],
      invited: []
    });
    return { createdId: id };
  }

  const c = list.find(item => item.id === body.communityId);
  if (!c) fail(404, 'Comunidade não encontrada.');
  c.members ||= [];
  c.admins ||= [];
  c.moderators ||= [];
  c.pendingRequests ||= [];
  c.invited ||= [];

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
    if (body.action === 'community_accept_invite' && !c.members.includes(mine)) {
      c.members.push(mine);
      syncLegacyInterest(state, c, mine, true);
    }
    return {};
  }

  if (body.action === 'community_invite') {
    if (!c.members.includes(mine)) fail(403, 'Apenas participantes podem convidar pessoas.');
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
    if (body.action === 'community_approve' && !c.members.includes(target)) {
      c.members.push(target);
      syncLegacyInterest(state, c, target, true);
    }
    return {};
  }

  if (body.action === 'community_role') {
    if (!c.admins.includes(mine)) fail(403, 'Apenas administradores alteram permissões da comunidade.');
    const target = body.memberKey;
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
    return {};
  }

  if (body.action === 'community_remove_member') {
    if (!isStaff(c, mine)) fail(403, 'Apenas administração ou moderação remove participantes.');
    const target = body.memberKey;
    if (target === mine) fail(400, 'Use a opção Sair da comunidade.');
    if (c.admins.includes(target) && !c.admins.includes(mine)) {
      fail(403, 'Moderadores não podem remover administradores.');
    }
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
    c.description = text(body.description, 400);
    c.rules = text(body.rules || '', 600, false);
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
    const removedIds = [post.media?.id, post.file?.id].filter(mid => mid && !remaining.some(p => p.media?.id === mid || p.file?.id === mid || p.repostOf?.media?.id === mid || p.repostOf?.file?.id === mid));
    state.posts = remaining;
    return { removedIds };
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
