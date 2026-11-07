<?php if (!Etnias_OpyEnabled()) { return; } ?>
<div class="opy-topbar">
    <nav class="opy-topbar-inner" aria-label="Acessos da comunidade">
        <a class="opy-brand" href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('home')); ?>" aria-label="Etnias.site — feed">
            <img src="<?php echo Etnias_OpyEscape(Etnias_OpyAsset('etnias-logo.png')); ?>" alt="etnias.site" width="150" height="40">
        </a>
        <button type="button" class="opy-menu-toggle" data-opy-open="opy-menu" aria-label="Opy" aria-haspopup="dialog" aria-controls="opy-menu" aria-expanded="false"><span>Opy</span></button>
        <form class="opy-search" action="<?php echo Etnias_OpyEscape(rtrim($wo['config']['site_url'], '/') . '/index.php'); ?>" method="get" role="search">
            <input type="hidden" name="link1" value="search">
            <label class="opy-sr-only" for="opy-search-query">Pesquisar no Etnias</label>
            <input id="opy-search-query" type="search" name="query" placeholder="Pessoas e publicações" maxlength="200" value="<?php echo Etnias_OpyEscape(isset($_GET['query']) && is_string($_GET['query']) ? $_GET['query'] : ''); ?>">
            <button type="submit" aria-label="Pesquisar"><?php echo Etnias_OpyIcon('pesquisar'); ?></button>
        </form>
        <div class="opy-member-controls">
            <?php
            // Preserve the vendor's account, chat, requests and notification handlers.
            // The original partial starts by closing the list opened by its header.
            echo preg_replace('/^\s*<\/ul>/', '', Wo_LoadPage('header/loggedin-header'), 1);
            ?>
        </div>
    </nav>
</div>
