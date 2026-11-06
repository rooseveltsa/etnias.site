#!/bin/sh
set -eu
# Compose mounts a dedicated writable cache volume over the read-only source tree.
mkdir -p /var/www/html/cache
chown www-data:www-data /var/www/html/cache
exec docker-php-entrypoint "$@"
