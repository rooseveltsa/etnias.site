<?php
// Runs only the request dispatch authentication gate, without application bootstrap or database.
$source = file_get_contents(__DIR__.'/../../public_html/requests.php');
$start = strpos($source, 'if (!in_array($f, $non_login_array))');
$end = strpos($source, "if (\$wo['loggedin'] &&", $start);
if ($start === false || $end === false) throw new RuntimeException('Gate não encontrado');
$gate = substr($source, $start, $end-$start);
if (isset($argv[1])) {
    $f=$argv[1]; $s=$argv[2]; $wo=['loggedin'=>$argv[3]==='yes']; $non_login_array=['login','register'];
    eval($gate); echo 'ALLOWED'; exit;
}
$cases=[['answer_call','load_more_posts','no',false],['decline_call','filter_posts','no',false],['upload_image','load-comments','no',false],['posts','load_more_posts','no',true],['posts','filter_posts','no',true],['watch','load_more_posts','no',true],['login','','no',true],['answer_call','','yes',true],['posts','insert_new_post','no',false]];
foreach($cases as [$f,$s,$logged,$allowed]) {
    $out=shell_exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg(__FILE__).' '.escapeshellarg($f).' '.escapeshellarg($s).' '.escapeshellarg($logged));
    if (($out==='ALLOWED')!==$allowed) throw new RuntimeException("Falha de autorização: $f / $s");
}
echo "PASS gate PHP: mutações anônimas rejeitadas, leituras públicas e login preservados.\n";
