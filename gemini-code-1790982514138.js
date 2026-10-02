class ProgressionHUD {
  constructor(canvasCtx) {
    this.ctx = canvasCtx;
    this.level = 1;
    this.xp = 0;
    this.nextLevelXp = 100;
    this.unlockedSkills = ['basic_attack'];

    // Level-up animation banner timer
    this.levelUpBannerTimer = 0;
  }

  updateProgress(data) {
    this.level = data.level;
    this.xp = data.xp;
    this.nextLevelXp = data.nextLevelXp;
    this.unlockedSkills = data.unlockedSkills;
  }

  triggerLevelUpBanner() {
    this.levelUpBannerTimer = 3.0; // Show for 3 seconds
  }

  render(dt, canvasWidth) {
    // 1. Draw XP Bar (Top-Left)
    const barX = 20;
    const barY = 20;
    const barWidth = 200;
    const barHeight = 16;
    const progressPct = Math.min(1.0, this.xp / this.nextLevelXp);

    // Background
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // XP Fill (Gold/Yellow)
    this.ctx.fillStyle = '#eab308';
    this.ctx.fillRect(barX, barY, barWidth * progressPct, barHeight);

    // Border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Text Overlay
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`LVL ${this.level}  (${this.xp} / ${this.nextLevelXp} XP)`, barX + 5, barY + 12);

    // 2. Draw Unlocked Skills (Bottom-Left)
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '12px sans-serif';
    this.ctx.fillText(`Skills: ${this.unlockedSkills.join(', ')}`, barX, barY + 36);

    // 3. Level Up Notification Animation
    if (this.levelUpBannerTimer > 0) {
      this.levelUpBannerTimer -= dt;

      this.ctx.save();
      this.ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
      this.ctx.font = 'bold 36px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('LEVEL UP!', canvasWidth / 2, 120);
      this.ctx.restore();
    }
  }
}