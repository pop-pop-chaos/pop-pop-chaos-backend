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
        getTeams();
        break;
    case 'POST':
        createTeam();
        break;
    case 'PUT':
        updateTeam();
        break;
    case 'DELETE':
        deleteTeam();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

function getTeams() {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT t.team_id as id, t.name, c.hex_code as color, c.name as colorName
            FROM teams t
            JOIN colors c ON t.color_id = c.color_id
            ORDER BY t.team_id
        ");
        $stmt->execute();
        $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($teams as &$team) {
            $team['id'] = (int)$team['id'];
        }
        
        echo json_encode([
            'teams' => $teams,
            'timestamp' => date('c')
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function createTeam() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['name']) || !isset($input['colorId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO teams (name, color_id) VALUES (?, ?)");
        $stmt->execute([$input['name'], $input['colorId']]);
        
        $teamId = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'team_id' => $teamId,
            'message' => 'Team created successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function updateTeam() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing team ID']);
        return;
    }
    
    try {
        $fields = [];
        $values = [];
        
        if (isset($input['name'])) {
            $fields[] = 'name = ?';
            $values[] = $input['name'];
        }
        if (isset($input['colorId'])) {
            $fields[] = 'color_id = ?';
            $values[] = $input['colorId'];
        }
        
        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No fields to update']);
            return;
        }
        
        $values[] = $input['id'];
        
        $sql = "UPDATE teams SET " . implode(', ', $fields) . " WHERE team_id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
        
        echo json_encode([
            'success' => true,
            'message' => 'Team updated successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

function deleteTeam() {
    global $pdo;
    
    $teamId = $_GET['id'] ?? null;
    
    if (!$teamId) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing team ID']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM teams WHERE team_id = ?");
        $stmt->execute([$teamId]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Team deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>