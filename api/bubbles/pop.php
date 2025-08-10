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
$bubbleId = $input['bubble_id'] ?? null;

if (!$bubbleId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing bubble_id']);
    exit();
}

try {
    $stmt = $pdo->prepare("SELECT size FROM bubbles WHERE bubble_id = ?");
    $stmt->execute([$bubbleId]);
    $currentBubble = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$currentBubble) {
        http_response_code(404);
        echo json_encode(['error' => 'Bubble not found']);
        exit();
    }

    $currentSize = $currentBubble['size'];

    // God pop - instant destruction
    $stmt = $pdo->prepare("DELETE FROM bubbles WHERE bubble_id = ?");
    $stmt->execute([$bubbleId]);

    logBubbleEvent($bubbleId, 'god_pop', $currentSize, 0);

    echo json_encode([
        'success' => true,
        'action' => 'god_pop',
        'message' => 'Bubble instantly destroyed'
    ]);

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
