<aside class="opy-sidebar" aria-label="Casa Opy">
    <button type="button" class="opy-nav-item" data-opy-open="opy-interactivity" aria-haspopup="dialog" aria-controls="opy-interactivity" aria-expanded="false"><?php echo Etnias_OpyIcon('interatividade'); ?><span>Interatividade</span></button>
    <?php echo Etnias_OpyNavigation(); ?>
    <a class="opy-nav-item" href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('saved-posts')); ?>"<?php echo isset($wo['page']) && $wo['page']==='saved-posts' ? ' aria-current="page"' : ''; ?>><?php echo Etnias_OpyIcon('save'); ?><span>Salvos</span></a>
    <details class="opy-personal">
        <summary>Meus recursos</summary>
        <a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('albums')); ?>">Meus álbuns</a>
        <a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('memories')); ?>">Recordações</a>
        <?php if (!empty($wo['config']['watch_page'])) { ?><a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('watch')); ?>">Assistir</a><?php } ?>
        <?php if (!empty($wo['config']['reels_upload'])) { ?><a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('reels')); ?>">Vídeos curtos</a><?php } ?>
        <?php if (!empty($wo['config']['groups'])) { ?><a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl(!empty($wo['config']['can_use_groups']) ? 'groups' : 'joined_groups')); ?>"><?php echo !empty($wo['config']['can_use_groups']) ? 'Meus grupos' : 'Grupos dos quais participo'; ?></a><?php } ?>
        <?php if (!empty($wo['config']['pages'])) { ?><a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl(!empty($wo['config']['can_use_pages']) ? 'pages' : 'liked-pages')); ?>"><?php echo !empty($wo['config']['can_use_pages']) ? 'Minhas páginas' : 'Páginas que acompanho'; ?></a><?php } ?>
        <a href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('setting')); ?>">Configurações</a>
    </details>
    <p class="opy-sidebar-note">Pessoas, saberes e cultura<br>em conexão.</p>
</aside>
