const revised = '2026-11-05';

const sources = [
  {
    id: 'iara',
    title: 'Implantação IAra v1.0 · documento de 05/11/2026',
    revised: '2026-11-05',
    terms: ['iara', 'assistente de conteudo', 'pedido de card'],
    answer: 'A IAra organiza pedidos de conteúdo e operação do Etnias. Na área IAra você descreve o pedido, recebe um protocolo com triagem inicial e pode baixar o briefing ou cancelar. O pedido fica privado para a sua conta, aguardando encaminhamento humano. Essa recepção ainda não envia tarefas ao Hermes nem produz ou publica peças. Instagram, LinkedIn e notificações externas aguardam configuração. A EtnIA continua orientando sobre o site e o Etnias.'
  },
  {
    id: 'publicar',
    title: 'Como publicar na prévia',
    revised,
    terms: ['publicar', 'publicacao', 'postar', 'no feed', 'foto', 'video', 'enquete', 'pdf', 'audio', 'celular'],
    answer: 'Para publicar, abra o feed e escreva no campo da história. Dá para juntar foto, vídeo, áudio ou PDF de até 2 MB, além de emoji, sentimento e enquete. Escolha “Público nesta homologação” ou “Somente eu” e toque em Publicar. No celular, a barra de baixo leva ao feed; Postagem abre o mesmo compositor.'
  },
  {
    id: 'casa-opy',
    title: 'O que é o Etnias',
    revised,
    terms: ['o que e o etnias', 'o que e etnias', 'etnias 2', 'casa opy', 'o que e a casa', 'o que e opy', 'aldeia digital', 'projeto opy'],
    answer: 'O Etnias 2.0 é a nova versão da rede Etnias, pensada como aldeia digital: convivência, conhecimento, cultura e participação. Nesta prévia funcionam a entrada, o feed com acervo autorizado e as interações de homologação. Cursos, pagamentos e serviços que o projeto só descreve como proposta não estão em funcionamento.'
  },
  {
    id: 'conta',
    title: 'Como entrar na prévia',
    revised,
    terms: ['criar conta', 'minha senha', 'usuario e senha', 'entrar na casa', 'cadastro', 'conta antiga', 'senha antiga', 'contas antigas'],
    answer: 'Não há usuário compartilhado. Em Entre no Etnias, toque em Criar conta e preencha nome, usuário, chave Google (o e-mail da conta Google), telefone com DDD e senha, com no mínimo 8 caracteres. Chave Google e telefone são obrigatórios. Na volta, use Entrar. As contas antigas do Etnias não entram por esta prévia.'
  },
  {
    id: 'caminhos',
    title: 'Caminhos do Etnias',
    revised: '2026-11-07',
    terms: ['barra inferior', 'maraca', 'menu lateral', 'onde fica o chat', 'notificacoes'],
    answer: 'O feed é a casa. A barra de baixo traz Feed, Mercado, Postagem, Saberes e EtnIA. Opy abre o menu lateral. Chat e Maracá ficam no cabeçalho: o Chat reúne suas conversas privadas e grupos por convite, e o Maracá mostra reações e comentários nas suas publicações.'
  },
  {
    id: 'chat',
    title: 'Chat e EtnIA',
    revised: '2026-11-07',
    terms: ['sala publica', 'mensagem privada', 'conversa privada', 'o chat'],
    answer: 'O Chat desta prévia não é uma sala pública. Ele tem conversas privadas entre contas criadas aqui e grupos de até 12 pessoas, que só se abrem para quem aceita o convite. As mensagens ficam guardadas na plataforma, sem criptografia de ponta a ponta. A EtnIA é outra conversa: só a sua conta vê o que você pergunta aqui, e eu respondo sobre o site e o projeto.'
  },
  {
    id: 'saberes',
    title: 'Saberes nesta prévia',
    revised,
    terms: ['saberes', 'curso', 'trilha', 'area do aluno', 'ondemand'],
    answer: 'Saberes está na prévia como trilha para a equipe avaliar a navegação. Não é um curso em funcionamento, não faz matrícula oficial e não emite certificado. Trate como proposta em avaliação.'
  },
  {
    id: 'guardiao',
    title: 'Guardião da Floresta nesta prévia',
    revised,
    terms: ['guardiao', 'queimada', 'ocorrencia territorial'],
    answer: 'O Guardião da Floresta nesta prévia é um protótipo de registro para avaliação da tela. Não é atendimento de emergência e não aciona brigada nem órgão público.'
  },
  {
    id: 'acervo',
    title: 'Acervo público autorizado',
    revised,
    terms: ['acervo', 'postagem antiga', 'publicacao antiga', 'foto de perfil'],
    answer: 'O feed mostra uma seleção autorizada de postagens públicas antigas, com autoria e data. As fotos de perfil disponíveis acompanham esses autores. Mensagens privadas, senhas e conteúdo de grupos restritos não foram importados.'
  },
  {
    id: 'escopo',
    title: 'O que a EtnIA responde',
    revised,
    terms: ['quem e voce', 'o que voce pode', 'o que voce sabe', 'para que serve a etnia', 'o que a etnia'],
    answer: 'Eu oriento sobre o uso do Etnias, com o material aprovado desta prévia. Não represento um povo, não sou liderança e não completo lacuna de rito, história ou conhecimento sem fonte autorizada. Quando o material não alcança a pergunta, eu digo isso.'
  },
  {
    id: 'interagir',
    title: 'Reagir, comentar e salvar',
    revised,
    terms: ['reagir', 'comentar', 'curtir', 'salvar publicacao', 'publicacoes salvas', 'meus salvos'],
    answer: 'Em cada publicação dá para reagir, comentar, votar na enquete e salvar. Salvos fica no menu lateral. Você só exclui a publicação que criou. Comentário e reação desta prévia não são as contagens antigas do Etnias.'
  },
  {
    id: 'pagamento',
    title: 'Pagamentos nesta prévia',
    revised,
    terms: ['pagamento', 'pagar', 'doar', 'pix', 'contribuicao'],
    answer: 'Esta prévia não pede pagamento, não processa doação e não conclui compra. A tela Doe para o Instituto é só avaliação de navegação. Nenhum valor é cobrado aqui.'
  },
  {
    id: 'previa',
    title: 'O que esta prévia faz',
    revised: '2026-11-07',
    terms: ['etnias.site', 'site oficial', 'esta previa', 'homologacao', 'o que funciona', 'o que ja funciona'],
    answer: 'Esta é a prévia de homologação do Etnias. Ela não altera o domínio etnias.site nem o banco antigo. Dá para criar uma conta daqui, ver o acervo autorizado, publicar, reagir, comentar, salvar e conversar em privado pelo Chat. Saberes, Guardião, fotógrafos, música e doação são protótipos de tela, não serviços concluídos.'
  },
  {
    id: 'revisao',
    title: 'Quando o material não fecha',
    revised,
    terms: ['fonte contraditoria', 'fontes contraditorias', 'documento retirado', 'desautorizado'],
    answer: 'Se duas fontes aprovadas discordarem, eu não escolho uma. Registro a pendência para revisão humana. Documento retirado ou desautorizado sai da base e não entra na resposta. Nesta prévia não há conflito aberto nem documento retirado registrado.'
  }
];

const knownIds = new Set(sources.map(source => source.id));

function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function directScore(source, question) {
  return source.terms.reduce((total, term) => total + (` ${question} `.includes(` ${term} `) ? (term.includes(' ') ? 3 : 2) : 0), 0);
}

function best(question) {
  return sources.map(source => ({ source, score: directScore(source, question) })).sort((a, b) => b.score - a.score)[0];
}

function reply(source) {
  return { status: 'answered', text: source.answer, sourceId: source.id, sourceTitle: source.title, revised: source.revised };
}

function refusal(status, text) {
  return { status, text, sourceId: '', sourceTitle: '', revised: '' };
}

export function answerEtnia(question, earlier = '') {
  const normalized = fold(question);
  const prior = fold(earlier);
  if (!normalized) return refusal('unknown', 'Escreva a pergunta para eu procurar no material desta prévia.');
  if (/ignore as regras|finja que|voce agora|prompt do sistema|revela (o|a) instruc/.test(normalized)) {
    return refusal('policy', 'Eu mantenho as regras desta conversa. Posso orientar sobre o Etnias com o material aprovado desta prévia, e não amplio isso por um pedido na mensagem.');
  }
  if (/\b(rito|ritos|ritual|pajelanca|reza|rezar|canto sagrado|ayahuasca|daime|conhecimento restrito|conhecimento sagrado|medicina tradicional)\b/.test(normalized)) {
    return refusal('restricted', 'Não trato de rito, reza ou conhecimento restrito de um povo. Não há fonte autorizada para isso nesta prévia, e eu não completo essa lacuna. Posso orientar sobre o uso do Etnias e do Etnias.');
  }
  const found = best(normalized);
  if (found && found.score >= 2) return reply(found.source);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|hey|e ai)\b/.test(normalized)) return reply(sources.find(source => source.id === 'escopo'));
  const follow = /^(e |pode |explica|detalha|como assim|mais |continua)/.test(normalized) || normalized.split(' ').length <= 3;
  if (follow && prior) {
    const fromEarlier = best(prior);
    if (fromEarlier && fromEarlier.score >= 2) return reply(fromEarlier.source);
  }
  return refusal('unknown', 'Não encontrei informação suficiente no material aprovado desta prévia, então não vou improvisar. Posso orientar, por exemplo, sobre como publicar, o que é o Etnias e o que já funciona aqui.');
}

export function etniaSourceIds() {
  return knownIds;
}
