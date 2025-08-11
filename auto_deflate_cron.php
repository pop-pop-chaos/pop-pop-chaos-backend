<?php
/**
 * Auto-Deflate Cron Job
 * Run this script periodically (every 30 seconds) to handle automatic bubble deflation
 *
 * Usage:
 * - Via cron: *1 * * * * php /path/to/auto_deflate_cron.php
 * - Via webhook: curl https://ppb.chatforest.com/auto_deflate_cron.php
 * - Via manual execution: php auto_deflate_cron.php
 */

header('Content-Type: application/json');

// Prevent browser caching
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// Only allow POST requests and localhost/server access for security
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

require_once 'config/database.php';

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
            'auto_deflate_cron'
        ]);
    } catch (PDOException $e) {
        error_log("Failed to log bubble event: " . $e->getMessage());
    }
}

try {
    $startTime = microtime(true);

    // Get all bubbles with deflation data
    $stmt = $pdo->prepare("
        SELECT bubble_id, name, size, deflation_rate, last_activity,
               TIMESTAMPDIFF(SECOND, last_activity, NOW()) as seconds_elapsed
        FROM bubbles
        ORDER BY last_activity ASC
    ");
    $stmt->execute();
    $bubbles = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalBubbles = count($bubbles);
    $updatedBubbles = 0;
    $deletedBubbles = 0;
    $bubblesForDeletion = [];
    $bubblesForUpdate = [];

    foreach ($bubbles as $bubble) {
        $currentSize = calculateCurrentBubbleSize($bubble);
        $originalSize = (int)$bubble['size'];

        if ($currentSize <= 0) {
            // Bubble has fully deflated - mark for deletion
            $bubblesForDeletion[] = $bubble;
        } else if ($currentSize < $originalSize) {
            // Bubble has partially deflated - mark for size update
            $bubblesForUpdate[] = [
                'bubble_id' => $bubble['bubble_id'],
                'old_size' => $originalSize,
                'new_size' => $currentSize,
                'name' => $bubble['name']
            ];
        }
    }

    // Delete fully deflated bubbles
    if (!empty($bubblesForDeletion)) {
        foreach ($bubblesForDeletion as $bubble) {
            logBubbleEvent($bubble['bubble_id'], 'auto_deflate', $bubble['size'], 0);
        }

        $bubbleIds = array_column($bubblesForDeletion, 'bubble_id');
        $placeholders = str_repeat('?,', count($bubbleIds) - 1) . '?';
        $stmt = $pdo->prepare("DELETE FROM bubbles WHERE bubble_id IN ($placeholders)");
        $stmt->execute($bubbleIds);

        $deletedBubbles = count($bubblesForDeletion);
    }

    // Update partially deflated bubbles
    if (!empty($bubblesForUpdate)) {
        $stmt = $pdo->prepare("
            UPDATE bubbles
            SET size = ?
            WHERE bubble_id = ?
        ");

        foreach ($bubblesForUpdate as $update) {
            $stmt->execute([$update['new_size'], $update['bubble_id']]);
            logBubbleEvent($update['bubble_id'], 'deflation_update', $update['old_size'], $update['new_size']);
        }

        $updatedBubbles = count($bubblesForUpdate);
    }

    $endTime = microtime(true);
    $executionTime = round(($endTime - $startTime) * 1000, 2); // milliseconds

    $result = [
        'success' => true,
        'timestamp' => date('c'),
        'execution_time_ms' => $executionTime,
        'total_bubbles' => $totalBubbles,
        'updated_bubbles' => $updatedBubbles,
        'deleted_bubbles' => $deletedBubbles,
        'message' => "Auto-deflate processed {$totalBubbles} bubbles in {$executionTime}ms"
    ];

    // Log significant activity
    if ($deletedBubbles > 0 || $updatedBubbles > 0) {
        error_log("Auto-deflate: Updated {$updatedBubbles}, deleted {$deletedBubbles} bubbles");
    }

    echo json_encode($result);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database error: ' . $e->getMessage(),
        'timestamp' => date('c')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Auto-deflate error: ' . $e->getMessage(),
        'timestamp' => date('c')
    ]);
}
?>
