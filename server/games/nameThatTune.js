const SONGS_PER_GAME = 10;
const ATTEMPT_SECONDS = 20;
const MAX_ATTEMPTS = 3;

const DEFAULT_SONGS = [
  { title: 'Billie Jean', artist: 'Michael Jackson' },
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'Shape of You', artist: 'Ed Sheeran' },
  { title: 'Rolling in the Deep', artist: 'Adele' },
  { title: 'Stayin Alive', artist: 'Bee Gees' },
  { title: 'Hotel California', artist: 'Eagles' },
  { title: 'Sweet Child O Mine', artist: "Guns N' Roses" },
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' }
];

function createGameState(room) {
  let players = room.players
    .filter((player) => player.connected && !player.isHost)
    .map((player) => ({
      sessionToken: player.sessionToken,
      displayName: player.displayName,
      score: 0
    }));

  if (players.length === 0) {
    players = room.players
      .filter((player) => player.connected)
      .map((player) => ({
        sessionToken: player.sessionToken,
        displayName: player.displayName,
        score: 0
      }));
  }

  return {
    id: 'name-that-tune',
    name: 'Name That Tune',
    status: 'setup',
    hostSessionToken: room.hostSessionToken,
    songsPerGame: SONGS_PER_GAME,
    players,
    songs: DEFAULT_SONGS.map((s) => ({ ...s })),
    currentSongIndex: 0,
    attemptCount: 0,
    attemptedSessionTokens: [],
    activeAttempt: null,
    awarded: { titleSessionToken: null, artistSessionToken: null },
    songHistory: [],
    result: null
  };
}

function savePlaylist(gameState, sessionToken, songs) {
  if (!gameState || gameState.status !== 'setup') {
    throw new Error('The song list can only be edited before the game starts.');
  }
  if (sessionToken !== gameState.hostSessionToken) {
    throw new Error('Only the host can edit the song list.');
  }
  if (!Array.isArray(songs) || songs.length !== SONGS_PER_GAME) {
    throw new Error(`Enter exactly ${SONGS_PER_GAME} songs.`);
  }

  const normalizedSongs = songs.map((song) => {
    const title = typeof song.title === 'string' ? song.title.trim() : '';
    const artist = typeof song.artist === 'string' ? song.artist.trim() : '';
    if (!title || !artist || title.length > 80 || artist.length > 80) {
      throw new Error('Each song needs a title and artist, up to 80 characters each.');
    }
    return { title, artist };
  });

  gameState.songs = normalizedSongs;
  return gameState;
}

function startGame(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'setup') {
    throw new Error('The song list is no longer being set up.');
  }
  if (sessionToken !== gameState.hostSessionToken) {
    throw new Error('Only the host can start the game.');
  }
  if (gameState.songs.length !== SONGS_PER_GAME || gameState.songs.some((song) => !song.title || !song.artist)) {
    throw new Error(`Save all ${SONGS_PER_GAME} song titles and artists before starting.`);
  }
  if (!gameState.players.length) {
    throw new Error('At least one connected non-host player is required.');
  }

  gameState.status = 'song-ready';
  return gameState;
}

function buzz(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'song-ready') {
    throw new Error('Buzzers are not open right now.');
  }
  if (!gameState.players.some((player) => player.sessionToken === sessionToken)) {
    throw new Error('Only a non-host player can buzz in.');
  }
  if (gameState.attemptedSessionTokens.includes(sessionToken)) {
    throw new Error('You have already attempted this song.');
  }
  if (gameState.attemptCount >= MAX_ATTEMPTS) {
    throw new Error('This song has no attempts remaining.');
  }

  gameState.attemptCount += 1;
  gameState.attemptedSessionTokens.push(sessionToken);
  gameState.activeAttempt = {
    sessionToken,
    deadlineAt: Date.now() + ATTEMPT_SECONDS * 1000,
    titleGuess: null,
    artistGuess: null
  };
  gameState.status = 'attempting';
  return gameState;
}

function submitAttempt(gameState, sessionToken, { title, artist } = {}) {
  if (!gameState || gameState.status !== 'attempting' || !gameState.activeAttempt) {
    throw new Error('There is no active attempt.');
  }
  if (gameState.activeAttempt.sessionToken !== sessionToken) {
    throw new Error('Only the player who buzzed first can submit this attempt.');
  }
  if (
    (typeof title !== 'string' && title !== undefined)
    || (typeof artist !== 'string' && artist !== undefined)
    || String(title || '').trim().length > 80
    || String(artist || '').trim().length > 80
  ) {
    throw new Error('Song title and artist guesses must be 80 characters or fewer.');
  }

  gameState.activeAttempt.titleGuess = String(title || '').trim();
  gameState.activeAttempt.artistGuess = String(artist || '').trim();
  gameState.activeAttempt.deadlineAt = null;
  gameState.status = 'judging';
  return gameState;
}

function revealSong(gameState) {
  const song = gameState.songs[gameState.currentSongIndex];
  const points = gameState.players.map((player) => ({
    displayName: player.displayName,
    titlePoints: player.sessionToken === gameState.awarded.titleSessionToken ? 0.5 : 0,
    artistPoints: player.sessionToken === gameState.awarded.artistSessionToken ? 0.5 : 0
  })).filter((entry) => entry.titlePoints || entry.artistPoints);

  gameState.songHistory.push({
    songNumber: gameState.currentSongIndex + 1,
    title: song.title,
    artist: song.artist,
    points,
    attempts: gameState.attemptCount
  });
  gameState.activeAttempt = null;
  gameState.status = 'song-reveal';
  return gameState;
}

function judgeAttempt(gameState, sessionToken, { titleCorrect, artistCorrect } = {}) {
  if (!gameState || gameState.status !== 'judging' || !gameState.activeAttempt) {
    throw new Error('No submitted attempt is waiting for a judgment.');
  }
  if (sessionToken !== gameState.hostSessionToken) {
    throw new Error('Only the host can judge song attempts.');
  }
  if (typeof titleCorrect !== 'boolean' || typeof artistCorrect !== 'boolean') {
    throw new Error('Judge the title and artist separately.');
  }

  const guesser = gameState.activeAttempt.sessionToken;
  if (titleCorrect && !gameState.awarded.titleSessionToken) {
    gameState.awarded.titleSessionToken = guesser;
    gameState.players.find((player) => player.sessionToken === guesser).score += 0.5;
  }
  if (artistCorrect && !gameState.awarded.artistSessionToken) {
    gameState.awarded.artistSessionToken = guesser;
    gameState.players.find((player) => player.sessionToken === guesser).score += 0.5;
  }

  gameState.activeAttempt = null;
  const bothPartsAwarded = gameState.awarded.titleSessionToken && gameState.awarded.artistSessionToken;
  const noMoreAttempts = gameState.attemptCount >= MAX_ATTEMPTS
    || gameState.attemptedSessionTokens.length >= gameState.players.length;
  if (bothPartsAwarded || noMoreAttempts) {
    return revealSong(gameState);
  }

  gameState.status = 'song-ready';
  return gameState;
}

function handleTimeout(gameState, expectedDeadlineAt) {
  if (
    !gameState
    || gameState.status !== 'attempting'
    || !gameState.activeAttempt
    || gameState.activeAttempt.deadlineAt !== expectedDeadlineAt
    || Date.now() < expectedDeadlineAt
  ) {
    return null;
  }

  gameState.activeAttempt = null;
  if (
    gameState.attemptCount >= MAX_ATTEMPTS
    || gameState.attemptedSessionTokens.length >= gameState.players.length
  ) {
    return revealSong(gameState);
  }

  gameState.status = 'song-ready';
  return gameState;
}

function revealWithoutBuzz(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'song-ready') {
    throw new Error('The answer can only be revealed when no attempt is active.');
  }
  if (sessionToken !== gameState.hostSessionToken) {
    throw new Error('Only the host can reveal the answer.');
  }
  if (gameState.attemptCount !== 0) {
    throw new Error('The answer can only be revealed when nobody has buzzed.');
  }
  return revealSong(gameState);
}

function nextSong(gameState, sessionToken) {
  if (!gameState || gameState.status !== 'song-reveal') {
    throw new Error('Reveal the current song before moving on.');
  }
  if (sessionToken !== gameState.hostSessionToken) {
    throw new Error('Only the host can move to the next song.');
  }

  if (gameState.currentSongIndex + 1 >= SONGS_PER_GAME) {
    gameState.status = 'results';
    gameState.result = {
      songs: [...gameState.songHistory],
      scores: [...gameState.players]
        .map(({ displayName, score }) => ({ displayName, score }))
        .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
    };
    return gameState;
  }

  gameState.currentSongIndex += 1;
  gameState.attemptCount = 0;
  gameState.attemptedSessionTokens = [];
  gameState.activeAttempt = null;
  gameState.awarded = { titleSessionToken: null, artistSessionToken: null };
  gameState.status = 'song-ready';
  return gameState;
}

module.exports = {
  SONGS_PER_GAME,
  ATTEMPT_SECONDS,
  MAX_ATTEMPTS,
  createGameState,
  savePlaylist,
  startGame,
  buzz,
  submitAttempt,
  judgeAttempt,
  handleTimeout,
  revealWithoutBuzz,
  nextSong
};
