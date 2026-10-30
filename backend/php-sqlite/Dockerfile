FROM php:8.3-cli

# pdo_sqlite is built into the official image; fail the build if it is ever missing.
RUN php -m | grep -q pdo_sqlite

WORKDIR /app
COPY . .
RUN chown -R www-data:www-data /app/database

USER www-data
EXPOSE 8005

# Create the database and table if needed, then serve every request through public/index.php.
CMD ["sh", "-c", "php bin/init-db.php && exec php -S 0.0.0.0:8005 -t public public/index.php"]
