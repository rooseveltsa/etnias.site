import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

source = Path(__file__).resolve().parents[2] / 'scripts/prepare-recovery.py'

class PreparationSafety(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        for name in ['scripts', 'deploy', 'public_html/upload', 'working-upload']:
            (self.root / name).mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, self.root / 'scripts/prepare-recovery.py')
        (self.root / 'public_html/config.php').write_text("<?php $siteEncryptKey = 'original-test-key';")
        (self.root / 'public_html/.htaccess').write_text('RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI} [R,L]\nRewriteRule ^groups$ index.php?link1=groups [QSA]\nRedirect 301 /admin-sistema https://etnias.site/admin-cp/general-settings\n')

    def tearDown(self):
        self.directory.cleanup()

    def prepare(self, upload, *options):
        return subprocess.run(['python3', str(self.root / 'scripts/prepare-recovery.py'), '--upload-directory', str(upload), *options], capture_output=True, text=True)

    def test_preserves_key_routes_and_readonly_source(self):
        result = self.prepare(self.root / 'public_html/upload')
        self.assertEqual(result.returncode, 0, result.stderr)
        settings = self.root / 'deploy/.env'
        self.assertIn("ETNIAS_ENCRYPTION_KEY='original-test-key'", settings.read_text())
        self.assertIn("ETNIAS_UPLOAD_MODE='ro'", settings.read_text())
        self.assertEqual(os.stat(settings).st_mode & 0o777, 0o600)
        routes = (self.root / 'deploy/runtime.htaccess').read_text()
        self.assertIn('RewriteRule ^groups$', routes)
        self.assertNotIn('https://etnias.site', routes)
        self.assertIn('Redirect 301 /admin-sistema /admin-cp/general-settings', routes)
        self.assertNotEqual(self.prepare(self.root / 'working-upload').returncode, 0)

    def test_rejects_writable_original_and_symlink(self):
        original = self.root / 'public_html/upload'
        link = self.root / 'upload-link'
        link.symlink_to(original, target_is_directory=True)
        for candidate in [original, link, original.parent]:
            result = self.prepare(candidate, '--writable-uploads')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('separate working copy', result.stderr)
            self.assertFalse((self.root / 'deploy/.env').exists())

    def test_accepts_separate_writable_working_copy(self):
        result = self.prepare(self.root / 'working-upload', '--writable-uploads', '--fixture')
        self.assertEqual(result.returncode, 0, result.stderr)
        settings = (self.root / 'deploy/.env').read_text()
        self.assertIn("ETNIAS_UPLOAD_MODE='rw'", settings)
        self.assertNotIn('original-test-key', settings)

if __name__ == '__main__':
    unittest.main()
