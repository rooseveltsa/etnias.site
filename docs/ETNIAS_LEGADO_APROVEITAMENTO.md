# O que aproveitar do Etnias antigo (WoWonder em `public_html/`)

Levantamento de 2026-11-07, feito só por leitura de código. O banco recuperado não foi consultado nem alterado. **Quais integrações estavam de fato ligadas** (chaves de SMS, push, nuvem etc.) fica na tabela `Wo_Config` do banco recuperado e não foi verificado.

## O que existe

| Área | No legado | Evidência |
|---|---|---|
| Dados reais | MariaDB com 139 tabelas e 7.418 contas, recuperado e conferido (IDs, logins, hashes idênticos) | `docs/diagnostico-backup-migracao.md`, `deploy/compose.yaml` |
| API para apps | API REST v2 com 184 endpoints (`server_key` + `access_token`), feita para os apps móveis do WoWonder | `api-v2.php`, `api/v2/endpoints/`, `api/v2/Documentation.html` |
| Interface web | 270 handlers AJAX | `xhr/` |
| Tempo real | Servidor Node com Socket.IO para chat, digitação e presença | `nodejs/` |
| Administração | Painel com 123 páginas | `admin-panel/pages/` |
| Mídia | ffmpeg (conversão de vídeo), armazenamento em Wasabi, DigitalOcean Spaces, Google Cloud ou FTP | `ffmpeg/`, `assets/libraries/s3-lib`, `cloud`, `ftp` |
| Tarefas | cron de expiração de planos e limpeza | `cron-job.php`, `expire_pro.php` |

## Cruzamento com os 47 itens

| Item | O legado já tem | Aproveitamento |
|---|---|---|
| 1.1 WhatsApp/SMS | Confirmação e recuperação por SMS (Twilio, Infobip, Msg91, BulkSMS) | Reaproveitar o fluxo; o Twilio também envia WhatsApp |
| 1.2 E-mail | Confirmação de conta, reenvio, recuperação de senha, PHPMailer/SMTP | Direto |
| 1.3 Preferências | Configurações de notificação e de e-mail por usuário | Direto |
| 1.4 2FA | Dois fatores, reenvio de código, confirmação de login incomum | Direto |
| 1.5 Sessões | Lista de sessões, encerrar todas, status de sessão | Direto |
| 1.6 Admin de integrações | Painel com configuração de SMS, e-mail, push e nuvem | Direto |
| 1.7 LGPD | Download dos próprios dados e exclusão de conta | Direto |
| 2.x Chat | Conversas, grupos, chat de páginas, digitação, presença (`lastseen`), favoritas, fixadas, reações, encaminhar, arquivadas | Recursos prontos; o tempo real do Socket.IO é melhor que o polling atual |
| Chamadas | Áudio e vídeo via Agora ou Twilio (pagos) | **Não reaproveitar:** a solução nova (WebRTC + coturn próprio) não tem custo por minuto |
| 3.1 Push | OneSignal (service worker e IDs de dispositivo) | Reaproveitável, mas depende de conta OneSignal; o plano prevê VAPID próprio |
| 3.7 Premium | Planos Pro, carteira, 20+ gateways de pagamento | Disponível; ativar só com regras comerciais definidas |
| 4.2 Menu admin | Configuração de recursos ligáveis pelo painel | Parcial |
| 5.x Stories | Criar, visualizações, reações, silenciar | Direto (falta só privacidade por Story) |
| 6.x Feed | Reels, vídeos, populares, hashtags, menções, enquetes, memórias, **usuários próximos** (base para Localidade) | Grande parte pronta |
| 6.8 Live | Agora e Millicast (pagos) | Preferir MediaMTX próprio (plano §1.1) |
| 6.13 Emojis/figurinhas | Carregamento de emojis e GIFs (Giphy) | Parcial; figurinhas próprias não existem |
| Extras | Blogs, fóruns, eventos, vagas, campanhas, mercado, filmes, jogos, IA (OpenAI) para posts | Disponível para módulos futuros |

## Diagnóstico

O rumo mudou. A prévia Casa Opy (Node + um arquivo JSON) reconstruiu do zero, em versão menor, coisas que o WoWonder já tinha: login, chat, grupos, stories, feed. Enquanto isso, o que dá mais trabalho (2FA, SMS, recuperação de conta, sessões, push, admin, pagamentos, reels, dados reais dos 7.418 usuários) já existe no legado.

## Recomendação

Usar o **banco recuperado + a API v2 do WoWonder na VPS como backend principal**, com a Casa Opy como interface nova:

1. Subir o legado na VPS a partir do `deploy/compose.yaml` já existente, numa cópia de homologação, sem tocar no banco de produção.
2. Criar no servidor Node da Casa Opy uma camada que chama a API v2 (o `server_key` fica só no servidor, nunca no navegador). Migrar tela por tela: primeiro login, 2FA e sessões; depois feed, stories e chat.
3. Manter da prévia Node o que é melhor que o legado: chamadas WebRTC com coturn, regras de privacidade do chat (sem leitura retroativa, anexos revogáveis) e o visual novo.
4. Endurecer o legado antes de abrir: a auditoria já encontrou um bypass de autenticação em `requests.php` (corrigido). O código WoWonder precisa de revisão de segurança, compatibilidade com PHP 8.3 e confirmação da licença (`purchase code`).

**Isso é uma mudança de arquitetura e precisa da sua decisão** antes de começar. Ela também redefine o pedido de reconstrução em Laravel 12, que pode virar uma migração gradual a partir da API v2 em vez de uma reescrita.
