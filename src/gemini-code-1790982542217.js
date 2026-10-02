const QuestSystem = require('./quest-system');
const ProgressionSystem = require('./progression-system');

const progression = new ProgressionSystem(pool);
const questSystem = new QuestSystem(pool, progression);

// Example handling within wss message router
async function handleGameAction(session, { actionType, actionData }) {
  const { userId, roomCode } = session;

  switch (actionType) {
    case 'ACCEPT_QUEST':
      await questSystem.acceptQuest(userId, actionData.questId);
      break;

    case 'ENEMY_KILLED':
      // Automatically checks and updates any active quests requiring this target
      await questSystem.trackObjectiveEvent(
        userId,
        'KILL',
        actionData.enemyType, // e.g., 'slime'
        1,
        roomCode,
        publishToCluster
      );
      break;

    case 'ITEM_COLLECTED':
      await questSystem.trackObjectiveEvent(
        userId,
        'COLLECT',
        actionData.itemId,
        actionData.quantity || 1,
        roomCode,
        publishToCluster
      );
      break;
  }
}