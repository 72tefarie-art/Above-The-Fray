const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'abovethefray',
  password: process.env.POSTGRES_PASSWORD || 'postgrespassword',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

/**
 * Log game/player actions to game_logs
 */
async function logGameAction(playerId, actionType, details, geminiEvaluation = null) {
  const query = `
    INSERT INTO game_logs (player_id, action_type, details, gemini_evaluation)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [playerId, actionType, details, geminiEvaluation ? JSON.stringify(geminiEvaluation) : null];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Fetch a player with their associated team details
 */
async function getPlayerWithTeam(playerId) {
  const query = `
    SELECT p.*, t.team_name, t.cash_balance
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.team_id
    WHERE p.player_id = $1;
  `;
  const { rows } = await pool.query(query, [playerId]);
  return rows[0];
}

module.exports = {
  pool,
  logGameAction,
  getPlayerWithTeam,
};
