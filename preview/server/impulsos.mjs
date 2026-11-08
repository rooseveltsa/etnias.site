// Monetização (missão "Conta e experiência", P3): impulsionar publicações, conteúdo patrocinado no feed, orçamento e
// duração, histórico financeiro e resultados. Dois caminhos:
//  - "plano": crédito do plano (como no Etnias 1.0: N publicações impulsionadas ao mesmo tempo, sem custo extra);
//  - "campanha": orçamento e duração escolhidos pela pessoa; fica "aguardando pagamento" até haver meio de pagamento.
//    Sem provedor configurado, só a administração confirma — e apenas pagamento de TESTE (OPY_PAYMENTS_TEST=1).
// Resultados vêm só de eventos reais: alcance (pessoas únicas que viram o card patrocinado na tela), visualizações e
// engajamento (reações e comentários dessas pessoas depois do início). Nada é estimado.
import { randomUUID } from 'node:crypto';
import { planOf, testPayments } from './planos.mjs';

export const boostActions = ['boost_create', 'boost_cancel', 'boost_seen'];
const DAY = 864e5;
const DURATIONS = [1, 3, 7, 14, 30];
const CURRENCY = env => String(env.OPY_BOOST_CURRENCY || 'BRL').slice(0, 3).toUpperCase();
function fail(status, message) { throw Object.assign(new Error(message), { status }); }

// Encerra o que venceu: campanha no fim da duração; impulso do plano quando o plano deixa de valer.
export function settleBoosts(state, now = Date.now()) {
  for (const b of state.boosts || []) {
    if (b.status !== 'ativo') continue;
    const post = (state.posts || []).find(p => p.id === b.postId);
    const owner = (state.accounts || []).find(a => a.id === b.userId);
    if (!post) { b.status = 'encerrado'; b.endedAt = now; b.endReason = 'Publicação excluída'; continue; }
    if (b.kind === 'campanha' && b.endAt && b.endAt <= now) { b.status = 'encerrado'; b.endedAt = b.endAt; b.endReason = 'Duração concluída'; }
    if (b.kind === 'plano' && !planOf(owner, now).ativo) { b.status = 'encerrado'; b.endedAt = now; b.endReason = 'Plano encerrado'; }
  }
}
const eligiblePost = (post, me) => post && post.authorId === me.id && post.audience === 'public' && !post.communityId && !post.live;

export function boostAction(state, me, account, body, env = process.env, now = Date.now()) {
  settleBoosts(state, now);
  state.boosts ||= [];
  switch (body.action) {
    case 'boost_create': {
      const post = (state.posts || []).find(p => p.id === body.postId);
      if (!post || post.authorId !== me.id) fail(404, 'Publicação não encontrada.');
      if (!eligiblePost(post, me)) fail(400, 'Só publicações públicas do seu feed podem ser impulsionadas (não de comunidades, para amizades ou lives).');
      if (state.boosts.some(b => b.postId === post.id && ['ativo', 'aguardando_pagamento'].includes(b.status))) fail(409, 'Esta publicação já tem um impulsionamento em andamento.');
      if (body.mode === 'plano') {
        const plan = planOf(account, now);
        const used = state.boosts.filter(b => b.userId === me.id && b.kind === 'plano' && b.status === 'ativo').length;
        if (!plan.ativo || !plan.impulsosPublicacoes) fail(403, 'Seu plano não inclui impulsionamento de publicações.');
        if (used >= plan.impulsosPublicacoes) fail(409, `Você já usa os ${plan.impulsosPublicacoes} impulsionamentos do seu plano. Encerre um para impulsionar outra publicação.`);
        state.boosts.push({ id: randomUUID(), postId: post.id, userId: me.id, kind: 'plano', planId: plan.id, status: 'ativo', createdAt: now, startAt: now, views: {}, impressions: 0 });
        return {};
      }
      if (body.mode !== 'campanha') fail(400, 'Escolha como impulsionar.');
      const days = Number(body.days);
      if (!DURATIONS.includes(days)) fail(400, 'Escolha a duração: 1, 3, 7, 14 ou 30 dias.');
      const budget = Math.round(Number(body.budget) * 100);
      if (!Number.isFinite(budget) || budget < 100 || budget > 1000000) fail(400, 'Informe um orçamento entre 1 e 10.000.');
      if (state.boosts.filter(b => b.userId === me.id && b.status === 'aguardando_pagamento').length >= 5) fail(409, 'Você já tem 5 campanhas aguardando pagamento.');
      state.boosts.push({ id: randomUUID(), postId: post.id, userId: me.id, kind: 'campanha', status: 'aguardando_pagamento', budgetCents: budget, currency: CURRENCY(env), days, createdAt: now, test: testPayments(env), views: {}, impressions: 0 });
      return {};
    }
    case 'boost_cancel': {
      const b = state.boosts.find(x => x.id === body.boostId && x.userId === me.id);
      if (!b) fail(404, 'Impulsionamento não encontrado.');
      if (b.status === 'aguardando_pagamento') { b.status = 'cancelado'; b.endedAt = now; return {}; }
      if (b.status === 'ativo' && b.kind === 'plano') { b.status = 'encerrado'; b.endedAt = now; b.endReason = 'Encerrado por você'; return {}; }
      if (b.status === 'ativo') fail(409, 'Campanhas pagas seguem até o fim da duração. Fale com a equipe para interromper.');
      fail(409, 'Este impulsionamento já terminou.');
    }
    case 'boost_seen': {
      // Visualização real: o card patrocinado ficou na tela de outra pessoa (o cliente avisa uma vez por carregamento).
      const b = state.boosts.find(x => x.id === body.boostId && x.status === 'ativo');
      if (!b || b.userId === me.id) return { silent: true };
      b.views ||= {}; if (!b.views[me.id]) b.views[me.id] = now;
      b.impressions = (b.impressions || 0) + 1;
      return { silent: true };
    }
  }
  fail(400, 'Ação de impulsionamento desconhecida.');
}

// Um patrocinado por página inicial do feed, para quem não é o autor, respeitando quem pode ver a publicação.
// Rodízio pelo que teve menos visualizações.
export function sponsoredFor(state, me, pageIds, canSee, now = Date.now()) {
  const pool = (state.boosts || []).filter(b => b.status === 'ativo' && b.userId !== me.id && !(b.views || {})[me.id]);
  const ranked = pool.map(b => ({ b, post: (state.posts || []).find(p => p.id === b.postId) })).filter(x => x.post && canSee(x.post)).sort((x, y) => (x.b.impressions || 0) - (y.b.impressions || 0));
  const pick = ranked[0]; if (!pick) return null;
  // Já está entre as primeiras do feed: o rótulo vai na própria publicação (sem card repetido).
  return { boostId: pick.b.id, post: pick.post, inPage: pageIds.has(pick.post.id), label: pick.b.kind === 'plano' ? 'Impulsionado' : 'Patrocinado', test: !!pick.b.test };
}

function results(state, b) {
  const post = (state.posts || []).find(p => p.id === b.postId);
  const reached = new Set(Object.keys(b.views || {}));
  const start = b.startAt || 0;
  const reactions = post ? Object.entries(post.reactions || {}).filter(([id, r]) => r && reached.has(id)).length : 0;
  const comments = post ? (post.comments || []).filter(c => c.createdAt >= start && reached.has(String(c.authorKey || '').replace(/^id:/, ''))).length : 0;
  return { alcance: reached.size, visualizacoes: b.impressions || 0, engajamento: reactions + comments, reacoes: reactions, comentarios: comments };
}
export function financeView(state, me, env = process.env, now = Date.now()) {
  settleBoosts(state, now);
  const mine = (state.boosts || []).filter(b => b.userId === me.id).sort((a, b) => b.createdAt - a.createdAt);
  const items = mine.map(b => {
    const post = (state.posts || []).find(p => p.id === b.postId);
    return { id: b.id, postId: b.postId, excerpt: post ? ((post.text || '').slice(0, 80) || 'Publicação com mídia') : 'Publicação excluída', kind: b.kind, status: b.status, createdAt: b.createdAt, startAt: b.startAt || 0, endAt: b.endAt || 0, endedAt: b.endedAt || 0, endReason: b.endReason || '', days: b.days || 0, budgetCents: b.budgetCents || 0, currency: b.currency || '', test: !!b.test, payment: b.payment || null, results: results(state, b) };
  });
  const paid = mine.filter(b => b.payment?.status === 'confirmado');
  const sum = list => list.reduce((s, b) => s + (b.budgetCents || 0), 0);
  return {
    items,
    totais: { investidoCents: sum(paid.filter(b => !b.payment.test)), testeCents: sum(paid.filter(b => b.payment.test)), aguardandoCents: sum(mine.filter(b => b.status === 'aguardando_pagamento')), moeda: CURRENCY(env) },
    pagamentoOnline: false, pagamentoTeste: testPayments(env),
    paginas: { disponivel: false, motivo: 'Páginas ainda não existem na 2.0; o impulsionamento de páginas fica para quando elas existirem.' },
    duracoes: DURATIONS
  };
}
// Administração: confirmar pagamento de TESTE (ativa a campanha) ou recusar. Chamado por admin.mjs.
export function decideBoost(state, body, actor, env = process.env, now = Date.now()) {
  const b = (state.boosts || []).find(x => x.id === body.boostId);
  if (!b) fail(404, 'Campanha não encontrada.');
  if (b.status !== 'aguardando_pagamento') fail(409, 'Esta campanha já foi decidida.');
  if (body.decision === 'recusar') { b.status = 'recusado'; b.endedAt = now; b.endReason = String(body.note || 'Recusada pela moderação').slice(0, 300); return { label: 'Campanha recusada' }; }
  if (body.decision !== 'confirmar_teste') fail(400, 'Escolha confirmar o pagamento de teste ou recusar.');
  if (!b.test || !testPayments(env)) fail(409, 'Pagamento real ainda não está disponível: falta configurar o meio de pagamento e aprovar as regras comerciais.');
  b.payment = { status: 'confirmado', test: true, at: now, by: actor.id };
  b.status = 'ativo'; b.startAt = now; b.endAt = now + b.days * DAY;
  return { label: 'Campanha ativada com pagamento de teste' };
}
export const boostQueue = state => (state.boosts || []).filter(b => b.kind === 'campanha' && b.status === 'aguardando_pagamento').map(b => {
  const post = (state.posts || []).find(p => p.id === b.postId); const owner = (state.accounts || []).find(a => a.id === b.userId);
  return { id: b.id, name: owner?.name || 'Conta removida', excerpt: post ? ((post.text || '').slice(0, 120) || 'Publicação com mídia') : 'Publicação excluída', budgetCents: b.budgetCents, currency: b.currency, days: b.days, createdAt: b.createdAt, teste: !!b.test };
});
