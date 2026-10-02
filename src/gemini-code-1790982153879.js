class PredictionGameEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Local player state
    this.localPlayer = {
      x: 400,
      y: 300,
      speed: 250 // Units per second
    };

    // Prediction & Reconciliation data structures
    this.inputSequenceNumber = 0;
    this.pendingInputs = []; // Queue of { sequenceNumber, dt, inputVector }

    // Input state
    this.keys = {};
    this.lastFrameTime = performance.now();

    this.initInputs();
  }

  initInputs() {
    window.addEventListener('keydown', (e) => (this.keys[e.key] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key] = false));
  }

  // ----------------------------------------------------
  // 1. CLIENT-SIDE PREDICTION
  // ----------------------------------------------------
  processAndPredictInput(dt) {
    // 1. Extract direction vector
    let dx = 0;
    let dy = 0;

    if (this.keys['ArrowUp'] || this.keys['w']) dy -= 1;
    if (this.keys['ArrowDown'] || this.keys['s']) dy += 1;
    if (this.keys['ArrowLeft'] || this.keys['a']) dx -= 1;
    if (this.keys['ArrowRight'] || this.keys['d']) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    // Ignore idle frames if no input is active
    if (dx === 0 && dy === 0) return;

    this.inputSequenceNumber++;

    const inputPayload = {
      sequenceNumber: this.inputSequenceNumber,
      dt: dt,
      dx: dx,
      dy: dy
    };

    // 2. Immediately predict local movement state
    this.applyInput(this.localPlayer, inputPayload);

    // 3. Store in pending queue until server confirms receipt
    this.pendingInputs.push(inputPayload);

    // 4. Send input payload with sequence number to server
    this.sendInputToServer(inputPayload);
  }

  applyInput(entityState, input) {
    const moveDist = entityState.speed * input.dt;
    entityState.x += input.dx * moveDist;
    entityState.y += input.dy * moveDist;
  }

  // ----------------------------------------------------
  // 2. SERVER RECONCILIATION
  // ----------------------------------------------------
  onServerStateUpdate(serverPacket) {
    const { lastProcessedInput, authX, authY } = serverPacket;

    // 1. Roll back local position to authoritative server position
    this.localPlayer.x = authX;
    this.localPlayer.y = authY;

    // 2. Discard all pending inputs that the server has processed
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.sequenceNumber > lastProcessedInput
    );

    // 3. Re-simulate (replay) remaining unacknowledged inputs on top of auth state
    for (const input of this.pendingInputs) {
      this.applyInput(this.localPlayer, input);
    }
  }

  sendInputToServer(inputPayload) {
    // Transmit input over WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'PLAYER_INPUT',
        payload: inputPayload
      }));
    }
  }

  // ----------------------------------------------------
  // 3. GAME LOOP
  // ----------------------------------------------------
  start() {
    requestAnimationFrame(this.loop.bind(this));
  }

  loop(currentTime) {
    const dt = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // Predict input & update client state instantly
    this.processAndPredictInput(dt);

    // Render local predicted state
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Local player (Green)
    this.ctx.beginPath();
    this.ctx.arc(this.localPlayer.x, this.localPlayer.y, 16, 0, Math.PI * 2);
    this.ctx.fillStyle = '#10b981';
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}