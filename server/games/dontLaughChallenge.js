const FACE_OFF_SECONDS = 30;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildPairings(team1Players, team2Players) {
  const t1 = shuffle(team1Players);
  const t2 = shuffle(team2Players);
  const pairings = [];

  const minCount = Math.min(t1.length, t2.length);
  if (minCount === 0) {
    const solo = t1[0] || t2[0];
    if (solo) {
      pairings.push({
        challenger: solo,
        challengerTeam: t1[0] ? 'team-1' : 'team-2',
        defender: solo,
        defenderTeam: t1[0] ? 'team-1' : 'team-2'
      });
    }
    return pairings;
  }

  for (let i = 0; i < minCount; i += 1) {
    // Alternate challenger/defender role between teams
    const team1IsChallenger = i % 2 === 0;
    pairings.push({
      challenger: team1IsChallenger ? t1[i] : t2[i],
      challengerTeam: team1IsChallenger ? 'team-1' : 'team-2',
      defender: team1IsChallenger ? t2[i] : t1[i],
      defenderTeam: team1IsChallenger ? 'team-2' : 'team-1'
    });
  }

  // Handle uneven teams: larger team's extra player participates after everyone else has gone once
  if (t1.length > minCount) {
    for (let i = minCount; i < t1.length; i += 1) {
      const partner = t2[i % t2.length];
      pairings.push({
        challenger: t1[i],
        challengerTeam: 'team-1',
        defender: partner,
        defenderTeam: 'team-2'
      });
    }
  } else if (t2.length > minCount) {
    for (let i = minCount; i < t2.length; i += 1) {
      const partner = t1[i % t1.length];
      pairings.push({
        challenger: t2[i],
        challengerTeam: 'team-2',
        defender: partner,
        defenderTeam: 'team-1'
      });
    }
  }

  return pairings;
}

function createGameState(room) {
  const connected = shuffle(room.players.filter((p) => p.connected));
  const team1Players = [];
  const team2Players = [];

  connected.forEach((p, idx) => {
    const playerObj = { sessionToken: p.sessionToken, displayName: p.displayName };
    if (idx % 2 === 0) {
      team1Players.push({ ...playerObj, teamId: 'team-1' });
    } else {
      team2Players.push({ ...playerObj, teamId: 'team-2' });
    }
  });

  const pairings = buildPairings(team1Players, team2Players);
  const currentPairing = pairings[0] || null;

  return {
    id: 'dont-laugh-challenge',
    name: "Don't Laugh Challenge",
    teams: [
      { id: 'team-1', name: 'Team 1', score: 0, players: team1Players },
      { id: 'team-2', name: 'Team 2', score: 0, players: team2Players }
    ],
    players: connected.map((p, idx) => ({
      sessionToken: p.sessionToken,
      displayName: p.displayName,
      teamId: idx % 2 === 0 ? 'team-1' : 'team-2'
    })),
    hostSessionToken: room.hostSessionToken,
    pairings,
    currentPairingIndex: 0,
    totalPairings: pairings.length,
    currentPairing,
    faceOffSeconds: FACE_OFF_SECONDS,
    status: 'ready', // 'ready' -> 'face-off' -> 'judging' -> 'revote' -> 'round-result' -> 'results'
    deadlineAt: null,
    votes: {}, // sessionToken -> boolean (true = laughed, false = didn't laugh)
    voteRound: 1, // 1 = first vote, 2 = revote
    roundResult: null,
    history: [],
    result: null
  };
}

function startFaceOff(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'ready') {
    throw new Error('Face-off cannot be started right now.');
  }

  const isHost = gameState.hostSessionToken === sessionToken;
  const isChallenger = gameState.currentPairing?.challenger.sessionToken === sessionToken;
  if (!isHost && !isChallenger) {
    throw new Error('Only the challenger or host can start the face-off.');
  }

  const now = Date.now();
  gameState.status = 'face-off';
  gameState.deadlineAt = now + gameState.faceOffSeconds * 1000;
  return gameState;
}

function handleFaceOffTimeout(gameState, expectedDeadlineAt, now = Date.now()) {
  if (
    !gameState
    || gameState.status !== 'face-off'
    || gameState.deadlineAt !== expectedDeadlineAt
    || now < gameState.deadlineAt
  ) {
    return gameState;
  }

  gameState.status = 'judging';
  gameState.deadlineAt = null;
  gameState.votes = {};
  gameState.voteRound = 1;
  return gameState;
}

function submitVote(gameState, sessionToken, didLaugh) {
  if (!gameState || !['judging', 'revote'].includes(gameState.status)) {
    throw new Error('Judging is not open right now.');
  }

  if (typeof didLaugh !== 'boolean') {
    throw new Error('Vote must be laugh or did not laugh.');
  }

  const pairing = gameState.currentPairing;
  if (!pairing) {
    throw new Error('No active pairing found.');
  }

  const eligibleVoters = gameState.players.filter((p) => (
    p.sessionToken !== pairing.challenger.sessionToken
    && p.sessionToken !== pairing.defender.sessionToken
  ));

  // If there are other players, face-off participants cannot judge
  if (eligibleVoters.length > 0) {
    if (
      pairing.challenger.sessionToken === sessionToken
      || pairing.defender.sessionToken === sessionToken
    ) {
      throw new Error('Players in the face-off cannot judge.');
    }
  }

  const voter = gameState.players.find((p) => p.sessionToken === sessionToken);
  if (!voter) {
    throw new Error('You are not in this game.');
  }

  gameState.votes[sessionToken] = didLaugh;

  const targetVoteCount = eligibleVoters.length > 0 ? eligibleVoters.length : 1;
  const voteCount = Object.keys(gameState.votes).length;
  if (voteCount >= targetVoteCount) {
    return resolveJudging(gameState);
  }

  return gameState;
}

function resolveJudging(gameState) {
  const votes = Object.values(gameState.votes);
  const laughCount = votes.filter(Boolean).length;
  const noLaughCount = votes.filter((v) => !v).length;
  const pairing = gameState.currentPairing;

  if (laughCount === noLaughCount) {
    // Tie
    if (gameState.voteRound === 1) {
      // 1 revote
      gameState.status = 'revote';
      gameState.voteRound = 2;
      gameState.votes = {};
      return gameState;
    }
    // Still tied on revote = no point
    return finalizeRound(gameState, {
      winnerTeam: null,
      message: 'Vote was tied twice! No points awarded.',
      laughCount,
      noLaughCount
    });
  }

  if (laughCount > noLaughCount) {
    // Defender laughed: Challenger team +1
    const winningTeam = gameState.teams.find((t) => t.id === pairing.challengerTeam);
    if (winningTeam) winningTeam.score += 1;
    return finalizeRound(gameState, {
      winnerTeam: pairing.challengerTeam,
      pointAwardedTo: winningTeam ? winningTeam.name : 'Challenger Team',
      message: `${pairing.defender.displayName} laughed! Point to ${winningTeam ? winningTeam.name : 'Challenger Team'}.`,
      laughCount,
      noLaughCount
    });
  }

  // Defender survived: Defender team +1
  const winningTeam = gameState.teams.find((t) => t.id === pairing.defenderTeam);
  if (winningTeam) winningTeam.score += 1;
  return finalizeRound(gameState, {
    winnerTeam: pairing.defenderTeam,
    pointAwardedTo: winningTeam ? winningTeam.name : 'Defender Team',
    message: `${pairing.defender.displayName} kept a straight face! Point to ${winningTeam ? winningTeam.name : 'Defender Team'}.`,
    laughCount,
    noLaughCount
  });
}

function finalizeRound(gameState, resultDetails) {
  const pairing = gameState.currentPairing;
  gameState.status = 'round-result';
  gameState.roundResult = {
    ...resultDetails,
    pairingNumber: gameState.currentPairingIndex + 1,
    totalPairings: gameState.totalPairings,
    challenger: pairing.challenger.displayName,
    defender: pairing.defender.displayName,
    team1Score: gameState.teams[0].score,
    team2Score: gameState.teams[1].score
  };
  gameState.history.push({ ...gameState.roundResult });
  return gameState;
}

function nextFaceOff(gameState, isHost) {
  if (!gameState || gameState.status !== 'round-result') {
    throw new Error('Cannot advance until face-off is judged.');
  }
  if (!isHost) {
    throw new Error('Only the host can advance to the next face-off.');
  }

  if (gameState.currentPairingIndex + 1 >= gameState.totalPairings) {
    return finishGame(gameState);
  }

  gameState.currentPairingIndex += 1;
  gameState.currentPairing = gameState.pairings[gameState.currentPairingIndex];
  gameState.status = 'ready';
  gameState.deadlineAt = null;
  gameState.votes = {};
  gameState.voteRound = 1;
  gameState.roundResult = null;
  return gameState;
}

function finishGame(gameState) {
  gameState.status = 'results';
  gameState.deadlineAt = null;

  const t1 = gameState.teams[0];
  const t2 = gameState.teams[1];
  let winner = null;
  let isDraw = false;

  if (t1.score > t2.score) {
    winner = t1.name;
  } else if (t2.score > t1.score) {
    winner = t2.name;
  } else {
    isDraw = true;
  }

  gameState.result = {
    team1: { name: t1.name, score: t1.score },
    team2: { name: t2.name, score: t2.score },
    winner,
    isDraw,
    history: [...gameState.history]
  };

  return gameState;
}

module.exports = {
  FACE_OFF_SECONDS,
  createGameState,
  startFaceOff,
  handleFaceOffTimeout,
  submitVote,
  nextFaceOff,
  finishGame
};
