const WORDS = [
  'Microwave',
  'Karaoke',
  'Traffic',
  'Wedding',
  'Passport',
  'Sunglasses',
  'Popcorn',
  'Airport',
  'Umbrella',
  'Barbecue',
  'Toothbrush',
  'Supermarket',
  'Birthday Cake',
  'Roller Coaster',
  'Alarm Clock',
  'Hairdresser',
  'Photographer',
  'Football',
  'Coconut',
  'Pillow',
  'Taxi',
  'Gym',
  'Restaurant',
  'Beach',
  'Raincoat',
  'Perfume',
  'Backpack',
  'Elevator',
  'Netflix',
  'Headphones'
];

const TURN_SECONDS = 5 * 60;
const WORDS_PER_TEAM = 10;
const RECONNECT_SECONDS = 2 * 60;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createGameState(room) {
  const players = shuffle(room.players.filter((player) => player.connected))
    .map((player, index) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      teamId: index % 2 === 0 ? 'team-1' : 'team-2',
      connected: true
    }));
  const words = shuffle(WORDS).slice(0, WORDS_PER_TEAM * 2);
  const teams = [
    { id: 'team-1', name: 'Team 1', score: 0, words: words.slice(0, WORDS_PER_TEAM), describerSessionToken: null },
    { id: 'team-2', name: 'Team 2', score: 0, words: words.slice(WORDS_PER_TEAM), describerSessionToken: null }
  ];

  return {
    id: 'describe-the-word',
    name: 'Describe the Word',
    players,
    teams,
    totalWords: WORDS_PER_TEAM,
    turnSeconds: TURN_SECONDS,
    reconnectSeconds: RECONNECT_SECONDS,
    currentTeamIndex: 0,
    nominationTeamIndex: 0,
    nominationMode: 'initial',
    pendingNomination: null,
    currentWordIndex: 0,
    wordActionNumber: 1,
    wordsAttempted: 0,
    skippedWordIndexes: [],
    revisiting: false,
    word: null,
    turnNumber: 1,
    status: 'nominating',
    turnStartedAt: null,
    deadlineAt: null,
    reconnectDeadlineAt: null,
    remainingMs: null,
    history: [],
    result: null
  };
}

function getCurrentTeam(gameState) {
  return gameState.teams[gameState.currentTeamIndex];
}

function getNominationTeam(gameState) {
  if (gameState.nominationMode === 'replacement') {
    return getCurrentTeam(gameState);
  }
  return gameState.teams[gameState.nominationTeamIndex];
}

function beginTurn(gameState, now) {
  const team = getCurrentTeam(gameState);
  gameState.word = team.words[0];
  gameState.currentWordIndex = 0;
  gameState.wordActionNumber = 1;
  gameState.wordsAttempted = 0;
  gameState.skippedWordIndexes = [];
  gameState.revisiting = false;
  gameState.status = 'playing';
  gameState.turnStartedAt = now;
  gameState.deadlineAt = now + gameState.turnSeconds * 1000;
  gameState.reconnectDeadlineAt = null;
  gameState.remainingMs = null;
  gameState.pendingNomination = null;
  const describer = gameState.players.find((player) => player.sessionToken === team.describerSessionToken);
  if (!describer || !describer.connected) {
    gameState.remainingMs = gameState.turnSeconds * 1000;
    gameState.deadlineAt = null;
    gameState.reconnectDeadlineAt = now + gameState.reconnectSeconds * 1000;
    gameState.status = 'paused-reconnect';
  }
}

function resumeTurn(gameState, now) {
  const team = getCurrentTeam(gameState);
  gameState.word = team.words[gameState.currentWordIndex];
  gameState.status = 'playing';
  gameState.turnStartedAt = now;
  gameState.deadlineAt = now + gameState.remainingMs;
  gameState.reconnectDeadlineAt = null;
  gameState.remainingMs = null;
  gameState.pendingNomination = null;
}

function nominateDescriber(gameState, actorSessionToken, nomineeSessionToken) {
  if (!gameState || !['nominating', 'replacement-nomination'].includes(gameState.status)) {
    throw new Error('The team is not choosing a describer right now.');
  }
  const team = getNominationTeam(gameState);
  const actor = gameState.players.find((player) => player.sessionToken === actorSessionToken);
  const nominee = gameState.players.find((player) => player.sessionToken === nomineeSessionToken);
  if (
    !team
    || !actor
    || actor.teamId !== team.id
    || !nominee
    || nominee.teamId !== team.id
    || !nominee.connected
  ) {
    throw new Error('Only teammates can nominate a describer from their team.');
  }
  if (actorSessionToken === nomineeSessionToken) {
    throw new Error('Ask a teammate to nominate you as describer.');
  }

  gameState.pendingNomination = nomineeSessionToken;
  return gameState;
}

function respondToNomination(gameState, sessionToken, accepted, now = Date.now()) {
  if (!gameState || !['nominating', 'replacement-nomination'].includes(gameState.status)) {
    throw new Error('There is no describer nomination to answer.');
  }
  if (gameState.pendingNomination !== sessionToken) {
    throw new Error('Only the nominated player can accept or decline.');
  }
  if (typeof accepted !== 'boolean') {
    throw new Error('Choose whether to accept the describer nomination.');
  }

  if (!accepted) {
    gameState.pendingNomination = null;
    return gameState;
  }

  const team = getNominationTeam(gameState);
  team.describerSessionToken = sessionToken;
  gameState.pendingNomination = null;

  if (gameState.nominationMode === 'replacement') {
    resumeTurn(gameState, now);
    gameState.nominationMode = 'initial';
    return gameState;
  }

  gameState.nominationTeamIndex += 1;
  if (gameState.nominationTeamIndex >= gameState.teams.length) {
    beginTurn(gameState, now);
  }
  return gameState;
}

function advanceToNextWord(gameState, now) {
  const team = getCurrentTeam(gameState);
  if (!gameState.revisiting && gameState.wordsAttempted < gameState.totalWords) {
    gameState.currentWordIndex = gameState.wordsAttempted;
    gameState.word = team.words[gameState.currentWordIndex];
    return gameState;
  }

  if (!gameState.revisiting && gameState.skippedWordIndexes.length > 0) {
    gameState.revisiting = true;
  }
  if (gameState.revisiting && gameState.skippedWordIndexes.length > 0) {
    gameState.currentWordIndex = gameState.skippedWordIndexes.shift();
    gameState.word = team.words[gameState.currentWordIndex];
    return gameState;
  }

  return finishTeamTurn(gameState, now);
}

function finishTeamTurn(gameState, now) {
  if (gameState.currentTeamIndex + 1 >= gameState.teams.length) {
    gameState.status = 'results';
    gameState.deadlineAt = null;
    gameState.reconnectDeadlineAt = null;
    gameState.word = null;
    const scores = gameState.teams
      .map(({ name, score }) => ({ name, score }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    gameState.result = {
      scores,
      winner: scores[0].score === scores[1].score ? null : scores[0].name,
      isDraw: scores[0].score === scores[1].score
    };
    return gameState;
  }

  gameState.currentTeamIndex += 1;
  gameState.turnNumber += 1;
  beginTurn(gameState, now);
  return gameState;
}

function resolveWord(gameState, sessionToken, action, wordActionNumber, now = Date.now()) {
  if (!gameState || gameState.status !== 'playing') {
    throw new Error('The Describe the Word turn is not active.');
  }
  if (!['correct', 'skip'].includes(action)) {
    throw new Error('Choose Correct or Skip.');
  }
  if (wordActionNumber !== gameState.wordActionNumber) {
    throw new Error('This word has already been resolved. Wait for the next word.');
  }
  const team = getCurrentTeam(gameState);
  if (team.describerSessionToken !== sessionToken) {
    throw new Error('Only the describer can control the words.');
  }
  if (now >= gameState.deadlineAt) {
    return finishTeamTurn(gameState, now);
  }

  const word = gameState.word;
  const wordIndex = gameState.currentWordIndex;
  if (action === 'correct') {
    team.score += 1;
  } else {
    gameState.skippedWordIndexes.push(wordIndex);
  }
  gameState.history.push({
    team: team.name,
    describerSessionToken: team.describerSessionToken,
    word,
    action,
    resolvedAt: now
  });
  if (!gameState.revisiting) {
    gameState.wordsAttempted += 1;
  }
  gameState.wordActionNumber += 1;

  return advanceToNextWord(gameState, now);
}

function handleTimeout(gameState, expectedDeadlineAt, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'playing'
    || gameState.deadlineAt !== expectedDeadlineAt
    || now < expectedDeadlineAt
  ) {
    return gameState;
  }
  return finishTeamTurn(gameState, now);
}

function handlePlayerDisconnected(gameState, sessionToken, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'playing'
    || getCurrentTeam(gameState).describerSessionToken !== sessionToken
  ) {
    return gameState;
  }

  gameState.remainingMs = Math.max(0, gameState.deadlineAt - now);
  gameState.deadlineAt = null;
  gameState.reconnectDeadlineAt = now + gameState.reconnectSeconds * 1000;
  gameState.status = 'paused-reconnect';
  return gameState;
}

function handlePlayerReconnected(gameState, sessionToken, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'paused-reconnect'
    || getCurrentTeam(gameState).describerSessionToken !== sessionToken
  ) {
    return gameState;
  }
  resumeTurn(gameState, now);
  return gameState;
}

function handleReconnectTimeout(gameState, expectedDeadlineAt, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'paused-reconnect'
    || gameState.reconnectDeadlineAt !== expectedDeadlineAt
    || now < expectedDeadlineAt
  ) {
    return gameState;
  }
  gameState.status = 'replacement-nomination';
  gameState.nominationMode = 'replacement';
  gameState.reconnectDeadlineAt = null;
  gameState.pendingNomination = null;
  return gameState;
}

function endEarly(gameState, isHost, now = Date.now()) {
  if (!gameState) {
    throw new Error('Game not found.');
  }
  if (!isHost) {
    throw new Error('Only the host can end the game early.');
  }
  gameState.status = 'results';
  gameState.endedEarly = true;
  gameState.deadlineAt = null;
  gameState.reconnectDeadlineAt = null;
  gameState.word = null;
  const scores = gameState.teams
    .map(({ name, score }) => ({ name, score }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const isDraw = scores.length > 1 && scores[0].score === scores[1].score;
  gameState.result = {
    scores,
    winner: isDraw ? null : (scores[0] ? scores[0].name : null),
    isDraw
  };
  return gameState;
}

module.exports = {
  TURN_SECONDS,
  WORDS_PER_TEAM,
  RECONNECT_SECONDS,
  createGameState,
  nominateDescriber,
  respondToNomination,
  resolveWord,
  handleTimeout,
  handlePlayerDisconnected,
  handlePlayerReconnected,
  handleReconnectTimeout,
  endEarly
};
