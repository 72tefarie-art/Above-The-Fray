class SmoothMultiplayerGame {
  constructor(canvasId, serverUrl) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Local player state
    this.localPlayerId = null;
    this.localPlayer = { x: 400, y: 300, targetX: 400, targetY: 300, speed: 200 };

    // Map of remote players: userId -> { x, y, targetX, targetY, lastUpdated }
    this.remotePlayers = new Map();

    // Input tracking
    this.keys = {};

    // Timing tracking
    this.lastFrameTime = performance.now();

    // WebSocket connection
    this.wsClient = new AboveTheFrayClient(serverUrl);

    this.initInputs();
    this.initNetwork();
  }

  // ----------------------------------------------------
  // 1. NETWORK INTEGRATION
  // ----------------------------------------------------
  initNetwork() {
    this.wsClient.on('ROOM_STATE_UPDATE', (payload) => {
      payload.players.forEach((p) => {
        if (p.user_id !== this.localPlayerId) {
          this.updateRemotePlayerTarget(p.user_id, p.position_x, p.position_y);
        }
      });
    });

    this.wsClient.on('PLAYER_MOVED', ({ userId, posX, posY }) => {
      if (userId !== this.localPlayerId) {
        this.updateRemotePlayerTarget(userId, posX, posY);
      }
    });

    this.wsClient.on('PLAYER_DISCONNECTED', ({ userId }) => {
      this.remotePlayers.delete(userId);
    });
  }

  updateRemotePlayerTarget(userId, x, y) {
    if (!this.remotePlayers.has(userId)) {
      // First time seeing player: place them directly at location
      this.remotePlayers.set(userId, {
        x: x,
        y: y,
        targetX: x,
        targetY: y,
      });
    } else {
      const player = this.remotePlayers.get(userId);
      // Set new target for interpolation; keep current (x, y) as current visual spot
      player.targetX = x;
      player.targetY = y;
    }
  }

  // ----------------------------------------------------
  // 2. INPUT & LOCAL MOVEMENT
  // ----------------------------------------------------
  initInputs() {
    window.addEventListener('keydown', (e) => (this.keys[e.key] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key] = false));
  }

  processLocalInput(dt) {
    let moved = false;
    const moveDist = this.localPlayer.speed * dt;

    if (this.keys['ArrowUp'] || this.keys['w']) { this.localPlayer.y -= moveDist; moved = true; }
    if (this.keys['ArrowDown'] || this.keys['s']) { this.localPlayer.y += moveDist; moved = true; }
    if (this.keys['ArrowLeft'] || this.keys['a']) { this.localPlayer.x -= moveDist; moved = true; }
    if (this.keys['ArrowRight'] || this.keys['d']) { this.localPlayer.x += moveDist; moved = true; }

    // Send updated coordinates to WebSocket server if moved
    if (moved) {
      this.wsClient.sendPosition(this.localPlayer.x, this.localPlayer.y);
    }
  }

  // ----------------------------------------------------
  // 3. INTERPOLATION ENGINE (LERP)
  // ----------------------------------------------------
  interpolateRemotePlayers(dt) {
    // Smoothing factor: higher = faster snap, lower = smoother lag-compensation
    // Adjust value (10-15) based on network tick frequency
    const lerpFactor = Math.min(1.0, 12 * dt);

    for (const [userId, player] of this.remotePlayers.entries()) {
      // Linear Interpolation: current = current + (target - current) * factor
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
    }
  }

  // ----------------------------------------------------
  // 4. MAIN GAME & RENDER LOOP
  // ----------------------------------------------------
  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(currentTime) {
    // Delta time in seconds
    const dt = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // 1. Process client input & predict local movement
    this.processLocalInput(dt);

    // 2. Interpolate remote player positions toward latest server targets
    this.interpolateRemotePlayers(dt);

    // 3. Draw frame
    this.render();

    // Request next frame
    requestAnimationFrame(this.loop.bind(this));
  }

  // ----------------------------------------------------
  // 5. RENDERING
  // ----------------------------------------------------
  render() {
    // Clear screen
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid background
    this.drawGrid();

    // Draw remote players (Blue)
    for (const [userId, player] of this.remotePlayers.entries()) {
      this.drawPlayer(player.x, player.y, '#3b82f6', 'Remote Player');
    }

    // Draw local player (Green)
    this.drawPlayer(this.localPlayer.x, this.localPlayer.y, '#10b981', 'You');
  }

  drawPlayer(x, y, color, label) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, 16, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.stroke();

    // Draw label above player
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, x, y - 24);
  }

  drawGrid() {
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
}