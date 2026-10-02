-- 1. Master Quest Definitions
CREATE TABLE IF NOT EXISTS quests (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    xp_reward INT NOT NULL DEFAULT 0,
    item_rewards JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g., [{"item_id": "iron_sword", "quantity": 1}]
    objectives JSONB NOT NULL -- e.g., [{"id": "kill_slimes", "type": "KILL", "target_id": "slime", "required": 5}]
);

-- 2. Player Active & Completed Quests
CREATE TABLE IF NOT EXISTS player_quests (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quest_id VARCHAR(50) REFERENCES quests(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED'
    progress JSONB NOT NULL DEFAULT '{}'::jsonb,      -- e.g., {"kill_slimes": 3}
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, quest_id)
);

-- 3. Player Inventory
CREATE TABLE IF NOT EXISTS player_inventory (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, item_id)
);

-- Seed an example quest
INSERT INTO quests (id, title, description, xp_reward, item_rewards, objectives)
VALUES (
    'quest_slime_hunter',
    'Slime Hunter',
    'Defeat 5 slimes around the starting area.',
    150,
    '[{"item_id": "health_potion", "quantity": 2}, {"item_id": "bronze_coin", "quantity": 10}]'::jsonb,
    '[{"id": "kill_slimes", "type": "KILL", "target_id": "slime", "required": 5}]'::jsonb
) ON CONFLICT (id) DO NOTHING;