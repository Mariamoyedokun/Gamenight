const DEFAULT_HOT_TAKES = [
  'Maybe Situationships are not that bad.',
  'Sagging is the modern day madness.',
  'The love of your life is not on Twitter.',
  'You cannot be friends with your ex.',
  'Abortion is healthcare not a murder.',
  'Being effeminate does not make you gay or less of a man.',
  'Coming back home after uni is okay.',
  'People that does not like plantains are clout chasers.'
];

const TAKES_PER_GAME = 5;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createGameState(room) {
  const players = room.players
    .filter((player) => player.connected)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      choice: null, // 'agree' | 'disagree'
      locked: false
    }));

  const prompts = shuffle(DEFAULT_HOT_TAKES).slice(0, TAKES_PER_GAME);

  return {
    id: 'hot-take-game',
    name: 'Hot Take Game',
    prompts,
    promptIndex: 0,
    totalTakes: prompts.length,
    prompt: prompts[0],
    players,
    status: 'voting',
    reveal: null,
    result: null
  };
}

function submitChoice(gameState, sessionToken, choice, connectedTokens = null) {
  if (!gameState || gameState.status !== 'voting') {
    throw new Error('Submissions are not open.');
  }

  if (!['agree', 'disagree'].includes(choice)) {
    throw new Error('Choice must be agree or disagree.');
  }

  const player = gameState.players.find((entry) => entry.sessionToken === sessionToken);
  if (!player) {
    throw new Error('You are not part of this game.');
  }

  if (player.locked) {
    throw new Error('Your choice is already locked in.');
  }

  player.choice = choice;
  player.locked = true;

  const eligible = Array.isArray(connectedTokens)
    ? gameState.players.filter((p) => connectedTokens.includes(p.sessionToken))
    : gameState.players;

  const allSubmitted = eligible.length > 0 && eligible.every((entry) => entry.locked && entry.choice !== null);
  if (allSubmitted) {
    resolveReveal(gameState);
  }

  return gameState;
}

function resolveReveal(gameState) {
  const agreePlayers = gameState.players
    .filter((p) => p.choice === 'agree')
    .map((p) => ({ displayName: p.displayName, sessionToken: p.sessionToken }));

  const disagreePlayers = gameState.players
    .filter((p) => p.choice === 'disagree')
    .map((p) => ({ displayName: p.displayName, sessionToken: p.sessionToken }));

  const hasAgree = agreePlayers.length > 0;
  const hasDisagree = disagreePlayers.length > 0;

  let agreeSpeaker = null;
  let disagreeSpeaker = null;

  if (hasAgree && hasDisagree) {
    agreeSpeaker = agreePlayers[Math.floor(Math.random() * agreePlayers.length)];
    disagreeSpeaker = disagreePlayers[Math.floor(Math.random() * disagreePlayers.length)];
  }

  gameState.status = 'reveal';
  gameState.revealSummary = {
    takeNumber: gameState.promptIndex + 1,
    totalTakes: gameState.totalTakes,
    prompt: gameState.prompt,
    agreePlayers,
    disagreePlayers,
    agreeSpeaker,
    disagreeSpeaker,
    isUnanimous: !hasAgree || !hasDisagree,
    banner: 'DEFEND YOUR POSITION!'
  };
  gameState.reveal = { ...gameState.revealSummary };

  return gameState;
}

function nextTake(gameState, isHost) {
  if (!gameState || !['reveal', 'revealing'].includes(gameState.status)) {
    throw new Error('Cannot advance until this hot take is revealed.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next hot take.');
  }

  if (gameState.promptIndex + 1 >= gameState.totalTakes) {
    return finishGame(gameState);
  }

  gameState.promptIndex += 1;
  gameState.prompt = gameState.prompts[gameState.promptIndex];
  gameState.status = 'voting';
  gameState.reveal = null;
  gameState.players.forEach((player) => {
    player.choice = null;
    player.locked = false;
  });

  return gameState;
}

function skipOrEndGame(gameState, isHost) {
  if (!isHost) {
    throw new Error('Only the host can end the game.');
  }
  return finishGame(gameState);
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.result = {
    message: 'Hot Take Game completed! Defend your positions with honor.',
    totalTakes: gameState.totalTakes
  };
  return gameState;
}

module.exports = {
  DEFAULT_HOT_TAKES,
  TAKES_PER_GAME,
  createGameState,
  submitChoice,
  nextTake,
  skipOrEndGame
};
