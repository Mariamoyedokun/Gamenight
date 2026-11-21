const MAX_PLAYERS = 12;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const { getGameById } = require('./gameRegistry');
const mostLikelyTo = require('./games/mostLikelyTo');
const hotTakeGame = require('./games/hotTakeGame');
const fiveSecondRule = require('./games/fiveSecondRule');
const headsUp = require('./games/headsUp');
const putAFingerDown = require('./games/putAFingerDown');
const dontLaughChallenge = require('./games/dontLaughChallenge');
const findTheSpy = require('./games/findTheSpy');
const describeTheWord = require('./games/describeTheWord');
const guessWho = require('./games/guessWho');
const whoAmI = require('./games/whoAmI');
const nameThatTune = require('./games/nameThatTune');
const doNotSpill = require('./games/doNotSpill');

const GAME_MODULES = {
  'most-likely-to': mostLikelyTo,
  'hot-take-game': hotTakeGame,
  'five-second-rule': fiveSecondRule,
  'heads-up': headsUp,
  'put-a-finger-down': putAFingerDown,
  'dont-laugh-challenge': dontLaughChallenge,
  'find-the-spy': findTheSpy,
  'describe-the-word': describeTheWord,
  'guess-who': guessWho,
  'who-am-i': whoAmI,
  'name-that-tune': nameThatTune,
  'do-not-spill': doNotSpill
};

function getGameModule(gameId) {
  return GAME_MODULES[gameId] || mostLikelyTo;
}

function normalizeDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeRoomCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function isValidDisplayName(value) {
  const trimmed = normalizeDisplayName(value);
  return /^[A-Za-z0-9][A-Za-z0-9 _-]{0,14}$/.test(trimmed) && trimmed.length >= 2 && trimmed.length <= 16;
}

function isValidRoomName(value) {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 && trimmed.length <= 30 && /^[A-Za-z0-9\s'!.-]+$/.test(trimmed);
}

function isValidRoomCode(value) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalizeRoomCode(value));
}

function createSessionToken() {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateRoomCode(rooms) {
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }

    if (!rooms.has(code)) {
      return code;
    }
  }
}

class RoomStore {
  constructor() {
    this.rooms = new Map();
    this.sessions = new Map();
  }

  getRoomByCode(code) {
    const normalized = normalizeRoomCode(code);
    return this.rooms.get(normalized) || null;
  }

  getRoomForSession(sessionToken) {
    const roomCode = this.sessions.get(sessionToken);
    if (!roomCode) {
      return null;
    }

    return this.getRoomByCode(roomCode);
  }

  getPlayer(roomCode, sessionToken) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }
    return room.players.find((player) => player.sessionToken === sessionToken) || null;
  }

  getCurrentPlayer(sessionToken) {
    const room = this.getRoomForSession(sessionToken);
    if (!room) {
      return null;
    }

    return this.getPlayer(room.code, sessionToken);
  }

  promoteHostIfNeeded(roomCode) {
    const room = this.getRoomByCode(roomCode);
    if (!room || room.players.length === 0) {
      return room;
    }

    const hostPlayer = room.players.find((player) => player.isHost);
    if (hostPlayer && hostPlayer.connected) {
      room.hostSessionToken = hostPlayer.sessionToken;
      return room;
    }

    const fallback = [...room.players].sort((a, b) => a.order - b.order).find((player) => player.connected) || room.players[0];
    if (!fallback) {
      return room;
    }

    if (hostPlayer) {
      hostPlayer.isHost = false;
    }

    fallback.isHost = true;
    room.hostSessionToken = fallback.sessionToken;
    return room;
  }

  syncSelectedGamePlayers(room) {
    if (!room || !room.selectedGame || !Array.isArray(room.selectedGame.players)) {
      return room;
    }

    if (['five-second-rule', 'heads-up', 'describe-the-word', 'guess-who', 'who-am-i', 'put-a-finger-down', 'dont-laugh-challenge', 'find-the-spy', 'name-that-tune', 'most-likely-to', 'hot-take-game', 'do-not-spill'].includes(room.selectedGame.id)) {
      return room;
    }

    const existingVotes = new Map(room.selectedGame.players.map((player) => [player.sessionToken, player]));
    room.selectedGame.players = room.players.map((player) => {
      const prior = existingVotes.get(player.sessionToken) || {};
      return {
        sessionToken: player.sessionToken,
        displayName: player.displayName,
        vote: prior.vote || null
      };
    });

    return room;
  }

  setPlayerConnectionState({ roomCode, sessionToken, connected, status }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player) {
      return room;
    }

    player.connected = Boolean(connected);
    player.status = status || (player.connected ? 'connected' : 'reconnecting');
    if (player.connected) {
      player.disconnectedAt = null;
    }
    room.updatedAt = Date.now();
    if (room.selectedGame && room.selectedGame.id === 'describe-the-word') {
      room.selectedGame = connected
        ? describeTheWord.handlePlayerReconnected(room.selectedGame, sessionToken)
        : describeTheWord.handlePlayerDisconnected(room.selectedGame, sessionToken);
      const gamePlayer = room.selectedGame.players.find((entry) => entry.sessionToken === sessionToken);
      if (gamePlayer) {
        gamePlayer.connected = Boolean(connected);
      }
    }
    this.syncSelectedGamePlayers(room);
    this.promoteHostIfNeeded(room.code);
    if (room.selectedGame && room.selectedGame.id === 'put-a-finger-down') {
      const connectedSessionTokens = room.players
        .filter((entry) => entry.connected)
        .map((entry) => entry.sessionToken);
      putAFingerDown.resolveResponses(room.selectedGame, connectedSessionTokens);
    }
    return this.serializeRoom(room);
  }

  cleanupInactiveRooms({ maxIdleMs = 1000 * 60 * 5 } = {}) {
    const now = Date.now();
    const cleanedRoomCodes = [];

    for (const [roomCode, room] of this.rooms.entries()) {
      if (!room || room.players.length === 0) {
        this.rooms.delete(roomCode);
        cleanedRoomCodes.push(roomCode);
        continue;
      }

      const connectedPlayers = room.players.filter((player) => player.connected);
      const idleForMs = now - (room.updatedAt || room.createdAt || now);

      if (connectedPlayers.length === 0 && idleForMs >= maxIdleMs) {
        for (const player of room.players) {
          this.sessions.delete(player.sessionToken);
        }

        this.rooms.delete(roomCode);
        cleanedRoomCodes.push(roomCode);
      }
    }

    return cleanedRoomCodes;
  }

  createRoom({ displayName, roomName, sessionToken }) {
    const roomDisplayName = normalizeDisplayName(displayName);
    const roomTitle = String(roomName || '').trim();

    if (!isValidDisplayName(roomDisplayName)) {
      throw new Error('Display name must be 2-16 characters and use letters, numbers, spaces, hyphens, or underscores.');
    }

    if (!isValidRoomName(roomTitle)) {
      throw new Error('Room name must be 1-30 characters and use only letters, numbers, spaces, apostrophes, hyphens, periods or exclamation marks.');
    }

    const code = generateRoomCode(this.rooms);
    const room = {
      code,
      name: roomTitle,
      status: 'waiting',
      started: false,
      hostSessionToken: sessionToken || createSessionToken(),
      players: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: [],
      gameHistory: [],
      roundHistory: [],
      selectedGame: null
    };

    const hostPlayer = {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionToken: room.hostSessionToken,
      displayName: roomDisplayName,
      isHost: true,
      connected: true,
      disconnectedAt: null,
      order: 1,
      score: 0,
      status: 'connected'
    };

    room.players.push(hostPlayer);
    this.rooms.set(code, room);
    this.sessions.set(room.hostSessionToken, code);
    return this.serializeRoom(room);
  }

  joinRoom({ roomCode, displayName, sessionToken }) {
    const normalizedCode = normalizeRoomCode(roomCode);
    const room = this.getRoomByCode(normalizedCode);
    const trimmedName = normalizeDisplayName(displayName);

    if (!room) {
      throw new Error('Room does not exist.');
    }

    if (room.started) {
      throw new Error('This room has already started.');
    }

    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full.');
    }

    if (!isValidDisplayName(trimmedName)) {
      throw new Error('Display name must be 2-16 characters and use letters, numbers, spaces, hyphens, or underscores.');
    }

    const nameExists = room.players.some((player) => player.displayName.toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      throw new Error('That display name is already in use in this room.');
    }

    const player = {
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionToken,
      displayName: trimmedName,
      isHost: false,
      connected: true,
      disconnectedAt: null,
      order: room.players.length + 1,
      score: 0,
      status: 'connected'
    };

    room.players.push(player);
    room.updatedAt = Date.now();
    this.sessions.set(sessionToken, normalizedCode);
    return this.serializeRoom(room);
  }

  leaveRoom({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex((player) => player.sessionToken === sessionToken);
    if (playerIndex === -1) {
      return room;
    }

    const [player] = room.players.splice(playerIndex, 1);
    if (room.selectedGame && room.selectedGame.id === 'describe-the-word') {
      room.selectedGame = describeTheWord.handlePlayerDisconnected(room.selectedGame, sessionToken);
      const gamePlayer = room.selectedGame.players.find((entry) => entry.sessionToken === sessionToken);
      if (gamePlayer) {
        gamePlayer.connected = false;
      }
    }
    if (player.isHost) {
      this.promoteHostIfNeeded(room.code);
    }

    this.sessions.delete(sessionToken);
    room.updatedAt = Date.now();
    this.syncSelectedGamePlayers(room);

    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return null;
    }

    return this.serializeRoom(room);
  }

  setRoomState({ roomCode, sessionToken, started }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    const hostPlayer = room.players.find((player) => player.sessionToken === sessionToken);
    if (!hostPlayer || !hostPlayer.isHost) {
      throw new Error('Only the host can start the game night.');
    }

    if (room.players.length > 0 && !room.players.some((player) => player.connected)) {
      throw new Error('At least one player must be connected to start the game night.');
    }

    const connectedPlayers = room.players.filter((player) => player.connected).length;
    if (started && connectedPlayers < 1) {
      throw new Error('At least one connected player is required to start the game night.');
    }

    room.started = Boolean(started);
    room.status = started ? 'in-game' : 'waiting';
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  endGameNight({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      throw new Error('Room not found.');
    }

    const hostPlayer = room.players.find((player) => player.sessionToken === sessionToken);
    if (!hostPlayer || !hostPlayer.isHost) {
      throw new Error('Only the host can end the game night.');
    }

    for (const player of room.players) {
      this.sessions.delete(player.sessionToken);
    }

    this.rooms.delete(room.code);
    return room;
  }

  clearSelectedGame({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    const hostPlayer = room.players.find((player) => player.sessionToken === sessionToken);
    if (!hostPlayer || !hostPlayer.isHost) {
      throw new Error('Only the host can return to game selection.');
    }

    room.selectedGame = null;
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  setSelectedGame({ roomCode, sessionToken, gameId }) {
    const room = this.getRoomByCode(roomCode);
    if (!room) {
      return null;
    }

    const hostPlayer = room.players.find((player) => player.sessionToken === sessionToken);
    if (!hostPlayer || !hostPlayer.isHost) {
      throw new Error('Only the host can pick a game.');
    }

    const game = getGameById(gameId);
    if (!game) {
      throw new Error('That game does not exist.');
    }

    const connectedPlayers = room.players.filter((player) => player.connected).length;
    if (connectedPlayers < 1) {
      throw new Error('At least one connected player is required to pick a game.');
    }

    const gameModule = getGameModule(gameId);
    const gameState = gameModule.createGameState(room);
    room.selectedGame = {
      ...game,
      ...gameState,
      roundId: `round_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      startedAt: Date.now(),
      prompt: gameState.prompt || 'Ready to play.'
    };
    room.gameHistory = room.gameHistory || [];
    room.gameHistory.push(game.id);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitGameVote({ roomCode, sessionToken, targetSessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame) {
      return null;
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    const selectedGame = room.selectedGame;
    if (selectedGame.id === 'most-likely-to') {
      return this.submitMostLikelyToVote({ roomCode, sessionToken, targetSessionToken });
    }

    return this.serializeRoom(room);
  }

  submitMostLikelyToVote({ roomCode, sessionToken, targetSessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'most-likely-to') {
      throw new Error('Most Likely To is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    const connectedTokens = room.players.filter((p) => p.connected).map((p) => p.sessionToken);
    room.selectedGame = mostLikelyTo.submitVote(room.selectedGame, sessionToken, targetSessionToken, connectedTokens);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  resolveMostLikelyToSuspense({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'most-likely-to') {
      return null;
    }

    const updated = mostLikelyTo.resolveSuspense(room.selectedGame, expectedDeadlineAt);
    if (!updated) {
      return null;
    }

    room.selectedGame = updated;
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  advanceMostLikelyToQuestion({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'most-likely-to') {
      throw new Error('Most Likely To is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = mostLikelyTo.nextQuestion(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  endMostLikelyTo({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'most-likely-to') {
      throw new Error('Most Likely To is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = mostLikelyTo.skipOrEndGame(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  submitHotTakeChoice({ roomCode, sessionToken, choice }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'hot-take-game') {
      throw new Error('Hot Take Game is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    const connectedTokens = room.players.filter((p) => p.connected).map((p) => p.sessionToken);
    room.selectedGame = hotTakeGame.submitChoice(room.selectedGame, sessionToken, choice, connectedTokens);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  advanceHotTake({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'hot-take-game') {
      throw new Error('Hot Take Game is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = hotTakeGame.nextTake(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  endHotTake({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'hot-take-game') {
      throw new Error('Hot Take Game is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = hotTakeGame.skipOrEndGame(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  startDontLaughFaceOff({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'dont-laugh-challenge') {
      throw new Error("Don't Laugh Challenge is not active.");
    }

    room.selectedGame = dontLaughChallenge.startFaceOff(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  timeoutDontLaughFaceOff({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'dont-laugh-challenge'
      || room.selectedGame.status !== 'face-off'
      || room.selectedGame.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = dontLaughChallenge.handleFaceOffTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitDontLaughVote({ roomCode, sessionToken, didLaugh }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'dont-laugh-challenge') {
      throw new Error("Don't Laugh Challenge is not active.");
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = dontLaughChallenge.submitVote(room.selectedGame, sessionToken, didLaugh);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advanceDontLaughFaceOff({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'dont-laugh-challenge') {
      throw new Error("Don't Laugh Challenge is not active.");
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = dontLaughChallenge.nextFaceOff(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  submitFindTheSpyClueDone({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'find-the-spy') {
      throw new Error('Find the Spy is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = findTheSpy.markClueDone(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitFindTheSpyVote({ roomCode, sessionToken, targetSessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'find-the-spy') {
      throw new Error('Find the Spy is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = findTheSpy.submitVote(room.selectedGame, sessionToken, targetSessionToken);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  resolveFindTheSpyVote({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'find-the-spy') {
      return null;
    }

    const updatedGame = findTheSpy.resolveVoteReveal(room.selectedGame, expectedDeadlineAt);
    if (!updatedGame) {
      return null;
    }

    room.selectedGame = updatedGame;
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  submitFindTheSpyGuess({ roomCode, sessionToken, guess }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'find-the-spy') {
      throw new Error('Find the Spy is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = findTheSpy.submitSpyGuess(room.selectedGame, sessionToken, guess);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  recordCompletedRound(room) {
    const game = room.selectedGame;
    if (!game || game.status !== 'results' || !game.roundId) {
      return;
    }

    room.roundHistory = room.roundHistory || [];
    if (room.roundHistory.some((entry) => entry.roundId === game.roundId)) {
      return;
    }

    room.roundHistory.push({
      roundId: game.roundId,
      gameId: game.id,
      gameName: game.name,
      completedAt: Date.now(),
      result: JSON.parse(JSON.stringify(game.result))
    });
    if (room.roundHistory.length > 50) {
      room.roundHistory.shift();
    }
  }

  startFiveSecondTimer({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'five-second-rule') {
      throw new Error('5-Second Rule is not active.');
    }

    room.selectedGame = fiveSecondRule.startTimer(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  timeoutFiveSecondTurn({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'five-second-rule'
      || room.selectedGame.status !== 'answering'
      || room.selectedGame.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    const updatedGame = fiveSecondRule.handleTimeout(
      room.selectedGame,
      expectedDeadlineAt
    );
    room.selectedGame = updatedGame;
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  judgeFiveSecondTurn({ roomCode, sessionToken, judgment }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'five-second-rule') {
      throw new Error('5-Second Rule is not active.');
    }

    room.selectedGame = fiveSecondRule.recordJudgment(room.selectedGame, sessionToken, judgment);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advanceFiveSecondTurn({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'five-second-rule') {
      throw new Error('5-Second Rule is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = fiveSecondRule.nextTurn(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  startHeadsUpTurn({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'heads-up') {
      throw new Error('Heads Up! is not active.');
    }

    room.selectedGame = headsUp.startTurn(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  advanceHeadsUpWord({ roomCode, sessionToken, action, wordNumber }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'heads-up') {
      throw new Error('The Heads Up! round is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = headsUp.advanceWord(
      room.selectedGame,
      action,
      sessionToken,
      wordNumber
    );
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  timeoutHeadsUpTurn({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'heads-up'
      || room.selectedGame.status !== 'playing'
      || room.selectedGame.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = headsUp.handleTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advanceHeadsUpPlayer({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'heads-up') {
      throw new Error('Heads Up! is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = headsUp.nextPlayerTurn(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  nominateDescribeTheWordDescriber({ roomCode, sessionToken, nomineeSessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'describe-the-word') {
      throw new Error('Describe the Word is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = describeTheWord.nominateDescriber(room.selectedGame, sessionToken, nomineeSessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  respondToDescribeTheWordNomination({ roomCode, sessionToken, accepted }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'describe-the-word') {
      throw new Error('Describe the Word is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = describeTheWord.respondToNomination(room.selectedGame, sessionToken, accepted);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  resolveDescribeTheWord({ roomCode, sessionToken, action, wordActionNumber }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'describe-the-word') {
      throw new Error('Describe the Word is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = describeTheWord.resolveWord(room.selectedGame, sessionToken, action, wordActionNumber);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  timeoutDescribeTheWordTurn({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'describe-the-word'
      || room.selectedGame.status !== 'playing'
      || room.selectedGame.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = describeTheWord.handleTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  timeoutDescribeTheWordReconnect({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'describe-the-word'
      || room.selectedGame.status !== 'paused-reconnect'
      || room.selectedGame.reconnectDeadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = describeTheWord.handleReconnectTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  endDescribeTheWordEarly({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'describe-the-word') {
      throw new Error('Describe the Word is not active.');
    }
    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost) {
      throw new Error('Only the host can end the game early.');
    }
    room.selectedGame = describeTheWord.endEarly(room.selectedGame, true);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  submitGuessWhoFact({ roomCode, sessionToken, fact }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'guess-who') {
      throw new Error('Guess Who? is not active.');
    }

    room.selectedGame = guessWho.submitFact(room.selectedGame, sessionToken, fact);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  closeGuessWhoSubmissions({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'guess-who') {
      throw new Error('Guess Who? is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = guessWho.closeSubmissions(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitGuessWhoGuess({ roomCode, sessionToken, guess }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'guess-who') {
      throw new Error('Guess Who? is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = guessWho.submitGuess(room.selectedGame, sessionToken, guess);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advanceGuessWhoFact({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'guess-who') {
      throw new Error('Guess Who? is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = guessWho.nextFact(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  startWhoAmITurn({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'who-am-i') {
      throw new Error('Who Am I? is not active.');
    }

    room.selectedGame = whoAmI.startTurn(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitWhoAmIGuess({ roomCode, sessionToken, guess }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'who-am-i') {
      throw new Error('Who Am I? is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = whoAmI.submitGuess(room.selectedGame, sessionToken, guess);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  timeoutWhoAmITurn({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'who-am-i'
      || room.selectedGame.status !== 'playing'
      || room.selectedGame.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = whoAmI.handleTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advanceWhoAmIPlayer({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'who-am-i') {
      throw new Error('Who Am I? is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = whoAmI.nextPlayerTurn(room.selectedGame, Boolean(player && player.isHost));
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  saveNameThatTunePlaylist({ roomCode, sessionToken, songs }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = nameThatTune.savePlaylist(room.selectedGame, sessionToken, songs);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  startNameThatTune({ roomCode, sessionToken, songs }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost || !player.connected) {
      throw new Error('Only the host can start the game.');
    }

    room.selectedGame = nameThatTune.savePlaylist(room.selectedGame, sessionToken, songs);
    room.selectedGame = nameThatTune.startGame(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  buzzNameThatTune({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = nameThatTune.buzz(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  submitNameThatTuneAttempt({ roomCode, sessionToken, title, artist }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = nameThatTune.submitAttempt(room.selectedGame, sessionToken, { title, artist });
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  judgeNameThatTuneAttempt({ roomCode, sessionToken, titleCorrect, artistCorrect }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost || !player.connected) {
      throw new Error('Only the host can judge song attempts.');
    }

    room.selectedGame = nameThatTune.judgeAttempt(room.selectedGame, sessionToken, { titleCorrect, artistCorrect });
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  timeoutNameThatTuneAttempt({ roomCode, expectedDeadlineAt }) {
    const room = this.getRoomByCode(roomCode);
    if (
      !room
      || !room.selectedGame
      || room.selectedGame.id !== 'name-that-tune'
      || room.selectedGame.status !== 'attempting'
      || !room.selectedGame.activeAttempt
      || room.selectedGame.activeAttempt.deadlineAt !== expectedDeadlineAt
      || Date.now() < expectedDeadlineAt
    ) {
      return null;
    }

    room.selectedGame = nameThatTune.handleTimeout(room.selectedGame, expectedDeadlineAt);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  revealNameThatTuneWithoutBuzz({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost || !player.connected) {
      throw new Error('Only the host can reveal the answer.');
    }

    room.selectedGame = nameThatTune.revealWithoutBuzz(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  advanceNameThatTuneSong({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'name-that-tune') {
      throw new Error('Name That Tune is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost || !player.connected) {
      throw new Error('Only the host can move to the next song.');
    }

    room.selectedGame = nameThatTune.nextSong(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  startDoNotSpill({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'do-not-spill') {
      throw new Error('Do Not Spill is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = doNotSpill.startGame(
      room.selectedGame,
      Boolean(player && player.isHost)
    );
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  recordDoNotSpillSpill({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'do-not-spill') {
      throw new Error('Do Not Spill is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = doNotSpill.recordSpill(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  spinDoNotSpill({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'do-not-spill') {
      throw new Error('Do Not Spill is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = doNotSpill.spinWheel(room.selectedGame, sessionToken);
    room.updatedAt = Date.now();
    return this.serializeRoom(room);
  }

  decideDoNotSpill({ roomCode, sessionToken, accepted }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'do-not-spill') {
      throw new Error('Do Not Spill is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    room.selectedGame = doNotSpill.decideConsequence(
      room.selectedGame,
      sessionToken,
      accepted
    );
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  endDoNotSpill({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'do-not-spill') {
      throw new Error('Do Not Spill is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    room.selectedGame = doNotSpill.endGame(
      room.selectedGame,
      Boolean(player && player.isHost)
    );
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  submitPutAFingerDownResponse({ roomCode, sessionToken, response }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'put-a-finger-down') {
      throw new Error('Put a Finger Down is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.connected) {
      throw new Error('You are not connected to this room.');
    }

    const connectedSessionTokens = room.players
      .filter((entry) => entry.connected)
      .map((entry) => entry.sessionToken);
    room.selectedGame = putAFingerDown.submitResponse(
      room.selectedGame,
      sessionToken,
      response,
      connectedSessionTokens
    );
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  advancePutAFingerDownRound({ roomCode, sessionToken }) {
    const room = this.getRoomByCode(roomCode);
    if (!room || !room.selectedGame || room.selectedGame.id !== 'put-a-finger-down') {
      throw new Error('Put a Finger Down is not active.');
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player || !player.isHost) {
      throw new Error('Only the host can continue to the next prompt.');
    }

    room.selectedGame = putAFingerDown.advanceRound(room.selectedGame);
    room.updatedAt = Date.now();
    this.recordCompletedRound(room);
    return this.serializeRoom(room);
  }

  serializeRoomForPlayer(room, sessionToken) {
    const serializedRoom = this.serializeRoom(room);
    const game = serializedRoom.selectedGame;

    if (game && game.id === 'most-likely-to') {
      const eligible = game.players.filter((p) => {
        const roomPlayer = room.players.find((rp) => rp.sessionToken === p.sessionToken);
        return Boolean(roomPlayer && roomPlayer.connected);
      });
      game.votesSubmitted = eligible.filter((p) => p.vote !== null).length;
      game.totalEligibleVoters = eligible.length;
      game.currentQuestionIndex = game.promptIndex;

      if (game.status === 'voting' || game.status === 'suspense') {
        game.players.forEach((player) => {
          player.hasVoted = player.vote !== null;
          if (player.sessionToken !== sessionToken) {
            player.vote = null;
          }
        });
      }
    }

    if (game && game.id === 'five-second-rule') {
      game.turnNumber = (game.turnIndex || 0) + 1;
      const active = game.players.find((p) => p.sessionToken === game.activeSessionToken);
      game.activeDisplayName = active ? active.displayName : '';
      game.isMyTurn = game.activeSessionToken === sessionToken;
      // Single assigned judge: only the designated judge can judge
      game.isJudge = game.judgeSessionToken === sessionToken;
      game.canJudge = game.status === 'judging' && game.isJudge;
      const judge = game.players.find((p) => p.sessionToken === game.judgeSessionToken);
      game.judgeDisplayName = judge ? judge.displayName : '';
    }

    if (game && game.id === 'hot-take-game') {
      const eligible = game.players.filter((p) => {
        const roomPlayer = room.players.find((rp) => rp.sessionToken === p.sessionToken);
        return Boolean(roomPlayer && roomPlayer.connected);
      });
      game.choicesSubmitted = eligible.filter((p) => p.locked && p.choice !== null).length;
      game.totalEligiblePlayers = eligible.length;
      game.currentTakeIndex = game.promptIndex;

      if (game.status === 'voting') {
        game.players.forEach((player) => {
          player.hasSubmitted = Boolean(player.locked);
          if (player.sessionToken !== sessionToken) {
            player.choice = null;
          }
        });
      }
    }

    if (game && game.id === 'dont-laugh-challenge') {
      const myPlayer = game.players.find((p) => p.sessionToken === sessionToken);
      game.myTeamId = myPlayer ? myPlayer.teamId : null;
      const myTeam = game.teams.find((t) => t.id === game.myTeamId);
      game.myTeamName = myTeam ? myTeam.name : '';

      const pairing = game.currentPairing;
      if (pairing) {
        game.currentFaceOff = {
          challengerSessionToken: pairing.challenger.sessionToken,
          challengerName: pairing.challenger.displayName,
          challengerTeam: pairing.challengerTeam,
          defenderSessionToken: pairing.defender.sessionToken,
          defenderName: pairing.defender.displayName,
          defenderTeam: pairing.defenderTeam,
          pairingNumber: game.currentPairingIndex + 1,
          totalPairings: game.totalPairings
        };
      }

      if (game.roundResult) {
        game.lastResultMsg = game.roundResult.message;
      }

      if (game.status === 'judging' || game.status === 'revote') {
        const myVote = game.votes ? game.votes[sessionToken] : undefined;
        game.submittedVoteCount = game.votes ? Object.keys(game.votes).length : 0;
        game.myVote = myVote !== undefined ? myVote : null;
        delete game.votes;
      }
    }

    if (game && game.id === 'guess-who') {
      const myPlayer = game.players.find((p) => p.sessionToken === sessionToken);
      game.mySubmittedFact = myPlayer ? (myPlayer.fact || '') : '';
      game.submittedCount = game.players.filter((p) => p.hasSubmittedFact && p.fact).length;
      game.totalFacts = game.facts ? game.facts.length : (game.totalFacts || 0);

      if (game.status === 'submitting') {
        game.players.forEach((player) => {
          player.hasSubmitted = player.hasSubmittedFact;
          delete player.fact;
        });
        delete game.facts;
      } else if (game.status === 'guessing') {
        const authorToken = game.currentFact ? game.currentFact.authorSessionToken : null;
        game.isMyFact = Boolean(authorToken && authorToken === sessionToken);
        if (game.currentFact) {
          game.currentFact = {
            id: game.currentFact.id,
            fact: game.currentFact.fact,
            isMyFact: game.isMyFact
          };
        }
        delete game.facts;
        game.candidateAuthorTokens = game.players.map((p) => p.sessionToken);
        game.guessesSubmitted = game.players.filter((p) => p.guess !== null).length;
        game.totalEligibleGuessers = game.players.filter((p) => p.sessionToken !== authorToken).length;
        game.players.forEach((player) => {
          player.hasGuessed = player.guess !== null;
          if (player.sessionToken !== sessionToken) {
            player.guess = null;
          }
          delete player.fact;
        });
      } else {
        delete game.facts;
        game.players.forEach((player) => {
          delete player.fact;
        });
      }
    }

    if (game && game.id === 'who-am-i') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      const isOwner = Boolean(currentPlayer && currentPlayer.sessionToken === sessionToken);
      if (game.status === 'ready' || game.status === 'playing') {
        if (isOwner) {
          game.secretIdentity = null;
        } else if (currentPlayer) {
          game.secretIdentity = currentPlayer.identity;
        }
        game.players.forEach((player) => {
          if (player.sessionToken === sessionToken) {
            player.secretIdentity = null;
          } else {
            player.secretIdentity = player.identity;
          }
          delete player.identity;
          delete player.aliases;
        });
      } else if (game.status === 'turn-reveal') {
        if (currentPlayer) {
          game.secretIdentity = currentPlayer.identity;
        }
        game.players.forEach((player) => {
          player.secretIdentity = player.identity;
          delete player.identity;
          delete player.aliases;
        });
      } else {
        game.players.forEach((player) => {
          delete player.identity;
          delete player.aliases;
        });
      }
    }

    if (game && game.id === 'heads-up') {
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (game.status === 'playing') {
        if (!sessionToken || (currentPlayer && currentPlayer.sessionToken === sessionToken)) {
          game.word = null;
        }
      }
      game.turnCorrectCount = game.currentTurnHistory
        ? game.currentTurnHistory.filter((entry) => entry.action === 'correct').length
        : (game.turnSummary ? game.turnSummary.scoreThisTurn : 0);
      game.history = [];
      delete game.usedWords;
      delete game.skippedWords;
    }

    if (game && game.id === 'describe-the-word') {
      const currentTeam = game.teams[game.currentTeamIndex];
      const requestingPlayer = game.players.find((player) => player.sessionToken === sessionToken);
      game.players.forEach((player) => {
        const roomPlayer = room.players.find((entry) => entry.sessionToken === player.sessionToken);
        player.connected = Boolean(roomPlayer && roomPlayer.connected);
      });
      if (!requestingPlayer || !currentTeam || currentTeam.describerSessionToken !== sessionToken) {
        game.word = null;
      }
      game.teams.forEach((team) => {
        delete team.words;
      });
      game.history = game.history.map(({ word, ...entry }) => entry);
      if (!sessionToken) {
        game.pendingNomination = null;
      }
    }

    if (game && game.id === 'name-that-tune') {
      const requestingPlayer = room.players.find((player) => player.sessionToken === sessionToken);
      const isHost = Boolean(requestingPlayer && requestingPlayer.isHost);
      if (game.status === 'setup' && !isHost) {
        game.songs = game.songs.map(() => ({ title: '', artist: '' }));
      } else if (game.status !== 'setup' && game.status !== 'results' && !isHost) {
        delete game.songs;
      }
      if (game.activeAttempt && !isHost) {
        delete game.activeAttempt.titleGuess;
        delete game.activeAttempt.artistGuess;
      }
      delete game.hostSessionToken;
    }

    if (game && game.id === 'put-a-finger-down' && game.status === 'answering') {
      game.players.forEach((player) => {
        if (player.sessionToken !== sessionToken) {
          player.response = null;
        }
      });
    }

    if (game && game.id === 'find-the-spy') {
      const { spySessionToken, category, secretWord } = game;
      delete game.spySessionToken;
      delete game.secretWord;
      game.revealedVoteRounds = game.revealedVoteRounds.map((round) => ({
        round: round.round,
        votes: round.votes.map(({ voterName, targetName }) => ({ voterName, targetName })),
        tiedNames: [...round.tiedNames]
      }));
      if (game.status === 'spy-guess' || game.status === 'results') {
        game.privateRole = null;
      } else {
        const currentPlayer = game.players.find((player) => player.sessionToken === sessionToken);
        game.privateRole = currentPlayer
          ? {
            isSpy: sessionToken === spySessionToken,
            category,
            word: sessionToken === spySessionToken ? null : secretWord
          }
          : null;
      }
      if (game.status !== 'results') {
        game.players.forEach((player) => {
          player.hasVoted = player.vote !== null;
          player.vote = null;
        });
      } else {
        game.players.forEach((player) => {
          delete player.vote;
        });
      }
    }

    return serializedRoom;
  }

  serializeRoom(room) {
    return JSON.parse(JSON.stringify(room));
  }
}

module.exports = {
  MAX_PLAYERS,
  RoomStore,
  createSessionToken,
  normalizeDisplayName,
  normalizeRoomCode,
  isValidDisplayName,
  isValidRoomName,
  isValidRoomCode
};
