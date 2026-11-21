const TEST_PROMPTS = [
  'Put a finger down if you have ever gone through your partner’s phone without them knowing.',
  'Put a finger down if you have ever liked someone you knew your friend also liked.',
  'Put a finger down if you have ever ignored someone on purpose just to make them wonder what was wrong.',
  'Put a finger down if you have ever lied about being busy because you did not want to hang out with someone.',
  'Put a finger down if you have ever kept talking to someone you knew was bad for you.',
  'Put a finger down if you have ever had a crush on someone your friends would never expect.',
  'Put a finger down if you have ever pretended to like someone’s gift when you actually hated it.',
  'Put a finger down if you have ever complained about someone to a person you knew would tell them.',
  'Put a finger down if you have ever deleted a message because you were scared someone would see it.',
  'Put a finger down if you have ever had a relationship you kept away from everybody.'
];
const STARTING_FINGERS = 10;
const QUESTIONS_PER_GAME = 10;
const RESPONSES = ['finger-down', 'still-up', 'prefer-not-to-answer'];

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [shuffled[otherIndex], shuffled[index]];
  }
  return shuffled;
}

function createGameState(room) {
  const previouslyUsedPrompts = new Set(
    (room.roundHistory || [])
      .filter((entry) => entry.gameId === 'put-a-finger-down')
      .flatMap((entry) => (
        entry.result && Array.isArray(entry.result.questionPrompts)
          ? entry.result.questionPrompts
          : []
      ))
  );
  const freshPrompts = shuffle(TEST_PROMPTS.filter((prompt) => !previouslyUsedPrompts.has(prompt)));
  const reusedPrompts = shuffle(TEST_PROMPTS.filter((prompt) => previouslyUsedPrompts.has(prompt)));
  const roundPrompts = [
    ...freshPrompts.slice(0, QUESTIONS_PER_GAME),
    ...reusedPrompts.slice(0, Math.max(0, QUESTIONS_PER_GAME - freshPrompts.length))
  ];
  const players = room.players
    .filter((player) => player.connected)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      fingersRemaining: STARTING_FINGERS,
      response: null
    }));

  return {
    id: 'put-a-finger-down',
    name: 'Put a Finger Down',
    status: 'answering',
    round: 1,
    totalRounds: QUESTIONS_PER_GAME,
    prompt: roundPrompts[0],
    roundPrompts,
    players,
    responsesSubmitted: 0,
    roundHistory: [],
    result: null
  };
}

function resolveResponses(gameState, connectedSessionTokens) {
  if (!gameState || gameState.status !== 'answering') {
    return gameState;
  }

  const connectedPlayers = gameState.players
    .filter((entry) => connectedSessionTokens.includes(entry.sessionToken));
  gameState.responsesSubmitted = connectedPlayers
    .filter((entry) => entry.response !== null).length;

  if (!connectedPlayers.length || gameState.responsesSubmitted !== connectedPlayers.length) {
    return gameState;
  }

  const responses = gameState.players
    .filter((entry) => entry.response !== null)
    .map((entry) => {
      if (entry.response === 'finger-down') {
        entry.fingersRemaining = Math.max(0, entry.fingersRemaining - 1);
      }
      return {
        displayName: entry.displayName,
        response: entry.response,
        fingersRemaining: entry.fingersRemaining
      };
    });
  gameState.roundHistory.push({
    round: gameState.round,
    prompt: gameState.prompt,
    putDownCount: responses.filter((entry) => entry.response === 'finger-down').length,
    responses
  });
  gameState.status = 'revealing';
  return gameState;
}

function submitResponse(gameState, sessionToken, response, connectedSessionTokens) {
  if (!gameState || gameState.status !== 'answering') {
    throw new Error('This prompt is no longer accepting responses.');
  }

  if (!RESPONSES.includes(response)) {
    throw new Error('Choose a response to this question.');
  }

  const player = gameState.players.find((entry) => entry.sessionToken === sessionToken);
  if (!player || !connectedSessionTokens.includes(sessionToken)) {
    throw new Error('You are not connected to this round.');
  }

  if (player.response !== null) {
    throw new Error('You have already responded to this prompt.');
  }

  player.response = response;

  return resolveResponses(gameState, connectedSessionTokens);
}

function advanceRound(gameState) {
  if (!gameState || gameState.status !== 'revealing') {
    throw new Error('The prompt results are not ready to advance.');
  }

  if (gameState.round >= gameState.totalRounds) {
    gameState.status = 'results';
  const scores = [...gameState.players]
    .map(({ displayName, fingersRemaining }) => ({ displayName, fingersRemaining }))
    .sort((a, b) => b.fingersRemaining - a.fingersRemaining || a.displayName.localeCompare(b.displayName));
  gameState.result = {
    questionPrompts: [...gameState.roundPrompts],
    scores,
    winners: scores
      .filter((entry) => entry.fingersRemaining === scores[0].fingersRemaining)
      .map((entry) => entry.displayName)
  };
    return gameState;
  }

  gameState.round += 1;
  gameState.prompt = gameState.roundPrompts[gameState.round - 1];
  gameState.responsesSubmitted = 0;
  gameState.players.forEach((player) => {
    player.response = null;
  });
  gameState.status = 'answering';
  return gameState;
}

module.exports = {
  createGameState,
  submitResponse,
  resolveResponses,
  advanceRound,
  STARTING_FINGERS,
  QUESTIONS_PER_GAME,
  TEST_PROMPTS,
  RESPONSES
};
