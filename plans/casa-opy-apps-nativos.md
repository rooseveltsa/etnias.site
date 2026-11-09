# Plano: aplicativos Android e iOS da Casa Opy (Etnias)

Objetivo: o Etnias (https://etnias.site) nas lojas Google Play e App Store, com câmera, chamadas, live,
carrossel e avisos funcionando como no navegador.

Gerado com ecc:blueprint em 2026-11-09. Modo: direto (branch única `cursor/banco-etnias-recuperado`,
commits pequenos por etapa, sem PR — é o fluxo do repositório).

## Decisão de arquitetura (uma só, justificada)

**Capacitor, um único projeto em `apps/mobile/`, carregando https://etnias.site** (`server.url`).

- Por quê: a rede já é um web app completo e em evolução diária. Reescrever em React Native/Flutter
  duplicaria tudo e atrasaria meses. Com o app carregando o site, cada `publicar.sh` atualiza o app
  sem passar pela revisão das lojas.
- WebRTC (chamadas e live WHIP/WHEP) funciona no WebView do Android e no WKWebView do iOS 14.3+.
- Risco principal: a Apple recusa "site embrulhado" (diretriz 4.2). Mitigação: recursos nativos
  reais — avisos nativos (APNs), permissões de câmera/microfone nativas, compartilhar nativo,
  tela própria sem internet, links universais. Isso está nas etapas 3 a 5.
- Web Push NÃO funciona dentro do WebView: os avisos no app precisam de push nativo (FCM no Android,
  APNs no iOS via FCM). Exige mudança no servidor (`preview/server/push.mjs`).

Rejeitados: TWA/Bubblewrap (só Android, teria de manter dois projetos), React Native (reescrita).

## Invariantes (valem depois de toda etapa)

- `node --test tests/opy/*.mjs` passa; o site no navegador não muda de comportamento.
- Nenhum segredo (keystore, chave FCM, .p8 da Apple) entra no git. Ficam nas Senhas do Mac e no
  `.env` da VPS (gravado pelo usuário).
- `apps/mobile` não é copiado para a imagem Docker (Dockerfile.dockerignore já nega tudo por padrão).

## Decisões do usuário (bloqueiam só as etapas indicadas)

| Decisão | Etapa | Sugestão |
|---|---|---|
| Nome na loja e identificador | 1 (pode mudar até a 7) | "Etnias", `site.etnias.app` |
| Projeto Firebase (grátis) para push | 4 | criar com a conta Google do projeto |
| Conta Google Play Console (US$ 25 uma vez) | 7 | conta da contratante (titularidade) |
| Conta Apple Developer (US$ 99/ano) | 6 e 7 | conta da contratante |
| Instalar o Xcode (App Store, grátis, ~15 GB) | 6 | necessário para qualquer build de iOS |

## Etapas

Grafo: 1 → 2 → (3 ∥ 5) → 4 → 6 → 7. A 3 e a 5 não tocam os mesmos arquivos.

### Etapa 1 — Esqueleto Capacitor + APK Android de teste (sem dependência do usuário)
Contexto: Android SDK em ~/Library/Android/sdk (platform android-36.1, build-tools 36.0.0); falta JDK.
Tarefas:
- `brew install openjdk@21`; JAVA_HOME só no comando de build (não mexer no shell do usuário).
- `apps/mobile/package.json` com `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` em versões
  exatas; `capacitor.config.json`: appId `site.etnias.app`, appName `Etnias`,
  `server.url: https://etnias.site`.
- `apps/mobile/www/index.html`: tela de reserva sem internet (botão "Tentar de novo").
- Ícones a partir de `public_html/assets/opy/icon-512.png`.
- `npx cap add android`; `./gradlew assembleDebug`.
Verificação: APK abre em emulador, carrega a tela de entrada do etnias.site, login funciona.
Saída: commit `feat(apps): esqueleto Capacitor e APK Android de teste`.

### Etapa 2 — Android: câmera, microfone, arquivos e navegação
Tarefas: permissões no AndroidManifest (CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, POST_NOTIFICATIONS);
conceder getUserMedia no WebChromeClient do Capacitor; seletor de arquivos múltiplo (carrossel);
botão voltar do Android volta no histórico; links externos (YouTube etc.) abrem no navegador.
Verificação no emulador: foto e carrossel, story com câmera, chamada entre app e navegador, live.
Saída: commit `feat(apps): permissões e navegação nativas no Android`.

### Etapa 3 — Recursos nativos que justificam o app (paralela à 5)
Tarefas: `@capacitor/share` no botão compartilhar (site detecta `window.Capacitor`), barra de status
nas cores do tema, tela sem internet, vibração leve nas reações.
Verificação: no navegador nada muda (detecção por `window.Capacitor?.isNativePlatform()`).

### Etapa 4 — Avisos nativos (precisa do projeto Firebase)
Servidor: `push.mjs` aceita inscrição `{ kind: 'fcm', token }` além do Web Push e envia pela API
FCM HTTP v1 (conta de serviço no `.env` da VPS). App: `@capacitor/push-notifications`, toque no aviso
abre a tela certa. Testes unitários para o envio FCM com `send` injetado (padrão já usado no push.mjs).

### Etapa 5 — Links do app (paralela à 3)
Servidor serve `/.well-known/assetlinks.json` (impressão digital da chave de assinatura) e
`/.well-known/apple-app-site-association`. Link de post/perfil abre direto no app.

### Etapa 6 — iOS (precisa do Xcode instalado e da conta Apple para aparelho real)
`npx cap add ios`; Info.plist com NSCameraUsageDescription, NSMicrophoneUsageDescription,
NSPhotoLibraryUsageDescription em português; push APNs pelo FCM; teste no simulador
(chamada, live, carrossel). Atenção: gravação de live em MP4 no iPhone já tem risco registrado.

### Etapa 7 — Publicação nas lojas (contas do usuário)
Android: keystore de produção (gerada aqui, guardada nas Senhas do Mac + cópia que o usuário
guarda fora), AAB assinado, ficha da loja (textos, capturas, política de privacidade, formulário de
segurança de dados — LGPD), teste interno → produção.
iOS: certificados pelo Xcode, TestFlight, revisão da Apple (preparar notas de revisão com conta de
teste, explicando os recursos nativos).

## Rollback
Etapas 1–3 e 6 vivem em `apps/mobile/` (apagar a pasta desfaz). Etapas 4 e 5 mexem no servidor:
cada uma é um commit revertível; o envio FCM só liga com as variáveis no `.env`.

## Revisão adversarial (ecc:architect, 2026-11-09) — incorporada

- Plugins: o site não tem bundler. Chamar `window.Capacitor.Plugins.X` direto (a bridge é injetada pelo
  nativo e não esbarra na CSP). Nada de JS de plugin servido de fora; nada de `'unsafe-inline'`.
- Apple 1.2 / 5.1.1(v) (conteúdo de usuários): antes da etapa 7, conferir dentro do app denunciar
  publicação/pessoa, bloquear, filtrar e EXCLUIR conta (account.mjs já tem bloqueio e pedido de exclusão;
  conferir denúncia de post e perfil).
- iOS: deployment target 15+; textos de permissão específicos em PT-BR (genérico é recusa).
- Android: além de CAMERA/RECORD_AUDIO/MODIFY_AUDIO_SETTINGS, `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` se o
  seletor pedir; testar 10 fotos em aparelho real.
- Cookie de sessão: hoje só ganha `Secure` com `VERCEL` definido; na VPS sai sem. Corrigir para `Secure`
  quando a requisição chega por HTTPS (x-forwarded-proto) — vale também para o site (etapa 1, servidor).
- Segredos fora do git: `google-services.json`, `.p8`, keystore. `.gitignore` em apps/mobile.
- Push nativo é o maior risco da 4.2 → etapa 4 antes de qualquer envio à Apple.
