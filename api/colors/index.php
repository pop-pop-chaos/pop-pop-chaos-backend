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
        getColors();
        break;
    case 'POST':
        createColor();
        break;
    case 'PUT':
        updateColor();
        break;
    case 'DELETE':
        deleteColor();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

function getColors() {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            SELECT color_id as id, name, hex_code as hexCode
            FROM colors
            ORDER BY color_id
        ");
        $stmt->execute();
        $colors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($colors as &$color) {
            $color['id'] = (int)$color['id'];
        }

        echo json_encode([
            'colors' => $colors,
            'timestamp' => date('c')
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function createColor() {
    global $pdo;

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['name']) || !isset($input['hexCode'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }

    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $input['hexCode'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid hex color code']);
        return;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO colors (name, hex_code) VALUES (?, ?)");
        $stmt->execute([$input['name'], $input['hexCode']]);

        $colorId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'color_id' => $colorId,
            'message' => 'Color created successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function updateColor() {
    global $pdo;

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing color ID']);
        return;
    }

    try {
        $fields = [];
        $values = [];

        if (isset($input['name'])) {
            $fields[] = 'name = ?';
            $values[] = $input['name'];
        }
        if (isset($input['hexCode'])) {
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $input['hexCode'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid hex color code']);
                return;
            }
            $fields[] = 'hex_code = ?';
            $values[] = $input['hexCode'];
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No fields to update']);
            return;
        }

        $values[] = $input['id'];

        $sql = "UPDATE colors SET " . implode(', ', $fields) . " WHERE color_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);

        echo json_encode([
            'success' => true,
            'message' => 'Color updated successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function deleteColor() {
    global $pdo;

    $colorId = $_GET['id'] ?? null;

    if (!$colorId) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing color ID']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM colors WHERE color_id = ?");
        $stmt->execute([$colorId]);

        echo json_encode([
            'success' => true,
            'message' => 'Color deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>
