<?php
require_once __DIR__ . '/bootstrap.php';
if (!Etnias_OpyEnabled()) {
    return;
}
$opyModules = array(
    'saberes' => 'Saberes e Trilhas de Conhecimento',
    'guardiao' => 'Guardião da Floresta',
    'fotografos' => 'Fotógrafos Indígenas',
    'musica' => 'Catálogo Musical',
    'doar' => 'Doe para o Instituto Etnias'
);
if (!isset($page) || !isset($opyModules[$page])) {
    return;
}
$wo['description'] = $wo['config']['siteDesc'];
$wo['keywords']    = $wo['config']['siteKeywords'];
$wo['page']        = $page;
$wo['title']       = $opyModules[$page] . ' | ' . $wo['config']['siteTitle'];
ob_start();
?>
<div class="page-margin">
    <div class="row opy-home-layout">
        <div class="col-md-2 leftcol"><?php echo Wo_LoadPage('sidebar/left-sidebar'); ?></div>
        <div class="col-md-7 middlecol"><?php require __DIR__ . '/views/modules.php'; ?></div>
        <?php echo Wo_LoadPage('sidebar/content'); ?>
    </div>
</div>
<?php
$wo['content'] = ob_get_clean();
