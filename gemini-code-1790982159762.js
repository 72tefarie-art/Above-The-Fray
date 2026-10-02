// Server-side state tracking
const playerStates = new Map(); // userId -> { x, y, speed, lastProcessedInput }

function handlePlayerInput(userId, inputPayload) {
  let state = playerStates.get(userId);
  if (!state) {
    state = { x: 400, y: 300, speed: 250, lastProcessedInput: 0 };
    playerStates.set(userId, state);
  }

  const { sequenceNumber, dt, dx, dy } = inputPayload;

  // Validate delta time bounds to prevent speed hacks/exploits
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);

  // Calculate movement
  let moveX = dx;
  let moveY = dy;
  if (moveX !== 0 && moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
  }

  const moveDist = state.speed * clampedDt;
  state.x += moveX * moveDist;
  state.y += moveY * moveDist;
  state.lastProcessedInput = sequenceNumber;

  // Broadcast authoritative update to cluster/client
  publishToCluster(state.roomCode, {
    type: 'SERVER_RECONCILE',
    payload: {
      userId,
      lastProcessedInput: state.lastProcessedInput,
      authX: state.x,
      authY: state.y
    }
  });
}