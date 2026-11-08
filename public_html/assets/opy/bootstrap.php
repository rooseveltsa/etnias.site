<?php
/** Opy is a UI extension. Authorization remains with the existing route handlers. */
function Etnias_OpyConfig() {
    static $config;
    if ($config === null) { $config = require __DIR__ . '/config.php'; }
    return $config;
}
function Etnias_OpyEnabled() {
    global $wo;
    $config = Etnias_OpyConfig();
    return $config['enabled'] && getenv('ETNIAS_OPY_ENABLED') !== '0'
        && !empty($wo['loggedin']) && empty($wo['user']['banned'])
        && (!isset($wo['config']['website_mode']) || $wo['config']['website_mode'] === 'facebook')
        && !in_array(isset($wo['page']) ? $wo['page'] : '', array('welcome', 'maintenance', 'banned', 'user_activation', 'get_news_feed', 'video-api'), true);
}
function Etnias_OpyEscape($value) {
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}
function Etnias_OpySafeUrl($value) {
    if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_URL)) { return ''; }
    return in_array(strtolower((string) parse_url($value, PHP_URL_SCHEME)), array('https', 'http'), true) ? $value : '';
}
function Etnias_OpyUrl($route, $params = array()) {
    global $wo;
    return rtrim($wo['config']['site_url'], '/') . '/index.php?' . http_build_query(array_merge(array('link1' => $route), $params), '', '&', PHP_QUERY_RFC3986);
}
function Etnias_OpyAsset($file) {
    global $wo;
    return rtrim($wo['config']['site_url'], '/') . '/assets/opy/' . $file . '?v=20261109.7';
}
function Etnias_OpyItems() {
    global $wo;
    $config = Etnias_OpyConfig();
    $items = array(
        'opy' => array('Opy', 'home', 'opy-symbol', '', 'Sua casa de entrada para a comunidade.'),
        'saberes' => array('Saberes', 'saberes', 'saberes', '', 'Cursos comunitários, oficinas e Área do Aluno estão sendo preparados e chegam em uma próxima atualização.'),
        'conexoes' => array('Conexões', 'search', 'conexoes', '', 'Encontre pessoas e fortaleça suas relações na comunidade.'),
        'grupos' => array('Grupos', 'suggested-groups', 'grupos', 'groups', 'As comunidades estão desativadas neste ambiente.'),
        'paginas' => array('Páginas', 'suggested-pages', 'paginas', 'pages', 'As páginas estão desativadas neste ambiente.'),
        'blogs' => array('Blogs', 'blogs', 'blogs', 'blogs', 'As publicações autorais estão desativadas neste ambiente.'),
        'mercado' => array('Mercado', 'products', 'mercado', 'classified', 'O mercado está desativado neste ambiente.'),
        'eventos' => array('Eventos', 'events', 'eventos', 'events', 'Os eventos estão desativados neste ambiente.'),
        'filmes' => array('Filmes', 'movies', 'filmes', 'movies', 'O catálogo de filmes está desativado neste ambiente.'),
        'musica' => array('Música', 'musica', 'musica', '', 'O catálogo de artistas, cantos e faixas está sendo preparado e chega em uma próxima atualização. Por enquanto, você pode compartilhar áudio em uma publicação.'),
        'empregos' => array('Empregos', 'jobs', 'empregos', 'job_system', 'As vagas estão desativadas neste ambiente.'),
        'coletas' => array('Coletas', 'funding', 'coletas', 'funding_system', 'As campanhas de arrecadação estão desativadas neste ambiente.'),
        'sobre' => array('Sobre', 'terms', 'sobre', '', 'Conheça o Etnias e o Instituto Etnias.'),
        'etnia' => array('EtnIA', '', 'etnia', '', 'A experiência de inteligência do Etnias ainda não está disponível nesta atualização.'),
        'doar' => array('Doe para o Instituto Etnias', 'doar', 'heart', '', 'O canal de contribuição ao Instituto ainda não foi configurado. Nenhum pagamento é solicitado por esta tela.')
    );
    if (!empty($GLOBALS['etnias_preview_etnia'])) {
        $items['etnia'][1] = 'etnia';
        $items['etnia'][4] = 'Converse para saber como usar o Etnias e a Casa Opy.';
    }
    $urlKeys = array('saberes' => 'saberes_url', 'etnia' => 'etnia_url', 'doar' => 'donation_url', 'musica' => 'music_url');
    $modulesEnabled = !isset($wo['config']['opy_modules']) || (string) $wo['config']['opy_modules'] !== '0';
    // Itens anunciados para uma próxima atualização: ficam no menu com o selo "Em breve" e abrem o aviso em vez da tela.
    $soon = isset($wo['config']['opy_soon']) ? (array) $wo['config']['opy_soon'] : array();
    $result = array();
    foreach ($items as $id => $item) {
        $enabled = $item[3] === '' || (isset($wo['config'][$item[3]]) && (string) $wo['config'][$item[3]] === '1');
        if ($id === 'filmes') { $enabled = $enabled && !empty($wo['config']['can_use_movies']); }
        if (in_array($id, array('saberes', 'musica', 'doar'), true) && !$modulesEnabled) { $enabled = false; }
        $isSoon = in_array($id, $soon, true);
        if ($isSoon) { $enabled = false; }
        $params = $id === 'sobre' ? array('type' => 'about-us') : array();
        $url = $enabled && $item[1] !== '' ? Etnias_OpyUrl($item[1], $params) : '';
        if (isset($urlKeys[$id])) {
            $configuredUrl = Etnias_OpySafeUrl($config[$urlKeys[$id]]);
            if ($configuredUrl !== '' || $item[1] === '') {
                $url = $configuredUrl;
            }
        }
        $result[$id] = array('label' => $item[0], 'route' => $item[1], 'icon' => $item[2], 'url' => $isSoon ? '' : $url, 'description' => $item[4], 'state' => $isSoon ? 'Em breve' : 'Ainda não disponível');
    }
    return $result;
}
function Etnias_OpyIcon($name) {
    $pictures = array(
        'opy-symbol' => 'icons/opy-symbol.png',
        'maraca' => 'icons/maraca.png',
        'chat-arte' => 'icons/chat.png',
        'pesquisar' => 'icons/pesquisar.png',
        'interatividade' => 'icons/interatividade.png',
        'guardiao' => 'icons/guardiao.png',
        'fotografo' => 'icons/fotografo.png',
        'fotografos' => 'icons/fotografos.png',
        'conexao' => 'icons/conexao.png',
        'jogos' => 'icons/jogos.png',
        'saberes' => 'icons/saberes.png',
        'conexoes' => 'icons/conexoes.png',
        'maloca' => 'icons/maloca.png',
        'grupos' => 'icons/grupos.png',
        'paginas' => 'icons/paginas.png',
        'paginas-simbolos' => 'icons/paginas-simbolos.png',
        'blogs' => 'icons/blogs.png',
        'opy-entrada' => 'icons/opy-entrada.png',
        'mercado' => 'icons/mercado.png',
        'filmes' => 'icons/filmes.png',
        'eventos' => 'icons/eventos.png',
        'musica' => 'icons/musica.png',
        'empregos' => 'icons/empregos.png',
        'coletas' => 'icons/coletas.png',
        'sobre' => 'icons/sobre.png',
        'feed' => 'icons/feed.png',
        'mercado-barra' => 'icons/mercado-barra.png',
        'postagem' => 'icons/postagem.png',
        'saberes-barra' => 'icons/saberes-barra.png',
        'etnia' => 'icons/etnia.png'
    );
    if (isset($pictures[$name])) {
        return '<img class="opy-icon opy-picture" src="' . Etnias_OpyEscape(Etnias_OpyAsset($pictures[$name])) . '" alt="" width="64" height="64" loading="lazy" decoding="async">';
    }
    $paths = array(
        'apps' => '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        'chat' => '<path d="M3 3h18v14H9l-6 4zM7 8h10M7 12h6"/>',
        'save' => '<path d="M6 3h12v19l-6-4-6 4z"/>',
        'smile' => '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M7 14a5 5 0 0 0 10 0"/>',
        'microphone' => '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
        'poll' => '<path d="M4 3v18h18M8 16V9M13 16V5M18 16v-4"/>',
        'file' => '<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6"/>',
        'video' => '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',
        'link' => '<path d="m9 15 6-6M7 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M17 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
        'home' => '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
        'menu' => '<path d="M4 6h16M4 12h16M4 18h16"/>',
        'book' => '<path d="M12 5v16M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
        'people' => '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6M19 14a6 6 0 0 1 3 5"/>',
        'group' => '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M3 7v6M0 10h6M21 7v6M18 10h6"/>',
        'flag' => '<path d="M5 22V3c6-4 8 4 14 0v11c-6 4-8-4-14 0"/>',
        'article' => '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
        'market' => '<path d="M4 8h16l1 13H3zM8 8V6a4 4 0 0 1 8 0v2"/>',
        'calendar' => '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M8 15h2M14 15h2"/>',
        'film' => '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
        'music' => '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
        'briefcase' => '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4"/>',
        'heart' => '<path d="M20 4c-3-2-6-1-8 2-2-3-5-4-8-2-7 5 2 12 8 17 6-5 15-12 8-17Z"/>',
        'info' => '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
        'intelligence' => '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
        'plus' => '<path d="M12 4v16M4 12h16"/>',
        'close' => '<path d="m6 6 12 12M18 6 6 18"/>',
        'search' => '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
        'leaf' => '<path d="M20 3C6 2 2 8 5 14s13 6 15-11ZM4 21 16 8"/>',
        'camera' => '<path d="M8 6 10 3h4l2 3h5v15H3V6z"/><circle cx="12" cy="13" r="4"/>',
        'games' => '<path d="M6 6h12l4 12c1 4-3 5-5 1l-2-3H9l-2 3c-2 4-6 3-5-1zM5 11h6M8 8v6M16 10v1M19 13v1"/>',
        'pin' => '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>',
        'arrow' => '<path d="M4 12h16m-6-6 6 6-6 6"/>',
        'chevron' => '<path d="m8 4 8 8-8 8"/>',
        'logout' => '<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'
    );
    return '<svg class="opy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . (isset($paths[$name]) ? $paths[$name] : $paths['info']) . '</svg>';
}
function Etnias_OpyItem($id, $item, $class = '') {
    global $wo;
    $active = $item['route'] !== '' && isset($wo['page']) && $wo['page'] === $item['route'];
    $attrs = ' class="opy-nav-item ' . Etnias_OpyEscape($class) . '" data-opy-destination="' . Etnias_OpyEscape($id) . '"';
    $content = Etnias_OpyIcon($item['icon']) . '<span>' . Etnias_OpyEscape($item['label']) . '</span>';
    if ($item['url'] !== '') {
        return '<a' . $attrs . ' href="' . Etnias_OpyEscape($item['url']) . '"' . ($active ? ' aria-current="page"' : '') . '>' . $content . '</a>';
    }
    $state = isset($item['state']) ? $item['state'] : 'Ainda não disponível';
    $mark = $state === 'Em breve' ? '<span class="opy-soon">Em breve</span>' : '<span class="opy-pending" aria-label="Ainda não disponível"></span>';
    return '<button type="button"' . $attrs . ' data-opy-info="' . Etnias_OpyEscape($item['label']) . '" data-opy-state="' . Etnias_OpyEscape($state) . '" data-opy-description="' . Etnias_OpyEscape($item['description']) . '">' . $content . $mark . '</button>';
}
function Etnias_OpyNavigation() {
    $items = Etnias_OpyItems();
    foreach ($items as $id => $item) {
        if (in_array($id, array('etnia', 'doar'), true)) { continue; }
        echo Etnias_OpyItem($id, $item);
    }
    echo '<div class="opy-support">' . Etnias_OpyItem('doar', $items['doar']) . '</div>';
}
