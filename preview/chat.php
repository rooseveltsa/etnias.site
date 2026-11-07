<section id="chat-workspace" class="chat-workspace" data-mobile-view="list" aria-labelledby="chat-title">
 <header class="chat-title-row"><div><h1 id="chat-title">Conversas</h1><p>Mensagens diretas e grupos privados da comunidade.</p></div><button id="chat-new-group" type="button" class="preview-secondary">Novo grupo</button></header>
 <p class="chat-privacy">Só participantes têm acesso por aqui. A plataforma armazena as mensagens; não há criptografia ponta a ponta. Compartilhe apenas o que tem permissão para compartilhar.</p>
 <div class="chat-messenger">
  <aside class="chat-sidebar" aria-label="Conversas e pessoas">
   <label for="chat-find">Buscar pessoas e conversas</label><input type="search" id="chat-find" placeholder="Nome ou @usuário" maxlength="100">
   <label class="chat-archive-toggle"><input type="checkbox" id="chat-archives"> Mostrar arquivadas</label>
   <div id="chat-invitations"></div><ul id="chat-list" class="chat-people"></ul>
  </aside>
  <section class="chat-thread" aria-label="Conversa selecionada">
   <header class="chat-head">
    <div class="chat-head-identity">
     <button id="chat-back" type="button" class="preview-secondary chat-back-btn" aria-label="Voltar para a lista de conversas">← Conversas</button>
     <span id="chat-avatar" class="preview-avatar" aria-hidden="true">C</span>
     <div class="chat-head-copy"><h2 id="chat-name">Escolha uma conversa</h2><p id="chat-subtitle">As pessoas do acervo precisam criar uma conta para receber mensagens.</p></div>
    </div>
    <div class="chat-head-actions">
     <button id="chat-info-toggle" type="button" class="preview-secondary" aria-expanded="false" aria-controls="chat-context" hidden>Detalhes</button>
     <button id="chat-options" type="button" class="preview-secondary" hidden>Opções</button>
    </div>
   </header>
   <form id="chat-search-form" hidden><label for="chat-search">Buscar nesta conversa</label><div class="chat-compose-row"><input type="search" id="chat-search" maxlength="100" placeholder="Filtrar mensagens…"><button type="submit" class="preview-secondary">Buscar</button></div></form>
   <button type="button" id="chat-older" class="preview-secondary" hidden>Carregar mensagens anteriores</button>
   <div id="chat-log" role="log" aria-label="Mensagens" aria-live="polite" tabindex="0"><p class="chat-empty">Escolha uma pessoa ou crie um grupo. Nenhuma mensagem será enviada a uma sala pública.</p></div>
   <form id="chat-form" hidden>
    <div id="chat-reply"></div><label for="chat-text">Sua mensagem</label>
    <div class="chat-compose-row"><textarea id="chat-text" maxlength="2000" rows="2" placeholder="Escreva no seu idioma"></textarea><button id="chat-send" class="opy-primary" type="submit">Enviar</button></div>
    <div class="chat-tools"><label class="preview-file">Anexar mídia ou documento <input id="chat-file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/webm,audio/mp4,application/pdf,text/plain"></label><button id="chat-voice" type="button" class="preview-secondary">Gravar áudio</button><button id="chat-emoji" type="button" class="preview-secondary" aria-label="Inserir emoji">😀</button></div>
    <p id="chat-attachment"></p><p class="chat-hint">Até 2 MB por anexo. Áudio e vídeo só carregam quando você reproduz. Localização pode ser escrita por você; não buscamos sua posição.</p>
   </form>
   <p id="chat-status" role="status">Conectando…</p><div id="chat-retry"></div>
  </section>
  <aside id="chat-context" class="chat-context" aria-label="Informações da conversa" hidden></aside>
 </div>
 <dialog id="chat-dialog" aria-labelledby="chat-dialog-title"><form method="dialog"><button class="preview-secondary">Fechar</button></form><h2 id="chat-dialog-title"></h2><div id="chat-dialog-body"></div></dialog>
</section>
