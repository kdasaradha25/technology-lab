<?php

declare(strict_types=1);

/*
 * Dependency-free tests (no Composer/PHPUnit needed).
 * Usage: php tests/run-tests.php
 *
 * Every test uses its own temporary database file, so the real database is never touched.
 */

require __DIR__ . '/../src/bootstrap.php';

$failures = 0;
$passed = 0;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function test(string $name, callable $fn): void
{
    global $failures, $passed;
    try {
        $fn();
        $passed++;
        echo "  PASS  $name\n";
    } catch (Throwable $e) {
        $failures++;
        echo "  FAIL  $name\n        " . $e->getMessage() . "\n";
    }
}

function temp_db_path(): string
{
    $dir = sys_get_temp_dir() . '/php-sqlite-tests-' . bin2hex(random_bytes(4));
    return $dir . '/test.sqlite';
}

function controller_for(string $path): HealthController
{
    return new HealthController(static fn (): Database => new Database($path, 1));
}

function initialized_db(): Database
{
    $db = new Database(temp_db_path(), 1);
    $db->initialize();
    return $db;
}

// Health-check failures are logged on purpose in some tests; keep test output readable.
ini_set('error_log', sys_get_temp_dir() . '/php-sqlite-tests.log');

echo "Database\n";

test('initialize creates the directory, file and table', function () {
    $path = temp_db_path();
    check(!file_exists($path), 'file should not exist yet');
    (new Database($path, 1))->initialize();
    check(is_file($path), 'database file was not created');

    $pdo = new PDO('sqlite:' . $path);
    $table = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'health_records'")->fetchColumn();
    check($table === 'health_records', 'health_records table missing');
});

test('initialize is idempotent and keeps data', function () {
    $db = initialized_db();
    $db->insertRecord();
    $db->initialize();
    check($db->countRecords() === 1, 'record lost after re-initialize');
});

test('insert and retrieve a health record', function () {
    $db = initialized_db();
    $first = $db->insertRecord();
    $second = $db->insertRecord();

    check($first['id'] >= 1, 'id should be positive');
    check($second['id'] === $first['id'] + 1, 'id should auto-increment');
    check((bool) preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/', $first['created_at']), 'created_at format: ' . $first['created_at']);

    $found = $db->findRecord($first['id']);
    check($found === $first, 'retrieved record differs from inserted one');

    $db->deleteRecord($first['id']);
    check($db->findRecord($first['id']) === null, 'record still present after delete');
});

test('connecting to a missing file does not create it', function () {
    $path = temp_db_path();
    @mkdir(dirname($path), 0775, true);
    $threw = false;
    try {
        (new Database($path, 1))->ping();
    } catch (PDOException) {
        $threw = true;
    }
    check($threw, 'ping should fail for a missing file');
    check(!file_exists($path), 'ping must not create the database file');
});

echo "\nEndpoints\n";

test('GET /health is healthy even without a database', function () {
    $called = false;
    $controller = new HealthController(static function () use (&$called): Database {
        $called = true;
        throw new RuntimeException('should not be called');
    });
    [$status, $body] = $controller->health();
    check($status === 200, "status $status");
    check($body === ['status' => 'healthy', 'service' => 'php-sqlite-api'], json_encode($body));
    check(!$called, '/health must not touch the database');
});

test('GET /health/db healthy', function () {
    $db = initialized_db();
    [$status, $body] = controller_for($db->path())->db();
    check($status === 200, "status $status");
    check($body === ['status' => 'healthy', 'database' => 'sqlite', 'message' => 'Database connection successful'], json_encode($body));
});

test('GET /health/app healthy', function () {
    $db = initialized_db();
    [$status, $body] = controller_for($db->path())->app();
    check($status === 200, "status $status");
    check($body === [
        'status' => 'healthy',
        'service' => 'php-sqlite-api',
        'database' => ['status' => 'healthy', 'type' => 'sqlite'],
    ], json_encode($body));
});

test('health checks do not insert records', function () {
    $db = initialized_db();
    controller_for($db->path())->db();
    controller_for($db->path())->app();
    check($db->countRecords() === 0, 'health check wrote data');
});

$unhealthyDb = ['status' => 'unhealthy', 'database' => 'sqlite', 'message' => 'Database connection failed'];
$unhealthyApp = [
    'status' => 'unhealthy',
    'service' => 'php-sqlite-api',
    'database' => ['status' => 'unhealthy', 'type' => 'sqlite'],
];

test('missing database file -> 503', function () use ($unhealthyDb, $unhealthyApp) {
    $path = temp_db_path();
    [$status, $body] = controller_for($path)->db();
    check($status === 503 && $body === $unhealthyDb, "db: $status " . json_encode($body));
    [$status, $body] = controller_for($path)->app();
    check($status === 503 && $body === $unhealthyApp, "app: $status " . json_encode($body));
    check(!file_exists($path), 'health check must not create the file');
});

test('database file without the table -> 503', function () use ($unhealthyDb) {
    $path = temp_db_path();
    @mkdir(dirname($path), 0775, true);
    (new PDO('sqlite:' . $path))->exec('CREATE TABLE other (x INTEGER)');
    [$status, $body] = controller_for($path)->db();
    check($status === 503 && $body === $unhealthyDb, "$status " . json_encode($body));
});

test('path is a directory -> 503', function () use ($unhealthyDb) {
    $path = temp_db_path();
    mkdir($path, 0775, true);
    [$status, $body] = controller_for($path)->db();
    check($status === 503 && $body === $unhealthyDb, "$status " . json_encode($body));
});

test('file is not a SQLite database -> 503', function () use ($unhealthyDb) {
    $path = temp_db_path();
    @mkdir(dirname($path), 0775, true);
    file_put_contents($path, str_repeat('not a database ', 100));
    [$status, $body] = controller_for($path)->db();
    check($status === 503 && $body === $unhealthyDb, "$status " . json_encode($body));
});

test('unreadable file -> 503 (skipped when running as root)', function () use ($unhealthyDb) {
    if (function_exists('posix_geteuid') && posix_geteuid() === 0) {
        echo "        (skipped: root ignores file permissions)\n";
        return;
    }
    if (PHP_OS_FAMILY === 'Windows') {
        echo "        (skipped: chmod has no effect on Windows)\n";
        return;
    }
    $db = initialized_db();
    chmod($db->path(), 0000);
    try {
        [$status, $body] = controller_for($db->path())->db();
        check($status === 503 && $body === $unhealthyDb, "$status " . json_encode($body));
    } finally {
        chmod($db->path(), 0644);
    }
});

echo "\nRouter\n";

test('unknown path -> 404, wrong method -> 405', function () {
    $router = new Router();
    $router->get('/health', fn () => [200, ['status' => 'healthy']]);

    check($router->dispatch('GET', '/health')[0] === 200, 'GET /health');
    check($router->dispatch('GET', '/health/')[0] === 200, 'trailing slash');
    check($router->dispatch('GET', '/nope')[0] === 404, '404');

    $result = $router->dispatch('POST', '/health');
    check($result[0] === 405 && $result[2]['Allow'] === 'GET', '405 with Allow header');
});

echo "\n$passed passed, $failures failed\n";
exit($failures === 0 ? 0 : 1);
