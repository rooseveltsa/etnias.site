# Continuidade — Etnias / Casa Opy / IAra

Registro da conversa em 06/11/2026. Este arquivo é um resumo de continuidade, não uma transcrição nem certificação de produção.

## Objetivo e autorização do usuário

Concluir a rede social Etnias/Casa Opy com boa usabilidade, feed organizado, stories no topo, ícones consistentes, curtidas/corações e contagem de comentários. Integrar IAra conforme o kit fornecido por Vytórya. Depois conectar a VPS Hostinger, preparar espaço isolado para o projeto e criar banco novo. O usuário fornecerá acesso posteriormente.

Projeto: `/Users/juniormiranda/Downloads/etnias.site`.

## Restrições obrigatórias

- Ler AGENTS.md e preservar alterações existentes: houve trabalho em outros terminais.
- Não alterar o domínio etnias.site nem o banco recuperado.
- A prévia https://casa-opy-preview.vercel.app usa contas individuais e cookie assinado; não restaurar HTTP Basic Auth.
- EtnIA deve conversar apenas sobre o site/projeto com material aprovado, sem respostas livres sobre povos, ritos ou conhecimentos restritos.
- Não copiar credenciais, históricos privados ou modelos de voz do Hermes de origem. Clonar voz exige autorização explícita.
- Ponytail foi solicitado: usar a menor alteração completa, sem declarar recursos simulados como operacionais.

## Trabalho registrado no contexto anterior

Os itens abaixo foram relatados em sessões anteriores e precisam ser conferidos nos arquivos antes de novas mudanças; não foram revalidados nesta etapa de conexão Hostinger.

- Kit IAra em `iara/kit`, integridade SHA256 relatada como validada. Instalador isolado `scripts/iara.py`, ajustes locais de endurecimento e orientações em `docs/iara-implantacao.md`.
- Hermes ainda não operacional; adapter Supabase incompleto; integrações externas pendentes.
- Prévia `/iara/` com tickets privados e triagem por palavras-chave, sem orquestração Hermes real.
- Ajustes de expiração/revogação da autenticação relatados.
- Prévia local: `node scripts/dev-opy.mjs`, dados em `preview/local-data/<porta>`. Porta 8101 esteve ocupada; alternativa `PORT=8102 node scripts/dev-opy.mjs`. O usuário preferiu aguardar a VPS.
- `preview/preview.js`: exibição de reações e contagem de comentários.
- `preview/page.php` e `preview/server/community.mjs`: stories de texto com duração de 24 horas, criação/exclusão, no topo do feed.
- Ajustes CSS, testes em `tests/opy/community-integration.mjs` e exportação de 29 páginas para `preview/dist` relatados. Testes passaram naquela etapa, não representam validação atual de produção.
- Stories com fotos/vídeos e revisão completa dos ícones ainda pendentes.

## Diagnóstico de produção trazido pelo usuário

Prévia Vercel e aplicação PHP são sistemas separados. A prévia não comprova integração com contas antigas. Diagnóstico anterior citou 7.418 cadastros preservados e 9.220 caminhos de mídia ausentes — números históricos, não recontados nesta conversa.

Pendências: servidor PHP/MariaDB/HTTPS, uploads, login e recuperação por email, fluxos entre duas contas, integração real dos módulos, SMTP, cron, notificações/chat, pagamentos quando aplicáveis, backup/restauração e monitoramento. Protótipos de Saberes, Guardião, fotógrafos, música e doações precisam de implementação real ou indicação de indisponibilidade. Limites e descarte automático de dados na prévia foram apontados e devem ser revisados antes de produção.

## Kit IAra recebido

Origem informada: `/Users/juniormiranda/Downloads/etnias-iara-v1.0`.
Arquivo original: `etnias-iara-v1.0.tar.gz`.
SHA256 esperado: `737f67f1a0a7e371ae475c989281dc0fdc851fc801e52702da6925b8be1181db`.

Kit descrito: 19 skills IAra, 8 de produção, design-kit/etnias, assets, scripts e 17 JSONs. Configuração inicialmente local. Não mudar para Supabase antes de implementar e validar persistência. Design duplicado deve ser instalado uma vez. Documento recebido contém divergências nos caminhos de instalação e comandos; conferir README real, não executar cegamente.

Integrações previstas: Hermes, Supabase, Mixpost, Authentik; Langfuse/MinIO recomendados; Instagram/LinkedIn, WhatsApp, email e APIs internas. Facebook/TikTok/YouTube ficam pendentes. Reavaliar portas conflitantes e requisitos reais antes de instalar na VPS.

## Estado exato da tentativa Hostinger

O usuário quer operar a VPS dentro do Codex, não no Claude Code. A tentativa inicial interpretou incorretamente o comando como instalação Claude.

- Claude Code 2.1.319 encontrado.
- Tentativa `claude plugin install hostinger@claude-plugins-official --scope project` falhou: sem permissão para criar cache em `~/.claude/plugins/cache/`. Não foi instalado.
- Busca de conectores nesta sessão retornou Hostinger Mail, que não atende à administração da VPS.
- Nenhuma ferramenta Hostinger foi encontrada no inventário ALL_TOOLS desta sessão.
- Servidor desejado pelo usuário: `https://mcp.hostinger.com`.
- Nenhuma chave foi recebida, nenhuma autenticação Hostinger concluída e nenhuma VPS/banco/domínio alterado nesta etapa.
- Foi orientado o fluxo de plugin MCP personalizado do ChatGPT web. Isso não equivale a configurar MCP no Codex local. Na retomada, identificar a interface correta e consultar `codex mcp --help` e documentação oficial antes de configurar.
- Preferir OAuth suportado pelo servidor; se necessário token, usar entrada segura local e nunca incluí-lo neste arquivo, no Git ou nas mensagens.

Referências consultadas:
- https://developers.openai.com/learn/docs-mcp
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://github.com/hostinger/claude-plugin

## Próximo passo

1. Ler este arquivo e AGENTS.md; conferir arquivos existentes e alterações de outros terminais.
2. Configurar Hostinger MCP no Codex correto, verificar autenticação e listar VPS com ação somente de leitura.
3. Identificar a VPS destinada ao Etnias antes de qualquer alteração; avaliar recursos e serviços existentes.
4. Retomar melhorias pendentes da rede e IAra e preparar implantação isolada com banco novo. Não anunciar conclusão ou produção funcional sem evidências.

Não executar novamente a instalação no Claude Code. Não presumir que MCP de gestão da VPS oferece shell: instalação de PHP/MariaDB e deploy podem exigir SSH separado.
