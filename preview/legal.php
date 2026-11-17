<?php
// Páginas legais e de apoio geradas com o mesmo visual do Etnias. $legal: 'privacidade' | 'termos' | 'offline'.
// RASCUNHO: os textos jurídicos abaixo foram preparados pela equipe técnica e precisam de revisão de advogado(a) antes de valerem.
// Tudo marcado com [CONFIRMAR] ou [PREENCHER] ainda não foi verificado e não deve ser afirmado ao público.
$e = function ($t) { return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); };
$aviso = '<p class="legal-draft" role="note"><strong>RASCUNHO — revisão jurídica necessária.</strong> Este texto ainda não foi revisado por advogado(a) e pode mudar. Itens em [colchetes] estão por confirmar.</p>';
$pages = array(
'privacidade' => array('Política de Privacidade', $aviso . '
<p>Esta página explica, em linguagem simples, quais dados o Etnias guarda, para quê, por quanto tempo e como você controla tudo isso (Lei Geral de Proteção de Dados, LGPD).</p>
<h2>Quem cuida dos seus dados</h2>
<p><strong>Controlador:</strong> [PREENCHER: nome da organização responsável pelo Etnias, CNPJ e endereço].<br><strong>Encarregado(a) pelos dados (DPO):</strong> [PREENCHER: nome e e-mail de contato]. <span id="contato">Enquanto isso não for preenchido, fale com a equipe pelo canal oficial do Etnias.</span></p>
<h2>Quais dados guardamos</h2>
<ul>
<li><strong>Conta:</strong> nome, usuário (@), e-mail ou celular, e a senha (guardada só de forma embaralhada, nunca em texto).</li>
<li><strong>Perfil:</strong> foto, capa, apresentação, afiliação e pronomes (se você preencher).</li>
<li><strong>Dados sensíveis, só se você quiser:</strong> <em>povo</em> e <em>pertencimento</em> (se declara indígena ou não). Eles revelam origem étnica, que a lei trata como dado sensível. Só guardamos com o seu consentimento específico, que você pode retirar a qualquer momento em Configurações.</li>
<li><strong>Cidade (opcional):</strong> se você pedir para mostrar sua cidade, o Etnias envia a sua posição aproximada (duas casas decimais) a um serviço de mapas (OpenStreetMap/Nominatim) para descobrir o nome da cidade. A posição não fica guardada; só a cidade e o estado.</li>
<li><strong>O que você publica ou envia:</strong> publicações, comentários, reações, stories, fotos, vídeos, áudios, arquivos, mensagens diretas, anúncios no mercado e conversas com a EtnIA/IAra.</li>
<li><strong>Chamadas e lives:</strong> guardamos quando e quem participou; <strong>lives são gravadas</strong> e a gravação fica na publicação.</li>
<li><strong>Aparelhos conectados:</strong> um rótulo como "Chrome · Android" e a data de entrada, para você poder sair de aparelhos que não usa mais.</li>
<li><strong>Registros técnicos do servidor:</strong> endereço de rede (IP), horário e página acessada, para segurança e para resolver problemas. Ficam em arquivos que se renovam sozinhos em poucos dias [CONFIRMAR o prazo exato].</li>
</ul>
<h2>Para que usamos</h2>
<p>Para criar e manter a sua conta, mostrar o que você publica a quem você escolheu, entregar mensagens, avisar você (se ativar os avisos do aparelho), proteger a rede contra abuso e cumprir a lei. Não vendemos seus dados. [CONFIRMAR: bases legais de cada finalidade, com revisão jurídica.]</p>
<h2>Com quem os dados passam</h2>
<ul>
<li><strong>Hospedagem do servidor:</strong> [PREENCHER: provedor da VPS e país].</li>
<li><strong>Cópia de segurança:</strong> uma cópia criptografada do banco fica guardada por até 14 dias em um serviço de armazenamento (Vercel Blob) [CONFIRMAR país e contrato].</li>
<li><strong>Serviço de mapas:</strong> OpenStreetMap/Nominatim, só se você usar "mostrar minha cidade".</li>
<li><strong>Avisos no aparelho:</strong> se você ativar, o aviso passa pelo serviço de notificações do seu navegador (Google, Mozilla, Apple ou Microsoft).</li>
<li><strong>Vídeos do YouTube:</strong> ao abrir um vídeo incorporado, o YouTube pode registrar o seu acesso.</li>
<li><strong>Envio de códigos:</strong> [CONFIRMAR: serviço de e-mail/SMS/WhatsApp que for ligado para códigos de recuperação].</li>
</ul>
<h2>Por quanto tempo guardamos</h2>
<ul>
<li>Enquanto a sua conta existir.</li>
<li><strong>Ao excluir a conta:</strong> ela fica desativada por 30 dias (para você poder desistir). Depois disso, o Etnias apaga a conta, as publicações, os comentários, as reações, as mensagens, os arquivos e as gravações de live ligados a ela. Reposts de outras pessoas mostram apenas "conta excluída".</li>
<li><strong>Cópias de segurança:</strong> dados já apagados podem continuar nas cópias por até 14 dias, até elas serem substituídas [CONFIRMAR].</li>
<li>O registro de ações da moderação é mantido sem o seu nome, para prestação de contas.</li>
</ul>
<h2>Seus direitos</h2>
<p>Em <strong>Configurações &gt; Seus dados e privacidade</strong> você pode: baixar uma cópia dos seus dados, pedir a exclusão da conta, retirar o consentimento de povo/pertencimento, apagar a cidade do perfil e sair de aparelhos. Para os demais direitos da LGPD (art. 18: confirmação e acesso, correção, anonimização, informação sobre compartilhamento, revogação), fale com o(a) encarregado(a) pelo contato acima.</p>
<h2>Crianças e adolescentes</h2>
<p>[CONFIRMAR: regra de idade mínima e consentimento de responsável, com revisão jurídica.]</p>
<h2>Mudanças neste texto</h2>
<p>Quando este texto mudar, avisaremos na rede. Versão atual: rascunho de novembro de 2026.</p>'),
'termos' => array('Termos de Uso', $aviso . '
<p>Estes termos explicam como usar o Etnias, a rede social dos povos indígenas do Brasil. Ao criar uma conta você diz que leu e concorda com eles e com a <a href="/privacidade/">Política de Privacidade</a>.</p>
<h2>Quem pode participar</h2>
<p>Povos indígenas, organizações, coletivos e pessoas aliadas, que respeitem estas regras. [CONFIRMAR: idade mínima.]</p>
<h2>Sua conta</h2>
<p>Você cuida da sua senha e do que acontece na sua conta. Se achar que alguém entrou nela, troque a senha em Configurações e saia dos outros aparelhos.</p>
<h2>O que esperamos de você</h2>
<ul>
<li>Respeitar as pessoas, os povos e seus protocolos. Não publique conhecimento tradicional restrito, ritos ou informações sensíveis sem autorização de quem tem esse direito.</li>
<li>Não publicar ameaças, discurso de ódio, conteúdo ilegal, golpes ou spam, nem se passar por outra pessoa.</li>
<li>Só publicar o que você tem direito de publicar (texto, imagem, voz, vídeo).</li>
</ul>
<h2>O que você publica</h2>
<p>O conteúdo continua sendo seu. Você autoriza o Etnias a guardá-lo e mostrá-lo às pessoas que você escolheu, para a rede funcionar. [CONFIRMAR: licença e direitos de imagem, voz e autoria coletiva, com revisão jurídica.]</p>
<h2>Moderação</h2>
<p>A equipe e a moderação podem esconder conteúdo, suspender ou remover contas que descumpram estas regras. As ações ficam registradas e a pessoa pode pedir revisão pelo canal oficial.</p>
<h2>Mercado</h2>
<p>Os anúncios são de responsabilidade de quem anuncia. O Etnias não participa da negociação nem do pagamento.</p>
<h2>Mudanças e contato</h2>
<p>Estes termos podem mudar; avisaremos na rede. Dúvidas: [PREENCHER: canal de contato]. Versão atual: rascunho de novembro de 2026.</p>'),
'offline' => array('Você está sem internet', '
<p>O Etnias não conseguiu falar com o servidor agora. Isso costuma passar quando a conexão volta.</p>
<p>O que você já abriu continua disponível nesta tela quando possível. Se estava escrevendo algo, o texto não foi perdido: volte à página e tente enviar de novo.</p>
<p><button type="button" class="opy-primary" onclick="location.reload()">Tentar de novo</button> <a class="preview-secondary" href="/">Ir para o início</a></p>')
);
$p = $pages[$legal];
$noindex = $legal === 'offline' ? 'noindex,nofollow' : 'index,follow';
?><!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="<?php echo $noindex; ?>"><meta name="theme-color" content="#f4ede4"><title><?php echo $e($p[0]); ?> · Etnias</title><script src="/assets/theme.js?v=1"></script><link rel="stylesheet" href="/assets/opy/opy.css?v=1"><link rel="stylesheet" href="/assets/preview.css?v=1"><style>.legal{max-width:46rem;margin:0 auto;padding:1.25rem 1rem 3rem;line-height:1.65}.legal h1{margin:.5rem 0 1rem}.legal h2{margin:1.6rem 0 .4rem;font-size:1.2rem}.legal li{margin:.3rem 0}.legal-draft{border:2px solid #b45309;background:#fef3c7;color:#451a03;padding:.75rem 1rem;border-radius:.5rem}[data-theme=dark] .legal-draft{background:#3b2a07;color:#fde68a;border-color:#d97706}.legal a{text-decoration:underline}</style></head><body class="opy-enabled"><a class="preview-skip" href="#conteudo">Ir para o conteúdo</a><main id="conteudo" class="legal"><p><a href="/entrar/"><img src="/assets/opy/etnias-logo.png" alt="Etnias" width="150" height="40"></a></p><h1><?php echo $e($p[0]); ?></h1><?php echo $p[1]; ?><p><a href="/entrar/">Voltar ao Etnias</a></p></main></body></html>
