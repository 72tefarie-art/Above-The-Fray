const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const wss = new WebSocketServer({ port: 8080 });

// In-Memory Game State
const players = new Map(); // id -> { ws, id, position: {x,y}, inventory: [] }
const activeTrades = new Map(); // tradeId -> TradeSession
const worldDrops = new Map(); // dropId -> { id, item, quantity, position: {x,y} }

// Initial Mock Player Data
function createPlayer(id, ws) {
  return {
    id,
    ws,
    position: { x: 10, y: 10 },
    inventory: [
      { instanceId: 'i_1', itemId: 'iron_sword', name: 'Iron Sword', count: 1 },
      { instanceId: 'i_2', itemId: 'health_potion', name: 'Health Potion', count: 5 },
      { instanceId: 'i_3', itemId: 'gold_coin', name: 'Gold Coin', count: 100 }
    ]
  };
}

class TradeSession {
  constructor(tradeId, playerA, playerB) {
    this.tradeId = tradeId;
    this.players = {
      [playerA.id]: { player: playerA, staged: [], locked: false },
      [playerB.id]: { player: playerB, staged: [], locked: false }
    };
  }

  getPartnerId(playerId) {
    return Object.keys(this.players).find(id => id !== playerId);
  }

  stageItem(playerId, instanceId, quantity) {
    const participant = this.players[playerId];
    const itemInInv = participant.player.inventory.find(i => i.instanceId === instanceId);
    if (!itemInInv || itemInInv.count < quantity) return false;

    // Reset locks if items change
    this.unlockBoth();

    const existingStaged = participant.staged.find(i => i.instanceId === instanceId);
    if (existingStaged) {
      existingStaged.count = quantity;
    } else {
      participant.staged.push({ ...itemInInv, count: quantity });
    }
    return true;
  }

  unlockBoth() {
    Object.values(this.players).forEach(p => p.locked = false);
  }

  lock(playerId) {
    this.players[playerId].locked = true;
  }

  isBothLocked() {
    return Object.values(this.players).every(p => p.locked);
  }

  executeSwap() {
    const [idA, idB] = Object.keys(this.players);
    const pA = this.players[idA];
    const pB = this.players[idB];

    // Transfer items from A to B
    this.transferStaged(pA.player, pB.player, pA.staged);
    // Transfer items from B to A
    this.transferStaged(pB.player, pA.player, pB.staged);
  }

  transferStaged(sender, receiver, stagedItems) {
    stagedItems.forEach(staged => {
      // Deduct from sender
      const invItem = sender.inventory.find(i => i.instanceId === staged.instanceId);
      if (invItem) {
        invItem.count -= staged.count;
        if (invItem.count <= 0) {
          sender.inventory = sender.inventory.filter(i => i.instanceId !== staged.instanceId);
        }
      }

      // Add to receiver
      const recItem = receiver.inventory.find(i => i.itemId === staged.itemId);
      if (recItem) {
        recItem.count += staged.count;
      } else {
        receiver.inventory.push({
          instanceId: `inst_${crypto.randomUUID()}`,
          itemId: staged.itemId,
          name: staged.name,
          count: staged.count
        });
      }
    });
  }
}

// Global Message Handler
wss.on('connection', (ws) => {
  const playerId = `p_${crypto.randomBytes(3).toString('hex')}`;
  const player = createPlayer(playerId, ws);
  players.set(playerId, player);

  send(ws, 'CONNECTED', { playerId, inventory: player.inventory });

  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message);
      handleClientMessage(player, type, data);
    } catch (err) {
      console.error('Invalid Message Payload:', err);
    }
  });

  ws.on('close', () => {
    cleanupPlayerTrades(playerId);
    players.delete(playerId);
  });
});

function handleClientMessage(player, type, data) {
  switch (type) {
    // ----------------------------------------------------
    // 1. WORLD ITEM DROPPING & PICKUP
    // ----------------------------------------------------
    case 'DROP_ITEM': {
      const { instanceId, quantity } = data;
      const invItem = player.inventory.find(i => i.instanceId === instanceId);
      if (!invItem || invItem.count < quantity) return;

      // Deduct from inventory
      invItem.count -= quantity;
      if (invItem.count <= 0) {
        player.inventory = player.inventory.filter(i => i.instanceId !== instanceId);
      }

      // Create ground drop at player coordinates
      const dropId = `drop_${crypto.randomUUID()}`;
      const dropData = {
        dropId,
        item: { itemId: invItem.itemId, name: invItem.name },
        quantity,
        position: { ...player.position }
      };
      worldDrops.set(dropId, dropData);

      // Notify player of updated inventory and broadcast ground item
      send(player.ws, 'INVENTORY_UPDATED', { inventory: player.inventory });
      broadcast('ITEM_DROPPED_IN_WORLD', dropData);
      break;
    }

    case 'PICKUP_ITEM': {
      const { dropId } = data;
      const drop = worldDrops.get(dropId);
      if (!drop) return;

      // Distance check (prevent looting across the map)
      const dist = Math.hypot(drop.position.x - player.position.x, drop.position.y - player.position.y);
      if (dist > 3.0) return; 

      // Add to player inventory
      const existing = player.inventory.find(i => i.itemId === drop.item.itemId);
      if (existing) {
        existing.count += drop.quantity;
      } else {
        player.inventory.push({
          instanceId: `inst_${crypto.randomUUID()}`,
          itemId: drop.item.itemId,
          name: drop.item.name,
          count: drop.quantity
        });
      }

      worldDrops.delete(dropId);

      send(player.ws, 'INVENTORY_UPDATED', { inventory: player.inventory });
      broadcast('ITEM_REMOVED_FROM_WORLD', { dropId });
      break;
    }

    // ----------------------------------------------------
    // 2. PLAYER TRADING SYSTEM
    // ----------------------------------------------------
    case 'REQUEST_TRADE': {
      const targetPlayer = players.get(data.targetPlayerId);
      if (!targetPlayer) return;

      send(targetPlayer.ws, 'TRADE_REQUESTED', { fromPlayerId: player.id });
      break;
    }

    case 'ACCEPT_TRADE': {
      const targetPlayer = players.get(data.targetPlayerId);
      if (!targetPlayer) return;

      const tradeId = `trade_${crypto.randomUUID()}`;
      const trade = new TradeSession(tradeId, player, targetPlayer);
      activeTrades.set(tradeId, trade);

      send(player.ws, 'TRADE_STARTED', { tradeId, partnerId: targetPlayer.id });
      send(targetPlayer.ws, 'TRADE_STARTED', { tradeId, partnerId: player.id });
      break;
    }

    case 'STAGE_TRADE_ITEM': {
      const trade = activeTrades.get(data.tradeId);
      if (!trade) return;

      if (trade.stageItem(player.id, data.instanceId, data.quantity)) {
        notifyTradeUpdate(trade);
      }
      break;
    }

    case 'LOCK_TRADE': {
      const trade = activeTrades.get(data.tradeId);
      if (!trade) return;

      trade.lock(player.id);
      notifyTradeUpdate(trade);

      // Execute trade automatically if both players lock
      if (trade.isBothLocked()) {
        trade.executeSwap();
        
        // Notify both players of trade completion
        Object.keys(trade.players).forEach(pId => {
          const p = trade.players[pId].player;
          send(p.ws, 'TRADE_COMPLETED', {});
          send(p.ws, 'INVENTORY_UPDATED', { inventory: p.inventory });
        });

        activeTrades.delete(trade.tradeId);
      }
      break;
    }

    case 'CANCEL_TRADE': {
      const trade = activeTrades.get(data.tradeId);
      if (!trade) return;

      Object.keys(trade.players).forEach(pId => {
        send(trade.players[pId].player.ws, 'TRADE_CANCELLED', {});
      });

      activeTrades.delete(trade.tradeId);
      break;
    }
  }
}

function notifyTradeUpdate(trade) {
  Object.keys(trade.players).forEach(pId => {
    const partnerId = trade.getPartnerId(pId);
    send(trade.players[pId].player.ws, 'TRADE_UPDATED', {
      myStaged: trade.players[pId].staged,
      myLocked: trade.players[pId].locked,
      partnerStaged: trade.players[partnerId].staged,
      partnerLocked: trade.players[partnerId].locked
    });
  });
}

function cleanupPlayerTrades(playerId) {
  for (const [tradeId, trade] of activeTrades.entries()) {
    if (trade.players[playerId]) {
      const partnerId = trade.getPartnerId(playerId);
      if (partnerId && players.get(partnerId)) {
        send(players.get(partnerId).ws, 'TRADE_CANCELLED', { reason: 'Partner disconnected' });
      }
      activeTrades.delete(tradeId);
    }
  }
}

function send(ws, type, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, data }));
}

function broadcast(type, data) {
  wss.clients.forEach(client => send(client, type, data));
}

console.log('Game Server running on ws://localhost:8080');