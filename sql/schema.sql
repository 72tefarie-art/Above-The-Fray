-- 1. Teams Table
CREATE TABLE IF NOT EXISTS teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL,
    cash_balance DECIMAL(15, 2) DEFAULT 1000000.00,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Players Table
CREATE TABLE IF NOT EXISTS players (
    player_id SERIAL PRIMARY KEY,
    team_id INT,
    student_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'Member',
    status VARCHAR(50) DEFAULT 'Active',
    karma_score INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL
);

-- 3. Alliances Table
CREATE TABLE IF NOT EXISTS alliances (
    alliance_id SERIAL PRIMARY KEY,
    team_a_id INT NOT NULL,
    team_b_id INT NOT NULL,
    pact_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    FOREIGN KEY (team_a_id) REFERENCES teams(team_id),
    FOREIGN KEY (team_b_id) REFERENCES teams(team_id)
);

-- 4. Game Logs Table
CREATE TABLE IF NOT EXISTS game_logs (
    log_id SERIAL PRIMARY KEY,
    player_id INT,
    action_type VARCHAR(100),
    details TEXT,
    gemini_evaluation JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE SET NULL
);
