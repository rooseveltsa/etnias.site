# Etnias — Fase 3 (reunião com o Karuan, 16/11/2026)

Resumo técnico do que entrou, como ligar/desligar, como administrar e o que depende de decisão.

## Chaves (flags) do menu — `preview/fase3.js`
`FLAGS = { aldeia:false, barraSaberes:false, barraComunidades:false }`. Troque para `true` e publique para voltar com o botão
Aldeia, o Saberes ou o Comunidades na barra inferior. Nada foi apagado: o CSS só esconde (`html[data-flag-*]`).

## Painéis suspensos (chat, notificações, EtnIA) — `preview/panels.js`
Abrem por cima da página (sem trocar de tela), como o pop-up de pedidos de amizade. Esc fecha, Tab fica preso no painel,
clique fora fecha, o foco volta ao botão. Ctrl/⌘+clique ou botão do meio abre a página completa.

## Ícones de curtir e figurinhas (admin → aba "Reações e figurinhas")
* Até **6 ícones ativos** na bandeja do Curtir (padrão: os 5 antigos + maracá). SVG ou PNG/WebP/GIF até 512 KB.
  O SVG é **limpo** no servidor (lista de elementos permitidos; sem script, evento, imagem externa, `use`, `foreignObject`,
  DOCTYPE/ENTITY) e é servido com `Content-Security-Policy: sandbox`.
* Ordem (↑ ↓), nome, ativo/inativo, apagar. Quem reagiu com um ícone apagado volta para "Curti".
* Animação suave (tremidinha leve ao passar o mouse) só quando o aparelho **não** pede movimento reduzido.
* **Figurinhas**: pacotes por categoria (Celebridades indígenas, Política, Atualidades, Zé Monge, Outros). Aparecem no botão de
  figurinhas dos comentários e do chat. Os arquivos do Zé Monge **não estavam** na exportação do grupo (só fotos e áudios):
  a categoria existe e está pronta para receber o upload (PNG com fundo transparente, até 512 KB).
  Remover fundo de uma imagem: `rembg` ou remove.bg, antes de subir.

## Trocar o @ (Configurações → Seu @)
Formato (letras/números/ponto/sublinhado, 3 a 24), lista de @ reservados, checagem em tempo real (40 consultas/min por pessoa),
**1 troca a cada 15 dias**, histórico, e o @ antigo fica **reservado por 90 dias** (ninguém mais registra). O @ da administração
(`OPY_ADMIN_USERNAMES`) pode ser registrado mesmo estando na lista de reservados.

## Localização (opcional, com consentimento)
Só quando a pessoa toca em "Usar minha localização" (Configurações ou aba Local da publicação). O navegador pede permissão
(Geolocation API), o servidor faz a geocodificação reversa e guarda **somente cidade e UF** (nunca o ponto exato).
* Padrão: OpenStreetMap **Nominatim** (grátis, sem chave). Servidor com cache por ~1 km por 7 dias, 6 consultas/min por pessoa e
  1 consulta/s no total (política de uso do Nominatim; obrigatório identificar o app — `OPY_GEOCODER_UA`).
  Para outro endereço compatível: `OPY_GEOCODER_URL`.
* **Alternativa paga** se o volume crescer ou se quiser SLA: Google Geocoding API (~US$ 5 por mil), Mapbox Geocoding, LocationIQ
  (plano grátis até 5 mil/dia) ou um Nominatim próprio. Basta apontar `OPY_GEOCODER_URL` para um serviço que devolva o mesmo JSON.

## Páginas (estilo Facebook) — `preview/server/pages.mjs`, `preview/pages.js`, rota `/paginas/`
Vinculadas ao perfil de quem criou (cartão "Páginas" no perfil). Dono, administração e moderação; capa e foto (só administração);
título, categoria, telefone, site, cidade, "sobre" e "o projeto"; seguidores; agenda de eventos (moderação também cria) com
"Tenho interesse"; link para o Eventos geral; estatísticas só para a equipe (seguidores, entradas em 7/30 dias, interesse, gráfico de
14 dias). Limites: 5 páginas por pessoa, 20 pessoas na equipe, 100 eventos por página. Só o dono promove administradores.
Ainda **não** tem publicações "como página" nem notificações de evento (próxima etapa).

## Compartilhar no WhatsApp — `preview/server/share.mjs`
`/p/<id>/` (público) devolve a prévia com título (autor), texto e **foto da própria publicação**; o navegador segue para o post.
Só publicações **públicas** de perfis públicos, contas ativas e comunidades públicas expõem conteúdo; o resto mostra o logo
padrão. Tudo escapado. Em Vercel há um `rewrite` no `vercel.json` gerado; no Node/Caddy a rota é atendida direto.
A prévia pode ficar em cache por 5 minutos.

## Vídeo
Limite avisado **antes** de anexar (4 min, 40 MB, MP4/MOV/WebM) e erro claro junto ao campo. Observação de infraestrutura:
em **Vercel** o corpo de uma requisição passa de 4,5 MB só no plano com limite maior — por isso vídeos grandes só funcionam
no servidor próprio (VPS/Caddy), que é o caminho de produção atual.
MOMENTOS: um toque abre o vídeo em tela cheia, carrega só o atual e o próximo (preload), compartilha com prévia.
Gravar segurando o botão (até 4 min, ~1 Mbps para caber nos 40 MB).

## Variáveis novas
`OPY_GEOCODER_URL`, `OPY_GEOCODER_UA`, `OPY_REGISTER_PER_HOUR` (padrão 30 cadastros/h por IP; `0` desliga; o `dev-opy.mjs` já usa 0).
