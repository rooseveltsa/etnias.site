<?php
if (!Etnias_OpyEnabled()) { return; }
$opyItems = Etnias_OpyItems();
$opyConfig = Etnias_OpyConfig();
?>
<nav class="opy-bottom" aria-label="Ações frequentes">
    <a class="opy-nav-item" href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('home')); ?>" data-opy-feed aria-label="Voltar ao feed e atualizar"><?php echo Etnias_OpyIcon('feed'); ?><span>Feed</span></a>
    <?php $opyGruposBarra = $opyItems['grupos']; $opyGruposBarra['label'] = 'Comunidades'; echo Etnias_OpyItem('grupos', $opyGruposBarra); ?>
    <a class="opy-nav-item opy-create" href="<?php echo Etnias_OpyEscape(Etnias_OpyUrl('home')); ?>#opy-compose" data-opy-compose><?php echo Etnias_OpyIcon('postagem'); ?><span>Postagem</span></a>
    <?php $opySaberesBarra = $opyItems['saberes']; $opySaberesBarra['icon'] = 'saberes-barra'; echo Etnias_OpyItem('saberes', $opySaberesBarra); ?>
    <?php echo Etnias_OpyItem('etnia', $opyItems['etnia']); ?>
</nav>
<dialog id="opy-menu" class="opy-dialog opy-drawer" aria-labelledby="opy-menu-title">
    <div class="opy-dialog-heading"><div><h2 id="opy-menu-title">Casa Opy</h2><p>Encontre seu caminho no Etnias.</p></div><button type="button" data-opy-close aria-label="Fechar Casa Opy"><?php echo Etnias_OpyIcon('close'); ?></button></div>
    <?php require __DIR__ . '/sidebar.php'; ?>
</dialog>
<dialog id="opy-interactivity" class="opy-dialog" aria-labelledby="opy-interactivity-title">
    <div class="opy-dialog-heading"><div><h2 id="opy-interactivity-title">Interatividade</h2><p>Outras formas de participar da aldeia.</p></div><button type="button" data-opy-close aria-label="Fechar Interatividade"><?php echo Etnias_OpyIcon('close'); ?></button></div>
    <div class="opy-experiences">
        <?php
        $opyModulesEnabled = !isset($wo['config']['opy_modules']) || (string) $wo['config']['opy_modules'] !== '0';
        $guardianUrl = Etnias_OpySafeUrl($opyConfig['guardian_url']);
        if ($guardianUrl === '' && $opyModulesEnabled) { $guardianUrl = Etnias_OpyUrl('guardiao'); }
        $photographersUrl = Etnias_OpySafeUrl($opyConfig['photographers_url']);
        if ($photographersUrl === '' && $opyModulesEnabled) { $photographersUrl = Etnias_OpyUrl('fotografos'); }
        $experiences = array(
            'guardiao' => array('label' => 'Guardião da Floresta', 'icon' => 'guardiao', 'url' => $guardianUrl, 'route' => 'guardiao', 'description' => 'O registro e acompanhamento de ocorrências territoriais e ambientais ainda não está disponível nesta atualização.'),
            'fotografos' => array('label' => 'Fotógrafos indígenas', 'icon' => 'fotografos', 'url' => $photographersUrl, 'route' => 'fotografos', 'description' => 'O espaço de fotógrafos, biografias e licenciamento de imagens ainda não está disponível nesta atualização.'),
            'descobrir' => array('label' => 'Descobrir conexões', 'icon' => 'conexao', 'url' => Etnias_OpyUrl('search'), 'route' => 'search', 'description' => 'Encontre pessoas na comunidade.'),
            'jogos' => array('label' => 'Jogos', 'icon' => 'jogos', 'url' => !empty($wo['config']['games']) && !empty($wo['config']['can_use_games']) ? Etnias_OpyUrl('new-game') : '', 'route' => 'new-game', 'description' => 'Os jogos estão desativados ou não estão disponíveis para sua conta.')
        );
        foreach ($experiences as $id => $item) { echo Etnias_OpyItem($id, $item); }
        ?>
    </div>
    <p class="opy-availability-note">O ponto ao lado de uma área indica que ela ainda não está disponível. Selecione para saber mais.</p>
</dialog>
<dialog id="opy-info" class="opy-dialog opy-info" aria-labelledby="opy-info-title" aria-describedby="opy-info-description">
    <div class="opy-dialog-heading"><h2 id="opy-info-title">Área do Etnias</h2><button type="button" data-opy-close aria-label="Fechar informação"><?php echo Etnias_OpyIcon('close'); ?></button></div>
    <p class="opy-info-state">Ainda não disponível</p><p id="opy-info-description"></p>
    <button type="button" class="opy-primary" data-opy-close>Entendi</button>
</dialog>
<p class="opy-sr-only" id="opy-status" role="status" aria-live="polite"></p>
<script src="<?php echo Etnias_OpyEscape(Etnias_OpyAsset('opy.js')); ?>" defer></script>
