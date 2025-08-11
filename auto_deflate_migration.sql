-- Auto-Deflate Feature Migration
-- Add deflation_rate and last_activity columns to bubbles table

ALTER TABLE bubbles
ADD COLUMN deflation_rate DECIMAL(4,2) NOT NULL DEFAULT 1.0 COMMENT 'Size lost per second (0.8-1.5 range)',
ADD COLUMN last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Last time bubble was interacted with';

-- Update existing bubbles with random deflation rates
UPDATE bubbles
SET deflation_rate = 0.8 + (RAND() * 0.7), -- Random between 0.8 and 1.5
    last_activity = updated_at
WHERE deflation_rate = 1.0; -- Only update bubbles that haven't been set yet

-- Add index for performance on deflation queries
ALTER TABLE bubbles ADD INDEX idx_last_activity (last_activity);
ALTER TABLE bubbles ADD INDEX idx_deflation_rate (deflation_rate);

-- Update bubble_events to track deflation events
ALTER TABLE bubble_events
MODIFY COLUMN event_type ENUM(
  'created', 'clicked', 'air_loss', 'popped', 'god_inflate', 'god_deflate', 'god_pop',
  'auto_deflate', 'deflation_update'
) NOT NULL;
