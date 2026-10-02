const ProgressionSystem = require('./progression-system');
const progression = new ProgressionSystem(pool);

// Example WS Message Handler: Player completes an objective or kills a target
async function handleGameAction(session, { actionType, actionData }) {
  const { userId, roomCode, roomId } = session;

  if (actionType === 'ENEMY_DEFEATED') {
    const xpReward = actionData.enemyXpValue || 25;

    // Award XP and handle level up
    const progress = await progression.awardXp(
      userId,
      xpReward,
      roomCode,
      publishToCluster
    );

    console.log(`User ${userId} earned ${xpReward} XP. Current Level: ${progress.level}`);
  }
}