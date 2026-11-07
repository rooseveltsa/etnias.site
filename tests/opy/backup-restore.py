#!/usr/bin/env python3
"""Restore a recovery snapshot into a temporary database and compare every dumped data row."""
import gzip
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

container = 'etnias-recovery-db-1'
temporary_database = 'opy_proof_' + uuid.uuid4().hex
snapshot = Path(sys.argv[1]).resolve()
assert snapshot.is_file()

def execute(sql):
    return subprocess.run(['docker', 'exec', container, 'sh', '-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N -e "$1"', 'sh', sql],
        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

def fingerprint(database):
    process = subprocess.Popen(['docker', 'exec', container, 'sh', '-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb-dump -uroot --no-create-info --skip-comments --skip-extended-insert --skip-add-locks --skip-lock-tables --skip-triggers --compact --order-by-primary "$1"', 'sh', database],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    digest = hashlib.sha256()
    while chunk := process.stdout.read(1024 * 1024):
        digest.update(chunk)
    assert process.wait() == 0, 'Cannot fingerprint restored data'
    return digest.digest()

execute(f'CREATE DATABASE `{temporary_database}` CHARACTER SET utf8mb4')
try:
    process = subprocess.Popen(['docker', 'exec', '-i', container, 'sh', '-c',
        'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot "$1"', 'sh', temporary_database],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with gzip.open(snapshot, 'rb') as source:
        shutil.copyfileobj(source, process.stdin)
    process.stdin.close()
    assert process.wait() == 0, 'Snapshot restoration failed'
    assert fingerprint('etnias') == fingerprint(temporary_database), 'Restored row content differs'
finally:
    execute(f'DROP DATABASE `{temporary_database}`')
print('PASS backup: snapshot restaurado em base temporária; conteúdo exportado de todas as tabelas idêntico; base temporária removida')
