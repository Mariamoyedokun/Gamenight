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
      score: 0,
      fact: '',
      hasSubmittedFact: false,
      guess: null // for current fact
    }));

  return {
    id: 'guess-who',
    name: 'Guess Who?',
    status: 'submitting', // 'submitting' -> 'guessing' -> 'revealing' -> 'results'
    players,
    hostSessionToken: room.hostSessionToken,
    facts: [], // Array of { id, authorSessionToken, authorDisplayName, fact }
    currentFactIndex: 0,
    currentFact: null,
    turnHistory: [],
    reveal: null,
    result: null
  };
}

function submitFact(gameState, sessionToken, factText) {
  if (!gameState || gameState.status !== 'submitting') {
    throw new Error('Fact submissions are closed.');
  }

  const player = gameState.players.find((p) => p.sessionToken === sessionToken);
  if (!player) {
    throw new Error('You are not in this game.');
  }

  const cleaned = String(factText || '').trim();
  if (!cleaned || cleaned.length > 200) {
    throw new Error('Fact must be between 1 and 200 characters.');
  }

  player.fact = cleaned;
  player.hasSubmittedFact = true;
  return gameState;
}

function closeSubmissions(gameState, isHost) {
  if (!gameState || gameState.status !== 'submitting') {
    throw new Error('Submissions are already closed.');
  }
  if (!isHost) {
    throw new Error('Only the host can close submissions.');
  }

  // Collect submitted facts
  const submitted = gameState.players
    .filter((p) => p.hasSubmittedFact && p.fact)
    .map((p) => ({
      id: `fact_${p.sessionToken}_${Date.now()}`,
      authorSessionToken: p.sessionToken,
      authorDisplayName: p.displayName,
      fact: p.fact
    }));

  if (submitted.length === 0) {
    throw new Error('At least one fact must be submitted to start guessing.');
  }

  gameState.facts = shuffle(submitted);
  gameState.currentFactIndex = 0;
  gameState.currentFact = gameState.facts[0];
  gameState.status = 'guessing';
  gameState.players.forEach((p) => {
    p.guess = null;
  });

  return gameState;
}

function submitGuess(gameState, sessionToken, guessedSessionToken) {
  if (!gameState || gameState.status !== 'guessing') {
    throw new Error('Guessing is not open.');
  }

  const currentFact = gameState.currentFact;
  if (!currentFact) {
    throw new Error('No active fact found.');
  }

  // The actual author cannot guess their own fact
  if (currentFact.authorSessionToken === sessionToken) {
    throw new Error('You cannot guess the author of your own fact.');
  }

  const player = gameState.players.find((p) => p.sessionToken === sessionToken);
  if (!player) {
    throw new Error('You are not in this game.');
  }

  const target = gameState.players.find((p) => p.sessionToken === guessedSessionToken);
  if (!target) {
    throw new Error('Invalid player guessed.');
  }

  player.guess = guessedSessionToken;

  // Check if all eligible guessers have submitted
  const eligibleGuessers = gameState.players.filter((p) => p.sessionToken !== currentFact.authorSessionToken);
  const allGuessed = eligibleGuessers.every((p) => p.guess !== null);

  if (allGuessed) {
    return resolveFactGuesses(gameState);
  }

  return gameState;
}

function resolveFactGuesses(gameState) {
  const currentFact = gameState.currentFact;
  const authorToken = currentFact.authorSessionToken;

  const guessDetails = gameState.players
    .filter((p) => p.sessionToken !== authorToken)
    .map((p) => {
      const isCorrect = p.guess === authorToken;
      if (isCorrect) {
        p.score += 1;
      }
      const guessedPlayer = gameState.players.find((entry) => entry.sessionToken === p.guess);
      return {
        guesserDisplayName: p.displayName,
        guessedDisplayName: guessedPlayer ? guessedPlayer.displayName : 'Unknown',
        isCorrect
      };
    });

  const correctGuessers = guessDetails.filter((d) => d.isCorrect).map((d) => d.guesserDisplayName);

  gameState.status = 'fact-reveal';
  gameState.revealedAuthor = { displayName: currentFact.authorDisplayName };
  gameState.correctGuessers = correctGuessers;
  gameState.totalFacts = gameState.facts.length;
  gameState.reveal = {
    factNumber: gameState.currentFactIndex + 1,
    totalFacts: gameState.facts.length,
    factText: currentFact.fact,
    authorDisplayName: currentFact.authorDisplayName,
    correctGuessers,
    allGuesses: guessDetails,
    scores: [...gameState.players]
      .map(({ displayName, score }) => ({ displayName, score }))
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
  };

  gameState.turnHistory.push({ ...gameState.reveal });
  return gameState;
}

function nextFact(gameState, isHost) {
  if (!gameState || !['revealing', 'fact-reveal'].includes(gameState.status)) {
    throw new Error('Cannot advance until fact reveal is complete.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next fact.');
  }

  if (gameState.currentFactIndex + 1 >= gameState.facts.length) {
    return finishGame(gameState);
  }

  gameState.currentFactIndex += 1;
  gameState.currentFact = gameState.facts[gameState.currentFactIndex];
  gameState.status = 'guessing';
  gameState.reveal = null;
  gameState.players.forEach((p) => {
    p.guess = null;
  });

  return gameState;
}

function finishGame(gameState) {
  gameState.status = 'results';
  const scores = [...gameState.players]
    .map(({ displayName, score }) => ({ displayName, score }))
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

  const highestScore = scores[0]?.score || 0;
  const winners = scores.filter((p) => p.score === highestScore).map((p) => p.displayName);

  gameState.result = {
    scores,
    winners,
    isTie: winners.length > 1,
    turnHistory: [...gameState.turnHistory]
  };

  return gameState;
}

module.exports = {
  createGameState,
  submitFact,
  closeSubmissions,
  submitGuess,
  nextFact,
  finishGame
};
