<?php
// Redirecionamento melhorado - SEM WWW (para coincidir com .htaccess)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'https://';
$host = $_SERVER['HTTP_HOST'];

// Remove WWW se tiver (para coincidir com .htaccess)
if (preg_match('/^www\./', $host)) {
    $host = str_replace('www.', '', $host);
}

$current_url = $_SERVER['REQUEST_URI'];
$redirect_url = $protocol . $host . str_replace('admin-panel', 'admin-cp', $current_url);

// Redireciona apenas se necessário
if (strpos($current_url, 'admin-panel') !== false) {
    header("Location: $redirect_url", true, 301);
    exit();
}
?>