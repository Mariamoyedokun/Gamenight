const MAX_SPILLS = 5;
const CONSEQUENCES = [
  'Let the group decide your next tweet/story and it has to stay up for 24hrs.',
  'Call your current/ex situationship and tell them you love them.',
  'Let another player choose your profile picture for 10 minutes.',
  'Send a random “I just remembered something about you 👀” text to someone.',
  'Tell an embarrassing story from your childhood.',
  'Let the person on your left ask you one question you have to answer honestly.',
  'Choose another player to take the consequence with you.',
  'Let the group choose your display name for the rest of game night.'
];

function createGameState(room) {
  const players = room.players
    .filter((player) => player.connected)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName
    }));

  return {
    id: 'do-not-spill',
    name: 'Do Not Spill',
    status: 'playing', // Starts playing immediately - no unnecessary setup
    players,
    hostSessionToken: room.hostSessionToken,
    spills: 0,
    maxSpills: MAX_SPILLS,
    activeSpill: null,
    pendingSpills: [],
    history: [],
    result: null
  };
}

function recordSpill(gameState, sessionToken) {
  if (!gameState || !['playing', 'spinning', 'decision'].includes(gameState.status)) {
    throw new Error('A spill cannot be recorded right now.');
  }
  if (gameState.spills >= gameState.maxSpills) {
    throw new Error('The game has already recorded five spills.');
  }
  const player = gameState.players.find((entry) => entry.sessionToken === sessionToken);
  if (!player) {
    throw new Error('You are not part of this game.');
  }

  gameState.spills += 1;
  const spill = {
    sessionToken: player.sessionToken,
    displayName: player.displayName,
    consequence: null,
    decision: null
  };

  if (!gameState.activeSpill) {
    gameState.activeSpill = spill;
    gameState.status = 'spinning';
  } else {
    gameState.pendingSpills.push(spill);
  }
  return gameState;
}

function spinWheel(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'spinning' || !gameState.activeSpill) {
    throw new Error('The consequence wheel is not ready to spin.');
  }
  if (gameState.activeSpill.sessionToken !== sessionToken) {
    throw new Error('Only the player who spilled can spin the wheel.');
  }

  const index = Math.floor(Math.random() * CONSEQUENCES.length);
  gameState.activeSpill.consequence = CONSEQUENCES[index];
  gameState.status = 'decision';
  return gameState;
}

function decideConsequence(gameState, sessionToken, accepted) {
  if (!gameState || gameState.status !== 'decision' || !gameState.activeSpill) {
    throw new Error('There is no consequence awaiting a decision.');
  }
  if (gameState.activeSpill.sessionToken !== sessionToken) {
    throw new Error('Only the player who spilled can accept or pass.');
  }
  if (typeof accepted !== 'boolean') {
    throw new Error('Choose Accept or Pass.');
  }

  gameState.activeSpill.decision = accepted ? 'accepted' : 'passed';
  gameState.history.push({
    spill: gameState.spills,
    displayName: gameState.activeSpill.displayName,
    consequence: gameState.activeSpill.consequence,
    decision: gameState.activeSpill.decision
  });
  gameState.activeSpill = null;

  if (gameState.pendingSpills.length > 0) {
    gameState.activeSpill = gameState.pendingSpills.shift();
    gameState.status = 'spinning';
    return gameState;
  }

  if (gameState.spills >= gameState.maxSpills) {
    return finishGame(gameState);
  }

  gameState.status = 'playing';
  return gameState;
}

function endGame(gameState, isHost) {
  if (!isHost) {
    throw new Error('Only the host can end the game early.');
  }
  return finishGame(gameState);
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.activeSpill = null;
  gameState.pendingSpills = [];
  gameState.result = {
    spills: gameState.spills,
    maxSpills: gameState.maxSpills,
    history: gameState.history.map((entry) => ({ ...entry }))
  };
  return gameState;
}

module.exports = {
  MAX_SPILLS,
  CONSEQUENCES,
  createGameState,
  recordSpill,
  spinWheel,
  decideConsequence,
  endGame
};
