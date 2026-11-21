const GAME_DEFINITIONS = [
  {
    id: 'most-likely-to',
    name: 'Most Likely To',
    shortDescription: 'Pick the friend most likely to do something outrageous.',
    minPlayers: 3,
    icon: '🎯',
    type: 'prompt-vote'
  },
  {
    id: 'five-second-rule',
    name: '5-Second Rule',
    shortDescription: 'Race against the clock to answer before the timer hits zero.',
    minPlayers: 2,
    icon: '⏱️',
    type: 'timed-answer'
  },
  {
    id: 'dont-laugh-challenge',
    name: "Don't Laugh Challenge",
    shortDescription: 'Take turns performing a silly challenge and vote if you laughed.',
    minPlayers: 2,
    icon: '😂',
    type: 'social-comedy'
  },
  {
    id: 'guess-who',
    name: 'Guess Who?',
    shortDescription: 'Read the clue and deduce the secret identity.',
    minPlayers: 3,
    icon: '🕵️',
    type: 'secret-id'
  },
  {
    id: 'hot-take-game',
    name: 'Hot Take Game',
    shortDescription: 'Defend the wildest opinion in the room.',
    minPlayers: 3,
    icon: '🔥',
    type: 'opinion'
  },
  {
    id: 'describe-the-word',
    name: 'Describe the Word',
    shortDescription: 'Take turns giving your team clues for ten words before five minutes are up.',
    minPlayers: 4,
    icon: '🧠',
    type: 'clue'
  },
  {
    id: 'who-am-i',
    name: 'Who Am I?',
    shortDescription: 'Ask yes-or-no questions and make two guesses before your 60-second turn ends.',
    minPlayers: 2,
    icon: '🪪',
    type: 'identity'
  },
  {
    id: 'put-a-finger-down',
    name: 'Put a Finger Down',
    shortDescription: 'Answer ten private questions and see how many fingers remain.',
    minPlayers: 2,
    icon: '✋',
    type: 'truth-round'
  },
  {
    id: 'do-not-spill',
    name: 'Do Not Spill',
    shortDescription: 'Track spills, spin the consequence wheel, and choose accept or pass.',
    minPlayers: 2,
    icon: '💧',
    type: 'penalty'
  },
  {
    id: 'heads-up',
    name: 'Heads Up!',
    shortDescription: 'Hold your phone to your forehead while the room gives verbal clues.',
    minPlayers: 2,
    icon: '🎤',
    type: 'charades'
  },
  {
    id: 'find-the-spy',
    name: 'Find the Spy',
    shortDescription: 'Give two rounds of clues, then privately vote for the spy.',
    minPlayers: 4,
    icon: '🕵️‍♂️',
    type: 'mystery'
  },
  {
    id: 'name-that-tune',
    name: 'Name That Tune',
    shortDescription: 'Buzz in to name songs while the host plays and judges.',
    minPlayers: 2,
    icon: '🎵',
    type: 'music'
  }
];

function getGameById(gameId) {
  return GAME_DEFINITIONS.find((game) => game.id === gameId) || null;
}

module.exports = {
  GAME_DEFINITIONS,
  getGameById
};
