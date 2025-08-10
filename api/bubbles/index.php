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
    case 'POST':
        createBubble();
        break;
    case 'PUT':
        updateBubble();
        break;
    case 'DELETE':
        deleteBubble();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

function getBubbles() {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT b.bubble_id as id, b.name, b.size, 
                   b.position_x as xPercent, b.position_y as yPercent,
                   b.velocity_dx as dx, b.velocity_dy as dy,
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
            $bubble['size'] = (int)$bubble['size'];
            $bubble['teamId'] = (int)$bubble['teamId'];
            $bubble['xPercent'] = (float)$bubble['xPercent'];
            $bubble['yPercent'] = (float)$bubble['yPercent'];
            $bubble['dx'] = (float)$bubble['dx'];
            $bubble['dy'] = (float)$bubble['dy'];
        }
        
        echo json_encode([
            'bubbles' => $bubbles,
            'timestamp' => date('c')
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function createBubble() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['name']) || !isset($input['xPercent']) || !isset($input['yPercent'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
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
        $size = $input['size'] ?? 10;
        
        $stmt->execute([
            $nextId,
            $input['name'],
            $input['xPercent'],
            $input['yPercent'],
            $size,
            $teamId
        ]);
        
        logBubbleEvent($nextId, 'created', 0, $size);
        
        echo json_encode([
            'success' => true,
            'bubble_id' => $nextId,
            'message' => 'Bubble created successfully'
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
?>