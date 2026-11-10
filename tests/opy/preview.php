<?php
// Isolated, synthetic UI fixture. Never loads config.php, credentials or the DB.
require __DIR__ . '/../../public_html/assets/opy/bootstrap.php';
$theme = isset($_GET['theme']) && $_GET['theme'] === 'wowonder' ? 'wowonder' : 'sunshine';
$page = isset($_GET['link1']) && in_array($_GET['link1'], array('home', 'saberes', 'guardiao', 'fotografos', 'musica', 'doar'), true) ? $_GET['link1'] : 'home';
$wo = array('loggedin' => true, 'page' => $page, 'user' => array('banned' => 0), 'config' => array(
    'site_url' => 'http://127.0.0.1:8097', 'theme_url' => '/themes/' . $theme, 'logo_extension' => 'png', 'website_mode' => 'facebook',
    'groups' => 1, 'pages' => 1, 'blogs' => 1, 'classified' => 1, 'events' => 1, 'movies' => 1, 'job_system' => 1, 'funding_system' => 1, 'games' => 0
));
function Wo_LoadPage($name) {
    // Only the legacy account/notification controls are represented by a fixture.
    return '</ul><ul class="nav navbar-nav navbar-right" id="head_menu_rght"><li class="requests-container"><a href="#requests">Solicitações</a></li><li class="messages-notification-container"><a href="#chat" class="sixteen-font-size"><svg viewBox="0 0 24 24"><path d="M3 3h18v14H9l-6 4z" fill="none" stroke="currentColor"/></svg></a></li><li class="notification-container"><a href="#" class="sixteen-font-size"><svg viewBox="0 0 24 24"><path d="M4 17h16l-3-5V8a5 5 0 0 0-10 0v4zM10 21h4" fill="none" stroke="currentColor"/></svg></a><span class="new-update-alert">2</span></li><li><a href="#account" class="user-menu-combination"><span class="user-avatar">E</span><b>Conta de teste</b></a></li></ul>';
}
?><!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prévia Opy — dados demonstrativos</title>
<link rel="stylesheet" href="/themes/<?php echo $theme; ?>/stylesheet/general-style-plugins.css">
<link rel="stylesheet" href="/themes/<?php echo $theme; ?>/stylesheet/style.css">
<link rel="stylesheet" href="/assets/opy/opy.css">
<style>.opy-preview-note{padding:12px 16px;margin:0 0 20px;background:#fff1d6;color:#5f3b00;font:14px sans-serif}.opy-preview-post{background:white;padding:24px;margin-top:20px;border-radius:12px}.opy-preview-post p{line-height:1.7}.opy-preview-post h2{font-size:18px}.opy-preview-composer{padding:20px;background:white;border-radius:12px}.opy-preview-composer textarea{width:100%;padding:16px;border:1px solid #cfd4d5;border-radius:8px;min-height:100px}.opy-preview-composer .sun_pub_more{padding:20px}.opy-preview-composer .sun_pub_more button{margin:4px}.opy-preview-composer .publisher-box-footer{display:none}.opy-preview-composer .sun_pub_mid_foot{padding:12px 0}.opy-preview-avatar{width:42px;height:42px;background:#eee8e1;display:inline-grid;place-items:center;border-radius:50%;margin-right:12px}</style>
</head><body class="opy-enabled">
<header class="header-container"><?php require __DIR__ . '/../../public_html/assets/opy/views/header.php'; ?></header>
<main class="content-container container"><p class="opy-preview-note">Prévia local de interface. Conta, conteúdo e contadores demonstrativos; sem conexão com o banco.</p><div class="row opy-home-layout">
<div class="col-md-2 leftcol"><?php require __DIR__ . '/../../public_html/assets/opy/views/sidebar.php'; ?></div>
<div class="col-md-7 middlecol"><?php if ($wo['page'] !== 'home') { require __DIR__ . '/../../public_html/assets/opy/views/modules.php'; } else { require __DIR__ . '/../../public_html/assets/opy/views/feed-intro.php'; ?>
<form class="post publisher-box opy-preview-composer" id="publisher-box-focus" onsubmit="event.preventDefault()"><label for="preview-post">Compartilhe com a comunidade</label><textarea id="preview-post" name="postText" class="postText" placeholder="Que história você quer compartilhar?"></textarea><div class="sun_pub_mid_foot"><label>Foto ou vídeo <input type="file" name="postPhotos[]"></label><span class="btn mor">Mais</span></div><div class="publisher-box-footer"><div class="sun_pub_more"><button type="button">Enquete</button><button type="button">Gravar áudio</button><button type="button">Arquivo</button></div><label>Quem pode ver? <select name="postPrivacy"><option>Comunidade</option><option>Somente eu</option></select></label><button class="btn btn-main" type="submit">Publicar</button></div></form>
<article class="opy-preview-post"><h2><span class="opy-preview-avatar" aria-hidden="true">E</span>Comunidade Etnias</h2><p>Este conteúdo é demonstrativo. O Etnias reúne os caminhos para conviver, aprender e compartilhar na plataforma.</p><p>Use o menu Opy para explorar as áreas e o botão central para voltar à sua publicação.</p><hr><button type="button">Curtir</button> <button type="button">Comentar</button></article>
<article class="opy-preview-post"><h2>Um espaço para nossos encontros</h2><p>Eventos, grupos, produções culturais e oportunidades têm seus próprios caminhos no Etnias.</p></article>
<?php } ?></div><aside class="col-md-3 custom-fixed-element"><section class="opy-preview-post"><h2>Explore a comunidade</h2><p>Encontre grupos, projetos e pessoas pelos acessos do Etnias.</p><a href="/index.php?link1=suggested-groups">Descobrir grupos</a></section></aside></div></main>
<?php require __DIR__ . '/../../public_html/assets/opy/views/runtime.php'; ?>
</body></html>
