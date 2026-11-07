#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/../deploy"
case "${1:-}" in
  restore)
    [[ -f "${2:-}" ]] || { echo 'Usage: recovery-database.sh restore /absolute/backup.sql' >&2; exit 1; }
    tables=$(docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"etnias\""')
    [[ "$tables" == '0' ]] || { echo 'Database is not empty; restoration refused. Use a separate recovery installation.' >&2; exit 1; }
    docker compose stop web
    docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot etnias' < "$2"
    echo 'Database restored. Web remains stopped: update site_url, disable old integrations and verify the data before starting it.'
    ;;
  backup)
    mkdir -p backups
    destination="backups/etnias-$(date -u +%Y%m%dT%H%M%SZ)-$$.sql.gz"
    docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb-dump -uroot --single-transaction --quick --routines --events --triggers etnias' | gzip > "$destination.partial"
    gzip -t "$destination.partial"
    mv "$destination.partial" "$destination"
    echo "Database backup verified: deploy/$destination"
    echo 'Back up the upload directory and private runtime settings separately.'
    ;;
  counts)
    docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot etnias -e "SELECT COUNT(*) AS users FROM Wo_Users; SELECT COUNT(*) AS posts FROM Wo_Posts; SELECT COUNT(*) AS messages FROM Wo_Messages; SELECT COUNT(*) AS bcrypt_passwords FROM Wo_Users WHERE CHAR_LENGTH(password)=60;"'
    ;;
  *) echo 'Usage: recovery-database.sh {restore /absolute/backup.sql|backup|counts}' >&2; exit 1 ;;
esac
