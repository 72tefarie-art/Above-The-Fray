const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'game_db',
  password: 'secretpassword',
  port: 5432,
});

// Track active player locks in memory to block concurrent WS messages (e.g., fast double-clicking)
const processingPlayers = new Set();

/**
 * Handles the final commitment of a trade initiated over WebSockets.
 * Wraps validation, inventory transfers, and audit logs in an isolated SQL transaction.
 *
 * @param {Object} wsPlayerA - WebSocket connection/session for Player A
 * @param {Object} wsPlayerB - WebSocket connection/session for Player B
 * @param {Object} tradeSession - In-memory trade state containing staged items
 */
async function handleWebSocketTradeCommit(wsPlayerA, wsPlayerB, tradeSession) {
  const playerAId = wsPlayerA.userId;
  const playerBId = wsPlayerB.userId;

  // 1. IN-MEMORY CONCURRENCY GUARD
  // Reject request if either player is already processing a database operation
  if (processingPlayers.has(playerAId) || processingPlayers.has(playerBId)) {
    sendError(wsPlayerA, 'TRADE_LOCKED', 'Another transaction is in progress.');
    sendError(wsPlayerB, 'TRADE_LOCKED', 'Another transaction is in progress.');
    return;
  }

  // Lock players in memory during DB execution
  processingPlayers.add(playerAId);
  processingPlayers.add(playerBId);

  const client = await pool.connect();

  try {
    // 2. BEGIN SQL TRANSACTION
    await client.query('BEGIN');

    // 3. PREVENT DEADLOCKS VIA DETERMINISTIC ROW LOCKING
    // Always lock rows in alphabetical order by Player ID
    const sortedPlayerIds = [playerAId, playerBId].sort();

    // Lock inventory rows for both players simultaneously
    await client.query(
      `SELECT instance_id, player_id, item_id, quantity 
       FROM player_inventories 
       WHERE player_id IN ($1, $2) 
       FOR UPDATE`,
      [sortedPlayerIds[0], sortedPlayerIds[1]]
    );

    // 4. VERIFY INVENTORIES AGAINST MEMORY STAGE (Anti-Duplication Check)
    // Check if items actually exist in DB before transferring
    await verifyStagedItemsExist(client, playerAId, tradeSession.playerAStaged);
    await verifyStagedItemsExist(client, playerBId, tradeSession.playerBStaged);

    // 5. ATOMIC ITEM TRANSFERS
    // Transfer Player A's items -> Player B
    await processTransferBatch(client, playerAId, playerBId, tradeSession.playerAStaged);

    // Transfer Player B's items -> Player A
    await processTransferBatch(client, playerBId, playerAId, tradeSession.playerBStaged);

    // 6. RECORD AUDIT LOG
    const tradeId = `trade_${crypto.randomUUID()}`;
    await client.query(
      `INSERT INTO trade_logs (trade_id, player_a_id, player_b_id, transferred_items, completed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        tradeId,
        playerAId,
        playerBId,
        JSON.stringify({
          fromA: tradeSession.playerAStaged,
          fromB: tradeSession.playerBStaged,
        }),
      ]
    );

    // 7. COMMIT TRANSACTION
    await client.query('COMMIT');

    // Fetch fresh post-trade inventory states for both clients
    const updatedInvA = await fetchPlayerInventory(client, playerAId);
    const updatedInvB = await fetchPlayerInventory(client, playerBId);

    // Broadcast success over WebSocket
    send(wsPlayerA, 'TRADE_SUCCESS', { tradeId, inventory: updatedInvA });
    send(wsPlayerB, 'TRADE_SUCCESS', { tradeId, inventory: updatedInvB });

  } catch (error) {
    // 8. ROLLBACK ON FAILURE
    await client.query('ROLLBACK');
    console.error(`Trade failed between ${playerAId} and ${playerBId}:`, error.message);

    // Notify clients that trade was aborted without changes
    sendError(wsPlayerA, 'TRADE_FAILED', 'Trade validation failed or item was unavailable.');
    sendError(wsPlayerB, 'TRADE_FAILED', 'Trade validation failed or item was unavailable.');
  } finally {
    client.release();
    // Release in-memory concurrency lock
    processingPlayers.delete(playerAId);
    processingPlayers.delete(playerBId);
  }
}

/**
 * Validates that all items staged in memory actually exist in the database with sufficient quantity.
 */
async function verifyStagedItemsExist(client, playerId, stagedItems) {
  for (const item of stagedItems) {
    const res = await client.query(
      `SELECT quantity FROM player_inventories 
       WHERE player_id = $1 AND item_id = $2`,
      [playerId, item.itemId]
    );

    if (res.rows.length === 0 || res.rows[0].quantity < item.quantity) {
      throw new Error(`Anti-dup alert: Player ${playerId} lacks required item ${item.itemId}`);
    }
  }
}

/**
 * Transfers staged items between sender and receiver in the database.
 */
async function processTransferBatch(client, senderId, receiverId, stagedItems) {
  for (const item of stagedItems) {
    const { itemId, quantity } = item;

    // Deduct from Sender
    await client.query(
      `UPDATE player_inventories 
       SET quantity = quantity - $3 
       WHERE player_id = $1 AND item_id = $2`,
      [senderId, itemId, quantity]
    );

    // Delete sender row if quantity reaches 0
    await client.query(
      `DELETE FROM player_inventories 
       WHERE player_id = $1 AND item_id = $2 AND quantity <= 0`,
      [senderId, itemId]
    );

    // Upsert to Receiver
    const instanceId = `inst_${crypto.randomUUID()}`;
    await client.query(
      `INSERT INTO player_inventories (instance_id, player_id, item_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, item_id) 
       DO UPDATE SET quantity = player_inventories.quantity + EXCLUDED.quantity`,
      [instanceId, receiverId, itemId, quantity]
    );
  }
}

async function fetchPlayerInventory(client, playerId) {
  const { rows } = await client.query(
    `SELECT i.instance_id, i.item_id, m.name, i.quantity 
     FROM player_inventories i
     JOIN items m ON i.item_id = m.id
     WHERE i.player_id = $1`,
    [playerId]
  );
  return rows;
}

function send(ws, type, data) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type, data }));
}

function sendError(ws, code, message) {
  send(ws, 'ERROR', { code, message });
}

module.exports = { handleWebSocketTradeCommit };