<?php
// Runtime credentials live outside public_html. Never copy the former server credentials.
function etniasRequiredEnvironment($name) {
    $value = getenv($name);
    if ($value === false || $value === '') throw new RuntimeException('Missing runtime setting: ' . $name);
    return $value;
}
$sql_db_host = 'db';
$sql_db_user = 'etnias';
$sql_db_pass = etniasRequiredEnvironment('ETNIAS_DB_PASSWORD');
$sql_db_name = 'etnias';
$site_url = etniasRequiredEnvironment('ETNIAS_SITE_URL');
$siteEncryptKey = etniasRequiredEnvironment('ETNIAS_ENCRYPTION_KEY');
$purchase_code = getenv('ETNIAS_PURCHASE_CODE') ?: '';
$auto_redirect = false;
