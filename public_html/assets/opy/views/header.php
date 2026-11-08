<?php if (!Etnias_OpyEnabled()) { return; } ?>
<div class="opy-topbar">
    <nav class="opy-topbar-inner" aria-label="Navegação principal">
        <div class="opy-topbar-start">
            <?php // O logo da casa é o botão do menu OPY ("Encontre seu caminho no Etnias"); o feed fica no item Opy do menu e na barra inferior. ?>
            <button type="button" class="opy-brand opy-house" data-opy-open="opy-menu" aria-label="OPY — Encontre seu caminho no Etnias" title="OPY — Encontre seu caminho no Etnias" aria-haspopup="dialog" aria-controls="opy-menu" aria-expanded="false">
                <span class="opy-logo-crop"><img src="<?php echo Etnias_OpyEscape(Etnias_OpyAsset('etnias-logo.png')); ?>" alt="" width="150" height="40"></span>
                <svg class="opy-brand-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>
        <form class="opy-search" id="opy-search" action="<?php echo Etnias_OpyEscape(rtrim($wo['config']['site_url'], '/') . '/index.php'); ?>" method="get" role="search" autocomplete="off">
            <input type="hidden" name="link1" value="search">
            <button type="button" class="opy-search-close" aria-label="Fechar pesquisa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <label class="opy-sr-only" for="opy-search-query">Pesquisar no Etnias</label>
            <input id="opy-search-query" type="search" name="query" placeholder="Pesquisar pessoas e publicações" maxlength="200" enterkeyhint="search" aria-controls="opy-search-results" aria-autocomplete="list" value="<?php echo Etnias_OpyEscape(isset($_GET['query']) && is_string($_GET['query']) ? $_GET['query'] : ''); ?>">
            <button type="button" class="opy-search-clear" aria-label="Limpar pesquisa" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            <button type="submit" class="opy-search-submit" aria-label="Pesquisar"><?php echo Etnias_OpyIcon('pesquisar'); ?></button>
            <div id="opy-search-results" class="opy-search-results" role="listbox" aria-label="Sugestões de pesquisa" hidden></div>
        </form>
        <button type="button" class="opy-search-open" aria-label="Pesquisar" aria-controls="opy-search" aria-expanded="false"><?php echo Etnias_OpyIcon('pesquisar'); ?></button>
        <div class="opy-member-controls">
            <?php
            // Preserve the vendor's account, chat, requests and notification handlers.
            // The original partial starts by closing the list opened by its header.
            echo preg_replace('/^\s*<\/ul>/', '', Wo_LoadPage('header/loggedin-header'), 1);
            ?>
        </div>
    </nav>
</div>
