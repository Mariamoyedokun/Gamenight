const TURN_SECONDS = 5;

const PROMPTS = [
  'Name 3 things you would do if you had the house to yourself.',
  'Name 3 things you could buy with ₦1,000.',
  'Name 3 animals that live in the ocean.',
  'Name 3 things that can ruin a good outfit.',
  'Name 3 afrobeat artists.',
  'Name 3 things that are usually yellow.',
  'Name 3 reality/dating TV shows.',
  'Name 3 things people pretend to like.',
  'Name 3 things you would order if someone else was paying.',
  'Name 3 things that you would never wear.',
  'Name 3 things you do right after waking up.',
  'Name 3 board games.'
];

function assignJudge(hostSessionToken, activeSessionToken, players) {
  if (activeSessionToken !== hostSessionToken) {
    // Normal case: host is always the judge
    return hostSessionToken;
  }
  // Host is the active player: pick a random other connected player
  const others = players.filter((p) => p.sessionToken !== activeSessionToken);
  if (!others.length) return null;
  return others[Math.floor(Math.random() * others.length)].sessionToken;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createGameState(room) {
  const connectedPlayers = room.players.filter((player) => player.connected);
  const playerTokens = shuffle(connectedPlayers.map((player) => player.sessionToken));
  const prompts = shuffle(PROMPTS);

  const players = connectedPlayers.map((player) => ({
    sessionToken: player.sessionToken,
    displayName: player.displayName
  }));

  const activeToken = playerTokens[0];
  const activePlayer = players.find((p) => p.sessionToken === activeToken);
  const judgeToken = assignJudge(room.hostSessionToken, activeToken, players);

  return {
    id: 'five-second-rule',
    name: '5-Second Rule',
    players,
    turnOrder: playerTokens,
    turnIndex: 0,
    totalTurns: playerTokens.length,
    activeSessionToken: activeToken,
    activeDisplayName: activePlayer ? activePlayer.displayName : '',
    hostSessionToken: room.hostSessionToken,
    judgeSessionToken: judgeToken,
    prompt: prompts[0],
    prompts,
    timerSeconds: TURN_SECONDS,
    status: 'ready', // 'ready' -> 'answering' -> 'judging' -> 'turn-result' -> 'results'
    deadlineAt: null,
    turnResult: null, // 'pass' | 'fail'
    turnHistory: [],
    result: null
  };
}

function startTimer(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'ready') {
    throw new Error('Timer cannot be started right now.');
  }

  // Active player or host can trigger start of the 5-second countdown
  const isHost = gameState.hostSessionToken === sessionToken;
  const isActive = gameState.activeSessionToken === sessionToken;
  if (!isHost && !isActive) {
    throw new Error('Only the active player or host can start the 5-second timer.');
  }

  const now = Date.now();
  gameState.status = 'answering';
  gameState.deadlineAt = now + gameState.timerSeconds * 1000;
  return gameState;
}

function handleTimeout(gameState, expectedDeadlineAt, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'answering'
    || gameState.deadlineAt !== expectedDeadlineAt
    || now < gameState.deadlineAt
  ) {
    return gameState;
  }

  gameState.status = 'judging';
  gameState.deadlineAt = null;
  return gameState;
}

function recordJudgment(gameState, sessionToken, judgment) {
  if (!gameState || gameState.status !== 'judging') {
    throw new Error('Judging is not open.');
  }

  if (!['pass', 'fail'].includes(judgment)) {
    throw new Error('Judgment must be pass or fail.');
  }

  if (sessionToken === gameState.activeSessionToken) {
    throw new Error('You cannot judge your own turn.');
  }

  if (sessionToken !== gameState.judgeSessionToken) {
    throw new Error('You are not the assigned judge for this turn.');
  }

  return applyTurnResult(gameState, judgment);
}

function applyTurnResult(gameState, outcome) {
  gameState.turnResult = outcome;
  gameState.lastJudgment = outcome;
  gameState.status = 'turn-result';
  gameState.turnHistory.push({
    turnNumber: gameState.turnIndex + 1,
    displayName: gameState.activeDisplayName,
    prompt: gameState.prompt,
    outcome,
    judgment: outcome
  });
  return gameState;
}

function nextTurn(gameState, isHost) {
  if (!gameState || gameState.status !== 'turn-result') {
    throw new Error('Cannot advance until turn is judged.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next player.');
  }

  if (gameState.turnIndex + 1 >= gameState.totalTurns) {
    return finishGame(gameState);
  }

  gameState.turnIndex += 1;
  gameState.activeSessionToken = gameState.turnOrder[gameState.turnIndex];
  const active = gameState.players.find((p) => p.sessionToken === gameState.activeSessionToken);
  gameState.activeDisplayName = active ? active.displayName : '';
  gameState.prompt = gameState.prompts[gameState.turnIndex % gameState.prompts.length];
  gameState.judgeSessionToken = assignJudge(gameState.hostSessionToken, gameState.activeSessionToken, gameState.players);
  gameState.status = 'ready';
  gameState.deadlineAt = null;
  gameState.turnResult = null;

  return gameState;
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.deadlineAt = null;
  gameState.result = {
    message: 'All players completed their 5-Second turns! No leaderboard — just fast fun.',
    turnHistory: [...gameState.turnHistory]
  };
  return gameState;
}

module.exports = {
  TURN_SECONDS,
  PROMPTS,
  createGameState,
  startTimer,
  handleTimeout,
  recordJudgment,
  nextTurn,
  finishGame
};
