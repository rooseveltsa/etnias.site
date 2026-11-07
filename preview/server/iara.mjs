import { randomUUID } from 'node:crypto';
import { answerEtnia } from './etnia.mjs';

// Source: etnias-iara-v1.0/skills/iara-triagem/SKILL.md, sections 1–3.
const sectors = [
  ['gestao-redes', 'Gestão de redes', 'iara-triagem', /\b(token|permissao|pareamento|conexao|conta bloqueada|acesso ao instagram)\b/, 'Verificar acesso ao canal com a equipe responsável.'],
  ['social-media', 'Social media', 'iara-log-publicacao', /\b(publicar|publique|postar|poste|comentario publico|resposta publica)\b/, 'Preparar a peça e solicitar revisão e aprovação nominal antes da publicação.'],
  ['conteudo-estatico', 'Conteúdo estático', 'iara-design-etnias', /\b(card|cartaz|arte|carrossel|capa|banner)\b/, 'Completar o briefing, aplicar o design aprovado do Etnias e encaminhar para revisão.'],
  ['audiovisual', 'Audiovisual', 'iara-misto', /\b(video|reels|motion|audio|narracao|transcricao|corte)\b/, 'Preparar roteiro e fontes; voz e imagem de pessoas dependem de autorização.'],
  ['atendimento', 'Atendimento', 'iara-atendimento', /\b(dm|privado|reclamacao|orcamento|responder a uma pessoa|atender)\b/, 'Revisar a resposta individual com a equipe de atendimento.'],
  ['analytics', 'Análise de métricas', 'iara-metrica', /\b(metrica|metricas|alcance|engajamento|conversao|funil|relatorio|comparativo)\b/, 'Identificar período e canal; usar somente métricas reais disponíveis.'],
  ['calendario-editorial', 'Calendário editorial', 'iara-calendario', /\b(calendario|pauta|pautas|grade|planejamento de serie|quando publicar)\b/, 'Definir pauta, canal e data prevista com a equipe editorial.'],
  ['radar-noticias', 'Radar de notícias', 'iara-radar', /\b(noticia|noticias|tendencia|tendencias|concorrente|varredura)\b/, 'Reunir links e fontes verificáveis antes de propor conteúdo.'],
  ['marketing', 'Marketing', 'iara-marketing', /\b(campanha|posicionamento|oferta|publico alvo|metas|estrategia)\b/, 'Definir objetivo, público, mensagem e critérios de resultado.'],
  ['escuta-comunitaria', 'Escuta comunitária', 'iara-escuta', /\b(escuta|mencoes|clima|crise|reclamacao recorrente)\b/, 'Reunir evidências anonimizadas e encaminhar sinais para análise humana.'],
  ['memoria-institucional', 'Memória institucional', 'iara-biblioteca', /\b(memoria|acervo|biblioteca|guardar|decisao|historico)\b/, 'Identificar fonte, autoria e autorização antes de registrar a referência.']
];
const reception = ['central-solicitacoes', 'Central de solicitações', 'iara-solicitacao', null, 'A equipe precisa esclarecer o objetivo e o formato deste pedido.'];
const fold = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export function triageIara(description) {
  const normalized = fold(description);
  const found = sectors.filter(([, , , pattern]) => pattern.test(normalized));
  // shortcut: triagem por palavras-chave; substituir por orquestração Hermes após homologar o motor.
  const chosen = found.length === 1 ? found[0] : reception;
  const [sector, sectorTitle, skill, , nextAction] = chosen;
  return { sector, sectorTitle, skill, nextAction, relatedSectors: found.map(item => item[0]), sourceTitle: 'Kit IAra v1.0 · Triagem setorial', revised: '2026-11-05' };
}

export function iaraTickets(state, ownerId) {
  return (state.iaraTickets || []).filter(item => item.ownerId === ownerId).map(({ ownerId: _, ...ticket }) => ticket);
}

export function createIaraTicket(state, ownerId, description, now = Date.now()) {
  if (typeof description !== 'string' || description.trim().length < 10 || description.length > 2000) fail(400, 'Descreva o pedido com 10 a 2.000 caracteres.');
  description = description.trim();
  const checked = answerEtnia(description);
  if (['restricted', 'policy'].includes(checked.status)) fail(400, checked.text);
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}\b/.test(description)) fail(400, 'Remova e-mail, telefone e CPF do pedido. Use referências anonimizadas.');
  state.iaraTickets ||= [];
  const own = state.iaraTickets.filter(item => item.ownerId === ownerId);
  const repeated = own.find(item => item.description === description && item.status === 'aguardando_equipe');
  if (repeated) return repeated;
  if (own.filter(item => item.createdAt > now - 60000).length >= 5) fail(429, 'Você enviou muitos pedidos. Aguarde um minuto.');
  if (own.length >= 20 || state.iaraTickets.length >= 400) fail(409, 'O limite de pedidos desta homologação foi atingido. Os pedidos existentes foram preservados.');
  const id = randomUUID();
  const ticket = { id, protocol: `IARA-${id.toUpperCase()}`, ownerId, description, ...triageIara(description), status: 'aguardando_equipe', createdAt: now };
  state.iaraTickets.unshift(ticket);
  return ticket;
}

export function cancelIaraTicket(state, ownerId, ticketId, now = Date.now()) {
  const ticket = state.iaraTickets?.find(item => item.id === ticketId && item.ownerId === ownerId);
  if (!ticket) fail(404, 'Pedido não encontrado.');
  if (ticket.status !== 'cancelado') { ticket.status = 'cancelado'; ticket.cancelledAt = now; }
}
