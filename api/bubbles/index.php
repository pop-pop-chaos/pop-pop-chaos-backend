<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getBubbles();
        break;
    case 'PUT':
        updateBubble();
        break;
    case 'DELETE':
        deleteBubble();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed - POST requests go to create.php']);
        break;
}

function getBubbles() {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            SELECT b.bubble_id as id, b.name, b.size,
                   b.position_x as xPercent, b.position_y as yPercent,
                   b.velocity_dx as dx, b.velocity_dy as dy,
                   b.deflation_rate, b.last_activity,
                   t.team_id as teamId, t.name as team, c.hex_code as color
            FROM bubbles b
            JOIN teams t ON b.team_id = t.team_id
            JOIN colors c ON t.color_id = c.color_id
            ORDER BY b.bubble_id
        ");
        $stmt->execute();
        $bubbles = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($bubbles as &$bubble) {
            $bubble['id'] = (int)$bubble['id'];
            $bubble['teamId'] = (int)$bubble['teamId'];
            $bubble['xPercent'] = (float)$bubble['xPercent'];
            $bubble['yPercent'] = (float)$bubble['yPercent'];
            $bubble['dx'] = (float)$bubble['dx'];
            $bubble['dy'] = (float)$bubble['dy'];
            $bubble['deflation_rate'] = (float)$bubble['deflation_rate'];

            // Calculate current deflated size
            $bubble['size'] = calculateCurrentBubbleSize($bubble);
        }

        // Remove bubbles that have deflated to 0 or less
        $bubbles = array_filter($bubbles, function($bubble) {
            return $bubble['size'] > 0;
        });

        // Clean up deflated bubbles from database
        cleanupDeflatedBubbles();

        echo json_encode([
            'bubbles' => array_values($bubbles), // Re-index array after filtering
            'timestamp' => date('c')
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function updateBubble() {
    global $pdo;

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing bubble ID']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT size FROM bubbles WHERE bubble_id = ?");
        $stmt->execute([$input['id']]);
        $currentBubble = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$currentBubble) {
            http_response_code(404);
            echo json_encode(['error' => 'Bubble not found']);
            return;
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

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No fields to update']);
            return;
        }

        // Always update last_activity when bubble is modified
        $fields[] = 'last_activity = NOW()';
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

        echo json_encode([
            'success' => true,
            'message' => 'Bubble updated successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function deleteBubble() {
    global $pdo;

    $bubbleId = $_GET['id'] ?? null;

    if (!$bubbleId) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing bubble ID']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT size FROM bubbles WHERE bubble_id = ?");
        $stmt->execute([$bubbleId]);
        $currentBubble = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$currentBubble) {
            http_response_code(404);
            echo json_encode(['error' => 'Bubble not found']);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM bubbles WHERE bubble_id = ?");
        $stmt->execute([$bubbleId]);

        logBubbleEvent($bubbleId, 'popped', $currentBubble['size'], 0);

        echo json_encode([
            'success' => true,
            'message' => 'Bubble deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
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

function calculateCurrentBubbleSize($bubble) {
    $baseSize = (int)$bubble['size'];
    $deflationRate = (float)$bubble['deflation_rate'];
    $lastActivity = new DateTime($bubble['last_activity']);
    $now = new DateTime();
    $secondsElapsed = $now->getTimestamp() - $lastActivity->getTimestamp();

    // Calculate current size based on deflation rate
    $currentSize = max(0, $baseSize - ($secondsElapsed * $deflationRate));

    return (int)round($currentSize);
}

function cleanupDeflatedBubbles() {
    global $pdo;

    try {
        // Find bubbles that have fully deflated
        $stmt = $pdo->prepare("
            SELECT bubble_id, size, deflation_rate, last_activity, name
            FROM bubbles
            WHERE size - (TIMESTAMPDIFF(SECOND, last_activity, NOW()) * deflation_rate) <= 0
        ");
        $stmt->execute();
        $deflatedBubbles = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Log and delete deflated bubbles
        foreach ($deflatedBubbles as $bubble) {
            logBubbleEvent($bubble['bubble_id'], 'auto_deflate', $bubble['size'], 0);
        }

        // Delete all fully deflated bubbles
        if (!empty($deflatedBubbles)) {
            $bubbleIds = array_column($deflatedBubbles, 'bubble_id');
            $placeholders = str_repeat('?,', count($bubbleIds) - 1) . '?';
            $stmt = $pdo->prepare("DELETE FROM bubbles WHERE bubble_id IN ($placeholders)");
            $stmt->execute($bubbleIds);

            error_log("Auto-deflated " . count($deflatedBubbles) . " bubbles");
        }

    } catch (PDOException $e) {
        error_log("Failed to cleanup deflated bubbles: " . $e->getMessage());
    }
}
?>
