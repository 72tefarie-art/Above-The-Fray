class QuestSystem {
  constructor(dbPool, progressionSystem) {
    this.pool = dbPool;
    this.progression = progressionSystem;
  }

  // 1. Assign a quest to a player
  async acceptQuest(userId, questId) {
    const { rows: quest } = await this.pool.query(
      `SELECT * FROM quests WHERE id = $1`,
      [questId]
    );
    if (!quest.length) throw new Error('Quest not found');

    // Initialize progress map: { "kill_slimes": 0 }
    const initialProgress = {};
    const objectives = quest[0].objectives;
    objectives.forEach((obj) => {
      initialProgress[obj.id] = 0;
    });

    await this.pool.query(
      `INSERT INTO player_quests (user_id, quest_id, status, progress)
       VALUES ($1, $2, 'IN_PROGRESS', $3)
       ON CONFLICT (user_id, quest_id) DO NOTHING`,
      [userId, questId, JSON.stringify(initialProgress)]
    );

    return { questId, status: 'IN_PROGRESS', progress: initialProgress };
  }

  // 2. Track game actions (e.g., KILL, COLLECT) and update progress
  async trackObjectiveEvent(userId, eventType, targetId, count = 1, roomCode, publishToCluster) {
    // Query active in-progress quests for this player
    const { rows: activeQuests } = await this.pool.query(
      `SELECT pq.*, q.objectives, q.xp_reward, q.item_rewards, q.title
       FROM player_quests pq
       JOIN quests q ON pq.quest_id = q.id
       WHERE pq.user_id = $1 AND pq.status = 'IN_PROGRESS'`,
      [userId]
    );

    for (const quest of activeQuests) {
      let progressChanged = false;
      let currentProgress = quest.progress;
      const objectives = quest.objectives;

      for (const obj of objectives) {
        if (obj.type === eventType && obj.target_id === targetId) {
          const currentVal = currentProgress[obj.id] || 0;
          if (currentVal < obj.required) {
            currentProgress[obj.id] = Math.min(obj.required, currentVal + count);
            progressChanged = true;
          }
        }
      }

      if (progressChanged) {
        const isComplete = objectives.every(
          (obj) => (currentProgress[obj.id] || 0) >= obj.required
        );

        if (isComplete) {
          // Complete quest and grant rewards
          await this.completeQuest(userId, quest, roomCode, publishToCluster);
        } else {
          // Update partial progress in DB
          await this.pool.query(
            `UPDATE player_quests SET progress = $1 WHERE user_id = $2 AND quest_id = $3`,
            [JSON.stringify(currentProgress), userId, quest.quest_id]
          );

          publishToCluster(roomCode, {
            type: 'QUEST_PROGRESS_UPDATED',
            payload: {
              userId,
              questId: quest.quest_id,
              progress: currentProgress
            }
          });
        }
      }
    }
  }

  // 3. Complete quest & distribute rewards atomically
  async completeQuest(userId, quest, roomCode, publishToCluster) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Mark quest completed
      await client.query(
        `UPDATE player_quests 
         SET status = 'COMPLETED', completed_at = NOW(), progress = $1
         WHERE user_id = $2 AND quest_id = $3`,
        [JSON.stringify(quest.progress), userId, quest.quest_id]
      );

      // Distribute item rewards
      const items = quest.item_rewards;
      for (const item of items) {
        await client.query(
          `INSERT INTO player_inventory (user_id, item_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, item_id) 
           DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity`,
          [userId, item.item_id, item.quantity]
        );
      }

      await client.query('COMMIT');

      // Distribute XP using the ProgressionSystem
      const updatedProgression = await this.progression.awardXp(
        userId,
        quest.xp_reward,
        roomCode,
        publishToCluster
      );

      // Broadcast completion event to cluster
      publishToCluster(roomCode, {
        type: 'QUEST_COMPLETED',
        payload: {
          userId,
          questId: quest.quest_id,
          title: quest.title,
          xpReward: quest.xp_reward,
          itemRewards: items,
          updatedProgression
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error completing quest:', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = QuestSystem;