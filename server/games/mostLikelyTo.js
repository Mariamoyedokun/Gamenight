const DEFAULT_PROMPTS = [
  'Who is most likely to get married first?',
  'Who is most likely to ghost someone?',
  'Who is most likely to fall in love with someone they just met?',
  'Who is most likely to sleep through an emergency?',
  'Who is most likely to spend all their money on something completely unnecessary?',
  'Who is most likely to lie their way out of trouble?',
  'Who is most likely to get arrested for something ridiculous?',
  'Who is most likely to travel out and never return?',
  'Who is most likely to become internet famous?',
  'Who is most likely to have a situationship?',
  'Who is most likely to cut everyone off after uni?',
  'Who is most likely to say “I’m on my way” while they’re still at home?',
  'Who is most likely to never find love?'
];

const QUESTIONS_PER_GAME = 10;
const SUSPENSE_SECONDS = 3;

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
      vote: null
    }));

  const prompts = shuffle(DEFAULT_PROMPTS).slice(0, QUESTIONS_PER_GAME);

  return {
    id: 'most-likely-to',
    name: 'Most Likely To',
    prompts,
    promptIndex: 0,
    totalQuestions: prompts.length,
    prompt: prompts[0],
    players,
    status: 'voting',
    suspenseDeadlineAt: null,
    reveal: null,
    result: null
  };
}

function submitVote(gameState, voterSessionToken, targetSessionToken, connectedTokens = null) {
  if (!gameState || gameState.status !== 'voting') {
    throw new Error('Voting is not open.');
  }

  const voter = gameState.players.find((player) => player.sessionToken === voterSessionToken);
  const target = gameState.players.find((player) => player.sessionToken === targetSessionToken);

  if (!voter || !target) {
    throw new Error('Invalid player selection.');
  }

  if (voterSessionToken === targetSessionToken) {
    throw new Error('You cannot vote for yourself.');
  }

  if (voter.vote !== null) {
    throw new Error('You have already submitted your vote.');
  }

  voter.vote = targetSessionToken;

  const eligible = Array.isArray(connectedTokens)
    ? gameState.players.filter((p) => connectedTokens.includes(p.sessionToken))
    : gameState.players;

  const allVoted = eligible.length > 0 && eligible.every((player) => player.vote !== null);
  if (allVoted) {
    gameState.status = 'suspense';
    gameState.suspenseDeadlineAt = Date.now() + SUSPENSE_SECONDS * 1000;
  }

  return gameState;
}

function resolveSuspense(gameState, expectedDeadlineAt) {
  if (
    !gameState
    || gameState.status !== 'suspense'
    || gameState.suspenseDeadlineAt !== expectedDeadlineAt
    || Date.now() < expectedDeadlineAt
  ) {
    return null;
  }

  const counts = new Map();
  gameState.players.forEach((player) => {
    counts.set(player.sessionToken, 0);
  });

  gameState.players.forEach((player) => {
    if (player.vote && counts.has(player.vote)) {
      counts.set(player.vote, counts.get(player.vote) + 1);
    }
  });

  const summary = gameState.players
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      votes: counts.get(player.sessionToken) || 0,
      count: counts.get(player.sessionToken) || 0
    }))
    .sort((a, b) => b.votes - a.votes || a.displayName.localeCompare(b.displayName));

  const maxVotes = summary[0]?.votes || 0;
  const leaders = summary
    .filter((entry) => entry.votes === maxVotes && maxVotes > 0)
    .map((entry) => ({ displayName: entry.displayName, votes: entry.votes }));

  const topPlayerNames = leaders.map((l) => l.displayName);

  gameState.status = 'reveal';
  gameState.suspenseDeadlineAt = null;
  gameState.revealSummary = {
    leaders,
    tally: summary,
    maxVotes,
    isTie: leaders.length > 1
  };
  gameState.reveal = {
    summary,
    maxVotes,
    spotlight: topPlayerNames,
    isTie: topPlayerNames.length > 1,
    questionNumber: gameState.promptIndex + 1,
    totalQuestions: gameState.totalQuestions
  };

  return gameState;
}

function nextQuestion(gameState, isHost) {
  if (!gameState || !['reveal', 'revealing'].includes(gameState.status)) {
    throw new Error('Cannot advance until votes are revealed.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next question.');
  }

  if (gameState.promptIndex + 1 >= gameState.totalQuestions) {
    return finishGame(gameState);
  }

  gameState.promptIndex += 1;
  gameState.prompt = gameState.prompts[gameState.promptIndex];
  gameState.status = 'voting';
  gameState.suspenseDeadlineAt = null;
  gameState.reveal = null;
  gameState.players.forEach((player) => {
    player.vote = null;
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
  gameState.suspenseDeadlineAt = null;
  gameState.result = {
    message: 'Most Likely To completed! No points awarded.',
    totalQuestions: gameState.totalQuestions
  };
  return gameState;
}

module.exports = {
  DEFAULT_PROMPTS,
  QUESTIONS_PER_GAME,
  SUSPENSE_SECONDS,
  createGameState,
  submitVote,
  resolveSuspense,
  nextQuestion,
  skipOrEndGame
};
