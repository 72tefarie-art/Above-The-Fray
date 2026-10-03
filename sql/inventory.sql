-- 1. Players Table
CREATE TABLE players (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Master Item Definitions
CREATE TABLE items (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  stackable BOOLEAN DEFAULT true
);

-- 3. Player Inventories (Instance or Stacked rows)
CREATE TABLE player_inventories (
  instance_id VARCHAR(64) PRIMARY KEY,
  player_id VARCHAR(64) REFERENCES players(id) ON DELETE CASCADE,
  item_id VARCHAR(64) REFERENCES items(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  CONSTRAINT unique_player_item UNIQUE (player_id, item_id) -- Ensures 1 stack entry per item type
);

-- 4. Trade Audit History
CREATE TABLE trade_logs (
  trade_id VARCHAR(64) PRIMARY KEY,
  player_a_id VARCHAR(64) REFERENCES players(id),
  player_b_id VARCHAR(64) REFERENCES players(id),
  transferred_items JSONB NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Mock Data
INSERT INTO items (id, name, stackable) VALUES 
  ('iron_sword', 'Iron Sword', false),
  ('health_potion', 'Health Potion', true),
  ('gold_coin', 'Gold Coin', true);

INSERT INTO players (id, username) VALUES 
  ('p_alice', 'Alice'),
  ('p_bob', 'Bob');

INSERT INTO player_inventories (instance_id, player_id, item_id, quantity) VALUES
  ('inst_1', 'p_alice', 'iron_sword', 1),
  ('inst_2', 'p_alice', 'health_potion', 10),
  ('inst_3', 'p_bob', 'gold_coin', 250);