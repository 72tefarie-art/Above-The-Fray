class ProgressionSystem {
  constructor(dbPool) {
    this.pool = dbPool;
  }

  // XP required to reach the NEXT level (Exponential Curve)
  // Level 1 -> 2: 100 XP | Level 2 -> 3: 250 XP | Level 3 -> 4: 450 XP
  getXpForNextLevel(currentLevel) {
    return Math.floor(50 * Math.pow(currentLevel, 1.5) + 50);
  }

  // Add XP to a player and check for Level Up
  async awardXp(userId, xpGained, roomCode, publishToCluster) {
    // 1. Fetch current progress
    const { rows } = await this.pool.query(
      `SELECT * FROM player_progress WHERE user_id = $1`,
      [userId]
    );

    let progress = rows[0];

    // Initialize row if new player
    if (!progress) {
      const initResult = await this.pool.query(
        `INSERT INTO player_progress (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      progress = initResult.rows[0];
    }

    let { level, xp, max_health, attack_power, unlocked_skills } = progress;
    
    // Parse JSONB array if returned as string
    if (typeof unlocked_skills === 'string') {
      unlocked_skills = JSON.parse(unlocked_skills);
    }

    xp += xpGained;
    let didLevelUp = false;
    let xpNeeded = this.getXpForNextLevel(level);

    // Handle multiple level ups if huge XP chunk is gained
    while (xp >= xpNeeded) {
      xp -= xpNeeded;
      level += 1;
      didLevelUp = true;

      // Increase Stats per Level
      max_health += 20;
      attack_power += 5;

      // Unlock skills at specific milestone levels
      if (level === 3 && !unlocked_skills.includes('dash')) {
        unlocked_skills.push('dash');
      }
      if (level === 5 && !unlocked_skills.includes('fireball')) {
        unlocked_skills.push('fireball');
      }

      xpNeeded = this.getXpForNextLevel(level);
    }

    // 2. Persist updated progress back to PostgreSQL
    await this.pool.query(
      `UPDATE player_progress 
       SET level = $1, xp = $2, max_health = $3, attack_power = $4, 
           unlocked_skills = $5, updated_at = NOW()
       WHERE user_id = $6`,
      [level, xp, max_health, attack_power, JSON.stringify(unlocked_skills), userId]
    );

    const updatedState = {
      userId,
      level,
      xp,
      nextLevelXp: xpNeeded,
      maxHealth: max_health,
      attackPower: attack_power,
      unlockedSkills: unlocked_skills,
      xpGained
    };

    // 3. Broadcast progression update to all servers in cluster
    if (didLevelUp) {
      publishToCluster(roomCode, {
        type: 'PLAYER_LEVEL_UP',
        payload: updatedState
      });
    } else {
      publishToCluster(roomCode, {
        type: 'PLAYER_XP_GAINED',
        payload: updatedState
      });
    }

    return updatedState;
  }
}

module.exports = ProgressionSystem;