<?php

declare(strict_types=1);

/*
 * Shared setup for the web entry point, the init script and the tests:
 * loads .env (real environment variables win) and the three classes.
 */

define('PROJECT_ROOT', dirname(__DIR__));

function load_env(string $path): void
{
    if (!is_readable($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (getenv($key) === false) {
            putenv($key . '=' . trim($value, "\"'"));
        }
    }
}

function env(string $key, string $default): string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

load_env(PROJECT_ROOT . '/.env');

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/HealthController.php';
require_once __DIR__ . '/Router.php';
