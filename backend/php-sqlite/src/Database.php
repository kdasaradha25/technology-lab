<?php

declare(strict_types=1);

/**
 * Thin wrapper around a PDO_SQLITE connection.
 *
 * Normal connections open the file read-write WITHOUT the create flag, so a missing
 * database file is reported as unhealthy instead of being silently recreated empty.
 * Only initialize() (bin/init-db.php) creates the file and schema.
 */
final class Database
{
    private ?PDO $pdo = null;

    public function __construct(
        private readonly string $path,
        private readonly int $timeoutSeconds = 3,
    ) {
    }

    public static function fromEnv(): self
    {
        $path = env('DB_PATH', 'database/app.sqlite');
        // Relative paths are resolved against the project root, not the current directory.
        if (!preg_match('#^(/|[A-Za-z]:[\\\\/])#', $path)) {
            $path = PROJECT_ROOT . '/' . $path;
        }
        return new self($path, (int) env('DB_TIMEOUT', '3'));
    }

    public function path(): string
    {
        return $this->path;
    }

    private function connect(bool $create = false): PDO
    {
        if ($this->pdo !== null) {
            return $this->pdo;
        }

        $flags = PDO::SQLITE_OPEN_READWRITE | ($create ? PDO::SQLITE_OPEN_CREATE : 0);
        $this->pdo = new PDO('sqlite:' . $this->path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => $this->timeoutSeconds, // wait this long if the file is locked
            PDO::SQLITE_ATTR_OPEN_FLAGS => $flags,
        ]);
        return $this->pdo;
    }

    /** Creates the database file (and its directory) and the health_records table. */
    public function initialize(): void
    {
        $dir = dirname($this->path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Cannot create database directory');
        }

        $this->connect(create: true)->exec(
            "CREATE TABLE IF NOT EXISTS health_records (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )"
        );
    }

    /**
     * Lightweight read-only check: a trivial query plus a one-row read of the table.
     * Throws on any failure (missing file, permissions, corruption, missing table).
     */
    public function ping(): void
    {
        $pdo = $this->connect();
        $pdo->query('SELECT 1')->fetchColumn();
        $pdo->query('SELECT id FROM health_records LIMIT 1')->fetch();
    }

    /** @return array{id: int, created_at: string} */
    public function insertRecord(): array
    {
        $pdo = $this->connect();
        $pdo->prepare('INSERT INTO health_records DEFAULT VALUES')->execute();
        return $this->findRecord((int) $pdo->lastInsertId());
    }

    /** @return array{id: int, created_at: string}|null */
    public function findRecord(int $id): ?array
    {
        $stmt = $this->connect()->prepare('SELECT id, created_at FROM health_records WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : ['id' => (int) $row['id'], 'created_at' => $row['created_at']];
    }

    public function deleteRecord(int $id): void
    {
        $this->connect()->prepare('DELETE FROM health_records WHERE id = :id')->execute([':id' => $id]);
    }

    public function countRecords(): int
    {
        return (int) $this->connect()->query('SELECT COUNT(*) FROM health_records')->fetchColumn();
    }
}
