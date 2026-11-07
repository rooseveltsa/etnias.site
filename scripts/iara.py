#!/usr/bin/env python3
"""Install and run the verified IAra kit in a project-owned, isolated directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

PROJECT = Path(__file__).resolve().parents[1]
KIT = PROJECT / 'iara' / 'kit'
DEFAULT_ROOT = PROJECT / 'iara' / 'local'
CHECKSUMS_HASH = '58e2f38a8b460f8142e438e3088c2bec23e08ced154c0f3ec04482cb189a66c0'


def verify():
    if hashlib.sha256((KIT / 'CHECKSUMS').read_bytes()).hexdigest() != CHECKSUMS_HASH:
        raise ValueError('O manifesto de checksums difere do kit verificado')
    listed = set()
    for line in (KIT / 'CHECKSUMS').read_text().splitlines():
        digest, name = line.split(None, 1)
        name = name.lstrip('*')
        original = KIT / name
        path = original.resolve()
        if KIT.resolve() not in path.parents or not path.is_file() or original.is_symlink() or any(parent.is_symlink() for parent in original.parents if parent != KIT):
            raise ValueError('Caminho invalido no kit: ' + name)
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('Checksum divergente: ' + name)
        listed.add(name)
    actual = {str(path.relative_to(KIT)) for path in KIT.rglob('*') if path.is_file()}
    if actual != listed | {'CHECKSUMS'}:
        raise ValueError('Arquivos inesperados ou ausentes no kit')
    return len(listed)


def install(root):
    count = verify()
    marker = root / 'iara-install.json'
    if root.exists() and any(root.iterdir()) and not marker.exists():
        raise ValueError('Destino ocupado sem identificacao IAra; nada foi sobrescrito')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    # Mark before copying so an interrupted installation can be resumed.
    marker.write_text(json.dumps({'kit': 'etnias-iara-v1.0', 'files_verified': count}) + '\n')
    for category in ('skills-base', 'skills'):
        for skill in (KIT / category).iterdir():
            if category == 'skills-base' and (KIT / 'skills' / skill.name).exists():
                continue
            shutil.copytree(skill, root / 'skills' / skill.name, dirs_exist_ok=True)
    subprocess.run(['patch', '--batch', '-p1', '-i', str(PROJECT / 'iara/patches/hardening.patch')], cwd=root, check=True, stdout=subprocess.DEVNULL)
    for source, destination in [('scripts', 'scripts'), ('assets', 'assets'), ('design-kit', 'profiles/iara/design-kit/etnias')]:
        shutil.copytree(KIT / source, root / destination, dirs_exist_ok=True)
    data = root / 'iara-data'
    data.mkdir(exist_ok=True, mode=0o700)
    for source in (KIT / 'data').rglob('*'):
        destination = data / source.relative_to(KIT / 'data')
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        elif not destination.exists():
            shutil.copyfile(source, destination)
            destination.chmod(0o600)
    config = data / 'config.json'
    cfg = json.loads(config.read_text())
    cfg.setdefault('pending_platforms', ['facebook', 'tiktok', 'youtube'])
    config.write_text(json.dumps(cfg, indent=2) + '\n')
    config.chmod(0o600)
    profile_skills = root / 'profiles/iara/skills'
    profile_skills.mkdir(parents=True, exist_ok=True)
    for skill in (KIT / 'skills').iterdir():
        link = profile_skills / skill.name
        if not link.exists():
            link.symlink_to(Path('../../../skills') / skill.name, target_is_directory=True)
    (root / 'credentials').mkdir(exist_ok=True, mode=0o700)
    (root / 'credentials').chmod(0o700)
    shutil.copyfile(PROJECT / 'iara/profile-instructions.md', root / 'AGENTS.md')
    # The upstream scripts hard-code ~/.hermes. Bind their paths to this installation.
    for folder in ('skills', 'scripts'):
        for path in (root / folder).rglob('*'):
            if path.suffix in ('.py', '.md', '.sh', '.js'):
                content = path.read_text()
                for old, new in [
                    ('~/.hermes', str(root)),
                    ('/home/anaobranca/.hermes', str(root)),
                    ('iara-triagem-setorial', 'iara-triagem'),
                    ('iara-referencia-por-caminho', 'iara-referencia'),
                    ('~/Hermes/Agente-do-Caos/artes/etnias-design-oficial-2026-11', str(root / 'profiles/iara/design-kit/etnias')),
                    ('/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-kit-2026-11', str(root / 'generated/design')),
                    ('/home/anaobranca/Hermes/Agente-do-Caos/artes/etnias-opy-2026-11', str(root / 'profiles/iara/design-kit/etnias/carrossel-opy')),
                    ('/home/anaobranca/.fonts/ArchivoBlack-Regular.ttf', str(root / 'fonts/ArchivoBlack-Regular.ttf')),
                    ('Path.home() / ".hermes/assets"', 'Path(' + repr(str(root / 'assets')) + ')'),
                ]:
                    content = content.replace(old, new)
                path.write_text(content)
    return {'installed': True, 'root': str(root), 'iara_skills': 19, 'production_skills': 7, 'storage': cfg['storage']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('verify')
    sub.add_parser('install')
    run = sub.add_parser('run')
    run.add_argument('skill')
    run.add_argument('script')
    run.add_argument('arguments', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.command == 'verify':
        print(json.dumps({'verified': verify()}))
    elif args.command == 'install':
        print(json.dumps(install(root)))
    else:
        if not (root / 'iara-install.json').exists():
            parser.error('Execute install antes de run')
        if args.skill not in {path.name for path in (root / 'skills').iterdir()} or Path(args.script).name != args.script or not args.script.endswith('.py'):
            parser.error('Skill ou script invalido')
        script = root / 'skills' / args.skill / 'scripts' / args.script
        if not script.is_file():
            parser.error('Script nao encontrado na skill')
        return subprocess.run([sys.executable, str(script), *args.arguments], env={**os.environ, 'HERMES_HOME': str(root), 'PYTHONDONTWRITEBYTECODE': '1'}).returncode
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(json.dumps({'ok': False, 'error': str(error)}), file=sys.stderr)
        sys.exit(1)
