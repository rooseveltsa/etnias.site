<aside class="opy-sidebar" aria-label="Casa Opy">
    <button type="button" class="opy-nav-item" data-opy-open="opy-interactivity" aria-haspopup="dialog" aria-controls="opy-interactivity" aria-expanded="false"><?php echo Etnias_OpyIcon('interatividade'); ?><span>Interatividade</span></button>
    <?php echo Etnias_OpyNavigation(); ?>
    <a class="opy-nav-item" href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('saved-posts')); ?>"<?php echo isset($wo['page']) && $wo['page']==='saved-posts' ? ' aria-current="page"' : ''; ?>><?php echo Etnias_OpyIcon('save'); ?><span>Salvos</span></a>
    <button type="button" class="opy-nav-item opy-logout" data-opy-logout><?php echo Etnias_OpyIcon('logout'); ?><span>Sair</span></button>
    <p class="opy-sidebar-note">Pessoas, saberes e cultura<br>em conexão.</p>
</aside>
