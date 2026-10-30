<?php

declare(strict_types=1);

// Creates the SQLite database file and the health_records table. Safe to run repeatedly.
// Usage: php bin/init-db.php

require __DIR__ . '/../src/bootstrap.php';

$db = Database::fromEnv();

try {
    $db->initialize();
    $db->ping();
} catch (Throwable $e) {
    fwrite(STDERR, 'Database initialization failed: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

echo 'Database ready: ' . $db->path() . ' (' . $db->countRecords() . ' health_records)' . PHP_EOL;
