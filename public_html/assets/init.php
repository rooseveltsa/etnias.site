<?php
// Garante buffer de saida no boot. Sem isso, qualquer byte enviado antes de um
// header() (ex.: quebras de linha depois da tag de fechamento em arquivos
// incluidos) causa "headers already sent" e quebra os redirects, resultando em
// tela branca. No servidor antigo o output_buffering do PHP estava ligado e
// mascarava o problema.
if (function_exists('ob_get_level') && ob_get_level() === 0) {
    ob_start();
}
@ini_set('session.cookie_httponly',1);
@ini_set('session.use_only_cookies',1);
if (!version_compare(PHP_VERSION, '7.1.0', '>=')) {
    exit("Required PHP_VERSION >= 7.1.0 , Your PHP_VERSION is : " . PHP_VERSION . "\n");
}
if (!function_exists("mysqli_connect")) {
    exit("MySQLi is required to run the application, please contact your hosting to enable php mysqli.");
}
date_default_timezone_set('UTC');
session_start();
@ini_set('gd.jpeg_ignore_warning', 1);
require_once('assets/libraries/DB/vendor/joshcam/mysqli-database-class/MySQL-Maria.php');
require_once('includes/cache.php');
require_once('includes/functions_general.php');
require_once('includes/tabels.php');
require_once('includes/functions_one.php');
require_once('includes/functions_two.php');
require_once('includes/functions_three.php');
