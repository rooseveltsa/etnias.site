<?php
// Run with PHP's local development server, bound to 127.0.0.1 only.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/' || $path === '/preview' || ($path === '/index.php' && isset($_GET['link1']) && in_array($_GET['link1'], array('home', 'saberes', 'guardiao', 'fotografos', 'musica', 'doar'), true))) {
    require __DIR__ . '/../tests/opy/preview.php';
    return true;
}
if (preg_match('#^/(themes/(sunshine|wowonder)/(stylesheet|img|fonts)/|assets/opy/)#', $path)
    && !preg_match('/\.(php|phtml)$/i', $path) && strpos($path, '..') === false) {
    return false;
}
http_response_code(404);
echo 'Prévia isolada. As rotas da aplicação precisam do ambiente completo.';
return true;
