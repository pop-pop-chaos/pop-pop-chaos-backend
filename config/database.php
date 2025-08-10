<?php
// Try environment variables first, then fall back to config file
if (file_exists(__DIR__ . '/.env.php')) {
    include __DIR__ . '/.env.php';
}

$host = $_ENV['DB_HOST'] ?? $dbConfig['host'] ?? 'localhost';
$dbname = $_ENV['DB_NAME'] ?? $dbConfig['dbname'] ?? 'pop_pop_chaos';
$username = $_ENV['DB_USER'] ?? $dbConfig['username'] ?? 'root';
$password = $_ENV['DB_PASSWORD'] ?? $dbConfig['password'] ?? '';

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit();
}
