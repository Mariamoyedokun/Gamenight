const TURN_SECONDS = 60;
const MAX_GUESSES = 2;

const IDENTITIES = [
  { name: 'Cristiano Ronaldo', aliases: ['ronaldo', 'cr7', 'cristiano'] },
  { name: 'Beyoncé', aliases: ['beyonce', 'queen bey'] },
  { name: 'Wizkid', aliases: ['wiz', 'ayomide balogun'] },
  { name: 'Davido', aliases: ['david adeleke', 'ovo'] },
  { name: 'Burna Boy', aliases: ['burna', 'damini ogulu'] },
  { name: 'Ayra Starr', aliases: ['ayra', 'oyinkansola'] },
  { name: 'Rema', aliases: ['rema boy', 'divine ikubor'] },
  { name: 'Tems', aliases: ['temilade openiyi'] },
  { name: 'Rihanna', aliases: ['rihanna', 'robyn rihanna'] },
  { name: 'Spider-Man', aliases: ['spiderman', 'peter parker'] },
  { name: 'Wednesday Addams', aliases: ['wednesday', 'addams'] },
  { name: 'Serena Williams', aliases: ['serena'] },
  { name: 'Lionel Messi', aliases: ['messi', 'leo messi'] },
  { name: 'SpongeBob SquarePants', aliases: ['spongebob', 'sponge bob'] },
  { name: 'DJ Chicken', aliases: ['djchicken', 'dj chicken'] },
  { name: 'Funke Akindele', aliases: ['funke', 'jenifa', 'jenifa'] },
  { name: 'Timini Egbuson', aliases: ['timini'] },
  { name: 'Sola Sobowale', aliases: ['sola', 'mummy shalewa'] },
  { name: 'Femi Adebayo', aliases: ['femi'] },
  { name: 'Tiwa Savage', aliases: ['tiwa'] },
  { name: 'Don Jazzy', aliases: ['don jazzy', 'don baba j'] },
  { name: 'Peller', aliases: ['habeeb hamzat', 'peller boy'] },
  { name: 'Barbie', aliases: ['barbie doll'] },
  { name: 'Donald Trump', aliases: ['trump'] },
  { name: 'Bola Tinubu', aliases: ['tinubu', 'bola ahmed tinubu'] },
  { name: 'Uche Montana', aliases: ['uche', 'uche montana'] },
  { name: 'Michael Jackson', aliases: ['mj', 'king of pop', 'michael jackson'] },
  { name: 'BTS', aliases: ['bangtan', 'bangtan boys'] },
  { name: 'Barack Obama', aliases: ['obama'] },
  { name: 'Elon Musk', aliases: ['musk'] }
];


function normalizeAnswer(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[-_./]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the)\s+/, '');
}

function isIdentityMatch(guess, canonicalName, aliases = []) {
  const normGuess = normalizeAnswer(guess);
  if (!normGuess) return false;
  const compactGuess = normGuess.replace(/\s+/g, '');

  const candidates = [canonicalName, ...(aliases || [])];
  for (const candidate of candidates) {
    const normCandidate = normalizeAnswer(candidate);
    const compactCandidate = normCandidate.replace(/\s+/g, '');
    if (normGuess === normCandidate || compactGuess === compactCandidate) {
      return true;
    }
  }
  return false;
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
  const shuffledIdentities = shuffle(IDENTITIES);

  const players = connectedPlayers.map((player, index) => {
    const chosen = shuffledIdentities[index % shuffledIdentities.length];
    return {
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      identity: chosen.name,
      aliases: chosen.aliases || [],
      guessesRemaining: MAX_GUESSES,
      guessedCorrectly: false,
      completedInMs: null
    };
  });

  return {
    id: 'who-am-i',
    name: 'Who Am I?',
    players,
    hostSessionToken: room.hostSessionToken,
    currentPlayerIndex: 0,
    totalPlayers: players.length,
    turnSeconds: TURN_SECONDS,
    status: 'ready', // 'ready' -> 'playing' -> 'turn-reveal' -> 'results'
    turnStartedAt: null,
    deadlineAt: null,
    lastGuessCorrect: null,
    currentTurnResult: null,
    turnHistory: [],
    result: null
  };
}

function startTurn(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'ready') {
    throw new Error('Turn cannot be started right now.');
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCurrentPlayer = currentPlayer && currentPlayer.sessionToken === sessionToken;
  const isHost = gameState.hostSessionToken === sessionToken;

  if (!isCurrentPlayer && !isHost) {
    throw new Error('Only the active player or host can start the turn.');
  }

  const now = Date.now();
  gameState.status = 'playing';
  gameState.turnStartedAt = now;
  gameState.deadlineAt = now + gameState.turnSeconds * 1000;
  gameState.lastGuessCorrect = null;
  return gameState;
}

function finishTurn(gameState, guessedCorrectly, now) {
  const player = gameState.players[gameState.currentPlayerIndex];
  const identity = player.identity;
  const completedInMs = guessedCorrectly
    ? Math.min(gameState.turnSeconds * 1000, now - gameState.turnStartedAt)
    : null;

  player.guessedCorrectly = guessedCorrectly;
  player.completedInMs = completedInMs;

  gameState.currentTurnResult = {
    displayName: player.displayName,
    identity,
    guessedCorrectly,
    completedInMs,
    reason: guessedCorrectly
      ? 'Guessed correctly!'
      : player.guessesRemaining === 0
        ? 'Used all 2 guesses.'
        : 'Time expired.'
  };

  gameState.turnHistory.push({ ...gameState.currentTurnResult });
  gameState.status = 'turn-reveal';
  gameState.deadlineAt = null;
  gameState.lastGuessCorrect = null;
  return gameState;
}

function submitGuess(gameState, sessionToken, guess, now = Date.now()) {
  if (!gameState || gameState.status !== 'playing') {
    throw new Error('This round is not accepting guesses.');
  }

  const player = gameState.players[gameState.currentPlayerIndex];
  if (!player || player.sessionToken !== sessionToken) {
    throw new Error('It is not your turn to guess.');
  }

  if (now >= gameState.deadlineAt) {
    return finishTurn(gameState, false, gameState.deadlineAt);
  }

  const normalizedGuess = normalizeAnswer(guess);
  if (!normalizedGuess || normalizedGuess.length > 50) {
    throw new Error('Enter a guess between 1 and 50 characters.');
  }

  if (isIdentityMatch(guess, player.identity, player.aliases)) {
    return finishTurn(gameState, true, now);
  }

  player.guessesRemaining -= 1;
  gameState.lastGuessCorrect = false;

  if (player.guessesRemaining === 0) {
    return finishTurn(gameState, false, now);
  }

  return gameState;
}

function handleTimeout(gameState, expectedDeadlineAt, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'playing'
    || gameState.deadlineAt !== expectedDeadlineAt
    || now < gameState.deadlineAt
  ) {
    return gameState;
  }

  return finishTurn(gameState, false, expectedDeadlineAt);
}

function nextPlayerTurn(gameState, isHost) {
  if (!gameState || gameState.status !== 'turn-reveal') {
    throw new Error('Cannot advance until turn is revealed.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next player.');
  }

  if (gameState.currentPlayerIndex + 1 >= gameState.players.length) {
    return finishGame(gameState);
  }

  gameState.currentPlayerIndex += 1;
  gameState.status = 'ready';
  gameState.turnStartedAt = null;
  gameState.deadlineAt = null;
  gameState.lastGuessCorrect = null;
  gameState.currentTurnResult = null;
  return gameState;
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.deadlineAt = null;

  const successfulTurns = gameState.turnHistory
    .filter((turn) => turn.guessedCorrectly && typeof turn.completedInMs === 'number')
    .sort((a, b) => a.completedInMs - b.completedInMs);

  const fastestTime = successfulTurns[0]?.completedInMs ?? null;
  const winners = fastestTime === null
    ? []
    : successfulTurns
      .filter((turn) => turn.completedInMs === fastestTime)
      .map((turn) => turn.displayName);

  gameState.result = {
    fastestTime,
    winners,
    rankings: successfulTurns.map(({ displayName, completedInMs }) => ({
      displayName,
      completedInMs
    })),
    history: [...gameState.turnHistory]
  };

  return gameState;
}

module.exports = {
  TURN_SECONDS,
  MAX_GUESSES,
  IDENTITIES,
  createGameState,
  startTurn,
  submitGuess,
  handleTimeout,
  nextPlayerTurn,
  finishGame
};
