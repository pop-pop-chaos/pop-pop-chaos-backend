<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://poppopchaos.chatforest.com');
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

require_once '../../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing bubble ID']);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT size FROM bubbles WHERE bubble_id = ?");
    $stmt->execute([$input['id']]);
    $currentBubble = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentBubble) {
        http_response_code(404);
        echo json_encode(['error' => 'Bubble not found']);
        exit();
    }

    $fields = [];
    $values = [];

    if (isset($input['size'])) {
        $fields[] = 'size = ?';
        $values[] = $input['size'];
    }
    if (isset($input['xPercent'])) {
        $fields[] = 'position_x = ?';
        $values[] = $input['xPercent'];
    }
    if (isset($input['yPercent'])) {
        $fields[] = 'position_y = ?';
        $values[] = $input['yPercent'];
    }
    if (isset($input['dx'])) {
        $fields[] = 'velocity_dx = ?';
        $values[] = $input['dx'];
    }
    if (isset($input['dy'])) {
        $fields[] = 'velocity_dy = ?';
        $values[] = $input['dy'];
    }
    if (isset($input['name'])) {
        $fields[] = 'name = ?';
        $values[] = $input['name'];
    }
    if (isset($input['teamId'])) {
        $fields[] = 'team_id = ?';
        $values[] = $input['teamId'];
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit();
    }

    $values[] = $input['id'];

    $sql = "UPDATE bubbles SET " . implode(', ', $fields) . " WHERE bubble_id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);

    if (isset($input['size'])) {
        $eventType = 'clicked';
        if (isset($input['eventType'])) {
            $eventType = $input['eventType'];
        }
        logBubbleEvent($input['id'], $eventType, $currentBubble['size'], $input['size']);
    }

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
    $stmt->execute([$input['id']]);
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
