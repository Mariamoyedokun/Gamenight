const TURN_SECONDS = 60;
const WORDS = [
  'airplane',
  'avocado',
  'backpack',
  'basketball',
  'birthday',
  'campfire',
  'chocolate',
  'dinosaur',
  'firefighter',
  'guitar',
  'kangaroo',
  'lighthouse',
  'motorcycle',
  'popcorn',
  'rainbow',
  'snowman',
  'spaceship',
  'watermelon',
  'alligator',
  'balloon',
  'bicycle',
  'butterfly',
  'cactus',
  'calendar',
  'candle',
  'carrot',
  'castle',
  'ceiling',
  'cheetah',
  'cloud',
  'compass',
  'cucumber',
  'dentist',
  'diamond',
  'dolphin',
  'drum',
  'elevator',
  'elephant',
  'envelope',
  'feather',
  'fountain',
  'frisbee',
  'galaxy',
  'giraffe',
  'glacier',
  'hamburger',
  'helicopter',
  'honey',
  'igloo',
  'invention',
  'jellyfish',
  'jigsaw',
  'jungle',
  'keyboard',
  'koala',
  'ladder',
  'lantern',
  'lemonade',
  'marshmallow',
  'mermaid',
  'microscope',
  'moonlight',
  'mountain',
  'necklace',
  'notebook',
  'octopus',
  'ostrich',
  'paintbrush',
  'pancake',
  'parachute',
  'penguin',
  'pineapple',
  'planet',
  'pyramid',
  'quicksand',
  'robot',
  'sandcastle',
  'satellite',
  'seashell',
  'shadow',
  'skateboard',
  'suitcase',
  'sunglasses',
  'telephone',
  'telescope',
  'toothbrush',
  'tornado',
  'treasure',
  'trombone',
  'unicorn',
  'volcano',
  'windmill',
  'yo-yo',
  'zookeeper',
  'wedding',
  'passport',
  'traffic',
  'karaoke',
  'celebrity',
  'influencer',
  'photographer',
  'airport',
  'restaurant',
  'beach',
  'concert',
  'birthday cake',
  'wedding ring',
  'perfume',
  'makeup',
  'football',
  'taxi',
  'umbrella',
  'alarm clock',
  'headphones',
  'mirror',
  'remote control',
  'pizza',
  'ice cream',
  'crush',
  'ex',
  'neighbour',
  'roommate',
  'landlord',
  'barber',
];

function chooseWord(gameState) {
  let availableWords = WORDS.filter((word) => (
    !gameState.usedWords.includes(word) && !gameState.skippedWords.includes(word)
  ));
  if (!availableWords.length && gameState.usedWords.length) {
    gameState.usedWords = [];
    availableWords = WORDS.filter((word) => !gameState.skippedWords.includes(word));
  }
  if (!availableWords.length) {
    return null;
  }
  return availableWords[Math.floor(Math.random() * availableWords.length)];
}

function createGameState(room) {
  const players = room.players
    .filter((player) => player.connected)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      score: 0
    }));

  return {
    id: 'heads-up',
    name: 'Heads Up!',
    players,
    hostSessionToken: room.hostSessionToken,
    currentPlayerIndex: 0,
    turnNumber: 1,
    turnSeconds: TURN_SECONDS,
    wordNumber: 1,
    word: null,
    usedWords: [],
    skippedWords: [],
    status: 'ready', // 'ready' -> 'playing' -> 'turn-summary' -> 'results'
    turnStartedAt: null,
    deadlineAt: null,
    currentTurnHistory: [],
    history: [],
    result: null
  };
}

function startTurn(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'ready') {
    throw new Error('Turn cannot be started right now.');
  }

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const isHost = gameState.hostSessionToken === sessionToken;
  const isActive = activePlayer && activePlayer.sessionToken === sessionToken;

  if (!isHost && !isActive) {
    throw new Error('Only the active player or host can start the turn.');
  }

  const now = Date.now();
  gameState.status = 'playing';
  gameState.turnStartedAt = now;
  gameState.deadlineAt = now + gameState.turnSeconds * 1000;
  gameState.currentTurnHistory = [];
  gameState.word = chooseWord(gameState);
  if (gameState.word) {
    gameState.usedWords.push(gameState.word);
  }
  return gameState;
}

function finishTurn(gameState, now) {
  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  gameState.status = 'turn-summary';
  gameState.deadlineAt = null;
  gameState.word = null;
  gameState.turnSummary = {
    turnNumber: gameState.turnNumber,
    displayName: activePlayer.displayName,
    scoreThisTurn: gameState.currentTurnHistory.filter((entry) => entry.action === 'correct').length,
    totalScore: activePlayer.score,
    history: [...gameState.currentTurnHistory]
  };
  return gameState;
}

function nextPlayerTurn(gameState, isHost) {
  if (!gameState || gameState.status !== 'turn-summary') {
    throw new Error('Cannot advance until turn summary is shown.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next player.');
  }

  const nextIndex = gameState.currentPlayerIndex + 1;
  if (nextIndex >= gameState.players.length) {
    return finishGame(gameState);
  }

  gameState.currentPlayerIndex = nextIndex;
  gameState.turnNumber += 1;
  gameState.status = 'ready';
  gameState.turnStartedAt = null;
  gameState.deadlineAt = null;
  gameState.word = null;
  gameState.wordNumber += 1;
  gameState.currentTurnHistory = [];
  gameState.turnSummary = null;
  return gameState;
}

function advanceWord(gameState, action, actorSessionToken, wordNumber, now = Date.now()) {
  if (!gameState || gameState.status !== 'playing') {
    throw new Error('This Heads Up! turn is no longer active.');
  }
  if (!['correct', 'skip'].includes(action)) {
    throw new Error('Choose Correct or Skip.');
  }
  if (wordNumber && wordNumber !== gameState.wordNumber) {
    return gameState;
  }

  const activePlayer = gameState.players[gameState.currentPlayerIndex];
  const actor = gameState.players.find((player) => player.sessionToken === actorSessionToken);
  if (!actor || !activePlayer) {
    throw new Error('You are not part of this round.');
  }
  if (activePlayer.sessionToken === actorSessionToken) {
    throw new Error('The active player cannot see or control their own word.');
  }
  if (now >= gameState.deadlineAt) {
    return finishTurn(gameState, now);
  }

  const word = gameState.word;
  if (action === 'correct') {
    activePlayer.score += 1;
  } else {
    gameState.skippedWords.push(word);
  }

  const actionRecord = {
    displayName: activePlayer.displayName,
    word,
    action,
    resolvedAt: now
  };
  gameState.history.push(actionRecord);
  gameState.currentTurnHistory.push(actionRecord);

  const nextWord = chooseWord(gameState);
  if (!nextWord) {
    return finishTurn(gameState, now);
  }
  gameState.word = nextWord;
  gameState.usedWords.push(nextWord);
  gameState.wordNumber += 1;
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

  return finishTurn(gameState, now);
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.deadlineAt = null;
  gameState.word = null;

  const scores = [...gameState.players]
    .map(({ displayName, score }) => ({ displayName, score }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  const highestScore = scores[0]?.score || 0;
  const winners = scores.filter((entry) => entry.score === highestScore).map((entry) => entry.displayName);

  gameState.result = {
    scores,
    winners,
    isTie: winners.length > 1,
    history: [...gameState.history]
  };
  return gameState;
}

module.exports = {
  TURN_SECONDS,
  WORDS,
  createGameState,
  startTurn,
  advanceWord,
  handleTimeout,
  nextPlayerTurn,
  finishGame
};
