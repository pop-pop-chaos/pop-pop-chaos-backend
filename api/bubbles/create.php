<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://poppopchaos.chatforest.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

require_once '../../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['name']) || !isset($input['xPercent']) || !isset($input['yPercent'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: name, xPercent, yPercent']);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT COALESCE(MAX(bubble_id), 0) + 1 as next_id FROM bubbles");
    $stmt->execute();
    $nextId = $stmt->fetch(PDO::FETCH_ASSOC)['next_id'];

    $stmt = $pdo->prepare("
        INSERT INTO bubbles (bubble_id, name, position_x, position_y, size, team_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    $teamId = $input['teamId'] ?? 1;
    $size = $input['size'] ?? 120;

    $stmt->execute([
        $nextId,
        $input['name'],
        $input['xPercent'],
        $input['yPercent'],
        $size,
        $teamId
    ]);

    logBubbleEvent($nextId, 'created', 0, $size);

    $stmt = $pdo->prepare("
        SELECT b.bubble_id as id, b.name, b.size,
               b.position_x as xPercent, b.position_y as yPercent,
               b.velocity_dx as dx, b.velocity_dy as dy,
               t.team_id as teamId, t.name as team, c.hex_code as color
        FROM bubbles b
        JOIN teams t ON b.team_id = t.team_id
        JOIN colors c ON t.color_id = c.color_id
        WHERE b.bubble_id = ?
    ");
    $stmt->execute([$nextId]);
    $bubble = $stmt->fetch(PDO::FETCH_ASSOC);

    $bubble['id'] = (int)$bubble['id'];
    $bubble['size'] = (int)$bubble['size'];
    $bubble['teamId'] = (int)$bubble['teamId'];
    $bubble['xPercent'] = (float)$bubble['xPercent'];
    $bubble['yPercent'] = (float)$bubble['yPercent'];
    $bubble['dx'] = (float)$bubble['dx'];
    $bubble['dy'] = (float)$bubble['dy'];

    echo json_encode($bubble);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}

function logBubbleEvent($bubbleId, $eventType, $sizeBefore, $sizeAfter) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            INSERT INTO bubble_events (bubble_id, event_type, size_before, size_after, player_ip)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $bubbleId,
            $eventType,
            $sizeBefore,
            $sizeAfter,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ]);
    } catch (PDOException $e) {
        error_log("Failed to log bubble event: " . $e->getMessage());
    }
}
?>
