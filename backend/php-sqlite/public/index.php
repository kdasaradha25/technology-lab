<?php

declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

// Never print PHP errors into responses; they go to the server log instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// CORS for the lab frontends.
$allowedOrigins = array_filter(array_map('trim', explode(',', env(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:3000,http://localhost:4200'
))));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}
if ($method === 'OPTIONS') {
    http_response_code(204);
    return;
}

$controller = new HealthController(static fn (): Database => Database::fromEnv());

$router = new Router();
$router->get('/health', $controller->health(...));
$router->get('/health/app', $controller->app(...));
$router->get('/health/db', $controller->db(...));

try {
    $result = $router->dispatch($method, $path);
} catch (Throwable $e) {
    error_log('Unhandled error: ' . $e::class);
    $result = [500, ['status' => 'error', 'message' => 'Internal server error']];
}

[$status, $body] = $result;
foreach ($result[2] ?? [] as $name => $value) {
    header($name . ': ' . $value);
}
http_response_code($status);
header('Content-Type: application/json');
echo json_encode($body, JSON_UNESCAPED_SLASHES);
