const TEST_CONTENT = [
  { category: 'Food', word: 'Burger' },
  { category: 'Food', word: 'Pancakes' },
  { category: 'Food', word: 'Spaghetti' },
  { category: 'Food', word: 'Popcorn' },
  { category: 'Food', word: 'Watermelon' },

  { category: 'Places', word: 'Beach' },
  { category: 'Places', word: 'Cinema' },
  { category: 'Places', word: 'Hospital' },
  { category: 'Places', word: 'Restaurant' },
  { category: 'Places', word: 'Supermarket' },

  { category: 'Animals', word: 'Penguin' },
  { category: 'Animals', word: 'Kangaroo' },
  { category: 'Animals', word: 'Giraffe' },
  { category: 'Animals', word: 'Cheetah' },
  { category: 'Animals', word: 'Octopus' },

  { category: 'Objects', word: 'Backpack' },
  { category: 'Objects', word: 'Mirror' },
  { category: 'Objects', word: 'Headphones' },
  { category: 'Objects', word: 'Suitcase' },
  { category: 'Objects', word: 'Toothbrush' },

  { category: 'Sports', word: 'Football' },
  { category: 'Sports', word: 'Tennis' },
  { category: 'Sports', word: 'Swimming' },
  { category: 'Sports', word: 'Boxing' },
  { category: 'Sports', word: 'Volleyball' },

  { category: 'Movies', word: 'Titanic' },
  { category: 'Movies', word: 'Frozen' },
  { category: 'Movies', word: 'Avatar' },
  { category: 'Movies', word: 'Black Panther' },
  { category: 'Movies', word: 'Home Alone' },

  { category: 'Jobs', word: 'Teacher' },
  { category: 'Jobs', word: 'Doctor' },
  { category: 'Jobs', word: 'Barber' },
  { category: 'Jobs', word: 'Photographer' },
  { category: 'Jobs', word: 'Pilot' },

  { category: 'Weather', word: 'Rain' },
  { category: 'Weather', word: 'Harmattan' },
  { category: 'Weather', word: 'Rainbow' },
  { category: 'Weather', word: 'Heatwave' },
  { category: 'Weather', word: 'Flood' },

  { category: 'Transport', word: 'Taxi' },
  { category: 'Transport', word: 'Motorcycle' },
  { category: 'Transport', word: 'Train' },
  { category: 'Transport', word: 'Helicopter' },
  { category: 'Transport', word: 'Bus' },

  { category: 'Music', word: 'Guitar' },
  { category: 'Music', word: 'Drums' },
  { category: 'Music', word: 'Karaoke' },
  { category: 'Music', word: 'Concert' },
  { category: 'Music', word: 'Microphone' }
];
const CLUE_ROUNDS = 2;
const SUSPENSE_SECONDS = 3;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

function createSpeakingOrder(players, spySessionToken, round) {
  const order = shuffle(players.map((player) => player.sessionToken));
  if (round === 1 && order[0] === spySessionToken && order.length > 1) {
    const replacementIndex = 1 + Math.floor(Math.random() * (order.length - 1));
    [order[0], order[replacementIndex]] = [order[replacementIndex], order[0]];
  }
  return order;
}

function startSuspense(gameState) {
  gameState.status = 'suspense';
  gameState.revealDeadlineAt = Date.now() + SUSPENSE_SECONDS * 1000;
  return gameState;
}

function createGameState(room) {
  const players = room.players
    .filter((player) => player.connected)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      vote: null
    }));
  const completedGames = (room.roundHistory || []).filter((entry) => entry.gameId === 'find-the-spy');
  const previousSpyNames = new Set(
    completedGames.map((entry) => entry.result && entry.result.spyName).filter(Boolean)
  );
  const availableSpies = players.filter((player) => !previousSpyNames.has(player.displayName));
  const spyPool = availableSpies.length ? availableSpies : players;
  const spySessionToken = spyPool[Math.floor(Math.random() * spyPool.length)].sessionToken;
  const previousWords = new Set(
    completedGames.map((entry) => entry.result && entry.result.word).filter(Boolean)
  );
  const availableContent = TEST_CONTENT.filter((entry) => !previousWords.has(entry.word));
  const contentPool = availableContent.length ? availableContent : TEST_CONTENT;
  const secret = contentPool[Math.floor(Math.random() * contentPool.length)];
  const firstOrder = createSpeakingOrder(players, spySessionToken, 1);

  return {
    id: 'find-the-spy',
    name: 'Find the Spy',
    status: 'clue-round',
    players,
    spySessionToken,
    category: secret.category,
    secretWord: secret.word,
    clueRound: 1,
    clueRounds: [{
      round: 1,
      speakingOrder: firstOrder,
      completedSessionTokens: []
    }],
    currentSpeakerIndex: 0,
    voteRound: 1,
    votesSubmitted: 0,
    eligibleVoteTargets: null,
    revealedVoteRounds: [],
    revealDeadlineAt: null,
    accusedSessionTokens: [],
    result: null
  };
}

function markClueDone(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'clue-round') {
    throw new Error('The clue round is not active.');
  }

  const currentRound = gameState.clueRounds[gameState.clueRounds.length - 1];
  const activeSessionToken = currentRound.speakingOrder[gameState.currentSpeakerIndex];
  if (activeSessionToken !== sessionToken) {
    throw new Error('Only the current speaker can mark their clue as done.');
  }

  currentRound.completedSessionTokens.push(sessionToken);
  gameState.currentSpeakerIndex += 1;
  if (gameState.currentSpeakerIndex < currentRound.speakingOrder.length) {
    return gameState;
  }

  if (gameState.clueRound < CLUE_ROUNDS) {
    gameState.clueRound += 1;
    gameState.currentSpeakerIndex = 0;
    gameState.clueRounds.push({
      round: gameState.clueRound,
      speakingOrder: createSpeakingOrder(gameState.players, gameState.spySessionToken, gameState.clueRound),
      completedSessionTokens: []
    });
    return gameState;
  }

  gameState.status = 'voting';
  return gameState;
}

function submitVote(gameState, voterSessionToken, targetSessionToken) {
  if (!gameState || !['voting', 'revote'].includes(gameState.status)) {
    throw new Error('Voting is not open.');
  }

  const voter = gameState.players.find((player) => player.sessionToken === voterSessionToken);
  const target = gameState.players.find((player) => player.sessionToken === targetSessionToken);
  if (!voter || !target) {
    throw new Error('Choose a player in this round.');
  }
  if (voterSessionToken === targetSessionToken) {
    throw new Error('You cannot vote for yourself.');
  }
  if (gameState.eligibleVoteTargets && !gameState.eligibleVoteTargets.includes(targetSessionToken)) {
    throw new Error('Choose one of the tied players.');
  }
  if (voter.vote !== null) {
    throw new Error('You have already voted.');
  }

  voter.vote = targetSessionToken;
  gameState.votesSubmitted += 1;
  if (gameState.votesSubmitted === gameState.players.length) {
    startSuspense(gameState);
  }
  return gameState;
}

function getVoteLeaders(gameState) {
  const counts = new Map();
  gameState.players.forEach((player) => {
    counts.set(player.vote, (counts.get(player.vote) || 0) + 1);
  });
  const highestCount = Math.max(...counts.values());
  return [...counts.entries()]
    .filter(([, count]) => count === highestCount)
    .map(([sessionToken]) => sessionToken);
}

function buildResult(gameState, spyWon, spyGuessCorrect = false) {
  const spy = gameState.players.find((player) => player.sessionToken === gameState.spySessionToken);
  const finalVoteRound = gameState.revealedVoteRounds[gameState.revealedVoteRounds.length - 1];

  const scores = gameState.players.map((player) => {
    let score = 0;
    if (player.sessionToken === gameState.spySessionToken) {
      score = spyWon ? 2 : 0;
    } else {
      score = spyWon ? 0 : 1;
    }
    return {
      displayName: player.displayName,
      sessionToken: player.sessionToken,
      score
    };
  }).sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  gameState.status = 'results';
  gameState.result = {
    category: gameState.category,
    word: gameState.secretWord,
    spyName: spy ? spy.displayName : 'Unknown',
    spyCaught: gameState.accusedSessionTokens.includes(gameState.spySessionToken),
    spyGuessCorrect,
    accusedNames: gameState.accusedSessionTokens
      .map((sessionToken) => {
        const p = gameState.players.find((player) => player.sessionToken === sessionToken);
        return p ? p.displayName : 'Unknown';
      }),
    winner: spyWon ? 'spy' : 'group',
    winnerMessage: spyWon
      ? (spyGuessCorrect
          ? 'The spy was caught but correctly guessed the secret word and wins!'
          : 'The spy evaded detection and wins!')
      : 'The group caught the spy, and the spy missed the secret word. Innocents win!',
    revealedVoteRounds: gameState.revealedVoteRounds.map((round) => ({
      round: round.round,
      votes: round.votes.map(({ voterName, targetName }) => ({ voterName, targetName })),
      tiedNames: [...round.tiedNames]
    })),
    scores
  };
  return gameState;
}

function resolveVoteReveal(gameState, expectedDeadlineAt) {
  if (
    !gameState
    || gameState.status !== 'suspense'
    || gameState.revealDeadlineAt !== expectedDeadlineAt
    || Date.now() < expectedDeadlineAt
  ) {
    return null;
  }

  const leaders = getVoteLeaders(gameState);
  const votes = gameState.players.map((player) => ({
    voterName: player.displayName,
    targetName: gameState.players.find((entry) => entry.sessionToken === player.vote).displayName,
    voterSessionToken: player.sessionToken,
    targetSessionToken: player.vote
  }));
  gameState.revealedVoteRounds.push({
    round: gameState.voteRound,
    votes,
    tiedNames: leaders.length > 1
      ? leaders.map((sessionToken) => gameState.players.find((player) => player.sessionToken === sessionToken).displayName)
      : []
  });
  gameState.accusedSessionTokens = leaders;
  gameState.revealDeadlineAt = null;

  if (
    gameState.voteRound === 1
    && leaders.length > 1
    && leaders.includes(gameState.spySessionToken)
  ) {
    gameState.status = 'revote';
    gameState.voteRound = 2;
    gameState.eligibleVoteTargets = leaders;
    gameState.votesSubmitted = 0;
    gameState.players.forEach((player) => {
      player.vote = null;
    });
    return gameState;
  }

  const spyWasUniquelyAccused = leaders.length === 1 && leaders[0] === gameState.spySessionToken;
  if (spyWasUniquelyAccused) {
    gameState.status = 'spy-guess';
    return gameState;
  }

  return buildResult(gameState, true);
}

function submitSpyGuess(gameState, sessionToken, guess) {
  if (!gameState || gameState.status !== 'spy-guess') {
    throw new Error('The final spy guess is not active.');
  }
  if (sessionToken !== gameState.spySessionToken) {
    throw new Error('Only the spy can make the final guess.');
  }
  if (typeof guess !== 'string' || !guess.trim()) {
    throw new Error('Enter your guess for the secret word.');
  }

  const normalizedGuess = guess.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const normalizedWord = gameState.secretWord.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const guessCorrect = normalizedGuess === normalizedWord;
  return buildResult(gameState, guessCorrect, guessCorrect);
}

module.exports = {
  TEST_CONTENT,
  CLUE_ROUNDS,
  SUSPENSE_SECONDS,
  createGameState,
  markClueDone,
  submitVote,
  resolveVoteReveal,
  submitSpyGuess
};
