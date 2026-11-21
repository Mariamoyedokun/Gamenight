require('dotenv').config();

const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { GAME_DEFINITIONS } = require('./server/gameRegistry');
const { RoomStore, createSessionToken, normalizeDisplayName, normalizeRoomCode, isValidDisplayName, isValidRoomName, isValidRoomCode } = require('./server/roomStore');

const PORT = process.env.PORT;
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const roomStore = new RoomStore();
const activeSocketsBySession = new Map();
const fiveSecondTimers = new Map();
const headsUpTimers = new Map();
const whoAmITimers = new Map();
const findTheSpyTimers = new Map();
const nameThatTuneTimers = new Map();
const describeWordTimers = new Map();
const describeWordReconnectTimers = new Map();
const mostLikelyToTimers = new Map();
const dontLaughTimers = new Map();

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

function getSessionToken(req) {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  return req.cookies?.sessionToken || null;
}

function emitRoomState(roomCode) {
  const room = roomStore.getRoomByCode(roomCode);
  if (!room) {
    return;
  }

  for (const [sessionToken, socketId] of activeSocketsBySession) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data && socket.data.roomCode === roomCode) {
      socket.emit('room-state', {
        room: roomStore.serializeRoomForPlayer(room, sessionToken)
      });
    }
  }
}

function attachSessionToSocket(socket, sessionToken) {
  const room = roomStore.getRoomForSession(sessionToken);
  if (!room) {
    return false;
  }

  const previousSocketId = activeSocketsBySession.get(sessionToken);
  activeSocketsBySession.set(sessionToken, socket.id);
  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(previousSocketId);
    if (previousSocket) {
      previousSocket.disconnect(true);
    }
  }

  roomStore.setPlayerConnectionState({
    roomCode: room.code,
    sessionToken,
    connected: true,
    status: 'connected'
  });

  socket.join(room.code);
  socket.data = { roomCode: room.code, sessionToken };
  emitRoomState(room.code);
  const reconnectTimer = describeWordReconnectTimers.get(room.code);
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    describeWordReconnectTimers.delete(room.code);
  }
  scheduleDescribeWordTurn(room.code);
  scheduleDescribeWordReconnect(room.code);
  scheduleFindTheSpyReveal(room.code);
  scheduleNameThatTuneAttempt(room.code);
  return true;
}

function scheduleFiveSecondTurn(roomCode) {
  const previousTimer = fiveSecondTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    fiveSecondTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'five-second-rule' || game.status !== 'answering') {
    return;
  }

  const expectedDeadlineAt = game.deadlineAt;
  const timer = setTimeout(() => {
    fiveSecondTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutFiveSecondTurn({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleFiveSecondTurn(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  fiveSecondTimers.set(roomCode, timer);
}

function scheduleHeadsUpTurn(roomCode) {
  const previousTimer = headsUpTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    headsUpTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'heads-up' || game.status !== 'playing') {
    return;
  }

  const expectedDeadlineAt = game.deadlineAt;
  const timer = setTimeout(() => {
    headsUpTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutHeadsUpTurn({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleHeadsUpTurn(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  headsUpTimers.set(roomCode, timer);
}

function scheduleWhoAmITurn(roomCode) {
  const previousTimer = whoAmITimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    whoAmITimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'who-am-i' || game.status !== 'playing') {
    return;
  }

  const expectedDeadlineAt = game.deadlineAt;
  const timer = setTimeout(() => {
    whoAmITimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutWhoAmITurn({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleWhoAmITurn(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  whoAmITimers.set(roomCode, timer);
}

function scheduleFindTheSpyReveal(roomCode) {
  const previousTimer = findTheSpyTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    findTheSpyTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'find-the-spy' || game.status !== 'suspense') {
    return;
  }

  const expectedDeadlineAt = game.revealDeadlineAt;
  const timer = setTimeout(() => {
    findTheSpyTimers.delete(roomCode);
    const updatedRoom = roomStore.resolveFindTheSpyVote({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleFindTheSpyReveal(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  findTheSpyTimers.set(roomCode, timer);
}

function scheduleNameThatTuneAttempt(roomCode) {
  const previousTimer = nameThatTuneTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    nameThatTuneTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (
    !game
    || game.id !== 'name-that-tune'
    || game.status !== 'attempting'
    || !game.activeAttempt
    || !game.activeAttempt.deadlineAt
  ) {
    return;
  }

  const expectedDeadlineAt = game.activeAttempt.deadlineAt;
  const timer = setTimeout(() => {
    nameThatTuneTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutNameThatTuneAttempt({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleNameThatTuneAttempt(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  nameThatTuneTimers.set(roomCode, timer);
}

function scheduleDescribeWordTurn(roomCode) {
  const previousTimer = describeWordTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    describeWordTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'describe-the-word' || game.status !== 'playing') {
    return;
  }

  const expectedDeadlineAt = game.deadlineAt;
  const timer = setTimeout(() => {
    describeWordTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutDescribeTheWordTurn({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleDescribeWordTurn(roomCode);
    scheduleDescribeWordReconnect(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  describeWordTimers.set(roomCode, timer);
}

function scheduleDescribeWordReconnect(roomCode) {
  const previousTimer = describeWordReconnectTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    describeWordReconnectTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'describe-the-word' || game.status !== 'paused-reconnect') {
    return;
  }

  const expectedDeadlineAt = game.reconnectDeadlineAt;
  const timer = setTimeout(() => {
    describeWordReconnectTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutDescribeTheWordReconnect({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
    scheduleDescribeWordReconnect(roomCode);
    scheduleDescribeWordTurn(roomCode);
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  describeWordReconnectTimers.set(roomCode, timer);
}

function scheduleMostLikelyToSuspense(roomCode) {
  const previousTimer = mostLikelyToTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    mostLikelyToTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'most-likely-to' || game.status !== 'suspense' || !game.suspenseDeadlineAt) {
    return;
  }

  const expectedDeadlineAt = game.suspenseDeadlineAt;
  const timer = setTimeout(() => {
    mostLikelyToTimers.delete(roomCode);
    const updatedRoom = roomStore.resolveMostLikelyToSuspense({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  mostLikelyToTimers.set(roomCode, timer);
}

function scheduleDontLaughFaceOff(roomCode) {
  const previousTimer = dontLaughTimers.get(roomCode);
  if (previousTimer) {
    clearTimeout(previousTimer);
    dontLaughTimers.delete(roomCode);
  }

  const room = roomStore.getRoomByCode(roomCode);
  const game = room && room.selectedGame;
  if (!game || game.id !== 'dont-laugh-challenge' || game.status !== 'face-off' || !game.deadlineAt) {
    return;
  }

  const expectedDeadlineAt = game.deadlineAt;
  const timer = setTimeout(() => {
    dontLaughTimers.delete(roomCode);
    const updatedRoom = roomStore.timeoutDontLaughFaceOff({ roomCode, expectedDeadlineAt });
    if (updatedRoom) {
      emitRoomState(roomCode);
    }
  }, Math.max(0, expectedDeadlineAt - Date.now()) + 10);

  dontLaughTimers.set(roomCode, timer);
}

function clearRoomTimers(roomCode) {
  const timerMaps = [
    fiveSecondTimers,
    headsUpTimers,
    whoAmITimers,
    findTheSpyTimers,
    nameThatTuneTimers,
    describeWordTimers,
    describeWordReconnectTimers,
    mostLikelyToTimers,
    dontLaughTimers
  ];
  timerMaps.forEach((map) => {
    const timer = map.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      map.delete(roomCode);
    }
  });
}

function pruneInactiveRooms() {
  const cleanedRoomCodes = roomStore.cleanupInactiveRooms({ maxIdleMs: 1000 * 60 * 5 });
  cleanedRoomCodes.forEach((roomCode) => {
    clearRoomTimers(roomCode);
    io.to(roomCode).emit('room-state', { room: null });
  });
  for (const [sessionToken] of activeSocketsBySession) {
    if (!roomStore.getRoomForSession(sessionToken)) {
      activeSocketsBySession.delete(sessionToken);
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/create-room', (req, res) => {
  try {
    const { displayName, roomName } = req.body || {};
    const sessionToken = createSessionToken();
    const room = roomStore.createRoom({ displayName, roomName, sessionToken });

    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.json({ token: sessionToken, room });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/join-room', (req, res) => {
  try {
    const { roomCode, displayName } = req.body || {};
    const sessionToken = createSessionToken();
    const normalizedCode = normalizeRoomCode(roomCode);
    const room = roomStore.joinRoom({ roomCode: normalizedCode, displayName, sessionToken });

    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.json({ token: sessionToken, room });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/leave-room', (req, res) => {
  const sessionToken = getSessionToken(req);
  if (sessionToken) {
    const room = roomStore.getRoomForSession(sessionToken);
    if (room) {
      roomStore.leaveRoom({ roomCode: room.code, sessionToken });
    }
  }

  res.clearCookie('sessionToken', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/restore-session', (req, res) => {
  try {
    const sessionToken = getSessionToken(req);
    if (!sessionToken) {
      return res.json({ room: null, token: null });
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      return res.json({ room: null, token: null });
    }

    return res.json({ token: sessionToken, room: roomStore.serializeRoomForPlayer(room, sessionToken) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/room/:code', (req, res) => {
  const room = roomStore.getRoomByCode(req.params.code);
  if (!room) {
    return res.status(404).json({ message: 'Room not found.' });
  }
  return res.json({ room: roomStore.serializeRoomForPlayer(room, null) });
});

app.get('/api/games', (_req, res) => {
  res.json({ games: GAME_DEFINITIONS });
});

io.on('connection', (socket) => {
  const sessionToken = socket.handshake.auth?.sessionToken;

  if (sessionToken) {
    attachSessionToSocket(socket, sessionToken);
  }

  socket.on('room:subscribe', ({ roomCode, sessionToken: token }) => {
    if (!roomCode || !token) {
      return;
    }

    const room = roomStore.getRoomForSession(token);
    if (!room) {
      return;
    }

    if (roomCode !== room.code) {
      return;
    }

    attachSessionToSocket(socket, token);
  });

  socket.on('room:start', ({ sessionToken: token }) => {
    const roomCode = roomStore.getRoomForSession(token)?.code;
    if (!roomCode) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and join the room again.' });
      return;
    }

    try {
      roomStore.setRoomState({ roomCode, sessionToken: token, started: true });
      emitRoomState(roomCode);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('room:leave', ({ sessionToken: token }) => {
    const room = roomStore.getRoomForSession(token);
    if (!room) {
      return;
    }

    const updatedRoom = roomStore.leaveRoom({ roomCode: room.code, sessionToken: token });
    if (updatedRoom) {
      emitRoomState(room.code);
      scheduleDescribeWordTurn(room.code);
      scheduleDescribeWordReconnect(room.code);
    } else {
      clearRoomTimers(room.code);
      io.to(room.code).emit('room-state', { room: null });
    }

    socket.leave(room.code);
  });

  socket.on('room:pick-game', ({ sessionToken: token, gameId }) => {
    const room = roomStore.getRoomForSession(token);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and try again.' });
      return;
    }

    try {
      clearRoomTimers(room.code);
      roomStore.setSelectedGame({ roomCode: room.code, sessionToken: token, gameId });
      emitRoomState(room.code);
      scheduleFiveSecondTurn(room.code);
      scheduleHeadsUpTurn(room.code);
      scheduleWhoAmITurn(room.code);
      scheduleDescribeWordTurn(room.code);
      scheduleDescribeWordReconnect(room.code);
      scheduleMostLikelyToSuspense(room.code);
      scheduleDontLaughFaceOff(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('room:choose-next-game', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      clearRoomTimers(room.code);
      roomStore.clearSelectedGame({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:heads-up-start', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startHeadsUpTurn({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
      scheduleHeadsUpTurn(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:heads-up-action', ({ sessionToken: token, action, wordNumber } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceHeadsUpWord({ roomCode: room.code, sessionToken, action, wordNumber });
      emitRoomState(room.code);
      scheduleHeadsUpTurn(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:heads-up-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceHeadsUpPlayer({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:describe-the-word-nominate', ({ sessionToken: token, nomineeSessionToken } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.nominateDescribeTheWordDescriber({ roomCode: room.code, sessionToken, nomineeSessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:describe-the-word-nomination-response', ({ sessionToken: token, accepted } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.respondToDescribeTheWordNomination({ roomCode: room.code, sessionToken, accepted });
      emitRoomState(room.code);
      scheduleDescribeWordTurn(room.code);
      scheduleDescribeWordReconnect(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:describe-the-word-action', ({ sessionToken: token, action, wordActionNumber } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.resolveDescribeTheWord({ roomCode: room.code, sessionToken, action, wordActionNumber });
      emitRoomState(room.code);
      scheduleDescribeWordTurn(room.code);
      scheduleDescribeWordReconnect(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:describe-the-word-end', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.endDescribeTheWordEarly({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:guess-who-submit-fact', ({ sessionToken: token, fact } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitGuessWhoFact({ roomCode: room.code, sessionToken, fact });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:guess-who-close-submissions', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.closeGuessWhoSubmissions({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:guess-who-guess', ({ sessionToken: token, guess } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitGuessWhoGuess({ roomCode: room.code, sessionToken, guess });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:guess-who-next-fact', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceGuessWhoFact({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:who-am-i-start', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startWhoAmITurn({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
      scheduleWhoAmITurn(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:who-am-i-guess', ({ sessionToken: token, guess } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitWhoAmIGuess({ roomCode: room.code, sessionToken, guess });
      emitRoomState(room.code);
      scheduleWhoAmITurn(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:who-am-i-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceWhoAmIPlayer({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-save-playlist', ({ sessionToken: token, songs } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.saveNameThatTunePlaylist({ roomCode: room.code, sessionToken, songs });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-start', ({ sessionToken: token, songs } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startNameThatTune({ roomCode: room.code, sessionToken, songs });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-buzz', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.buzzNameThatTune({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
      scheduleNameThatTuneAttempt(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-attempt', ({ sessionToken: token, title, artist } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitNameThatTuneAttempt({ roomCode: room.code, sessionToken, title, artist });
      emitRoomState(room.code);
      scheduleNameThatTuneAttempt(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-judge', ({ sessionToken: token, titleCorrect, artistCorrect } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.judgeNameThatTuneAttempt({ roomCode: room.code, sessionToken, titleCorrect, artistCorrect });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-reveal', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.revealNameThatTuneWithoutBuzz({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:name-that-tune-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceNameThatTuneSong({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:do-not-spill-start', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startDoNotSpill({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:do-not-spill-spill', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.recordDoNotSpillSpill({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:do-not-spill-spin', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.spinDoNotSpill({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:do-not-spill-decision', ({ sessionToken: token, accepted } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.decideDoNotSpill({ roomCode: room.code, sessionToken, accepted });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:do-not-spill-end', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.endDoNotSpill({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:put-a-finger-down-response', ({ sessionToken: token, response } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitPutAFingerDownResponse({ roomCode: room.code, sessionToken, response });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:put-a-finger-down-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advancePutAFingerDownRound({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:dont-laugh-start', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startDontLaughFaceOff({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
      scheduleDontLaughFaceOff(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:dont-laugh-vote', ({ sessionToken: token, didLaugh } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitDontLaughVote({ roomCode: room.code, sessionToken, didLaugh });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:dont-laugh-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceDontLaughFaceOff({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:find-the-spy-clue-done', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitFindTheSpyClueDone({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:find-the-spy-vote', ({ sessionToken: token, targetSessionToken } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitFindTheSpyVote({ roomCode: room.code, sessionToken, targetSessionToken });
      emitRoomState(room.code);
      scheduleFindTheSpyReveal(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:find-the-spy-guess', ({ sessionToken: token, guess } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitFindTheSpyGuess({ roomCode: room.code, sessionToken, guess });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:five-second-start', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.startFiveSecondTimer({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
      scheduleFiveSecondTurn(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:five-second-judge', ({ sessionToken: token, judgment } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      const updated = roomStore.judgeFiveSecondTurn({ roomCode: room.code, sessionToken, judgment });
      emitRoomState(room.code);
      if (updated && updated.selectedGame && updated.selectedGame.status === 'turn-result') {
        setTimeout(() => {
          const currentRoom = roomStore.getRoomByCode(room.code);
          if (currentRoom && currentRoom.selectedGame && currentRoom.selectedGame.id === 'five-second-rule' && currentRoom.selectedGame.status === 'turn-result') {
            roomStore.advanceFiveSecondTurn({ roomCode: room.code, sessionToken: currentRoom.hostSessionToken });
            emitRoomState(room.code);
          }
        }, 2200);
      }
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:five-second-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceFiveSecondTurn({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:most-likely-to-vote', ({ sessionToken: token, targetSessionToken } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitMostLikelyToVote({ roomCode: room.code, sessionToken, targetSessionToken });
      emitRoomState(room.code);
      scheduleMostLikelyToSuspense(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:most-likely-to-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceMostLikelyToQuestion({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:most-likely-to-end', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.endMostLikelyTo({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:hot-take-choice', ({ sessionToken: token, choice } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.submitHotTakeChoice({ roomCode: room.code, sessionToken, choice });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:hot-take-next', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.advanceHotTake({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:hot-take-end', ({ sessionToken: token } = {}) => {
    const sessionToken = token || (socket.data && socket.data.sessionToken);
    if (!sessionToken) {
      socket.emit('error-message', { message: 'Your player session could not be verified. Reconnect and try again.' });
      return;
    }

    const room = roomStore.getRoomForSession(sessionToken);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and rejoin the room.' });
      return;
    }

    try {
      roomStore.endHotTake({ roomCode: room.code, sessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('game:vote', ({ sessionToken: token, targetSessionToken }) => {
    const room = roomStore.getRoomForSession(token);
    if (!room) {
      socket.emit('error-message', { message: 'Session not found. Please refresh and try again.' });
      return;
    }

    try {
      roomStore.submitGameVote({ roomCode: room.code, sessionToken: token, targetSessionToken });
      emitRoomState(room.code);
    } catch (error) {
      socket.emit('error-message', { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    const { roomCode, sessionToken } = socket.data || {};
    if (!roomCode || !sessionToken) {
      return;
    }

    if (activeSocketsBySession.get(sessionToken) !== socket.id) {
      return;
    }
    activeSocketsBySession.delete(sessionToken);

    const room = roomStore.getRoomByCode(roomCode);
    if (!room) {
      return;
    }

    const player = room.players.find((entry) => entry.sessionToken === sessionToken);
    if (!player) {
      return;
    }

    roomStore.setPlayerConnectionState({
      roomCode,
      sessionToken,
      connected: false,
      status: 'reconnecting'
    });

    emitRoomState(roomCode);
    scheduleWhoAmITurn(roomCode);
    scheduleDescribeWordTurn(roomCode);
    scheduleDescribeWordReconnect(roomCode);
  });
});

setInterval(pruneInactiveRooms, 60 * 1000);

server.listen(PORT, () => {
  console.log(`Department of Fun server running at http://localhost:${PORT}`);
});
