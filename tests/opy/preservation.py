#!/usr/bin/env python3
"""Compare the isolated original restore with the new recovery database, without printing personal data."""
import hashlib
import subprocess

def query(container, database, sql, audit=False):
    command = ['docker', 'exec', container]
    if audit:
        command += ['mariadb', '-uroot', '-popy-audit-only', '--batch', '--skip-column-names', database, '-e', sql]
    else:
        command += ['sh', '-c', 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --skip-column-names etnias -e "$1"', 'sh', sql]
    return subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout

original = ('etnias-backup-audit', 'etnias_restore', True)
recovery = ('etnias-recovery-db-1', 'etnias', False)
def run(target, sql):
    return query(target[0], target[1], sql, target[2])

tables = run(original, 'SHOW TABLES').decode().splitlines()
assert len(tables) == 139
assert tables == run(recovery, 'SHOW TABLES').decode().splitlines(), 'Missing or additional tables'
counts_sql = ' UNION ALL '.join(f"SELECT '{name}', COUNT(*) FROM `{name}`" for name in tables)
assert run(original, counts_sql) == run(recovery, counts_sql), 'Row counts changed'
identity_sql = 'SELECT user_id, HEX(username), HEX(email), HEX(password), active FROM Wo_Users ORDER BY user_id'
before = hashlib.sha256(run(original, identity_sql)).digest()
after = hashlib.sha256(run(recovery, identity_sql)).digest()
assert before == after, 'Account IDs, login names, emails, password hashes or activation states changed'
assert run(recovery, 'SELECT COUNT(*) FROM Wo_Users') == b'7418\n'
print('PASS preservação: 139 tabelas, contagens idênticas e 7.418 identidades/senhas/estados sem alteração')
