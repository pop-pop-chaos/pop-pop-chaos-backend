-- Pop Pop Chaos Database Schema (3NF Design)

-- Colors table (pure color definitions)
CREATE TABLE colors (
  color_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  hex_code VARCHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table (team definitions with color references)
CREATE TABLE teams (
  team_id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  color_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (color_id) REFERENCES colors(color_id)
);

-- Insert default colors
INSERT INTO colors (name, hex_code) VALUES
('green', '#4CAF50'),
('blue', '#2196F3'),
('red', '#F44336'),
('purple', '#9C27B0'),
('orange', '#FF9800'),
('teal', '#009688');

-- Insert default teams
INSERT INTO teams (name, color_id) VALUES
('default', 1),    -- green
('team1', 2),      -- blue
('team2', 3),      -- red
('team3', 4),      -- purple
('team4', 5);      -- orange

-- Users table for authentication
CREATE TABLE users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_superadmin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main bubbles table
CREATE TABLE bubbles (
  bubble_id INT PRIMARY KEY,  -- Use our existing ID system
  name VARCHAR(100) NOT NULL,
  size INT NOT NULL DEFAULT 10,
  position_x DECIMAL(8,3) NOT NULL,  -- Store as percentage of game area (0.0-1.0)
  position_y DECIMAL(8,3) NOT NULL,  -- This makes it screen-size independent!
  velocity_dx DECIMAL(8,6) NOT NULL DEFAULT 0.0,  -- X velocity component
  velocity_dy DECIMAL(8,6) NOT NULL DEFAULT 0.0,  -- Y velocity component
  team_id INT NOT NULL DEFAULT 1,
  deflation_rate DECIMAL(4,2) NOT NULL DEFAULT 1.0,  -- Size lost per second (0.8-1.5 range)
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Last interaction timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (team_id) REFERENCES teams(team_id),
  INDEX idx_size (size),
  INDEX idx_position (position_x, position_y),
  INDEX idx_last_activity (last_activity),
  INDEX idx_deflation_rate (deflation_rate)
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
  event_type ENUM('created', 'clicked', 'air_loss', 'popped', 'god_inflate', 'god_deflate', 'god_pop', 'auto_deflate', 'deflation_update'),
  size_before INT,
  size_after INT,
  player_ip VARCHAR(45),  -- For basic player tracking
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_bubble (bubble_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp)
);
