<?php
// Deliberate allowlist: no production initializer, SQL, credentials, vendor code or uploaded user media.
$root = dirname(__DIR__);
$project = $root . '/preview/dist';
$destination = $project . '/public';
$paths = array('home'=>'','entrar'=>'entrar','etnia'=>'etnia','iara'=>'iara','search'=>'search','suggested-groups'=>'grupos','suggested-pages'=>'paginas','blogs'=>'blogs','products'=>'mercado','events'=>'eventos','movies'=>'filmes','jobs'=>'empregos','funding'=>'coletas','terms'=>'sobre','messages'=>'chat','notifications'=>'notificacoes','account'=>'conta','profile'=>'perfil','admin'=>'admin','help'=>'sobre-a-previa','saved-posts'=>'salvos','albums'=>'albuns','memories'=>'recordacoes','joined_groups'=>'meus-grupos','liked-pages'=>'minhas-paginas','setting'=>'configuracoes','saberes'=>'saberes','guardiao'=>'guardiao','fotografos'=>'fotografos','musica'=>'musica','doar'=>'doar');
if (!is_dir($destination)) mkdir($destination, 0755, true);
function previewRewriteLink($match) {
    global $paths;
    $url = html_entity_decode($match[2], ENT_QUOTES, 'UTF-8');
    if (strpos($url, '/index.php?') !== 0) return $match[0];
    $parts = parse_url($url); parse_str($parts['query'], $params);
    if (!isset($params['link1'], $paths[$params['link1']])) throw new RuntimeException('Unmapped preview link');
    $path = '/' . $paths[$params['link1']];
    if ($path !== '/') $path .= '/';
    if (isset($params['query'])) $path .= '?query=' . rawurlencode($params['query']);
    if (isset($parts['fragment'])) $path .= '#' . $parts['fragment'];
    return $match[1] . '="' . htmlspecialchars($path, ENT_QUOTES, 'UTF-8') . '"';
}
foreach ($paths as $route => $path) {
    ob_start(); require $root . '/preview/page.php'; $html = ob_get_clean();
    $html = preg_replace_callback('/(href)="([^"]*)"/', 'previewRewriteLink', $html);
    $html = str_replace('action="/index.php"', 'action="/search/"', $html);
    $folder = $destination . ($path === '' ? '' : '/' . $path);
    if (!is_dir($folder)) mkdir($folder, 0755, true);
    file_put_contents($folder . '/index.html', $html);
}
foreach (array('opy.css','opy.js','etnias-logo.png','apple-touch-icon.png','icon-192.png','icon-512.png') as $file) {
    $folder = $destination . '/assets/opy'; if (!is_dir($folder)) mkdir($folder, 0755, true);
    copy($root . '/public_html/assets/opy/' . $file, $folder . '/' . $file);
}
$iconDest = $destination . '/assets/opy/icons';
if (!is_dir($iconDest)) mkdir($iconDest, 0755, true);
foreach (glob($root . '/public_html/assets/opy/icons/*.png') as $file) {
    $base = basename($file);
    if (strpos($base, 'cluster-') === 0) continue;
    copy($file, $iconDest . '/' . $base);
}
foreach (array('preview.css','preview.js','chat.js','calls.js','live.js','admin.js','admin.css','i18n.js','emojis.json') as $file) copy($root . '/preview/' . $file, $destination . '/assets/' . $file);
$folder = $destination . '/assets/i18n'; if (!is_dir($folder)) mkdir($folder, 0755, true);
foreach (glob($root . '/preview/i18n/*.json') as $file) if (basename($file) !== 'source.json') copy($file, $folder . '/' . basename($file));
$folder = $destination . '/assets/fonts'; if (!is_dir($folder)) mkdir($folder, 0755, true);
foreach (array('krub-400.ttf','krub-600.ttf') as $font) {
    if (!is_file($root . '/preview/fonts/' . $font)) throw new RuntimeException('Missing bundled font');
    copy($root . '/preview/fonts/' . $font, $folder . '/' . $font);
}
copy($root . '/preview/fonts/OFL.txt', $folder . '/OFL.txt');
file_put_contents($destination . '/robots.txt', "User-agent: *\nDisallow: /\n");
copy($root . '/preview/manifest.webmanifest', $destination . '/manifest.webmanifest');
copy($root . '/preview/sw.js', $destination . '/sw.js');
$config = array('framework'=>null,'outputDirectory'=>'public','buildCommand'=>null,'installCommand'=>'npm ci --ignore-scripts','regions'=>array('iad1'),'functions'=>array('api/*.js'=>array('maxDuration'=>30)),'cleanUrls'=>true,'trailingSlash'=>true,'headers'=>array(
    array('source'=>'/manifest.webmanifest','headers'=>array(array('key'=>'Content-Type','value'=>'application/manifest+json'),array('key'=>'X-Robots-Tag','value'=>'noindex, nofollow'))),
    array('source'=>'/(.*)','headers'=>array(array('key'=>'X-Robots-Tag','value'=>'noindex, nofollow'),array('key'=>'X-Content-Type-Options','value'=>'nosniff'),array('key'=>'Referrer-Policy','value'=>'strict-origin-when-cross-origin'),array('key'=>'Content-Security-Policy','value'=>"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'")))
));
file_put_contents($project . '/vercel.json', json_encode($config, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES) . "\n");
file_put_contents($project . '/.vercelignore', ".vercel\n.env*\n.git*\n*.log\nnode_modules\n");
echo 'Exported ' . count($paths) . " static preview pages. No database or private media included.\n";

foreach (array('server','api','i18n') as $dir) { if (!is_dir($project.'/'.$dir)) mkdir($project.'/'.$dir,0755,true); foreach (glob($root.'/preview/'.$dir.'/*') as $file) copy($file,$project.'/'.$dir.'/'.basename($file)); }
foreach (array('package.json','package-lock.json','public-posts.json') as $file) copy($root.'/preview/'.$file,$project.'/'.$file);
if (!is_file($root.'/preview/middleware.js')) throw new RuntimeException('Missing preview/middleware.js welcome gate');
copy($root.'/preview/middleware.js', $project.'/middleware.js');
$archive=$destination.'/assets/archive'; if (!is_dir($archive)) mkdir($archive,0755,true); foreach(glob($root.'/preview/archive/*') as $file) copy($file,$archive.'/'.basename($file));
