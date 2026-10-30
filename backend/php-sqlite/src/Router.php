<?php

declare(strict_types=1);

/** Maps "METHOD /path" to a handler. Exact path matches only. */
final class Router
{
    /** @var array<string, array<string, callable(): array>> path => method => handler */
    private array $routes = [];

    public function get(string $path, callable $handler): void
    {
        $this->routes[$path]['GET'] = $handler;
    }

    /** @return array{0: int, 1: array, 2?: array<string, string>} [status, body, extra headers] */
    public function dispatch(string $method, string $path): array
    {
        $path = rtrim($path, '/') ?: '/';

        if (!isset($this->routes[$path])) {
            return [404, ['status' => 'error', 'message' => 'Not found']];
        }
        if (!isset($this->routes[$path][$method])) {
            $allowed = implode(', ', array_keys($this->routes[$path]));
            return [405, ['status' => 'error', 'message' => 'Method not allowed'], ['Allow' => $allowed]];
        }
        return ($this->routes[$path][$method])();
    }
}
