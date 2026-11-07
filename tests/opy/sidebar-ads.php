<?php
// Run only inside the isolated integration container, whose database is synthetic.
if (getenv('OPY_TEST_DATABASE') !== 'synthetic') {
    fwrite(STDERR, "Set OPY_TEST_DATABASE=synthetic in the local test container.\n");
    exit(1);
}
require '/var/www/html/config.php';
$sqlConnect = new mysqli($sql_db_host, $sql_db_user, $sql_db_pass, $sql_db_name);
define('T_USER_ADS', 'Wo_UserAds');
define('T_USERS', 'Wo_Users');
require '/var/www/html/assets/includes/functions_three.php';
set_error_handler(function ($severity, $message) { throw new ErrorException($message, 0, $severity); });
$wo = array('loggedin' => true, 'user' => array('gender' => 'male', 'user_id' => 1, 'country_id' => 1));
foreach (array(null, array(), array('ads' => null), array('ads' => array()), array('ads' => array(123)), array('ads' => array('not-an-id'))) as $tracking) {
    unset($wo['ad-con']);
    if ($tracking !== null) $wo['ad-con'] = $tracking;
    if (!is_array(Wo_GetSideBarAds())) throw new RuntimeException('Sidebar must load without prior advertising cookie');
}
$wo['loggedin'] = false;
if (Wo_GetSideBarAds() !== false) throw new RuntimeException('Anonymous behavior changed');
echo "PASS anúncios: feed sem cookie, cookie vazio, anúncios anteriores e visitante\n";
