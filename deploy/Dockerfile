FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev libfreetype6-dev libjpeg62-turbo-dev libpng-dev libonig-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 mysqli pdo_mysql mbstring gd zip exif curl opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*
COPY apache.conf /etc/apache2/conf-enabled/etnias.conf
COPY php.ini /usr/local/etc/php/conf.d/etnias.ini
COPY entrypoint.sh /usr/local/bin/etnias-entrypoint
RUN chmod 755 /usr/local/bin/etnias-entrypoint
ENTRYPOINT ["etnias-entrypoint"]
CMD ["apache2-foreground"]
