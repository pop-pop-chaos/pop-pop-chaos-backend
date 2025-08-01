-- Pop Pop Chaos Database Schema

-- Bubble colors lookup table
CREATE TABLE bubble_colors (
  color_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  hex_code VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default colors
INSERT INTO bubble_colors (name, hex_code) VALUES
('green', '#4CAF50'),
('blue', '#2196F3'),
('red', '#F44336'),
('purple', '#9C27B0'),
('orange', '#FF9800'),
('teal', '#009688');

-- Main bubbles table
CREATE TABLE bubbles (
  bubble_id INT PRIMARY KEY,  -- Use our existing ID system
  name VARCHAR(100) NOT NULL,
  size INT NOT NULL DEFAULT 10,
  position_x DECIMAL(8,3) NOT NULL,  -- Store as percentage of game area (0.0-1.0)
  position_y DECIMAL(8,3) NOT NULL,  -- This makes it screen-size independent!
  color_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (color_id) REFERENCES bubble_colors(color_id),
  INDEX idx_size (size),
  INDEX idx_position (position_x, position_y)
);

-- Game sessions table (for future multiplayer features)
CREATE TABLE game_sessions (
  session_id VARCHAR(36) PRIMARY KEY,  -- UUID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  total_bubbles INT DEFAULT 0,
  status ENUM('active', 'paused', 'ended') DEFAULT 'active'
);

-- Bubble events log (for analytics/debugging)
CREATE TABLE bubble_events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  bubble_id INT,
  event_type ENUM('created', 'clicked', 'air_loss', 'popped', 'god_inflate', 'god_deflate', 'god_pop'),
  size_before INT,
  size_after INT,
  player_ip VARCHAR(45),  -- For basic player tracking
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_bubble (bubble_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp)
);