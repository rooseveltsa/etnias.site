<?php
/**
 * DIAGNÓSTICO TEMPORÁRIO - etnias.site
 * Suba este arquivo para a raiz do site e acesse: https://etnias.site/_diag.php
 * APAGUE este arquivo depois de resolver (ele expõe informações do servidor).
 */

// 1) Forçar exibição de TODOS os erros
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

header('Content-Type: text/html; charset=utf-8');
echo "<pre style='font:14px monospace;line-height:1.5'>";

echo "==== 1. VERSAO DO PHP ====\n";
echo "PHP: " . PHP_VERSION . "  (SAPI: " . PHP_SAPI . ")\n\n";

echo "==== 2. EXTENSOES NECESSARIAS ====\n";
$req = ['mysqli','curl','gd','zip','openssl','mbstring','json','fileinfo','xml','bcmath','intl','exif'];
foreach ($req as $ext) {
    printf("  %-12s : %s\n", $ext, extension_loaded($ext) ? "OK" : "*** FALTANDO ***");
}
echo "\n";

echo "==== 3. CONFIGURACOES PHP RELEVANTES ====\n";
foreach (['memory_limit','max_execution_time','post_max_size','upload_max_filesize','allow_url_fopen','session.save_path'] as $k) {
    echo "  $k = " . ini_get($k) . "\n";
}
echo "\n";

echo "==== 4. ARQUIVOS/PASTAS ESSENCIAIS ====\n";
foreach (['config.php','assets/init.php','assets/includes/app_start.php','assets/libraries/DB/vendor/autoload.php'] as $f) {
    echo "  " . ($f) . " : " . (file_exists($f) ? "existe" : "*** NAO EXISTE ***") . "\n";
}
echo "  upload/ gravavel : " . (is_writable('upload') ? "sim" : "NAO/ausente") . "\n\n";

echo "==== 5. TESTE DE CONEXAO COM O BANCO ====\n";
if (file_exists('config.php')) {
    // Lê as variáveis do config sem executar o resto do sistema
    include 'config.php';
    echo "  host=$sql_db_host  db=$sql_db_name  user=$sql_db_user\n";
    mysqli_report(MYSQLI_REPORT_OFF); // não lançar exceção, queremos ver a msg
    $c = @mysqli_connect($sql_db_host, $sql_db_user, $sql_db_pass, $sql_db_name, 3306);
    if (!$c) {
        echo "  *** FALHA: " . mysqli_connect_error() . "\n";
    } else {
        echo "  CONEXAO OK. Server: " . mysqli_get_server_info($c) . "\n";
        $r = mysqli_query($c, "SELECT COUNT(*) AS n FROM Wo_Config");
        if ($r) { $row = mysqli_fetch_assoc($r); echo "  Wo_Config linhas: " . $row['n'] . "\n"; }
        else    { echo "  *** Erro lendo Wo_Config: " . mysqli_error($c) . "\n"; }
    }
}
echo "\n";

echo "==== 6. INICIALIZANDO O SISTEMA (init + app_start) ====\n";
chdir(__DIR__);

// Shutdown handler: captura erro fatal mesmo com display_errors=0
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
        echo "\n>>>>>>>>>> ERRO FATAL CAPTURADO <<<<<<<<<<\n";
        echo "Mensagem: " . $e['message'] . "\n";
        echo "Arquivo:  " . $e['file'] . " (linha " . $e['line'] . ")\n";
    }
    echo "</pre>";
});

// Carrega SÓ a inicialização (não o roteador de páginas), para inspecionar o tema.
require_once('assets/init.php');
decryptConfigData();

// Reforça exibicao de erros (init/app_start desligaram)
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "  loggedin           : " . var_export($wo['loggedin'], true) . "\n";
echo "  theme (config)     : " . var_export($wo['config']['theme'], true) . "\n";
echo "  theme_url          : " . var_export($wo['config']['theme'], true) . "\n";
echo "  directory_landing  : " . var_export($wo['config']['directory_landing_page'] ?? '(indefinido)', true) . "\n";
echo "  maintenance_mode   : " . var_export($wo['config']['maintenance_mode'] ?? '?', true) . "\n";
echo "  membership_system  : " . var_export($wo['config']['membership_system'] ?? '?', true) . "\n\n";

echo "==== 7. ARQUIVOS DO TEMA ====\n";
$theme = $wo['config']['theme'];
$themeDir  = "./themes/$theme";
$container = "$themeDir/layout/container.phtml";
$welcome   = "$themeDir/layout/welcome.phtml";
echo "  pasta do tema      : $themeDir  -> " . (is_dir($themeDir) ? "existe" : "*** NAO EXISTE ***") . "\n";
echo "  container.phtml    : " . (file_exists($container) ? "existe" : "*** NAO EXISTE ***") . "\n";
echo "  welcome.phtml      : " . (file_exists($welcome) ? "existe" : "(nao existe)") . "\n\n";

echo "==== 8. REPRODUZINDO O FLUXO REAL DA PAGINA 'welcome' ====\n";
echo "  (Se houver Fatal error, o handler no fim mostra o arquivo/linha exatos)\n\n";

// Replica o que sources/welcome.php faz:
$wo['description'] = $wo['config']['siteDesc'] ?? '';
$wo['keywords']    = $wo['config']['siteKeywords'] ?? '';
$wo['page']        = 'welcome';
$wo['title']       = $wo['config']['siteTitle'] ?? '';

echo "  -> Renderizando welcome/content ...\n";
$content = '';
try {
    $content = Wo_LoadPage('welcome/content');
    echo "     welcome/content OK: " . strlen($content) . " bytes\n";
} catch (Throwable $t) {
    echo "     *** EXCECAO em welcome/content: " . $t->getMessage() . "\n";
    echo "         " . $t->getFile() . ":" . $t->getLine() . "\n";
}
$wo['content'] = $content;

echo "  -> Renderizando container (com page=welcome) ...\n";
$html = '';
try {
    $html = Wo_LoadPage('container');
    echo "     container OK: " . strlen($html) . " bytes\n";
} catch (Throwable $t) {
    echo "     *** EXCECAO em container: " . $t->getMessage() . "\n";
    echo "         " . $t->getFile() . ":" . $t->getLine() . "\n";
}
echo "\n  Se ambos mostraram 'OK' com bytes > 0, o problema NAO esta no render.\n";
echo "</pre>";
