<?php
$chatIcon = function ($name) {
    $own = array(
        'back' => '<path d="m15 4-8 8 8 8"/>',
        'phone' => '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
        'more' => '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
        'send' => '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
        'image' => '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
        'headphones' => '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="3" y="15" width="4" height="6" rx="1.5"/><rect x="17" y="15" width="4" height="6" rx="1.5"/>',
    );
    if (!isset($own[$name])) { return Etnias_OpyIcon($name); }
    return '<svg class="opy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $own[$name] . '</svg>';
};
?><section id="chat-workspace" class="chat-workspace" data-mobile-view="list" aria-labelledby="chat-title">
 <div class="chat-messenger">
  <aside class="chat-sidebar" aria-label="Conversas e pessoas">
   <header class="chat-title-row"><h1 id="chat-title">Conversas</h1><button id="chat-new-group" type="button" class="chat-icon-btn" aria-label="Novo grupo" title="Novo grupo"><?php echo $chatIcon('group'); ?></button></header>
   <label for="chat-find" class="opy-sr-only">Buscar pessoas e conversas</label>
   <div class="chat-search-pill"><?php echo $chatIcon('search'); ?><input type="search" id="chat-find" placeholder="Buscar" maxlength="100"></div>
   <p class="chat-privacy">Só participantes leem as conversas. A plataforma guarda as mensagens, sem criptografia de ponta a ponta.</p>
   <div id="chat-invitations"></div>
   <ul id="chat-list" class="chat-people"></ul>
   <label class="chat-archive-toggle"><input type="checkbox" id="chat-archives"> Mostrar arquivadas</label>
  </aside>
  <section class="chat-thread" aria-label="Conversa selecionada">
   <header class="chat-head">
    <button id="chat-back" type="button" class="chat-icon-btn chat-back-btn" aria-label="Voltar para as conversas"><?php echo $chatIcon('back'); ?></button>
    <button id="chat-info-toggle" type="button" class="chat-head-identity" aria-expanded="false" aria-controls="chat-context" hidden>
     <span id="chat-avatar" class="preview-avatar" aria-hidden="true">C</span>
     <span class="chat-head-copy"><strong id="chat-name">Escolha uma conversa</strong><small id="chat-subtitle">Encontre alguém pelo nome ou crie um grupo.</small></span>
    </button>
    <div class="chat-head-actions">
     <button id="chat-call-video" type="button" class="chat-icon-btn" aria-label="Chamada de vídeo" title="Chamada de vídeo" hidden><?php echo $chatIcon('video'); ?></button>
     <button id="chat-call-audio" type="button" class="chat-icon-btn" aria-label="Chamada de voz" title="Chamada de voz" hidden><?php echo $chatIcon('phone'); ?></button>
     <button id="chat-options" type="button" class="chat-icon-btn" aria-label="Opções da conversa" title="Opções" hidden><?php echo $chatIcon('more'); ?></button>
    </div>
   </header>
   <form id="chat-search-form" class="chat-search-bar" hidden><label for="chat-search" class="opy-sr-only">Buscar nesta conversa</label><input type="search" id="chat-search" maxlength="100" placeholder="Buscar nesta conversa"><button type="submit" class="preview-secondary">Buscar</button></form>
   <button type="button" id="chat-older" class="chat-older" hidden>Carregar mensagens anteriores</button>
   <div id="chat-log" role="log" aria-label="Mensagens" aria-live="polite" tabindex="0"><p class="chat-empty">Escolha uma pessoa ou crie um grupo.</p></div>
   <form id="chat-form" hidden>
    <div id="chat-reply"></div><p id="chat-attachment"></p>
    <div class="chat-compose-row">
     <button id="chat-plus" type="button" class="chat-icon-btn" aria-label="Anexar" aria-haspopup="dialog" aria-controls="chat-sheet"><?php echo $chatIcon('plus'); ?></button>
     <div class="chat-input-pill">
      <label for="chat-text" class="opy-sr-only">Sua mensagem</label><textarea id="chat-text" maxlength="2000" rows="1" placeholder="Mensagem"></textarea>
      <button id="chat-voice" type="button" class="chat-mic" aria-label="Gravar áudio" aria-pressed="false"><?php echo $chatIcon('microphone'); ?></button>
     </div>
     <button id="chat-send" class="chat-send" type="submit" aria-label="Enviar"><?php echo $chatIcon('send'); ?></button>
    </div>
    <input id="chat-file" type="file" hidden>
   </form>
   <p id="chat-status" role="status">Conectando…</p><div id="chat-retry"></div>
  </section>
  <aside id="chat-context" class="chat-context" aria-label="Informações da conversa" hidden></aside>
 </div>
 <dialog id="chat-sheet" class="chat-sheet" aria-labelledby="chat-sheet-title">
  <span class="chat-sheet-grip" aria-hidden="true"></span><h2 id="chat-sheet-title" class="opy-sr-only">Anexar</h2>
  <div class="chat-sheet-grid">
   <button type="button" data-pick="document"><span><?php echo $chatIcon('file'); ?></span>Documento</button>
   <button type="button" data-pick="camera"><span><?php echo $chatIcon('camera'); ?></span>Câmera</button>
   <button type="button" data-pick="gallery"><span><?php echo $chatIcon('image'); ?></span>Galeria</button>
   <button type="button" data-pick="audio"><span><?php echo $chatIcon('headphones'); ?></span>Áudio</button>
   <button type="button" id="chat-emoji"><span><?php echo $chatIcon('smile'); ?></span>Emoji</button>
  </div>
  <p class="chat-hint">Até 2 MB por anexo. Áudio e vídeo só carregam quando você toca.</p>
  <form method="dialog"><button class="preview-secondary chat-sheet-close">Fechar</button></form>
 </dialog>
 <dialog id="chat-dialog" aria-labelledby="chat-dialog-title"><form method="dialog"><button class="preview-secondary">Fechar</button></form><h2 id="chat-dialog-title"></h2><div id="chat-dialog-body"></div></dialog>
</section>
