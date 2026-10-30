<?php

declare(strict_types=1);

/**
 * The three health endpoints. Each method returns [HTTP status, response body];
 * public/index.php turns that into the actual response.
 */
final class HealthController
{
    public const SERVICE_NAME = 'php-sqlite-api';
    private const DATABASE_TYPE = 'sqlite';

    /** @param Closure(): Database $databaseFactory created lazily so /health never touches the database */
    public function __construct(private readonly Closure $databaseFactory)
    {
    }

    public function health(): array
    {
        return [200, ['status' => 'healthy', 'service' => self::SERVICE_NAME]];
    }

    public function app(): array
    {
        $ok = $this->databaseIsHealthy();
        $status = $ok ? 'healthy' : 'unhealthy';
        return [$ok ? 200 : 503, [
            'status' => $status,
            'service' => self::SERVICE_NAME,
            'database' => ['status' => $status, 'type' => self::DATABASE_TYPE],
        ]];
    }

    public function db(): array
    {
        if ($this->databaseIsHealthy()) {
            return [200, [
                'status' => 'healthy',
                'database' => self::DATABASE_TYPE,
                'message' => 'Database connection successful',
            ]];
        }
        return [503, [
            'status' => 'unhealthy',
            'database' => self::DATABASE_TYPE,
            'message' => 'Database connection failed',
        ]];
    }

    private function databaseIsHealthy(): bool
    {
        try {
            ($this->databaseFactory)()->ping();
            return true;
        } catch (Throwable $e) {
            // Log the exception class and SQLite error code only: messages can contain file paths.
            $code = $e instanceof PDOException ? ' (code ' . $e->getCode() . ')' : '';
            error_log('SQLite health check failed: ' . $e::class . $code);
            return false;
        }
    }
}
