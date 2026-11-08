<?php
// Run from the project root: php tests/opy/navigation.php
$failures = 0;
function check($condition, $message) {
    global $failures;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . PHP_EOL;
    if (!$condition) { $failures++; }
}
$bootstrap = __DIR__ . '/../../public_html/assets/opy/bootstrap.php';
if (!is_file($bootstrap)) {
    check(false, 'A navegação compartilhada Opy está disponível');
    exit(1);
}
require $bootstrap;
$wo = array('loggedin' => true, 'page' => 'home', 'user' => array('banned' => 0), 'config' => array('site_url' => 'https://etnias.example/rede', 'website_mode' => 'facebook'));
check(Etnias_OpyEnabled(), 'Opy habilitado para membro autenticado');
$wo['loggedin'] = false;
check(!Etnias_OpyEnabled(), 'Visitante preserva experiência anterior');
$wo['loggedin'] = true;
$wo['user']['banned'] = 1;
check(!Etnias_OpyEnabled(), 'Pessoa bloqueada não ganha nova navegação');
$wo['user']['banned'] = 0;
putenv('ETNIAS_OPY_ENABLED=0');
check(!Etnias_OpyEnabled(), 'Desativação por ambiente funciona');
putenv('ETNIAS_OPY_ENABLED');
check(Etnias_OpySafeUrl('javascript:alert(1)') === '', 'Rejeita URL executável');
check(Etnias_OpySafeUrl('//another.example') === '', 'Rejeita URL sem protocolo explícito');
check(Etnias_OpySafeUrl('https://saberes.example/cursos') !== '', 'Aceita URL HTTPS configurada');
check(strpos(Etnias_OpyUrl('search', array('query' => 'povos & saberes')),'query=povos%20%26%20saberes') !== false, 'Codifica pesquisa com espaço e &');
check(strpos(Etnias_OpyUrl('home'), 'https://etnias.example/rede/') === 0, 'Respeita instalação em subdiretório');
$items = Etnias_OpyItems();
check($items['mercado']['url'] === '', 'Mercado desativado não ganha destino');
$wo['config']['classified'] = 1;
$items = Etnias_OpyItems();
check(strpos($items['mercado']['url'], 'link1=products') !== false, 'Mercado habilitado usa rota existente');
check(strpos($items['saberes']['url'], 'link1=saberes') !== false && strpos($items['musica']['url'], 'link1=musica') !== false && strpos($items['doar']['url'], 'link1=doar') !== false, 'Módulos Opy habilitados apontam para suas rotas de homologação');
check($items['etnia']['url'] === '', 'EtnIA permanece indisponível até base autorizada');
$wo['config']['opy_modules'] = 0;
$disabledModules = Etnias_OpyItems();
check($disabledModules['saberes']['url'] === '' && $disabledModules['musica']['url'] === '' && $disabledModules['doar']['url'] === '', 'Desativar opy_modules restaura estado pendente');
unset($wo['config']['opy_modules']);
$wo['config']['movies'] = 1;
$wo['config']['can_use_movies'] = 0;
$items = Etnias_OpyItems();
check($items['filmes']['url'] === '', 'Filmes respeita a permissão da conta');
$wo['config']['groups'] = 1;
$wo['config']['pages'] = 1;
$wo['config']['can_use_groups'] = 0;
$wo['config']['can_use_pages'] = 0;
ob_start();
require __DIR__ . '/../../public_html/assets/opy/views/sidebar.php';
$sidebar = ob_get_clean();
// Decisão de 2026-11-08: grupos, páginas e configurações saíram da lateral e vivem no menu da foto do perfil (cabeçalho).
check(strpos($sidebar, 'opy-personal') === false, 'A lateral não traz mais o bloco "Meus recursos"');
check(strpos($sidebar, 'link1=setting') === false, 'Configurações não fica mais na lateral');
check(Etnias_OpyEscape('<script>"&') === '&lt;script&gt;&quot;&amp;', 'Escapa texto e atributos');
exit($failures ? 1 : 0);
