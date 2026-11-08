// Planos (recuperados do Etnias 1.0) e verificação de perfil (missão "Conta e experiência", P2 e P4).
// O catálogo vem de planos.json; quem tinha plano no 1.0 vem de legado-planos.json (gerado do banco recuperado,
// fora do Git). Contratar só abre com OPY_PLANS_OPEN=1 (preço, moeda e meio de pagamento aprovados); confirmar um
// pagamento é ação de administração e só existe em modo de teste (OPY_PAYMENTS_TEST=1) ou com transferência manual
// aprovada (OPY_PLANS_MANUAL_PAYMENTS=1). Plano e verificação são independentes: plano nunca dá selo.
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const here = new URL('.', import.meta.url);
export const catalog = JSON.parse(readFileSync(new URL('planos.json', here), 'utf8'));
const legacyFile = new URL('legado-planos.json', here);
const legacyPlans = existsSync(legacyFile) ? new Map(JSON.parse(readFileSync(legacyFile, 'utf8')).assinantes.map(a => [a.legacyId, a])) : new Map();
const DAY = 864e5;
const PERIOD_DAYS = { mes: 30, ano: 365 };
export const planActions = ['plan_request', 'plan_request_cancel', 'verification_request', 'verification_cancel'];

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const planById = id => catalog.planos.find(p => p.id === id);
const flag = (env, name) => String(env[name] || '') === '1';
export const plansOpen = env => flag(env, 'OPY_PLANS_OPEN');
export const testPayments = env => flag(env, 'OPY_PAYMENTS_TEST');
const untilOf = (plan, since) => plan.periodo === 'vitalicio' ? null : since + (PERIOD_DAYS[plan.periodo] || 30) * DAY;

// Plano vigente: o contratado na 2.0 (account.plan) ou o herdado do 1.0, pela regra do 1.0 (mensal = 30 dias; VIP vitalício).
export function planOf(account, now = Date.now()) {
  let source = null;
  if (account?.plan?.id) source = { ...account.plan };
  else if (account?.legacyId && legacyPlans.has(account.legacyId)) { const l = legacyPlans.get(account.legacyId); const p = planById(l.plan); if (p) source = { id: p.id, since: l.since, until: untilOf(p, l.since), source: 'legado' }; }
  if (!source) return { id: 'gratuito', nome: 'Gratuito', ativo: false, impulsosPublicacoes: 0, destaque: false };
  const p = planById(source.id); if (!p) return { id: 'gratuito', nome: 'Gratuito', ativo: false, impulsosPublicacoes: 0, destaque: false };
  const ativo = !source.until || source.until > now;
  return { id: p.id, nome: p.nome, cor: p.cor, since: source.since, until: source.until || null, origem: source.source, ativo, impulsosPublicacoes: ativo ? p.impulsosPublicacoes : 0, destaque: ativo };
}
// Selo público do plano (só plano ativo); o detalhe fica nas configurações da própria pessoa.
export const planBadge = account => { const p = planOf(account); return p.ativo ? { id: p.id, nome: p.nome, cor: p.cor } : null; };

export function plansView(state, account, env = process.env, now = Date.now()) {
  const mine = r => r.userId === account.id;
  return {
    current: planOf(account, now),
    contratacaoAberta: plansOpen(env),
    pagamentoTeste: testPayments(env),
    planos: catalog.planos.map(p => ({ id: p.id, nome: p.nome, cor: p.cor, periodo: p.periodo, impulsosPublicacoes: p.impulsosPublicacoes, ...(plansOpen(env) ? { preco: p.precoLegado, moeda: catalog.moedaLegado } : {}) })),
    beneficios: catalog.beneficiosNa2,
    pedidos: (state.planRequests || []).filter(mine).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map(r => ({ id: r.id, planId: r.planId, nome: planById(r.planId)?.nome || r.planId, status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt || 0, note: r.note || '', teste: !!r.test })),
    verificacao: {
      verificado: !!account.verified,
      celularVerificado: !!account.phoneVerifiedAt,
      pedidos: (state.verificationRequests || []).filter(mine).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map(r => ({ id: r.id, status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt || 0, motivo: r.reason || '' }))
    }
  };
}

export function planAction(state, account, body, env = process.env, now = Date.now()) {
  switch (body.action) {
    case 'plan_request': {
      if (!plansOpen(env)) fail(409, 'A contratação de planos ainda não está aberta. Os valores e a forma de pagamento estão em definição.');
      const plan = planById(body.planId); if (!plan) fail(400, 'Escolha um plano.');
      state.planRequests ||= [];
      if (state.planRequests.some(r => r.userId === account.id && r.status === 'aguardando_pagamento')) fail(409, 'Você já tem um pedido de plano aguardando pagamento.');
      const current = planOf(account, now); if (current.ativo && current.id === plan.id) fail(409, 'Este já é o seu plano.');
      state.planRequests.push({ id: randomUUID(), userId: account.id, planId: plan.id, status: 'aguardando_pagamento', createdAt: now, test: testPayments(env) });
      return {};
    }
    case 'plan_request_cancel': {
      const r = (state.planRequests || []).find(x => x.id === body.requestId && x.userId === account.id);
      if (!r) fail(404, 'Pedido não encontrado.');
      if (r.status !== 'aguardando_pagamento') fail(409, 'Só dá para cancelar um pedido que ainda aguarda pagamento.');
      r.status = 'cancelado'; r.decidedAt = now; return {};
    }
    case 'verification_request': {
      if (account.verified) fail(409, 'Seu perfil já é verificado.');
      state.verificationRequests ||= [];
      if (state.verificationRequests.some(r => r.userId === account.id && r.status === 'pendente')) fail(409, 'Você já tem um pedido de verificação em análise.');
      const message = String(body.message || '').trim().slice(0, 600);
      if (message.length < 20) fail(400, 'Conte em poucas linhas quem você é e por que o perfil deve ser verificado (mínimo de 20 caracteres).');
      const link = String(body.link || '').trim().slice(0, 300);
      if (link) { let ok = false; try { ok = ['https:', 'http:'].includes(new URL(link).protocol); } catch { } if (!ok) fail(400, 'O link precisa começar com https://'); }
      state.verificationRequests.push({ id: randomUUID(), userId: account.id, message, link, status: 'pendente', createdAt: now });
      return {};
    }
    case 'verification_cancel': {
      const r = (state.verificationRequests || []).find(x => x.userId === account.id && x.status === 'pendente');
      if (!r) fail(404, 'Não há pedido em análise.');
      r.status = 'cancelado'; r.decidedAt = now; return {};
    }
  }
  fail(400, 'Ação de plano desconhecida.');
}

// Decisões da administração (chamadas por admin.mjs, que já confere o papel e registra no histórico).
export function decidePlanRequest(state, body, actor, env = process.env, now = Date.now()) {
  const r = (state.planRequests || []).find(x => x.id === body.requestId);
  if (!r) fail(404, 'Pedido não encontrado.');
  if (r.status !== 'aguardando_pagamento') fail(409, 'Este pedido já foi decidido.');
  const target = (state.accounts || []).find(a => a.id === r.userId); if (!target) fail(404, 'Conta não encontrada.');
  if (body.decision === 'recusar') { r.status = 'recusado'; r.decidedAt = now; r.decidedBy = actor.id; r.note = String(body.note || '').slice(0, 300); return { target, label: 'Pedido de plano recusado' }; }
  if (body.decision !== 'confirmar') fail(400, 'Escolha confirmar ou recusar.');
  if (!(r.test && testPayments(env)) && !flag(env, 'OPY_PLANS_MANUAL_PAYMENTS')) fail(409, 'Confirmação de pagamento indisponível: falta aprovar o meio de pagamento.');
  const plan = planById(r.planId);
  target.plan = { id: plan.id, since: now, until: untilOf(plan, now), source: r.test ? 'teste' : 'transferencia', requestId: r.id };
  r.status = 'ativo'; r.decidedAt = now; r.decidedBy = actor.id;
  return { target, label: (r.test ? 'Plano ativado (pagamento de teste): ' : 'Plano ativado (transferência confirmada): ') + plan.nome };
}
export function decideVerification(state, body, actor, now = Date.now()) {
  const r = (state.verificationRequests || []).find(x => x.id === body.requestId);
  if (!r) fail(404, 'Pedido não encontrado.');
  if (r.status !== 'pendente') fail(409, 'Este pedido já foi decidido.');
  const target = (state.accounts || []).find(a => a.id === r.userId); if (!target) fail(404, 'Conta não encontrada.');
  if (target.id === actor.id) fail(400, 'Você não pode decidir o próprio pedido.');
  if (body.decision === 'aprovar') { target.verified = true; r.status = 'aprovado'; }
  else if (body.decision === 'rejeitar') { const reason = String(body.reason || '').trim().slice(0, 300); if (!reason) fail(400, 'Informe o motivo da rejeição; ele é mostrado à pessoa.'); r.status = 'rejeitado'; r.reason = reason; }
  else fail(400, 'Escolha aprovar ou rejeitar.');
  r.decidedAt = now; r.decidedBy = actor.id;
  return { target, label: r.status === 'aprovado' ? 'Verificação aprovada' : 'Verificação rejeitada' };
}
export function adminQueues(state) {
  const nameOf = id => (state.accounts || []).find(a => a.id === id)?.name || 'Conta removida';
  return {
    verificacoes: (state.verificationRequests || []).filter(r => r.status === 'pendente').map(r => ({ id: r.id, userKey: 'id:' + r.userId, name: nameOf(r.userId), message: r.message, link: r.link, createdAt: r.createdAt })),
    planos: (state.planRequests || []).filter(r => r.status === 'aguardando_pagamento').map(r => ({ id: r.id, userKey: 'id:' + r.userId, name: nameOf(r.userId), plan: planById(r.planId)?.nome || r.planId, createdAt: r.createdAt, teste: !!r.test }))
  };
}
