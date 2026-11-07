#!/usr/bin/env python3
"""Prepare a private, loopback-only recovery installation; never alter the source backup."""
import argparse
from pathlib import Path
import os
import re
import secrets
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--upload-directory', required=True, type=Path)
parser.add_argument('--site-url', default='http://127.0.0.1:8099')
parser.add_argument('--port', type=int, default=8099)
parser.add_argument('--fixture', action='store_true', help='Generate a test encryption key instead of preserving the original key')
parser.add_argument('--writable-uploads', action='store_true', help='Allow writes only to a separate working copy of uploads')
args = parser.parse_args()
if not 1024 <= args.port <= 65535:
    parser.error('Port must be between 1024 and 65535')
url = urlparse(args.site_url)
if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
    parser.error('Invalid site URL')
env_path = root / 'deploy/.env'
if env_path.exists():
    parser.error('deploy/.env already exists; refusing to replace credentials')
upload = args.upload_directory.expanduser().resolve()
if not upload.is_dir():
    parser.error('Upload directory must already exist')
source_upload = (root / 'public_html/upload').resolve()
if args.writable_uploads and (upload == source_upload or source_upload in upload.parents or upload in source_upload.parents):
    parser.error('Writable uploads must use a separate working copy, outside the original upload tree')
if args.fixture:
    key = secrets.token_hex(32)
else:
    config = (root / 'public_html/config.php').read_text()
    match = re.search(r'\$siteEncryptKey\s*=\s*([\'\"])([^\r\n]*?)\1\s*;', config)
    if not match or any(c in match[2] for c in "\"'\\$\n\r"):
        parser.error('Cannot safely preserve siteEncryptKey; configure it manually without changing its value')
    key = match[2]
values = {
    'ETNIAS_DB_PASSWORD': secrets.token_hex(32),
    'ETNIAS_DB_ROOT_PASSWORD': secrets.token_hex(32),
    'ETNIAS_ENCRYPTION_KEY': key,
    'ETNIAS_SITE_URL': args.site_url.rstrip('/'),
    'ETNIAS_HTTP_PORT': str(args.port),
    'ETNIAS_UPLOAD_DIRECTORY': str(upload),
    'ETNIAS_UPLOAD_MODE': 'rw' if args.writable_uploads else 'ro',
    'ETNIAS_OPY_ENABLED': '1',
}
if any(any(c in value for c in "\n\r'$\\") for value in values.values()):
    parser.error('Unsupported characters in runtime settings')
descriptor = os.open(env_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, 'w') as handle:
    handle.write('\n'.join(f"{name}='{value}'" for name, value in values.items()) + '\n')
htaccess = (root / 'public_html/.htaccess').read_text()
redirect = r'RewriteCond %\{HTTPS\} off\s*\nRewriteRule \(\.\*\) https://%\{HTTP_HOST\}%\{REQUEST_URI\} \[R,L\]'
htaccess, count = re.subn(redirect, '# HTTPS terminates at the reverse proxy; application remains bound to loopback.', htaccess, count=1)
if count != 1:
    env_path.unlink()
    parser.error('HTTPS rule differs from expected; runtime file was not generated')
htaccess = re.sub(r'^Redirect 301 /admin-sistema https://etnias\.site/admin-cp/general-settings\s*$', 'Redirect 301 /admin-sistema /admin-cp/general-settings', htaccess, flags=re.MULTILINE)
(root / 'deploy/runtime.htaccess').write_text(htaccess)
print('Prepared private runtime settings and original application routes. No database imported.')
