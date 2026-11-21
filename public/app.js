const state = {
  token: null,
  room: null,
  socket: null,
  games: [],
  activeView: 'landing',
  roomNotice: '',
  roomNoticeTimeout: null,
  fiveSecondTurnKey: null,
  headsUpTurnKey: null,
  describeWordTurnKey: null,
  guessWhoTurnKey: null,
  whoAmITurnKey: null,
  nameThatTuneTurnKey: null,
  nameThatTuneJudgementKey: null,
  doNotSpillStatusKey: null,
  dontLaughTurnKey: null
};

function getTabSessionToken() {
  return window.sessionStorage.getItem('dof-session-token');
}

function setTabSessionToken(token) {
  if (!token) {
    window.sessionStorage.removeItem('dof-session-token');
    return;
  }

  window.sessionStorage.setItem('dof-session-token', token);
}

function getRequestHeaders(extraHeaders = {}) {
  const token = state.token || getTabSessionToken();
  return {
    'Content-Type': 'application/json',
    'x-session-token': token || '',
    ...extraHeaders
  };
}

const landingView = document.getElementById('landing-view');
const authPanel = document.getElementById('auth-panel');
const lobbyView = document.getElementById('lobby-view');
const selectionView = document.getElementById('selection-view');
const gameView = document.getElementById('game-view');
const createRoomFormView = document.getElementById('create-room-form-view');
const joinRoomFormView = document.getElementById('join-room-form-view');
const authMessageEl = document.getElementById('auth-message');
const playerListEl = document.getElementById('player-list');
const roomNameEl = document.getElementById('lobby-room-name');
const roomCodeEl = document.getElementById('lobby-room-code');
const playerCountEl = document.getElementById('lobby-player-count');
const hostControlsEl = document.getElementById('host-controls');
const selectionRoomTitleEl = document.getElementById('selection-room-title');
const selectionRoomCodeEl = document.getElementById('selection-room-code');
const selectionPlayerCountEl = document.getElementById('selection-player-count');
const gameGridEl = document.getElementById('game-grid');
const selectedGameTitleEl = document.getElementById('selected-game-title');
const gamePromptTextEl = document.getElementById('game-prompt-text');
const connectionStatusEl = document.getElementById('connection-status-banner');
const gameConnectionNoteEl = document.getElementById('game-connection-note');
const gamePromptLabelEl = document.getElementById('game-prompt-label');
const gameActionsEl = document.getElementById('game-actions');

const mostLikelyToPanelEl = document.getElementById('most-likely-to-game-panel');
const mostLikelyToQuestionNumberEl = document.getElementById('most-likely-to-question-number');
const mostLikelyToProgressEl = document.getElementById('most-likely-to-progress');
const mostLikelyToSuspenseBoxEl = document.getElementById('most-likely-to-suspense-box');
const mostLikelyToSuspenseCountdownEl = document.getElementById('most-likely-to-suspense-countdown');
const mostLikelyToVotingBoxEl = document.getElementById('most-likely-to-voting-box');
const mostLikelyToOptionsEl = document.getElementById('most-likely-to-options');
const mostLikelyToRevealBoxEl = document.getElementById('most-likely-to-reveal-box');
const mostLikelyToSpotlightEl = document.getElementById('most-likely-to-spotlight');
const mostLikelyToResultsListEl = document.getElementById('most-likely-to-results-list');
const mostLikelyToNextBtn = document.getElementById('most-likely-to-next-btn');
const mostLikelyToEndBtn = document.getElementById('most-likely-to-end-btn');

const hotTakePanelEl = document.getElementById('hot-take-game-panel');
const hotTakeNumberEl = document.getElementById('hot-take-number');
const hotTakeProgressEl = document.getElementById('hot-take-progress');
const hotTakeVotingBoxEl = document.getElementById('hot-take-voting-box');
const hotTakeAgreeBtn = document.getElementById('hot-take-agree-btn');
const hotTakeDisagreeBtn = document.getElementById('hot-take-disagree-btn');
const hotTakeLockBtn = document.getElementById('hot-take-lock-btn');
const hotTakeStatusMsgEl = document.getElementById('hot-take-status-msg');
const hotTakeRevealBoxEl = document.getElementById('hot-take-reveal-box');
const hotTakeAgreeCountEl = document.getElementById('hot-take-agree-count');
const hotTakeAgreeSpeakerEl = document.getElementById('hot-take-agree-speaker');
const hotTakeAgreeListEl = document.getElementById('hot-take-agree-list');
const hotTakeDisagreeCountEl = document.getElementById('hot-take-disagree-count');
const hotTakeDisagreeSpeakerEl = document.getElementById('hot-take-disagree-speaker');
const hotTakeDisagreeListEl = document.getElementById('hot-take-disagree-list');
const hotTakeNextBtn = document.getElementById('hot-take-next-btn');
const hotTakeEndBtn = document.getElementById('hot-take-end-btn');

let localHotTakeSelection = null;
let lastHotTakePrompt = null;

const fiveSecondPanelEl = document.getElementById('five-second-game-panel');
const fiveSecondTurnStatusEl = document.getElementById('five-second-turn-status');
const fiveSecondCountdownEl = document.getElementById('five-second-countdown');
const fiveSecondTrackerEl = document.getElementById('five-second-tracker');
const fiveSecondStartBtn = document.getElementById('five-second-start-btn');
const fiveSecondJudgingActionsEl = document.getElementById('five-second-judging-actions');
const fiveSecondPassBtn = document.getElementById('five-second-pass-btn');
const fiveSecondFailBtn = document.getElementById('five-second-fail-btn');
const fiveSecondNextBtn = document.getElementById('five-second-next-btn');
const fiveSecondFeedbackEl = document.getElementById('five-second-feedback');
const fiveSecondTurnHistoryEl = document.getElementById('five-second-turn-history');

const headsUpPanelEl = document.getElementById('heads-up-game-panel');
const headsUpTurnStatusEl = document.getElementById('heads-up-turn-status');
const headsUpCountdownEl = document.getElementById('heads-up-countdown');
const headsUpWordCardEl = document.getElementById('heads-up-word-card');
const headsUpStartBtn = document.getElementById('heads-up-start-btn');
const headsUpGroupControlsEl = document.getElementById('heads-up-group-controls');
const headsUpCorrectButton = document.getElementById('heads-up-correct-button');
const headsUpSkipButton = document.getElementById('heads-up-skip-button');
const headsUpTurnSummaryEl = document.getElementById('heads-up-turn-summary');
const headsUpTurnSummaryTextEl = document.getElementById('heads-up-turn-summary-text');
const headsUpNextBtn = document.getElementById('heads-up-next-btn');
const headsUpFeedbackEl = document.getElementById('heads-up-feedback');
const headsUpScoresEl = document.getElementById('heads-up-scores');

const describeWordGamePanelEl = document.getElementById('describe-word-game-panel');
const describeWordTurnStatusEl = document.getElementById('describe-word-turn-status');
const describeWordCountdownEl = document.getElementById('describe-word-countdown');
const describeWordCardEl = document.getElementById('describe-word-card');
const describeWordTeamScoresEl = document.getElementById('describe-word-team-scores');
const describeWordNominationControlsEl = document.getElementById('describe-word-nomination-controls');
const describeWordActionsEl = document.getElementById('describe-word-actions');
const describeWordFeedbackEl = document.getElementById('describe-word-feedback');
const describeWordEndBtn = document.getElementById('describe-word-end-btn');

const fingerDownPanelEl = document.getElementById('finger-down-game-panel');
const fingerDownRoundStatusEl = document.getElementById('finger-down-round-status');
const fingerDownCountEl = document.getElementById('finger-down-count');
const fingerDownResponseProgressEl = document.getElementById('finger-down-response-progress');
const fingerDownResponseActionsEl = document.getElementById('finger-down-response-actions');
const fingerDownButton = document.getElementById('finger-down-button');
const fingerDownStillUpButton = document.getElementById('finger-down-still-up-button');
const fingerDownPreferNotButton = document.getElementById('finger-down-prefer-not-button');
const fingerDownResponseButtons = [fingerDownButton, fingerDownStillUpButton, fingerDownPreferNotButton];
const fingerDownFeedbackEl = document.getElementById('finger-down-feedback');
const fingerDownRoundResultsEl = document.getElementById('finger-down-round-results');
const fingerDownFinalScoresEl = document.getElementById('finger-down-final-scores');
const fingerDownContinueButton = document.getElementById('finger-down-continue-button');

const dontLaughPanelEl = document.getElementById('dont-laugh-game-panel');
const dontLaughTeam1NameEl = document.getElementById('dont-laugh-team-1-name');
const dontLaughTeam1ScoreEl = document.getElementById('dont-laugh-team-1-score');
const dontLaughTeam2NameEl = document.getElementById('dont-laugh-team-2-name');
const dontLaughTeam2ScoreEl = document.getElementById('dont-laugh-team-2-score');
const dontLaughTurnStatusEl = document.getElementById('dont-laugh-turn-status');
const dontLaughCountdownEl = document.getElementById('dont-laugh-countdown');
const dontLaughFaceoffCardEl = document.getElementById('dont-laugh-faceoff-card');
const dontLaughChallengerNameEl = document.getElementById('dont-laugh-challenger-name');
const dontLaughDefenderNameEl = document.getElementById('dont-laugh-defender-name');
const dontLaughStartBtn = document.getElementById('dont-laugh-start-btn');
const dontLaughVoteActionsEl = document.getElementById('dont-laugh-vote-actions');
const dontLaughLaughedButton = document.getElementById('dont-laugh-laughed-button');
const dontLaughStraightFaceButton = document.getElementById('dont-laugh-straight-face-button');
const dontLaughRoundResultEl = document.getElementById('dont-laugh-round-result');
const dontLaughResultMsgEl = document.getElementById('dont-laugh-result-msg');
const dontLaughNextBtn = document.getElementById('dont-laugh-next-btn');
const dontLaughFeedbackEl = document.getElementById('dont-laugh-feedback');
const dontLaughScoresEl = document.getElementById('dont-laugh-scores');

const findSpyPanelEl = document.getElementById('find-spy-game-panel');
const findSpyRoleEl = document.getElementById('find-spy-role');
const findSpyStatusEl = document.getElementById('find-spy-status');
const findSpyCountdownEl = document.getElementById('find-spy-countdown');
const findSpySpeakingOrderEl = document.getElementById('find-spy-speaking-order');
const findSpyDoneButton = document.getElementById('find-spy-done-button');
const findSpyVoteActionsEl = document.getElementById('find-spy-vote-actions');
const findSpyGuessFormEl = document.getElementById('find-spy-guess-form');
const findSpyGuessInputEl = document.getElementById('find-spy-guess-input');
const findSpyResultsEl = document.getElementById('find-spy-results');

const guessWhoPanelEl = document.getElementById('guess-who-game-panel');
const guessWhoPhaseStatusEl = document.getElementById('guess-who-phase-status');
const guessWhoProgressEl = document.getElementById('guess-who-progress');
const guessWhoSubmissionBoxEl = document.getElementById('guess-who-submission-box');
const guessWhoFactFormEl = document.getElementById('guess-who-fact-form');
const guessWhoFactInputEl = document.getElementById('guess-who-fact-input');
const guessWhoSubmitFactBtn = document.getElementById('guess-who-submit-fact-btn');
const guessWhoSubmittedNoticeEl = document.getElementById('guess-who-submitted-notice');
const guessWhoCloseSubmissionsBtn = document.getElementById('guess-who-close-submissions-btn');
const guessWhoGuessingBoxEl = document.getElementById('guess-who-guessing-box');
const guessWhoFactDisplayEl = document.getElementById('guess-who-fact-display');
const guessWhoAuthorOptionsEl = document.getElementById('guess-who-author-options');
const guessWhoRevealBoxEl = document.getElementById('guess-who-reveal-box');
const guessWhoRevealedAuthorEl = document.getElementById('guess-who-revealed-author');
const guessWhoCorrectGuessersEl = document.getElementById('guess-who-correct-guessers');
const guessWhoNextFactBtn = document.getElementById('guess-who-next-fact-btn');
const guessWhoFeedbackEl = document.getElementById('guess-who-feedback');
const guessWhoScoresEl = document.getElementById('guess-who-scores');

const whoAmIPanelEl = document.getElementById('who-am-i-game-panel');
const whoAmITurnStatusEl = document.getElementById('who-am-i-turn-status');
const whoAmICountdownEl = document.getElementById('who-am-i-countdown');
const whoAmIIdentityCardEl = document.getElementById('who-am-i-identity-card');
const whoAmIAttemptsEl = document.getElementById('who-am-i-attempts');
const whoAmIInstructionsEl = document.getElementById('who-am-i-instructions');
const whoAmIStartBtn = document.getElementById('who-am-i-start-btn');
const whoAmIMakeGuessBtn = document.getElementById('who-am-i-make-guess-btn');
const whoAmIGuessFormEl = document.getElementById('who-am-i-guess-form');
const whoAmIGuessInputEl = document.getElementById('who-am-i-guess-input');
const whoAmIRevealCardEl = document.getElementById('who-am-i-reveal-card');
const whoAmIRevealMsgEl = document.getElementById('who-am-i-reveal-msg');
const whoAmINextBtn = document.getElementById('who-am-i-next-btn');
const whoAmIFeedbackEl = document.getElementById('who-am-i-feedback');
const whoAmIScoresEl = document.getElementById('who-am-i-scores');
const nameThatTunePanelEl = document.getElementById('name-that-tune-game-panel');
const nameThatTuneTurnStatusEl = document.getElementById('name-that-tune-turn-status');
const nameThatTuneInstructionsEl = document.getElementById('name-that-tune-instructions');
const nameThatTuneSetupFormEl = document.getElementById('name-that-tune-setup-form');
const nameThatTuneSongFieldsEl = document.getElementById('name-that-tune-song-fields');
const nameThatTuneStartButton = document.getElementById('name-that-tune-start-button');
const nameThatTuneCountdownEl = document.getElementById('name-that-tune-countdown');
const nameThatTuneBuzzButton = document.getElementById('name-that-tune-buzz-button');
const nameThatTuneAttemptFormEl = document.getElementById('name-that-tune-attempt-form');
const nameThatTuneTitleInputEl = document.getElementById('name-that-tune-title-input');
const nameThatTuneArtistInputEl = document.getElementById('name-that-tune-artist-input');
const nameThatTuneJudgeActionsEl = document.getElementById('name-that-tune-judge-actions');
const nameThatTuneJudgeButton = document.getElementById('name-that-tune-judge-button');
const nameThatTuneRevealButton = document.getElementById('name-that-tune-reveal-button');
const nameThatTuneNextButton = document.getElementById('name-that-tune-next-button');
const nameThatTuneFeedbackEl = document.getElementById('name-that-tune-feedback');
const nameThatTuneScoresEl = document.getElementById('name-that-tune-scores');
const doNotSpillPanelEl = document.getElementById('do-not-spill-game-panel');
const doNotSpillSpillCountEl = document.getElementById('do-not-spill-spill-count');
const doNotSpillStatusEl = document.getElementById('do-not-spill-status');
const doNotSpillWarningEl = document.getElementById('do-not-spill-warning');
const doNotSpillWheelEl = document.getElementById('do-not-spill-wheel');
const doNotSpillFeedbackEl = document.getElementById('do-not-spill-feedback');
const doNotSpillStartButton = document.getElementById('do-not-spill-start-button');
const doNotSpillSpillButton = document.getElementById('do-not-spill-spill-button');
const doNotSpillSpinButton = document.getElementById('do-not-spill-spin-button');
const doNotSpillDecisionActionsEl = document.getElementById('do-not-spill-decision-actions');
const doNotSpillAcceptButton = document.getElementById('do-not-spill-accept-button');
const doNotSpillPassButton = document.getElementById('do-not-spill-pass-button');
const doNotSpillEndButton = document.getElementById('do-not-spill-end-button');
const doNotSpillRecapEl = document.getElementById('do-not-spill-recap');
const gameResultActionsEl = document.getElementById('game-result-actions');
const nextGameButton = document.getElementById('next-game-button');
const replayGameButton = document.getElementById('replay-game-button');
const backToSelectionButton = document.getElementById('back-to-selection-button');
const roundHistoryOverlayEl = document.getElementById('round-history-overlay');
const roundHistoryListEl = document.getElementById('round-history-list');

function setConnectionStatus(message) {
  if (!connectionStatusEl) {
    return;
  }

  if (!message) {
    connectionStatusEl.textContent = '';
    connectionStatusEl.classList.add('hidden');
    return;
  }

  connectionStatusEl.textContent = message;
  connectionStatusEl.classList.remove('hidden');
}

function updateConnectionStatus() {
  if (!state.room) {
    setConnectionStatus('');
    return;
  }

  const currentPlayer = state.room.players.find((player) => player.sessionToken === state.token);
  if (currentPlayer && !currentPlayer.connected) {
    setConnectionStatus('You are reconnecting to the room…');
  } else if (state.socket && !state.socket.connected) {
    setConnectionStatus('Reconnecting…');
  } else {
    setConnectionStatus(state.roomNotice);
  }
}

function showRoomNotice(message) {
  state.roomNotice = message;
  if (state.roomNoticeTimeout) {
    window.clearTimeout(state.roomNoticeTimeout);
  }

  state.roomNoticeTimeout = window.setTimeout(() => {
    state.roomNotice = '';
    state.roomNoticeTimeout = null;
    updateConnectionStatus();
  }, 6000);
  updateConnectionStatus();
}

function clearRoomNotice() {
  state.roomNotice = '';
  if (state.roomNoticeTimeout) {
    window.clearTimeout(state.roomNoticeTimeout);
    state.roomNoticeTimeout = null;
  }
}

function getHostSessionToken(room) {
  if (!room) {
    return null;
  }

  return room.hostSessionToken || room.players.find((player) => player.isHost)?.sessionToken || null;
}

function showScreen(name) {
  state.activeView = name;
  landingView.classList.toggle('active', name === 'landing');
  authPanel.classList.toggle('active', name === 'auth');
  lobbyView.classList.toggle('active', name === 'lobby');
  selectionView.classList.toggle('active', name === 'selection');
  gameView.classList.toggle('active', name === 'game');
}

function setAuthMessage(message, isError = false) {
  authMessageEl.textContent = message || '';
  authMessageEl.style.color = isError ? '#b63b33' : '#2b8a67';
}

function setAuthView(mode) {
  const createVisible = mode === 'create';
  createRoomFormView.classList.toggle('hidden', !createVisible);
  joinRoomFormView.classList.toggle('hidden', createVisible);
  showScreen('auth');
}

function getInitials(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'P';
}

function renderPlayerList() {
  const room = state.room;
  if (!room) {
    playerListEl.innerHTML = '';
    return;
  }

  const orderedPlayers = [...room.players].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.order - b.order;
  });

  playerListEl.innerHTML = orderedPlayers
    .map((player) => {
      const isCurrentPlayer = player.sessionToken === state.token;
      const statusText = player.connected ? 'Connected' : player.status === 'reconnecting' ? 'Reconnecting' : 'Disconnected';
      const statusClass = player.connected ? 'connected' : 'reconnecting';
      const badges = [player.isHost ? '<span class="badge host">Host</span>' : '', isCurrentPlayer ? '<span class="badge self">You</span>' : ''];
      return `
        <li class="player-item">
          <div class="player-main">
            <div class="avatar">${getInitials(player.displayName)}</div>
            <div class="player-meta">
              <span class="player-name">${player.displayName}</span>
              <span class="player-badges">${badges.join('')}</span>
            </div>
          </div>
          <span class="player-status ${statusClass}">${statusText}</span>
        </li>
      `;
    })
    .join('');
}

function getGameHistoryLabel(gameId) {
  if (!state.room || !state.room.gameHistory) {
    return 'Not played';
  }

  const count = state.room.gameHistory.filter((id) => id === gameId).length;
  if (count === 0) return 'Not played';
  if (count === 1) return 'Played';
  return `Played ×${count}`;
}

function formatRoundResult(result) {
  if (!result) {
    return 'Round completed.';
  }
  if (result.winnerMessage) {
    return result.winnerMessage;
  }
  if (result.message) {
    return result.message;
  }
  if (Array.isArray(result.scores)) {
    return result.scores.map((entry) => {
      if (typeof entry.score === 'number') {
        return `${entry.displayName}: ${entry.score} point${entry.score === 1 ? '' : 's'}`;
      }
      if (typeof entry.fingersRemaining === 'number') {
        return `${entry.displayName}: ${entry.fingersRemaining} finger${entry.fingersRemaining === 1 ? '' : 's'} left`;
      }
      return entry.displayName;
    }).join(' · ');
  }
  if (Array.isArray(result.summary) && result.summary.length) {
    const topVote = result.summary[0];
    return `${result.winner || topVote.displayName} received ${topVote.count} vote${topVote.count === 1 ? '' : 's'}`;
  }
  if (result.winner) {
    return `Top pick: ${result.winner}`;
  }
  return 'Round completed.';
}

function renderRoundHistory() {
  if (!state.room) {
    roundHistoryListEl.replaceChildren();
    return;
  }

  const history = [...(state.room.roundHistory || [])].reverse();
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const canReplay = isHost && (!state.room.selectedGame || state.room.selectedGame.status === 'results');
  const connectedPlayers = state.room.players.filter((player) => player.connected).length;
  roundHistoryListEl.replaceChildren();

  if (history.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'round-history-item';
    emptyItem.textContent = 'No completed rounds yet.';
    roundHistoryListEl.appendChild(emptyItem);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'round-history-item';
    const title = document.createElement('strong');
    title.textContent = entry.gameName;
    const details = document.createElement('p');
    details.textContent = `${new Date(entry.completedAt).toLocaleString()} · ${formatRoundResult(entry.result)}`;
    item.append(title, details);

    const game = state.games.find((definition) => definition.id === entry.gameId);
    if (canReplay && game) {
      const replayButton = document.createElement('button');
      replayButton.type = 'button';
      replayButton.className = 'secondary-button';
      replayButton.dataset.replayGameId = entry.gameId;
      replayButton.disabled = connectedPlayers < game.minPlayers;
      replayButton.textContent = replayButton.disabled
        ? `Replay requires ${game.minPlayers} players`
        : 'Replay this game';
      item.appendChild(replayButton);
    }

    roundHistoryListEl.appendChild(item);
  });
}

function renderGameSelection() {
  if (!state.room) return;

  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connectedPlayers = state.room.players.filter((player) => player.connected).length;
  selectionRoomCodeEl.textContent = `Code: ${state.room.code}`;
  selectionPlayerCountEl.textContent = `Players: ${connectedPlayers}`;

  if (!isHost) {
    selectionRoomTitleEl.textContent = `${state.room.name} — waiting for host`;
    gameGridEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: var(--color-surface, #ffffff); border-radius: 1rem; border: 1px solid var(--color-border, #e4e4e7);">
        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🎮</span>
        <h3 style="margin: 0 0 0.5rem; font-size: 1.25rem;">The host is choosing the next game...</h3>
        <p style="color: var(--color-text-muted, #71717a); margin: 0;">Sit tight! The next round will begin in a moment.</p>
      </div>
    `;
    return;
  }

  selectionRoomTitleEl.textContent = `${state.room.name} — choose a game`;

  gameGridEl.innerHTML = state.games
    .map((game) => {
      const isSelected = state.room.selectedGame && state.room.selectedGame.id === game.id;
      const historyLabel = getGameHistoryLabel(game.id);
      const isUnderRecommended = connectedPlayers < game.minPlayers;
      const badgeText = isUnderRecommended ? `Best with ${game.minPlayers}+` : `${game.minPlayers}+ players`;
      return `
        <button class="game-card-item ${isSelected ? 'selected' : ''}" data-game-id="${game.id}">
          <div class="game-card-top">
            <span class="game-emoji">${game.icon}</span>
            <span class="game-card-badge">${badgeText}</span>
          </div>
          <h3>${game.name}</h3>
          <p>${game.shortDescription}</p>
          <div class="game-card-meta">
            <span>${historyLabel}</span>
            <span>${isSelected ? 'Selected' : 'Play →'}</span>
          </div>
        </button>
      `;
    })
    .join('');

  gameGridEl.querySelectorAll('[data-game-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      const gameId = button.dataset.gameId;
      state.socket.emit('room:pick-game', { sessionToken: state.token, gameId });
    });
  });
}

function renderSelectedGame() {
  if (!state.room || !state.room.selectedGame) {
    gamePromptTextEl.textContent = 'Choose your first game from the game selection board.';
    selectedGameTitleEl.textContent = 'No game selected';
    if (mostLikelyToPanelEl) mostLikelyToPanelEl.classList.add('hidden');
    if (hotTakePanelEl) hotTakePanelEl.classList.add('hidden');
    fiveSecondPanelEl.classList.add('hidden');
    headsUpPanelEl.classList.add('hidden');
    describeWordGamePanelEl.classList.add('hidden');
    fingerDownPanelEl.classList.add('hidden');
    dontLaughPanelEl.classList.add('hidden');
    findSpyPanelEl.classList.add('hidden');
    guessWhoPanelEl.classList.add('hidden');
    whoAmIPanelEl.classList.add('hidden');
    nameThatTunePanelEl.classList.add('hidden');
    doNotSpillPanelEl.classList.add('hidden');
    gameResultActionsEl.classList.add('hidden');
    gameActionsEl.classList.add('hidden');
    backToSelectionButton.classList.remove('hidden');
    gamePromptLabelEl.textContent = 'Prompt';
    if (gameConnectionNoteEl) {
      gameConnectionNoteEl.textContent = '';
      gameConnectionNoteEl.classList.add('hidden');
    }
    return;
  }

  const reconnectingPlayers = state.room.players
    .filter((player) => !player.connected)
    .map((player) => player.displayName);
  if (gameConnectionNoteEl) {
    gameConnectionNoteEl.textContent = reconnectingPlayers.length
      ? `Reconnecting players: ${reconnectingPlayers.join(', ')}.`
      : '';
    gameConnectionNoteEl.classList.toggle('hidden', reconnectingPlayers.length === 0);
  }

  const selectedGame = state.room.selectedGame;
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  selectedGameTitleEl.textContent = selectedGame.name;
  gameResultActionsEl.classList.toggle('hidden', selectedGame.status !== 'results' || !isHost);

  const isMostLikelyTo = selectedGame.id === 'most-likely-to';
  const isHotTake = selectedGame.id === 'hot-take-game';
  const isFiveSecondRule = selectedGame.id === 'five-second-rule';
  const isHeadsUp = selectedGame.id === 'heads-up';
  const isDescribeWord = selectedGame.id === 'describe-the-word';
  const isFingerDown = selectedGame.id === 'put-a-finger-down';
  const isDontLaugh = selectedGame.id === 'dont-laugh-challenge';
  const isFindSpy = selectedGame.id === 'find-the-spy';
  const isGuessWho = selectedGame.id === 'guess-who';
  const isWhoAmI = selectedGame.id === 'who-am-i';
  const isNameThatTune = selectedGame.id === 'name-that-tune';
  const isDoNotSpill = selectedGame.id === 'do-not-spill';

  if (mostLikelyToPanelEl) mostLikelyToPanelEl.classList.toggle('hidden', !isMostLikelyTo);
  if (hotTakePanelEl) hotTakePanelEl.classList.toggle('hidden', !isHotTake);
  fiveSecondPanelEl.classList.toggle('hidden', !isFiveSecondRule);
  headsUpPanelEl.classList.toggle('hidden', !isHeadsUp);
  describeWordGamePanelEl.classList.toggle('hidden', !isDescribeWord);
  fingerDownPanelEl.classList.toggle('hidden', !isFingerDown);
  dontLaughPanelEl.classList.toggle('hidden', !isDontLaugh);
  findSpyPanelEl.classList.toggle('hidden', !isFindSpy);
  guessWhoPanelEl.classList.toggle('hidden', !isGuessWho);
  whoAmIPanelEl.classList.toggle('hidden', !isWhoAmI);
  nameThatTunePanelEl.classList.toggle('hidden', !isNameThatTune);
  doNotSpillPanelEl.classList.toggle('hidden', !isDoNotSpill);
  gameActionsEl.classList.add('hidden');
  backToSelectionButton.classList.toggle('hidden', !isHost);

  if (isMostLikelyTo) {
    renderMostLikelyTo(selectedGame);
    return;
  }

  if (isHotTake) {
    renderHotTakeGame(selectedGame);
    return;
  }

  if (isFiveSecondRule) {
    renderFiveSecondRule(selectedGame);
    return;
  }

  if (isHeadsUp) {
    renderHeadsUp(selectedGame);
    return;
  }

  if (isDescribeWord) {
    renderDescribeTheWord(selectedGame);
    return;
  }

  if (isFingerDown) {
    renderPutAFingerDown(selectedGame);
    return;
  }

  if (isDontLaugh) {
    renderDontLaughChallenge(selectedGame);
    return;
  }

  if (isFindSpy) {
    renderFindTheSpy(selectedGame);
    return;
  }

  if (isGuessWho) {
    renderGuessWho(selectedGame);
    return;
  }

  if (isWhoAmI) {
    renderWhoAmI(selectedGame);
    return;
  }

  if (isNameThatTune) {
    renderNameThatTune(selectedGame);
    return;
  }

  if (isDoNotSpill) {
    renderDoNotSpill(selectedGame);
    return;
  }
}

function renderMostLikelyTo(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  const qNum = (selectedGame.currentQuestionIndex !== undefined ? selectedGame.currentQuestionIndex : 0) + 1;
  const totalQ = selectedGame.totalQuestions || 10;

  gamePromptLabelEl.textContent = `Question ${qNum} of ${totalQ}`;
  gamePromptTextEl.textContent = selectedGame.prompt || 'Loading question…';
  mostLikelyToQuestionNumberEl.textContent = `Question ${qNum} of ${totalQ}`;

  const submittedCount = selectedGame.votesSubmitted || 0;
  const eligibleCount = selectedGame.totalEligibleVoters || selectedGame.players.length;
  mostLikelyToProgressEl.textContent = `${submittedCount}/${eligibleCount} submitted`;

  mostLikelyToNextBtn.classList.add('hidden');
  mostLikelyToEndBtn.classList.add('hidden');

  if (selectedGame.status === 'suspense') {
    mostLikelyToVotingBoxEl.classList.add('hidden');
    mostLikelyToRevealBoxEl.classList.add('hidden');
    mostLikelyToSuspenseBoxEl.classList.remove('hidden');
    updateMostLikelyToSuspenseCountdown();
    return;
  }

  mostLikelyToSuspenseBoxEl.classList.add('hidden');

  if (['reveal', 'revealing', 'results'].includes(selectedGame.status)) {
    mostLikelyToVotingBoxEl.classList.add('hidden');
    mostLikelyToRevealBoxEl.classList.remove('hidden');

    const summary = selectedGame.revealSummary || { leaders: [], tally: [] };
    const leaders = summary.leaders || [];
    mostLikelyToSpotlightEl.replaceChildren();

    if (leaders.length > 0) {
      const title = document.createElement('h3');
      title.textContent = leaders.length > 1
        ? 'Tied for Most Likely! (Sharing the spotlight)'
        : 'Most Likely!';
      const names = document.createElement('p');
      names.textContent = `${leaders.map((l) => l.displayName).join(' & ')} (${leaders[0].votes} vote${leaders[0].votes === 1 ? '' : 's'})`;
      mostLikelyToSpotlightEl.append(title, names);
    } else {
      const title = document.createElement('h3');
      title.textContent = 'No votes recorded';
      mostLikelyToSpotlightEl.appendChild(title);
    }

    mostLikelyToResultsListEl.replaceChildren();
    (summary.tally || []).forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.displayName}: ${entry.votes} vote${entry.votes === 1 ? '' : 's'}`;
      mostLikelyToResultsListEl.appendChild(item);
    });

    if (isHost && ['reveal', 'revealing'].includes(selectedGame.status)) {
      mostLikelyToNextBtn.classList.remove('hidden');
      mostLikelyToNextBtn.disabled = !connected;
      mostLikelyToEndBtn.classList.remove('hidden');
      mostLikelyToEndBtn.disabled = !connected;
    }
    return;
  }

  // Waiting for votes
  mostLikelyToRevealBoxEl.classList.add('hidden');
  mostLikelyToVotingBoxEl.classList.remove('hidden');

  const myPlayer = selectedGame.players.find((player) => player.sessionToken === state.token);
  const hasVoted = Boolean(myPlayer && (myPlayer.hasVoted || myPlayer.vote !== null));

  mostLikelyToOptionsEl.replaceChildren();
  const candidatePlayers = selectedGame.players.filter((player) => player.sessionToken !== state.token);

  if (!candidatePlayers.length) {
    const notice = document.createElement('p');
    notice.className = 'five-second-feedback';
    notice.textContent = 'You are the only player in the room.';
    mostLikelyToOptionsEl.appendChild(notice);
    return;
  }

  candidatePlayers.forEach((player) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button vote-option';
    button.textContent = player.displayName;
    button.disabled = hasVoted || !connected;
    button.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      button.disabled = true;
      state.socket.emit('game:most-likely-to-vote', {
        sessionToken: state.token,
        targetSessionToken: player.sessionToken
      });
    });
    mostLikelyToOptionsEl.appendChild(button);
  });

  const instructionEl = document.getElementById('most-likely-to-instruction');
  if (instructionEl) {
    instructionEl.textContent = hasVoted
      ? 'Your vote is locked in. Waiting for everyone else…'
      : 'Privately choose one other player (no self-voting):';
  }
}

function updateMostLikelyToSuspenseCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'most-likely-to') return;
  const game = state.room.selectedGame;
  if (game.status !== 'suspense' || !game.revealDeadlineAt) {
    if (mostLikelyToSuspenseCountdownEl) mostLikelyToSuspenseCountdownEl.textContent = '';
    return;
  }
  const secondsLeft = Math.max(0, Math.ceil((game.revealDeadlineAt - Date.now()) / 1000));
  if (mostLikelyToSuspenseCountdownEl) mostLikelyToSuspenseCountdownEl.textContent = String(secondsLeft);
}

function renderHotTakeGame(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  const tNum = (selectedGame.currentTakeIndex !== undefined ? selectedGame.currentTakeIndex : 0) + 1;
  const totalTakes = selectedGame.totalTakes || 5;

  if (selectedGame.prompt !== lastHotTakePrompt) {
    lastHotTakePrompt = selectedGame.prompt;
    localHotTakeSelection = null;
  }

  gamePromptLabelEl.textContent = `Take ${tNum} of ${totalTakes}`;
  gamePromptTextEl.textContent = selectedGame.prompt || 'Loading hot take…';
  hotTakeNumberEl.textContent = `Take ${tNum} of ${totalTakes}`;

  const submittedCount = selectedGame.choicesSubmitted || 0;
  const totalCount = selectedGame.totalEligiblePlayers || selectedGame.players.length;
  hotTakeProgressEl.textContent = `${submittedCount}/${totalCount} submitted`;

  hotTakeNextBtn.classList.add('hidden');
  hotTakeEndBtn.classList.add('hidden');

  if (selectedGame.status === 'reveal' || selectedGame.status === 'results') {
    hotTakeVotingBoxEl.classList.add('hidden');
    hotTakeRevealBoxEl.classList.remove('hidden');

    const summary = selectedGame.revealSummary || { agreePlayers: [], disagreePlayers: [] };
    const agreePlayers = summary.agreePlayers || [];
    const disagreePlayers = summary.disagreePlayers || [];

    hotTakeAgreeCountEl.textContent = String(agreePlayers.length);
    hotTakeDisagreeCountEl.textContent = String(disagreePlayers.length);

    hotTakeAgreeListEl.replaceChildren();
    if (agreePlayers.length === 0) {
      const noneItem = document.createElement('li');
      noneItem.textContent = '(None - unanimous disagree)';
      hotTakeAgreeListEl.appendChild(noneItem);
    } else {
      agreePlayers.forEach((p) => {
        const item = document.createElement('li');
        item.textContent = p.displayName;
        hotTakeAgreeListEl.appendChild(item);
      });
    }

    hotTakeDisagreeListEl.replaceChildren();
    if (disagreePlayers.length === 0) {
      const noneItem = document.createElement('li');
      noneItem.textContent = '(None - unanimous agree)';
      hotTakeDisagreeListEl.appendChild(noneItem);
    } else {
      disagreePlayers.forEach((p) => {
        const item = document.createElement('li');
        item.textContent = p.displayName;
        hotTakeDisagreeListEl.appendChild(item);
      });
    }

    if (summary.agreeSpeaker) {
      hotTakeAgreeSpeakerEl.textContent = `🎤 Speaker: ${summary.agreeSpeaker.displayName}`;
      hotTakeAgreeSpeakerEl.classList.remove('hidden');
    } else {
      hotTakeAgreeSpeakerEl.classList.add('hidden');
    }

    if (summary.disagreeSpeaker) {
      hotTakeDisagreeSpeakerEl.textContent = `🎤 Speaker: ${summary.disagreeSpeaker.displayName}`;
      hotTakeDisagreeSpeakerEl.classList.remove('hidden');
    } else {
      hotTakeDisagreeSpeakerEl.classList.add('hidden');
    }

    if (isHost && selectedGame.status === 'reveal') {
      hotTakeNextBtn.classList.remove('hidden');
      hotTakeNextBtn.disabled = !connected;
      hotTakeEndBtn.classList.remove('hidden');
      hotTakeEndBtn.disabled = !connected;
    }
    return;
  }

  // Waiting for choices
  hotTakeRevealBoxEl.classList.add('hidden');
  hotTakeVotingBoxEl.classList.remove('hidden');

  const myPlayer = selectedGame.players.find((player) => player.sessionToken === state.token);
  const isLocked = Boolean(myPlayer && (myPlayer.hasSubmitted || myPlayer.locked));
  const currentChoice = isLocked ? myPlayer.choice : localHotTakeSelection;

  hotTakeAgreeBtn.classList.toggle('selected', currentChoice === 'agree');
  hotTakeDisagreeBtn.classList.toggle('selected', currentChoice === 'disagree');
  hotTakeAgreeBtn.disabled = !connected || isLocked;
  hotTakeDisagreeBtn.disabled = !connected || isLocked;

  if (isLocked) {
    if (hotTakeLockBtn) hotTakeLockBtn.classList.add('hidden');
    hotTakeStatusMsgEl.textContent = `Your choice (${currentChoice ? currentChoice.toUpperCase() : 'SUBMITTED'}) is locked in! Waiting for others…`;
  } else if (localHotTakeSelection) {
    if (hotTakeLockBtn) {
      hotTakeLockBtn.classList.remove('hidden');
      hotTakeLockBtn.disabled = !connected;
    }
    hotTakeStatusMsgEl.textContent = `You selected ${localHotTakeSelection.toUpperCase()}. Tap "Lock In Choice" to confirm.`;
  } else {
    if (hotTakeLockBtn) hotTakeLockBtn.classList.add('hidden');
    hotTakeStatusMsgEl.textContent = 'Make your choice:';
  }
}

function renderFiveSecondRule(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  const activeToken = selectedGame.activeSessionToken || selectedGame.activePlayerToken;
  const activePlayer = selectedGame.players.find((p) => p.sessionToken === activeToken);
  const isMyTurn = Boolean(activeToken && activeToken === state.token);
  const activeName = activePlayer ? activePlayer.displayName : (selectedGame.activeDisplayName || 'Active player');

  gamePromptLabelEl.textContent = `5-Second Rule`;
  gamePromptTextEl.textContent = selectedGame.prompt || 'Loading prompt…';

  const tNum = (selectedGame.turnIndex !== undefined ? selectedGame.turnIndex : (selectedGame.turnNumber ? selectedGame.turnNumber - 1 : 0)) + 1;
  const totalT = selectedGame.totalTurns || selectedGame.players.length;
  fiveSecondTrackerEl.textContent = `Turn ${tNum} of ${totalT} — Current Player: ${activeName}`;

  fiveSecondStartBtn.classList.add('hidden');
  fiveSecondJudgingActionsEl.classList.add('hidden');
  fiveSecondNextBtn.classList.add('hidden');

  if (selectedGame.status === 'ready') {
    fiveSecondTurnStatusEl.textContent = isMyTurn
      ? '⭐ YOUR TURN! Get ready to name 3 things in 5 seconds.'
      : `Waiting for ${activeName} to start their turn…`;
    fiveSecondCountdownEl.textContent = '5s';
    fiveSecondFeedbackEl.textContent = isMyTurn
      ? 'Tap "Start 5 Seconds" as soon as you are ready to speak!'
      : `${activeName} will answer aloud. Get ready to judge.`;
    if (isMyTurn || isHost) {
      fiveSecondStartBtn.classList.remove('hidden');
      fiveSecondStartBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'answering' || selectedGame.status === 'playing') {
    fiveSecondTurnStatusEl.textContent = isMyTurn
      ? '🎤 NAME 3 THINGS ALOUD NOW!'
      : `🎤 ${activeName} is answering aloud!`;
    fiveSecondFeedbackEl.textContent = '5-second countdown in progress…';
    updateFiveSecondCountdown();
  } else if (selectedGame.status === 'judging') {
    fiveSecondCountdownEl.textContent = 'Time!';
    const judgeLabel = selectedGame.judgeDisplayName ? `Judge: ${selectedGame.judgeDisplayName}` : 'Waiting for judge…';
    fiveSecondTurnStatusEl.textContent = isMyTurn
      ? `Time up! ${judgeLabel} is deciding your result…`
      : `Did ${activeName} successfully name 3 things in time? (${judgeLabel})`;

    // Only the single assigned judge sees PASS/FAIL
    const isJudge = Boolean(selectedGame.isJudge);

    if (isJudge) {
      fiveSecondJudgingActionsEl.classList.remove('hidden');
      fiveSecondPassBtn.disabled = !connected;
      fiveSecondFailBtn.disabled = !connected;
      fiveSecondFeedbackEl.textContent = 'You are the judge — cast your verdict (PASS or FAIL):';
    } else if (isMyTurn) {
      fiveSecondFeedbackEl.textContent = 'Your answer is being judged…';
    } else {
      fiveSecondFeedbackEl.textContent = `${selectedGame.judgeDisplayName || 'The judge'} is deciding…`;
    }
  } else if (selectedGame.status === 'turn-result') {
    const judgment = selectedGame.lastJudgment || selectedGame.turnResult || 'pass';
    fiveSecondCountdownEl.textContent = judgment.toUpperCase();
    fiveSecondTurnStatusEl.textContent = `${activeName}’s result: ${judgment.toUpperCase()}`;
    fiveSecondFeedbackEl.textContent = judgment === 'pass' ? '✓ Turn successful! Moving to next player…' : '✗ Turn unsuccessful. Moving to next player…';
    if (isHost) {
      fiveSecondNextBtn.classList.remove('hidden');
      fiveSecondNextBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'results') {
    fiveSecondTurnStatusEl.textContent = 'All turns completed!';
    fiveSecondCountdownEl.textContent = 'Done!';
    fiveSecondFeedbackEl.textContent = 'Everyone has taken their turn.';
  }

  fiveSecondTurnHistoryEl.replaceChildren();
  if (selectedGame.turnHistory && selectedGame.turnHistory.length > 0) {
    selectedGame.turnHistory.forEach((turn) => {
      const item = document.createElement('li');
      item.textContent = `${turn.displayName}: ${turn.prompt} → ${(turn.outcome || turn.judgment || 'pass').toUpperCase()}`;
      fiveSecondTurnHistoryEl.appendChild(item);
    });
  }
}

function updateFiveSecondCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'five-second-rule') return;
  const game = state.room.selectedGame;
  if (game.status !== 'playing' || !game.deadlineAt) {
    if (game.status !== 'ready' && game.status !== 'judging') {
      fiveSecondCountdownEl.textContent = '';
    }
    return;
  }
  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  fiveSecondCountdownEl.textContent = `${secondsLeft}s`;
}

function renderHeadsUp(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const currentPlayer = selectedGame.players[selectedGame.currentPlayerIndex];
  const isMyTurn = Boolean(currentPlayer && currentPlayer.sessionToken === state.token);
  const isConnected = Boolean(state.socket && state.socket.connected);

  gamePromptLabelEl.textContent = `Heads Up! (Turn ${selectedGame.turnNumber} of ${selectedGame.players.length})`;
  gamePromptTextEl.textContent = 'Active player holds their phone to their forehead. Group gives verbal clues!';

  headsUpStartBtn.classList.add('hidden');
  headsUpGroupControlsEl.classList.add('hidden');
  headsUpTurnSummaryEl.classList.add('hidden');
  headsUpScoresEl.classList.add('hidden');

  if (selectedGame.status === 'ready') {
    headsUpTurnStatusEl.textContent = isMyTurn
      ? 'Your turn! Hold your phone to your forehead when ready.'
      : `${currentPlayer ? currentPlayer.displayName : 'Player'} is getting ready.`;
    headsUpCountdownEl.textContent = '60s';
    headsUpWordCardEl.textContent = isMyTurn
      ? 'Hold phone to your forehead and tap Start Turn!'
      : 'Word will appear here when timer begins.';
    headsUpFeedbackEl.textContent = '';

    if (isMyTurn || isHost) {
      headsUpStartBtn.classList.remove('hidden');
      headsUpStartBtn.disabled = !isConnected;
    }
  } else if (selectedGame.status === 'playing') {
    const liveScore = selectedGame.turnCorrectCount || 0;
    headsUpTurnStatusEl.textContent = isMyTurn
      ? `⭐ YOUR TURN (Score: ${liveScore})`
      : `${currentPlayer ? currentPlayer.displayName : 'Player'}’s Turn (Score: ${liveScore})`;
    headsUpWordCardEl.innerHTML = isMyTurn
      ? '<span style="font-size: 1.1rem; color: #888;">📱 Hold phone to forehead!</span><br><strong style="font-size: 1.6rem; color: var(--gold, #d4af37);">GUESS!</strong><br><span style="font-size: 0.95rem;">Listen to your group</span>'
      : (selectedGame.word || 'Loading word…');
    headsUpGroupControlsEl.classList.toggle('hidden', isMyTurn);
    headsUpCorrectButton.disabled = !isConnected;
    headsUpSkipButton.disabled = !isConnected;
    headsUpFeedbackEl.textContent = isMyTurn
      ? 'Group shouts clues and marks CORRECT or SKIP.'
      : 'Shout clues aloud without saying the word! Tap CORRECT or SKIP.';
    updateHeadsUpCountdown();
  } else if (selectedGame.status === 'turn-summary') {
    headsUpTurnStatusEl.textContent = `${currentPlayer ? currentPlayer.displayName : 'Player'}’s turn finished!`;
    headsUpCountdownEl.textContent = 'Time!';
    headsUpWordCardEl.textContent = `Score: ${selectedGame.turnCorrectCount || 0} word${selectedGame.turnCorrectCount === 1 ? '' : 's'} correct`;
    headsUpTurnSummaryEl.classList.remove('hidden');
    headsUpTurnSummaryTextEl.textContent = `${currentPlayer ? currentPlayer.displayName : 'Player'} got ${selectedGame.turnCorrectCount || 0} words correct!`;
    if (isHost) {
      headsUpNextBtn.classList.remove('hidden');
      headsUpNextBtn.disabled = !isConnected;
    }
  } else if (selectedGame.status === 'results') {
    headsUpTurnStatusEl.textContent = 'Round complete';
    headsUpCountdownEl.textContent = '';
    headsUpWordCardEl.textContent = selectedGame.result && selectedGame.result.winners && selectedGame.result.winners.length
      ? `Winner: ${selectedGame.result.winners.join(', ')}`
      : 'Round finished';
    headsUpScoresEl.replaceChildren();
    headsUpScoresEl.classList.remove('hidden');
    const scores = selectedGame.result ? selectedGame.result.scores : [];
    scores.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.displayName}: ${entry.score} point${entry.score === 1 ? '' : 's'}`;
      headsUpScoresEl.appendChild(item);
    });
  }
}

function renderDescribeTheWord(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const isConnected = Boolean(state.socket && state.socket.connected);
  const team = selectedGame.teams[selectedGame.currentTeamIndex];
  const describer = team && selectedGame.players.find((player) => player.sessionToken === team.describerSessionToken);
  const isDescriber = Boolean(describer && describer.sessionToken === state.token);
  const turnKey = `${state.room.code}:${selectedGame.turnNumber}:${selectedGame.currentWordIndex}:${selectedGame.revisiting}`;
  if (state.describeWordTurnKey !== turnKey) {
    state.describeWordTurnKey = turnKey;
    describeWordFeedbackEl.textContent = '';
  }

  if (describeWordEndBtn) {
    describeWordEndBtn.classList.toggle('hidden', !isHost || selectedGame.status === 'results');
    describeWordEndBtn.disabled = !isConnected;
  }

  gamePromptLabelEl.textContent = 'Describe the Word';
  gamePromptTextEl.textContent = 'Your team has five minutes to describe ten words. Do not say the word or part of it, spell it, give its first letter, gesture or act, point to something, or rhyme it.';
  describeWordTeamScoresEl.replaceChildren();
  selectedGame.teams.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `${entry.name}: ${entry.score} / ${selectedGame.totalWords} correct`;
    describeWordTeamScoresEl.appendChild(item);
  });
  describeWordNominationControlsEl.replaceChildren();
  describeWordNominationControlsEl.classList.add('hidden');
  describeWordActionsEl.classList.add('hidden');
  describeWordActionsEl.querySelectorAll('button').forEach((button) => {
    button.disabled = !isConnected;
  });

  if (selectedGame.status === 'results') {
    describeWordTurnStatusEl.textContent = selectedGame.result.isDraw
      ? 'Draw — both teams scored the same.'
      : `${selectedGame.result.winner} wins!`;
    describeWordCountdownEl.textContent = '';
    describeWordCardEl.textContent = 'Both teams have completed their five-minute turn.';
    return;
  }

  if (selectedGame.status === 'nominating' || selectedGame.status === 'replacement-nomination') {
    const nominationTeam = selectedGame.nominationMode === 'replacement'
      ? team
      : selectedGame.teams[selectedGame.nominationTeamIndex];
    const nominationTeamPlayers = nominationTeam
      ? selectedGame.players.filter((player) => player.teamId === nominationTeam.id && player.connected)
      : [];
    const nominee = selectedGame.pendingNomination
      ? selectedGame.players.find((player) => player.sessionToken === selectedGame.pendingNomination)
      : null;
    const isTeamMember = nominationTeamPlayers.some((player) => player.sessionToken === state.token);
    describeWordTurnStatusEl.textContent = selectedGame.status === 'replacement-nomination'
      ? `${nominationTeam.name} must nominate a replacement describer.`
      : `${nominationTeam.name} — choose your describer.`;
    describeWordCountdownEl.textContent = '';
    describeWordCardEl.textContent = nominee
      ? `${nominee.displayName} has been nominated.`
      : 'The describer will privately receive each word. The nominated player must accept before the turn begins.';
    describeWordNominationControlsEl.classList.remove('hidden');

    if (nominee && nominee.sessionToken === state.token) {
      describeWordNominationControlsEl.append(
        createDescribeWordButton('Accept nomination', 'accept'),
        createDescribeWordButton('Decline', 'decline', true)
      );
    } else if (nominee) {
      describeWordFeedbackEl.textContent = `Waiting for ${nominee.displayName} to accept or decline.`;
    } else if (isTeamMember) {
      nominationTeamPlayers
        .filter((player) => player.sessionToken !== state.token)
        .forEach((player) => {
          describeWordNominationControlsEl.appendChild(
            createDescribeWordButton(`Nominate ${player.displayName}`, 'nominate', false, player.sessionToken)
          );
        });
    } else {
      describeWordFeedbackEl.textContent = `Waiting for ${nominationTeam.name} to choose a describer.`;
    }
    return;
  }

  if (selectedGame.status === 'paused-reconnect') {
    const reconnectingSeconds = Math.max(0, Math.ceil((selectedGame.reconnectDeadlineAt - Date.now()) / 1000));
    describeWordTurnStatusEl.textContent = `${describer ? describer.displayName : 'The describer'} disconnected. The turn is paused while they reconnect.`;
    describeWordCountdownEl.textContent = `${reconnectingSeconds}s to reconnect`;
    describeWordCardEl.textContent = 'The team turn will resume with its remaining time when the describer reconnects.';
    return;
  }

  describeWordTurnStatusEl.textContent = `${team.name} turn — ${describer ? describer.displayName : 'describer'} is describing.`;
  describeWordCountdownEl.textContent = '';
  describeWordCardEl.textContent = isDescriber
    ? (selectedGame.word || 'Your word is loading…')
    : 'Only the describer can see the secret word. Give verbal clues and guess together!';
  describeWordActionsEl.classList.toggle('hidden', !isDescriber);
  describeWordActionsEl.querySelectorAll('button').forEach((button) => {
    button.disabled = !isConnected;
  });
  const skippedCount = selectedGame.skippedWordIndexes.length + (selectedGame.revisiting ? 1 : 0);
  const wordLabel = selectedGame.revisiting
    ? `Word ${selectedGame.currentWordIndex + 1} of ${selectedGame.totalWords} — revisiting a skip`
    : `Word ${selectedGame.wordsAttempted + 1} of ${selectedGame.totalWords}`;
  describeWordFeedbackEl.textContent = `${wordLabel} • ${selectedGame.wordsAttempted} attempted • ${skippedCount} skipped`;
  updateDescribeWordCountdown();
}

function createDescribeWordButton(label, action, secondary = false, nomineeSessionToken = null) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = secondary ? 'secondary-button' : 'primary-button';
  button.textContent = label;
  button.disabled = !state.socket || !state.socket.connected;
  button.dataset.describeAction = action;
  if (nomineeSessionToken) {
    button.dataset.nomineeSessionToken = nomineeSessionToken;
  }
  return button;
}

function renderPutAFingerDown(selectedGame) {
  gamePromptLabelEl.textContent = `Question ${selectedGame.round} of ${selectedGame.totalRounds}`;
  gamePromptTextEl.textContent = selectedGame.prompt;
  const currentPlayer = selectedGame.players.find((player) => player.sessionToken === state.token);
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  fingerDownFinalScoresEl.replaceChildren();
  fingerDownRoundResultsEl.replaceChildren();

  if (selectedGame.status === 'results') {
    fingerDownRoundStatusEl.textContent = 'Game complete';
    fingerDownCountEl.textContent = '';
    fingerDownResponseProgressEl.textContent = '';
    fingerDownFeedbackEl.textContent = `Winner${selectedGame.result.winners.length === 1 ? '' : 's'}: ${selectedGame.result.winners.join(', ')}`;
    fingerDownResponseActionsEl.classList.add('hidden');
    fingerDownRoundResultsEl.classList.add('hidden');
    fingerDownContinueButton.classList.add('hidden');
    fingerDownFinalScoresEl.classList.remove('hidden');
    selectedGame.result.scores.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.displayName}: ${entry.fingersRemaining} finger${entry.fingersRemaining === 1 ? '' : 's'} up`;
      fingerDownFinalScoresEl.appendChild(item);
    });
    return;
  }

  fingerDownFinalScoresEl.classList.add('hidden');
  if (selectedGame.status === 'revealing') {
    const roundResult = selectedGame.roundHistory[selectedGame.roundHistory.length - 1];
    fingerDownRoundStatusEl.textContent = `Question ${selectedGame.round} revealed`;
    fingerDownCountEl.textContent = `${roundResult.putDownCount} player${roundResult.putDownCount === 1 ? '' : 's'} put a finger down`;
    fingerDownResponseProgressEl.textContent = '';
    fingerDownFeedbackEl.textContent = 'Everyone’s responses are revealed.';
    fingerDownResponseActionsEl.classList.add('hidden');
    fingerDownRoundResultsEl.classList.remove('hidden');
    roundResult.responses.forEach((entry) => {
      const item = document.createElement('li');
      const responseLabel = entry.response === 'finger-down'
        ? 'Put a finger down'
        : entry.response === 'still-up'
          ? 'Still up'
          : 'Prefer not to answer';
      item.textContent = `${entry.displayName}: ${responseLabel} — ${entry.fingersRemaining} finger${entry.fingersRemaining === 1 ? '' : 's'} remaining`;
      fingerDownRoundResultsEl.appendChild(item);
    });
    fingerDownContinueButton.classList.toggle('hidden', !isHost);
    return;
  }

  fingerDownRoundStatusEl.textContent = `Question ${selectedGame.round} of ${selectedGame.totalRounds}`;
  fingerDownCountEl.textContent = `${currentPlayer ? currentPlayer.fingersRemaining : 0} of 10 fingers remaining`;
  fingerDownResponseProgressEl.textContent = `${selectedGame.responsesSubmitted}/${state.room.players.filter((player) => player.connected).length} answered`;
  fingerDownFeedbackEl.textContent = currentPlayer && currentPlayer.response !== null
    ? 'Your response is in. Waiting for everyone else…'
    : 'Your response stays private until everyone has answered.';
  fingerDownResponseActionsEl.classList.toggle('hidden', !currentPlayer || currentPlayer.response !== null);
  fingerDownResponseButtons.forEach((button) => {
    button.disabled = !state.socket || !state.socket.connected;
  });
  fingerDownRoundResultsEl.classList.add('hidden');
  fingerDownContinueButton.classList.add('hidden');
}

function renderDontLaughChallenge(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);

  gamePromptLabelEl.textContent = `Don't Laugh Challenge`;
  gamePromptTextEl.textContent = selectedGame.prompt || 'Challenger vs Defender face-off!';

  // Teams scoreboard
  const team1 = selectedGame.teams ? selectedGame.teams[0] : null;
  const team2 = selectedGame.teams ? selectedGame.teams[1] : null;
  if (team1 && team2) {
    dontLaughTeam1NameEl.textContent = team1.name;
    dontLaughTeam1ScoreEl.textContent = `${team1.score} pt${team1.score === 1 ? '' : 's'}`;
    dontLaughTeam2NameEl.textContent = team2.name;
    dontLaughTeam2ScoreEl.textContent = `${team2.score} pt${team2.score === 1 ? '' : 's'}`;
  }

  const faceOff = selectedGame.currentFaceOff;
  const challenger = faceOff ? (selectedGame.players.find((p) => p.sessionToken === faceOff.challengerSessionToken) || { displayName: faceOff.challengerName }) : null;
  const defender = faceOff ? (selectedGame.players.find((p) => p.sessionToken === faceOff.defenderSessionToken) || { displayName: faceOff.defenderName }) : null;

  if (faceOff && challenger && defender) {
    const chTeamName = faceOff.challengerTeam === 'team-1' ? (team1 ? team1.name : 'Team 1') : (team2 ? team2.name : 'Team 2');
    const defTeamName = faceOff.defenderTeam === 'team-1' ? (team1 ? team1.name : 'Team 1') : (team2 ? team2.name : 'Team 2');
    dontLaughChallengerNameEl.textContent = `${challenger.displayName} (${chTeamName})`;
    dontLaughDefenderNameEl.textContent = `${defender.displayName} (${defTeamName})`;
  }

  if (selectedGame.myTeamName) {
    gamePromptTextEl.textContent = `You are on ${selectedGame.myTeamName}. Face-off ${faceOff ? faceOff.pairingNumber : 1} of ${faceOff ? faceOff.totalPairings : ''}`;
  }

  const isChallenger = Boolean(faceOff && faceOff.challengerSessionToken === state.token);
  const isDefender = Boolean(faceOff && faceOff.defenderSessionToken === state.token);
  const isInFaceOff = isChallenger || isDefender;

  dontLaughStartBtn.classList.add('hidden');
  dontLaughVoteActionsEl.classList.add('hidden');
  dontLaughRoundResultEl.classList.add('hidden');
  dontLaughScoresEl.classList.add('hidden');

  if (selectedGame.status === 'ready') {
    dontLaughTurnStatusEl.textContent = isInFaceOff
      ? (isChallenger ? 'Your turn to make the defender laugh!' : 'Your turn to defend! Don’t laugh!')
      : `${challenger ? challenger.displayName : 'Challenger'} vs ${defender ? defender.displayName : 'Defender'}`;
    dontLaughCountdownEl.textContent = '30s';
    dontLaughFeedbackEl.textContent = 'Face-off ready. Tap to start the 30-second timer.';
    if (isChallenger || isHost) {
      dontLaughStartBtn.classList.remove('hidden');
      dontLaughStartBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'face-off') {
    dontLaughTurnStatusEl.textContent = isChallenger
      ? 'MAKE THEM LAUGH NOW!'
      : (isDefender ? 'HOLD YOUR LAUGH!' : 'Face-off in progress! Watch closely.');
    dontLaughFeedbackEl.textContent = 'Challenger has 30 seconds to make the defender laugh.';
    updateDontLaughCountdown();
  } else if (selectedGame.status === 'judging' || selectedGame.status === 'revote') {
    dontLaughCountdownEl.textContent = 'Vote!';
    dontLaughTurnStatusEl.textContent = selectedGame.status === 'revote'
      ? 'First vote was tied! REVOTE: Did the defender laugh?'
      : 'Did the defender laugh?';

    if (isInFaceOff) {
      dontLaughFeedbackEl.textContent = 'You are in the face-off. Other players are voting…';
    } else {
      const hasVoted = Boolean(selectedGame.myVote !== null && selectedGame.myVote !== undefined);
      dontLaughVoteActionsEl.classList.toggle('hidden', hasVoted);
      dontLaughLaughedButton.disabled = !connected;
      dontLaughStraightFaceButton.disabled = !connected;
      dontLaughFeedbackEl.textContent = hasVoted
        ? 'Your vote is in. Waiting for other judges…'
        : 'Cast your vote below:';
    }
  } else if (selectedGame.status === 'face-off-result' || selectedGame.status === 'round-result') {
    dontLaughCountdownEl.textContent = '';
    dontLaughTurnStatusEl.textContent = 'Face-off complete!';
    dontLaughRoundResultEl.classList.remove('hidden');
    dontLaughResultMsgEl.textContent = selectedGame.lastResultMsg || 'Result recorded.';
    if (isHost) {
      dontLaughNextBtn.classList.remove('hidden');
      dontLaughNextBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'results') {
    dontLaughTurnStatusEl.textContent = 'Challenge complete!';
    dontLaughCountdownEl.textContent = 'Game Over';
    dontLaughScoresEl.replaceChildren();
    dontLaughScoresEl.classList.remove('hidden');
    if (selectedGame.result && selectedGame.result.winnerTeam) {
      dontLaughFeedbackEl.textContent = `Winning Team: ${selectedGame.result.winnerTeam}!`;
    }
    if (selectedGame.teams) {
      selectedGame.teams.forEach((team) => {
        const item = document.createElement('li');
        item.textContent = `${team.name}: ${team.score} point${team.score === 1 ? '' : 's'}`;
        dontLaughScoresEl.appendChild(item);
      });
    }
  }
}

function updateDontLaughCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'dont-laugh-challenge') return;
  const game = state.room.selectedGame;
  if (game.status !== 'face-off' || !game.deadlineAt) {
    if (game.status !== 'ready') dontLaughCountdownEl.textContent = '';
    return;
  }
  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  dontLaughCountdownEl.textContent = `${secondsLeft}s`;
}

function renderFindTheSpy(selectedGame) {
  gamePromptLabelEl.textContent = 'Find the Spy';
  findSpySpeakingOrderEl.replaceChildren();
  findSpyResultsEl.replaceChildren();

  if (selectedGame.status === 'results') {
    gamePromptLabelEl.textContent = 'The round is over';
    gamePromptTextEl.textContent = `Category: ${selectedGame.result.category}. The word was ${selectedGame.result.word}.`;
    findSpyRoleEl.innerHTML = `<strong style="font-size: 1.15rem; color: var(--gold, #d4af37);">🕵️ ${selectedGame.result.spyName}</strong> was the spy!`;
    findSpyStatusEl.textContent = selectedGame.result.winnerMessage || (selectedGame.result.winner === 'spy' ? 'The spy wins!' : 'The group wins!');
    findSpyVoteActionsEl.classList.add('hidden');
    findSpyDoneButton.classList.add('hidden');
    findSpyGuessFormEl.classList.add('hidden');
    findSpyCountdownEl.textContent = '';
    findSpyResultsEl.classList.remove('hidden');

    if (selectedGame.result.revealedVoteRounds) {
      selectedGame.result.revealedVoteRounds.forEach((round) => {
        const heading = document.createElement('li');
        heading.innerHTML = `<strong>Vote round ${round.round}</strong>`;
        findSpyResultsEl.appendChild(heading);
        round.votes.forEach((vote) => {
          const item = document.createElement('li');
          item.textContent = `${vote.voterName} voted for ${vote.targetName}`;
          findSpyResultsEl.appendChild(item);
        });
        if (round.tiedNames && round.tiedNames.length) {
          const tie = document.createElement('li');
          tie.textContent = `Tie: ${round.tiedNames.join(', ')}`;
          findSpyResultsEl.appendChild(tie);
        }
      });
    }
    if (selectedGame.result.accusedNames && selectedGame.result.accusedNames.length) {
      const accused = document.createElement('li');
      accused.textContent = `Accused: ${selectedGame.result.accusedNames.join(', ')}`;
      findSpyResultsEl.appendChild(accused);
    }
    if (selectedGame.result.scores && selectedGame.result.scores.length) {
      const scoresHeading = document.createElement('li');
      scoresHeading.innerHTML = '<strong>Scores</strong>';
      findSpyResultsEl.appendChild(scoresHeading);
      selectedGame.result.scores.forEach((entry) => {
        const item = document.createElement('li');
        item.textContent = `${entry.displayName}: ${entry.score} point${entry.score === 1 ? '' : 's'}`;
        findSpyResultsEl.appendChild(item);
      });
    }
    return;
  }

  const privateRole = selectedGame.privateRole;
  if (privateRole && privateRole.isSpy) {
    gamePromptTextEl.textContent = `Category: ${privateRole.category}. You are the spy. Blend in and try to deduce the word!`;
    findSpyRoleEl.innerHTML = '<div style="background: rgba(184, 51, 42, 0.15); border: 2px solid #b8332a; border-radius: 8px; padding: 10px; margin-bottom: 8px;"><strong style="color: #b8332a; font-size: 1.15rem; display: block;">🕵️ YOU ARE THE SPY</strong><span style="font-size: 0.9rem;">Your identity is secret! Blend in and guess the word.</span></div>';
  } else if (privateRole) {
    gamePromptTextEl.textContent = `Category: ${privateRole.category}. Your secret word is ${privateRole.word}.`;
    findSpyRoleEl.innerHTML = `<div style="background: rgba(46, 125, 50, 0.12); border: 2px solid #2e7d32; border-radius: 8px; padding: 10px; margin-bottom: 8px;"><strong style="color: #2e7d32; font-size: 1.15rem; display: block;">🔍 INNOCENT AGENT</strong><span style="font-size: 0.9rem;">Secret word: <strong>${privateRole.word}</strong>. Give a verbal clue!</span></div>`;
  } else {
    gamePromptTextEl.textContent = 'Your private role is loading…';
    findSpyRoleEl.textContent = '';
  }

  findSpyCountdownEl.textContent = '';
  findSpySpeakingOrderEl.classList.add('hidden');
  findSpyResultsEl.classList.add('hidden');
  findSpyDoneButton.classList.add('hidden');
  findSpyGuessFormEl.classList.add('hidden');

  if (selectedGame.status === 'clue-round') {
    const currentRound = selectedGame.clueRounds[selectedGame.clueRounds.length - 1];
    const activeSessionToken = currentRound.speakingOrder[selectedGame.currentSpeakerIndex];
    const isCurrentSpeaker = activeSessionToken === state.token;
    const completed = new Set(currentRound.completedSessionTokens);
    findSpySpeakingOrderEl.classList.remove('hidden');
    findSpyVoteActionsEl.classList.add('hidden');
    gamePromptLabelEl.textContent = `Clue round ${selectedGame.clueRound} of 2`;
    findSpyStatusEl.innerHTML = isCurrentSpeaker
      ? '<strong style="color: var(--gold, #d4af37);">🎙️ YOUR TURN! Give your clue aloud, then tap DONE.</strong>'
      : `${selectedGame.players.find((player) => player.sessionToken === activeSessionToken)?.displayName || 'A player'} is giving a clue.`;
    currentRound.speakingOrder.forEach((sessionToken, index) => {
      const player = selectedGame.players.find((entry) => entry.sessionToken === sessionToken);
      const isThisSpeaker = sessionToken === activeSessionToken;
      const isDone = completed.has(sessionToken);
      const item = document.createElement('li');
      if (isThisSpeaker) {
        item.innerHTML = `<strong style="color: var(--gold, #d4af37);">▶ ${index + 1}. ${player ? player.displayName : 'Player'} (Speaking now 🎙️)</strong>`;
      } else {
        item.textContent = `${index + 1}. ${player ? player.displayName : 'Player'}${isDone ? ' — ✓ done' : ''}`;
      }
      findSpySpeakingOrderEl.appendChild(item);
    });
    findSpyDoneButton.classList.toggle('hidden', !isCurrentSpeaker);
    findSpyDoneButton.disabled = !state.socket || !state.socket.connected;
    return;
  }

  if (selectedGame.status === 'voting' || selectedGame.status === 'revote') {
    if (selectedGame.status === 'revote') {
      findSpyStatusEl.textContent = `The first vote was tied. Revote only for: ${selectedGame.revealedVoteRounds[0].tiedNames.join(', ')}.`;
      renderFindSpyVoteRounds(selectedGame.revealedVoteRounds, findSpyResultsEl);
      findSpyResultsEl.classList.remove('hidden');
    }
    const myPlayer = selectedGame.players.find((player) => player.sessionToken === state.token);
    const hasVoted = Boolean(myPlayer && myPlayer.hasVoted);
    const connected = Boolean(state.socket && state.socket.connected);
    const votesSubmitted = selectedGame.players.filter((player) => player.hasVoted).length;
    if (selectedGame.status === 'voting') {
      findSpyStatusEl.textContent = hasVoted
        ? `Your vote is locked in. Waiting for the others (${votesSubmitted}/${selectedGame.players.length}).`
        : `Privately choose the spy (${votesSubmitted}/${selectedGame.players.length} votes submitted).`;
    }
    findSpyVoteActionsEl.classList.toggle('hidden', hasVoted);
    findSpyVoteActionsEl.replaceChildren();
    selectedGame.players
      .filter((player) => (
        player.sessionToken !== state.token
        && (!selectedGame.eligibleVoteTargets || selectedGame.eligibleVoteTargets.includes(player.sessionToken))
      ))
      .forEach((player) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-button vote-option';
        button.textContent = player.displayName;
        button.disabled = !connected;
        button.addEventListener('click', () => {
          if (!state.socket || !state.token) return;
          findSpyVoteActionsEl.querySelectorAll('button').forEach((voteButton) => {
            voteButton.disabled = true;
          });
          findSpyStatusEl.textContent = 'Submitting your vote…';
          state.socket.emit('game:find-the-spy-vote', {
            sessionToken: state.token,
            targetSessionToken: player.sessionToken
          });
        });
        findSpyVoteActionsEl.appendChild(button);
      });
    return;
  }

  if (selectedGame.status === 'suspense') {
    findSpyStatusEl.textContent = 'Votes are locked. Get ready for the reveal…';
    findSpyVoteActionsEl.classList.add('hidden');
    updateFindSpyCountdown();
    return;
  }

  if (selectedGame.status === 'spy-guess') {
    findSpyVoteActionsEl.classList.add('hidden');
    const spy = selectedGame.players.find((player) => player.sessionToken === selectedGame.accusedSessionTokens[0]);
    findSpyRoleEl.textContent = `${spy ? spy.displayName : 'The accused player'} was the spy.`;
    gamePromptTextEl.textContent = `The category is ${selectedGame.category}. The spy has one final chance to guess the word.`;
    findSpyStatusEl.textContent = state.token === selectedGame.accusedSessionTokens[0]
      ? 'Enter your final guess. A correct guess wins the game.'
      : 'The spy is making one final guess.';
    findSpyGuessFormEl.classList.toggle('hidden', state.token !== selectedGame.accusedSessionTokens[0]);
    findSpyResultsEl.classList.remove('hidden');
    renderFindSpyVoteRounds(selectedGame.revealedVoteRounds, findSpyResultsEl);
    return;
  }

}

function renderFindSpyVoteRounds(rounds, list) {
  rounds.forEach((round) => {
    const heading = document.createElement('li');
    heading.textContent = `Vote round ${round.round}`;
    list.appendChild(heading);
    round.votes.forEach((vote) => {
      const item = document.createElement('li');
      item.textContent = `${vote.voterName} voted for ${vote.targetName}`;
      list.appendChild(item);
    });
    if (round.tiedNames.length) {
      const tie = document.createElement('li');
      tie.textContent = `Tie: ${round.tiedNames.join(', ')}`;
      list.appendChild(tie);
    }
  });
}

function renderGuessWho(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);

  gamePromptLabelEl.textContent = 'Guess Who?';
  gamePromptTextEl.textContent = 'Submit an interesting fact about yourself, then guess who wrote each anonymous fact!';

  guessWhoSubmissionBoxEl.classList.add('hidden');
  guessWhoGuessingBoxEl.classList.add('hidden');
  guessWhoRevealBoxEl.classList.add('hidden');
  guessWhoScoresEl.classList.add('hidden');
  guessWhoNextFactBtn.classList.add('hidden');

  if (selectedGame.status === 'submitting') {
    guessWhoSubmissionBoxEl.classList.remove('hidden');
    guessWhoPhaseStatusEl.textContent = 'Fact Submission Phase';
    guessWhoProgressEl.textContent = `${selectedGame.submittedCount || 0}/${selectedGame.players.length} submitted`;

    const myFact = selectedGame.mySubmittedFact;
    if (myFact) {
      guessWhoSubmittedNoticeEl.textContent = '✓ Your fact is submitted! You can edit and re-submit anytime before submissions close.';
      guessWhoSubmitFactBtn.textContent = 'Update Fact';
      guessWhoSubmitFactBtn.disabled = !connected;
      if (!guessWhoFactInputEl.value) {
        guessWhoFactInputEl.value = myFact;
      }
    } else {
      guessWhoSubmittedNoticeEl.textContent = 'Facts are anonymous. Players can edit until submissions close.';
      guessWhoSubmitFactBtn.textContent = 'Submit Fact';
      guessWhoSubmitFactBtn.disabled = !connected;
    }

    guessWhoCloseSubmissionsBtn.classList.toggle('hidden', !isHost);
    guessWhoCloseSubmissionsBtn.disabled = !connected || (selectedGame.submittedCount || 0) === 0;
  } else if (selectedGame.status === 'guessing') {
    guessWhoGuessingBoxEl.classList.remove('hidden');
    const fNum = (selectedGame.currentFactIndex || 0) + 1;
    const totalF = selectedGame.totalFacts || 0;
    guessWhoPhaseStatusEl.textContent = `Guessing Fact ${fNum} of ${totalF}`;
    guessWhoProgressEl.textContent = `${selectedGame.guessesSubmitted || 0}/${selectedGame.totalEligibleGuessers || 0} guessed`;

    const factData = selectedGame.currentFact;
    guessWhoFactDisplayEl.textContent = factData ? factData.fact : 'Loading fact…';

    const isAuthor = Boolean(factData && factData.isMyFact);
    const myPlayer = selectedGame.players.find((p) => p.sessionToken === state.token);
    const hasGuessed = Boolean(myPlayer && myPlayer.hasGuessed);

    guessWhoAuthorOptionsEl.replaceChildren();

    if (isAuthor) {
      const notice = document.createElement('p');
      notice.className = 'five-second-feedback';
      notice.textContent = '★ This is your fact! You cannot guess.';
      guessWhoAuthorOptionsEl.appendChild(notice);
    } else if (hasGuessed) {
      const notice = document.createElement('p');
      notice.className = 'five-second-feedback';
      notice.textContent = 'Your guess is locked in. Waiting for everyone else…';
      guessWhoAuthorOptionsEl.appendChild(notice);
    } else {
      const candidateTokens = selectedGame.candidateAuthorTokens || [];
      candidateTokens.forEach((token) => {
        const candidate = selectedGame.players.find((p) => p.sessionToken === token);
        if (!candidate || candidate.sessionToken === state.token) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-button vote-option';
        button.textContent = candidate.displayName;
        button.disabled = !connected;
        button.addEventListener('click', () => {
          if (!state.socket || !state.token) return;
          button.disabled = true;
          state.socket.emit('game:guess-who-guess', {
            sessionToken: state.token,
            guess: candidate.sessionToken
          });
        });
        guessWhoAuthorOptionsEl.appendChild(button);
      });
    }
  } else if (selectedGame.status === 'fact-reveal') {
    guessWhoRevealBoxEl.classList.remove('hidden');
    const fNum = (selectedGame.currentFactIndex || 0) + 1;
    const totalF = selectedGame.totalFacts || 0;
    guessWhoPhaseStatusEl.textContent = `Fact ${fNum} of ${totalF} Revealed!`;
    guessWhoProgressEl.textContent = '';

    const authorName = selectedGame.revealedAuthor ? selectedGame.revealedAuthor.displayName : 'Unknown';
    guessWhoRevealedAuthorEl.textContent = authorName;

    const correct = selectedGame.correctGuessers || [];
    guessWhoCorrectGuessersEl.textContent = correct.length > 0
      ? `Correct guessers (+1 pt): ${correct.join(', ')}`
      : 'No one guessed correctly!';

    if (isHost) {
      guessWhoNextFactBtn.classList.remove('hidden');
      guessWhoNextFactBtn.disabled = !connected;
    }

    renderGuessWhoScores(selectedGame);
  } else if (selectedGame.status === 'results') {
    guessWhoPhaseStatusEl.textContent = 'Round Complete!';
    guessWhoProgressEl.textContent = '';
    renderGuessWhoScores(selectedGame);
  }
}

function renderGuessWhoScores(selectedGame) {
  guessWhoScoresEl.replaceChildren();
  guessWhoScoresEl.classList.remove('hidden');
  const scores = (selectedGame.result && selectedGame.result.scores) || (selectedGame.players.map((p) => ({ displayName: p.displayName, score: p.score || 0 })));
  scores.sort((a, b) => b.score - a.score);
  scores.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `${entry.displayName}: ${entry.score} point${entry.score === 1 ? '' : 's'}`;
    guessWhoScoresEl.appendChild(item);
  });
}

function renderWhoAmI(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  const currentPlayer = selectedGame.players[selectedGame.currentPlayerIndex];
  const isMyTurn = Boolean(currentPlayer && currentPlayer.sessionToken === state.token);

  gamePromptLabelEl.textContent = `Who Am I? (Turn ${selectedGame.currentPlayerIndex + 1} of ${selectedGame.players.length})`;
  gamePromptTextEl.textContent = 'Ask unlimited yes/no questions to the group, then make up to 2 guesses!';

  whoAmIStartBtn.classList.add('hidden');
  whoAmIMakeGuessBtn.classList.add('hidden');
  whoAmIGuessFormEl.classList.add('hidden');
  whoAmIRevealCardEl.classList.add('hidden');
  whoAmIScoresEl.classList.add('hidden');

  if (selectedGame.status === 'ready') {
    whoAmITurnStatusEl.textContent = isMyTurn
      ? 'Your turn! Your mystery identity is hidden from you.'
      : `${currentPlayer ? currentPlayer.displayName : 'Player'} is getting ready.`;
    whoAmICountdownEl.textContent = '60s';
    whoAmIIdentityCardEl.textContent = isMyTurn
      ? '🔒 Secret! Show your screen or let friends look.'
      : `Identity: ${selectedGame.secretIdentity || 'Loading…'}`;
    whoAmIAttemptsEl.textContent = '2 guesses remaining.';
    whoAmIInstructionsEl.textContent = isMyTurn
      ? 'Ask yes-or-no questions to your friends. Tap Start Turn when ready!'
      : 'Answer their questions with YES or NO only! Do not give clues.';

    if (isMyTurn || isHost) {
      whoAmIStartBtn.classList.remove('hidden');
      whoAmIStartBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'playing') {
    whoAmITurnStatusEl.textContent = isMyTurn
      ? 'ASK YOUR QUESTIONS! (Yes/No only)'
      : `${currentPlayer ? currentPlayer.displayName : 'Player'} is asking questions!`;
    whoAmIIdentityCardEl.textContent = isMyTurn
      ? '🔒 Your identity is secret!'
      : `Identity: ${selectedGame.secretIdentity || 'Loading…'}`;
    const guessesLeft = currentPlayer ? currentPlayer.guessesRemaining : 2;
    whoAmIAttemptsEl.textContent = `${guessesLeft} guess${guessesLeft === 1 ? '' : 'es'} remaining.`;
    whoAmIInstructionsEl.textContent = 'Timer is ticking down!';

    if (isMyTurn && guessesLeft > 0) {
      whoAmIMakeGuessBtn.classList.remove('hidden');
      whoAmIMakeGuessBtn.disabled = !connected;
    }

    if (selectedGame.lastGuessFailed && isMyTurn) {
      whoAmIFeedbackEl.textContent = 'Not quite! One attempt remaining.';
    } else {
      whoAmIFeedbackEl.textContent = '';
    }
    updateWhoAmICountdown();
  } else if (selectedGame.status === 'turn-reveal') {
    whoAmITurnStatusEl.textContent = `${currentPlayer ? currentPlayer.displayName : 'Player'}’s turn finished.`;
    const turnResult = selectedGame.currentTurnResult || {};
    const guessedCorrectly = Boolean(turnResult.guessedCorrectly);
    whoAmICountdownEl.textContent = guessedCorrectly ? 'Solved!' : 'Time up!';
    whoAmIIdentityCardEl.textContent = `Identity: ${selectedGame.secretIdentity || turnResult.identity || ''}`;
    whoAmIRevealCardEl.classList.remove('hidden');
    whoAmIRevealMsgEl.textContent = guessedCorrectly
      ? (turnResult.completedInMs != null ? `Guessed correctly in ${(turnResult.completedInMs / 1000).toFixed(1)} seconds! 🎉` : 'Guessed correctly! 🎉')
      : (turnResult.reason || 'Did not guess correctly.');

    if (isHost) {
      whoAmINextBtn.classList.remove('hidden');
      whoAmINextBtn.disabled = !connected;
    }
  } else if (selectedGame.status === 'results') {
    whoAmITurnStatusEl.textContent = 'Round complete!';
    whoAmICountdownEl.textContent = 'Done!';
    whoAmIIdentityCardEl.textContent = '';
    whoAmIAttemptsEl.textContent = '';
    whoAmIInstructionsEl.textContent = '';
    whoAmIFeedbackEl.textContent = selectedGame.result && selectedGame.result.winners && selectedGame.result.winners.length > 0
      ? `Fastest correct guess: ${selectedGame.result.winners.join(' & ')}!`
      : 'No one qualified with a correct guess.';

    whoAmIScoresEl.replaceChildren();
    whoAmIScoresEl.classList.remove('hidden');
    if (selectedGame.result && selectedGame.result.rankings) {
      selectedGame.result.rankings.forEach((entry, index) => {
        const item = document.createElement('li');
        item.textContent = `${index + 1}. ${entry.displayName}: ${(entry.completedInMs / 1000).toFixed(1)}s`;
        whoAmIScoresEl.appendChild(item);
      });
    }
  }
}

function updateWhoAmICountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'who-am-i') return;
  const game = state.room.selectedGame;
  if (game.status !== 'playing' || !game.deadlineAt) {
    if (game.status !== 'ready') whoAmICountdownEl.textContent = '';
    return;
  }
  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  whoAmICountdownEl.textContent = `${secondsLeft}s`;
}

function renderNameThatTune(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  nameThatTuneScoresEl.replaceChildren();
  nameThatTuneFeedbackEl.textContent = '';
  gamePromptTextEl.textContent = 'The host plays songs manually from Spotify through the room speaker. The website does not play audio.';
  nameThatTuneCountdownEl.textContent = '';
  nameThatTuneSetupFormEl.classList.add('hidden');
  nameThatTuneStartButton.classList.add('hidden');
  nameThatTuneBuzzButton.classList.add('hidden');
  nameThatTuneAttemptFormEl.classList.add('hidden');
  nameThatTuneJudgeActionsEl.classList.add('hidden');
  nameThatTuneRevealButton.classList.add('hidden');
  nameThatTuneNextButton.classList.add('hidden');
  nameThatTuneScoresEl.classList.add('hidden');

  if (selectedGame.status === 'results') {
    gamePromptLabelEl.textContent = 'Round complete';
    gamePromptTextEl.textContent = 'All ten songs have been played. Here are the answers and final scores.';
    nameThatTuneTurnStatusEl.textContent = 'Final scores';
    nameThatTuneInstructionsEl.textContent = '';
    nameThatTuneScoresEl.classList.remove('hidden');
    selectedGame.result.songs.forEach((song) => {
      const item = document.createElement('li');
      const points = song.points.length
        ? song.points.map((entry) => `${entry.displayName} ${entry.titlePoints + entry.artistPoints} pt`).join(', ')
        : 'no points';
      item.textContent = `${song.songNumber}. ${song.title} — ${song.artist} (${points})`;
      nameThatTuneScoresEl.appendChild(item);
    });
    selectedGame.result.scores.forEach((entry) => {
      const score = document.createElement('li');
      score.textContent = `${entry.displayName}: ${entry.score} point${entry.score === 1 ? '' : 's'}`;
      nameThatTuneScoresEl.appendChild(score);
    });
    const highestScore = selectedGame.result.scores.length > 0
      ? selectedGame.result.scores[0].score
      : 0;
    const winners = selectedGame.result.scores.filter((entry) => entry.score === highestScore);
    gamePromptTextEl.textContent = winners.length
      ? `All ten songs are complete. ${winners.map((entry) => entry.displayName).join(' and ')} ${winners.length === 1 ? 'wins' : 'share the win'} with ${highestScore} point${highestScore === 1 ? '' : 's'}.`
      : 'All ten songs are complete. No points were awarded.';
    return;
  }

  gamePromptLabelEl.textContent = `Song ${selectedGame.currentSongIndex + 1} of ${selectedGame.songsPerGame || 10}`;
  if (selectedGame.status === 'setup') {
    nameThatTuneTurnStatusEl.textContent = isHost
      ? 'Enter ten songs and artists, then start the game. You will host and judge; players compete.'
      : 'The host is preparing ten songs. The host does not compete in this game.';
    nameThatTuneInstructionsEl.textContent = isHost
      ? 'Answers stay private from players during gameplay. You can edit the list until you start.'
      : 'Listen to songs played manually by the host and buzz in to answer.';
    if (isHost) {
      ensureNameThatTuneSongFields(selectedGame.songs);
      nameThatTuneSetupFormEl.classList.remove('hidden');
      nameThatTuneSetupFormEl.querySelector('button[type="submit"]').disabled = !connected;
      nameThatTuneStartButton.classList.remove('hidden');
      nameThatTuneStartButton.disabled = !connected;
    }
    return;
  }

  if (selectedGame.status === 'song-ready') {
    const alreadyTried = selectedGame.attemptedSessionTokens.includes(state.token);
    const playerIsEligible = selectedGame.players.some((player) => player.sessionToken === state.token);
    const song = isHost && selectedGame.songs ? selectedGame.songs[selectedGame.currentSongIndex] : null;
    nameThatTuneTurnStatusEl.textContent = isHost
      ? `Play song ${selectedGame.currentSongIndex + 1} manually. ${selectedGame.attemptCount}/${3} attempts used.`
      : alreadyTried
        ? 'You have already attempted this song. Listen for the next one.'
        : 'Know the song? Buzz in for the first attempt!';
    nameThatTuneInstructionsEl.textContent = isHost && song
      ? `Host answer: ${song.title} — ${song.artist}. ${nameThatTuneAwardStatus(selectedGame)} Each correct part earns 0.5 points; different players can earn each part. Judge each part separately after the attempt.`
      : 'The first buzzer gets 20 seconds to submit a title and artist. Each correct part is worth 0.5 points, and another player can earn the missing half. The host controls Spotify manually.';
    nameThatTuneBuzzButton.classList.toggle('hidden', !playerIsEligible || alreadyTried);
    nameThatTuneBuzzButton.disabled = !connected;
    nameThatTuneRevealButton.classList.toggle('hidden', !isHost || selectedGame.attemptCount !== 0);
    nameThatTuneRevealButton.disabled = !connected;
  } else if (selectedGame.status === 'attempting') {
    const activeAttempt = selectedGame.activeAttempt;
    const attemptPlayer = selectedGame.players.find((player) => player.sessionToken === activeAttempt.sessionToken);
    const attemptKey = `${selectedGame.currentSongIndex}:${selectedGame.attemptCount}`;
    if (state.nameThatTuneAttemptKey !== attemptKey) {
      state.nameThatTuneAttemptKey = attemptKey;
      nameThatTuneAttemptFormEl.reset();
    }
    nameThatTuneTurnStatusEl.textContent = `${attemptPlayer ? attemptPlayer.displayName : 'A player'} has the first attempt (${selectedGame.attemptCount}/3).`;
    nameThatTuneInstructionsEl.textContent = activeAttempt.sessionToken === state.token
      ? 'Submit the title and artist within 20 seconds. You can leave either field blank.'
      : 'Other buzzers are disabled while this player attempts.';
    nameThatTuneAttemptFormEl.classList.toggle('hidden', activeAttempt.sessionToken !== state.token);
    nameThatTuneTitleInputEl.disabled = !connected;
    nameThatTuneArtistInputEl.disabled = !connected;
    nameThatTuneAttemptFormEl.querySelector('button[type="submit"]').disabled = !connected;
    updateNameThatTuneCountdown();
  } else if (selectedGame.status === 'judging') {
    const activeAttempt = selectedGame.activeAttempt;
    const attemptPlayer = selectedGame.players.find((player) => player.sessionToken === activeAttempt.sessionToken);
    const song = isHost && selectedGame.songs ? selectedGame.songs[selectedGame.currentSongIndex] : null;
    nameThatTuneTurnStatusEl.textContent = isHost
      ? `Judge ${attemptPlayer ? attemptPlayer.displayName : 'the player'}'s attempt.`
      : 'The host is judging the attempt.';
    nameThatTuneInstructionsEl.textContent = isHost
      ? `They guessed: “${activeAttempt.titleGuess || '(no title)'}” by “${activeAttempt.artistGuess || '(no artist)'}.” Answer: ${song.title} — ${song.artist}. ${nameThatTuneAwardStatus(selectedGame)}`
      : 'The guess is private while the host judges the title and artist.';
    nameThatTuneJudgeActionsEl.classList.toggle('hidden', !isHost);
    const judgmentKey = `${selectedGame.currentSongIndex}:${activeAttempt.sessionToken}:${activeAttempt.titleGuess}:${activeAttempt.artistGuess}`;
    if (state.nameThatTuneJudgementKey !== judgmentKey) {
      state.nameThatTuneJudgementKey = judgmentKey;
      nameThatTuneJudgeActionsEl.querySelectorAll('input[type="radio"]').forEach((input) => {
        input.checked = false;
      });
    }
    nameThatTuneJudgeButton.disabled = !connected;
  } else if (selectedGame.status === 'song-reveal') {
    const song = selectedGame.songHistory[selectedGame.songHistory.length - 1];
    nameThatTuneTurnStatusEl.textContent = 'Song answer revealed';
    nameThatTuneInstructionsEl.textContent = `${song.title} — ${song.artist}`;
    nameThatTuneNextButton.classList.toggle('hidden', !isHost);
    nameThatTuneNextButton.textContent = song.songNumber === 10 ? 'FINISH GAME' : 'NEXT SONG';
    nameThatTuneNextButton.disabled = !connected;
    nameThatTuneScoresEl.classList.remove('hidden');
    const points = document.createElement('li');
    points.textContent = song.points.length
      ? `Points: ${song.points.map((entry) => `${entry.displayName} +${entry.titlePoints + entry.artistPoints}`).join(', ')}`
      : 'No points awarded.';
    nameThatTuneScoresEl.appendChild(points);
    selectedGame.players.forEach((player) => {
      const item = document.createElement('li');
      item.textContent = `${player.displayName}: ${player.score} point${player.score === 1 ? '' : 's'}`;
      nameThatTuneScoresEl.appendChild(item);
    });
  }
}

function nameThatTuneAwardStatus(game) {
  const titleWinner = game.players.find((player) => player.sessionToken === game.awarded.titleSessionToken);
  const artistWinner = game.players.find((player) => player.sessionToken === game.awarded.artistSessionToken);
  const awarded = [];
  if (titleWinner) awarded.push(`Title point already earned by ${titleWinner.displayName}.`);
  if (artistWinner) awarded.push(`Artist point already earned by ${artistWinner.displayName}.`);
  return awarded.join(' ');
}

function ensureNameThatTuneSongFields(songs) {
  if (nameThatTuneSongFieldsEl.childElementCount === 10) {
    return;
  }

  nameThatTuneSongFieldsEl.replaceChildren();
  for (let index = 0; index < 10; index += 1) {
    const field = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Song ${index + 1}`;
    field.appendChild(legend);
    for (const [key, labelText] of [['title', 'Title'], ['artist', 'Artist']]) {
      const label = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 80;
      input.required = true;
      input.autocomplete = 'off';
      input.dataset.songIndex = String(index);
      input.dataset.songField = key;
      input.value = songs[index] ? songs[index][key] : '';
      label.append(text, input);
      field.appendChild(label);
    }
    nameThatTuneSongFieldsEl.appendChild(field);
  }
}

function renderDoNotSpill(selectedGame) {
  const isHost = state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
  const connected = Boolean(state.socket && state.socket.connected);
  const activeSpill = selectedGame.activeSpill;
  const isSpiller = Boolean(activeSpill && activeSpill.sessionToken === state.token);
  const statusKey = `${selectedGame.status}:${selectedGame.spills}:${activeSpill ? activeSpill.sessionToken : ''}:${activeSpill ? activeSpill.consequence || '' : ''}`;
  if (state.doNotSpillStatusKey !== statusKey) {
    state.doNotSpillStatusKey = statusKey;
    doNotSpillFeedbackEl.textContent = '';
  }

  gamePromptLabelEl.textContent = 'Do Not Spill';
  gamePromptTextEl.textContent = 'Use real water and cups. The website tracks spills and consequences only.';
  doNotSpillSpillCountEl.textContent = `Spills: ${selectedGame.spills}/${selectedGame.maxSpills}`;
  doNotSpillWarningEl.classList.toggle('hidden', selectedGame.status === 'results');
  doNotSpillWheelEl.classList.add('hidden');
  doNotSpillWheelEl.classList.remove('spinning');
  doNotSpillRecapEl.replaceChildren();

  const isReady = selectedGame.status === 'ready';
  const isPlaying = selectedGame.status === 'playing';
  const isSpinning = selectedGame.status === 'spinning';
  const isDecision = selectedGame.status === 'decision';
  const isResults = selectedGame.status === 'results';

  doNotSpillStartButton.classList.toggle('hidden', !isReady || !isHost);
  doNotSpillStartButton.disabled = !connected;
  const canRecordSpill = ['playing', 'spinning', 'decision'].includes(selectedGame.status)
    && selectedGame.spills < selectedGame.maxSpills;
  doNotSpillSpillButton.classList.toggle('hidden', !canRecordSpill);
  doNotSpillSpillButton.disabled = !connected;
  doNotSpillSpinButton.classList.toggle('hidden', !isSpinning || !isSpiller);
  doNotSpillSpinButton.disabled = !connected;
  doNotSpillDecisionActionsEl.classList.toggle('hidden', !isDecision || !isSpiller);
  doNotSpillAcceptButton.disabled = !connected;
  doNotSpillPassButton.disabled = !connected;
  doNotSpillEndButton.classList.toggle('hidden', !isHost || !isPlaying);
  doNotSpillEndButton.disabled = !connected;

  if (isReady) {
    doNotSpillStatusEl.textContent = isHost
      ? 'Keep your phones away from the water. Start when everyone is ready.'
      : 'Keep your phones away from the water. Waiting for the host to start.';
    doNotSpillFeedbackEl.textContent = 'Placeholder outcomes are being used until the consequence list is supplied.';
    doNotSpillRecapEl.classList.add('hidden');
    return;
  }

  if (isPlaying) {
    doNotSpillStatusEl.textContent = 'Tap “I SPILLED!” as soon as you spill. Wait while the current consequence is resolved.';
    doNotSpillFeedbackEl.textContent = 'The host can end the game early.';
    doNotSpillRecapEl.classList.add('hidden');
    return;
  }

  if (isSpinning) {
    doNotSpillStatusEl.textContent = isSpiller
      ? 'You spilled! You are the only player who can control the spin.'
      : `${activeSpill.displayName} spilled and is about to spin.`;
    doNotSpillFeedbackEl.textContent = isSpiller
      ? `${selectedGame.pendingSpills.length} other spill${selectedGame.pendingSpills.length === 1 ? '' : 's'} waiting. Tap SPIN to choose your consequence.`
      : `${selectedGame.pendingSpills.length} additional spill${selectedGame.pendingSpills.length === 1 ? '' : 's'} waiting. Everyone sees each result.`;
    doNotSpillRecapEl.classList.add('hidden');
    return;
  }

  if (isDecision) {
    doNotSpillStatusEl.textContent = isSpiller
      ? 'Your consequence is ready. Choose Accept or Pass.'
      : `${activeSpill.displayName} received a consequence and is choosing whether to accept or pass.`;
    doNotSpillWheelEl.textContent = activeSpill.consequence;
    doNotSpillWheelEl.classList.remove('hidden');
    doNotSpillWheelEl.classList.add('spinning');
    doNotSpillFeedbackEl.textContent = isSpiller
      ? `You can pass; no second spin is required. ${selectedGame.pendingSpills.length} spill${selectedGame.pendingSpills.length === 1 ? '' : 's'} waiting.`
      : `The spiller is the only person who can accept or pass. ${selectedGame.pendingSpills.length} spill${selectedGame.pendingSpills.length === 1 ? '' : 's'} waiting.`;
    doNotSpillRecapEl.classList.add('hidden');
    return;
  }

  gamePromptLabelEl.textContent = 'Game recap';
  gamePromptTextEl.textContent = 'Do Not Spill is over.';
  doNotSpillStatusEl.textContent = `Final spills: ${selectedGame.result.spills}/${selectedGame.maxSpills}`;
  doNotSpillFeedbackEl.textContent = selectedGame.result.spills >= selectedGame.maxSpills
    ? 'The game ended after five spills.'
    : 'The host ended the game early.';
  doNotSpillStartButton.classList.add('hidden');
  doNotSpillSpillButton.classList.add('hidden');
  doNotSpillSpinButton.classList.add('hidden');
  doNotSpillDecisionActionsEl.classList.add('hidden');
  doNotSpillEndButton.classList.add('hidden');
  doNotSpillRecapEl.classList.remove('hidden');
  selectedGame.result.history.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `Spill ${entry.spill}: ${entry.displayName} — ${entry.consequence} (${entry.decision})`;
    doNotSpillRecapEl.appendChild(item);
  });
}

function updateHeadsUpCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'heads-up') {
    return;
  }

  const game = state.room.selectedGame;
  if (game.status !== 'playing' || !game.deadlineAt) {
    headsUpCountdownEl.textContent = '';
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  headsUpCountdownEl.textContent = `${secondsLeft}s`;
}

function updateWhoAmICountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'who-am-i') {
    return;
  }
  const game = state.room.selectedGame;
  if (game.status !== 'playing' || !game.deadlineAt) {
    whoAmICountdownEl.textContent = '';
    return;
  }
  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  whoAmICountdownEl.textContent = `${secondsLeft}s`;
}

function updateFindSpyCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'find-the-spy') {
    return;
  }

  const game = state.room.selectedGame;
  if (game.status !== 'suspense' || !game.revealDeadlineAt) {
    findSpyCountdownEl.textContent = '';
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((game.revealDeadlineAt - Date.now()) / 1000));
  findSpyCountdownEl.textContent = `Vote reveal in ${secondsLeft}…`;
}

function updateNameThatTuneCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'name-that-tune') {
    return;
  }

  const game = state.room.selectedGame;
  if (game.status !== 'attempting' || !game.activeAttempt || !game.activeAttempt.deadlineAt) {
    nameThatTuneCountdownEl.textContent = '';
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((game.activeAttempt.deadlineAt - Date.now()) / 1000));
  nameThatTuneCountdownEl.textContent = `${secondsLeft}s`;
}

function updateDescribeWordCountdown() {
  if (!state.room || !state.room.selectedGame || state.room.selectedGame.id !== 'describe-the-word') {
    return;
  }

  const game = state.room.selectedGame;
  if (game.status === 'paused-reconnect' && game.reconnectDeadlineAt) {
    const secondsLeft = Math.max(0, Math.ceil((game.reconnectDeadlineAt - Date.now()) / 1000));
    describeWordCountdownEl.textContent = `Reconnect ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
    return;
  }
  if (game.status !== 'playing' || !game.deadlineAt) {
    describeWordCountdownEl.textContent = '';
    return;
  }

  const secondsLeft = Math.max(0, Math.ceil((game.deadlineAt - Date.now()) / 1000));
  describeWordCountdownEl.textContent = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
}

function renderRoom() {
  if (!state.room) {
    setConnectionStatus('');
    showScreen('landing');
    return;
  }

  updateConnectionStatus();

  roomNameEl.textContent = state.room.name;
  roomCodeEl.textContent = state.room.code;
  playerCountEl.textContent = `${state.room.players.length}/12`;
  renderPlayerList();
  hostControlsEl.classList.toggle('hidden', !state.room.players.some((player) => player.sessionToken === state.token && player.isHost));

  if (!state.room.started) {
    showScreen('lobby');
    return;
  }

  renderRoundHistory();

  if (state.room.selectedGame) {
    renderSelectedGame();
    showScreen('game');
    return;
  }

  renderGameSelection();
  showScreen('selection');
}

function connectSocket() {
  if (!state.token) return;

  if (state.socket) {
    state.socket.disconnect();
  }

  state.socket = io({ auth: { sessionToken: state.token } });

  state.socket.on('room-state', (event) => {
    if (!event.room) {
      state.room = null;
      clearRoomNotice();
      setConnectionStatus('');
      showScreen('landing');
      return;
    }

    const previousHostToken = getHostSessionToken(state.room);
    state.room = event.room;
    const nextHostToken = getHostSessionToken(state.room);
    if (previousHostToken && nextHostToken && previousHostToken !== nextHostToken) {
      const newHost = state.room.players.find((player) => player.sessionToken === nextHostToken);
      showRoomNotice(newHost && nextHostToken === state.token
        ? 'You are now the host.'
        : `${newHost ? newHost.displayName : 'A new player'} is now hosting the room.`);
    }
    renderRoom();
  });

  state.socket.on('error-message', ({ message }) => {
    setAuthMessage(message, true);
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'five-second-rule') {
      if (fiveSecondFeedbackEl) fiveSecondFeedbackEl.textContent = message;
      if (fiveSecondStartBtn) fiveSecondStartBtn.disabled = false;
      if (fiveSecondPassBtn) fiveSecondPassBtn.disabled = false;
      if (fiveSecondFailBtn) fiveSecondFailBtn.disabled = false;
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'heads-up') {
      if (headsUpFeedbackEl) headsUpFeedbackEl.textContent = message;
      if (headsUpCorrectButton) headsUpCorrectButton.disabled = false;
      if (headsUpSkipButton) headsUpSkipButton.disabled = false;
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'describe-word') {
      if (describeWordFeedbackEl) describeWordFeedbackEl.textContent = message;
      if (describeWordNominationControlsEl) {
        describeWordNominationControlsEl.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
      if (describeWordActionsEl) {
        describeWordActionsEl.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'put-a-finger-down') {
      if (fingerDownFeedbackEl) fingerDownFeedbackEl.textContent = message;
      fingerDownResponseButtons.forEach((button) => {
        if (button) button.disabled = false;
      });
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'dont-laugh-challenge') {
      if (dontLaughFeedbackEl) dontLaughFeedbackEl.textContent = message;
      if (dontLaughStartBtn) dontLaughStartBtn.disabled = false;
      if (dontLaughLaughedButton) dontLaughLaughedButton.disabled = false;
      if (dontLaughStraightFaceButton) dontLaughStraightFaceButton.disabled = false;
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'find-the-spy') {
      if (findSpyStatusEl) findSpyStatusEl.textContent = message;
      if (findSpyVoteActionsEl) {
        findSpyVoteActionsEl.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
      if (findSpyDoneButton) findSpyDoneButton.disabled = false;
      if (findSpyGuessFormEl) {
        const btn = findSpyGuessFormEl.querySelector('button[type="submit"]');
        if (btn) btn.disabled = false;
      }
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'guess-who') {
      if (guessWhoFeedbackEl) guessWhoFeedbackEl.textContent = message;
      if (guessWhoSubmitFactBtn) guessWhoSubmitFactBtn.disabled = false;
      if (guessWhoAuthorOptionsEl) {
        guessWhoAuthorOptionsEl.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'who-am-i') {
      if (whoAmIFeedbackEl) whoAmIFeedbackEl.textContent = message;
      if (whoAmIStartBtn) whoAmIStartBtn.disabled = false;
      if (whoAmIGuessFormEl) {
        const btn = whoAmIGuessFormEl.querySelector('button[type="submit"]');
        if (btn) btn.disabled = false;
      }
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'name-that-tune') {
      nameThatTuneFeedbackEl.textContent = message;
      nameThatTuneSetupFormEl.querySelector('button[type="submit"]').disabled = false;
      nameThatTuneStartButton.disabled = false;
      nameThatTuneBuzzButton.disabled = false;
      nameThatTuneAttemptFormEl.querySelector('button[type="submit"]').disabled = false;
      nameThatTuneJudgeButton.disabled = false;
      nameThatTuneRevealButton.disabled = false;
      nameThatTuneNextButton.disabled = false;
    }
    if (state.room && state.room.selectedGame && state.room.selectedGame.id === 'do-not-spill') {
      doNotSpillFeedbackEl.textContent = message;
      doNotSpillStartButton.disabled = false;
      doNotSpillSpillButton.disabled = false;
      doNotSpillSpinButton.disabled = false;
      doNotSpillAcceptButton.disabled = false;
      doNotSpillPassButton.disabled = false;
      doNotSpillEndButton.disabled = false;
    }
  });

  state.socket.on('disconnect', () => {
    if (state.token) {
      setConnectionStatus('Reconnecting…');
      renderRoom();
    }
  });

  state.socket.on('connect', () => {
    updateConnectionStatus();
  });
}

async function createRoom(event) {
  event.preventDefault();
  const displayName = document.getElementById('create-display-name').value.trim();
  const roomName = document.getElementById('create-room-name').value.trim();

  try {
    const response = await fetch('/api/create-room', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ displayName, roomName })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to create room.');
    }

    state.token = payload.token;
    setTabSessionToken(state.token);
    state.room = payload.room;
    setAuthMessage('');
    connectSocket();
    renderRoom();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function joinRoom(event) {
  event.preventDefault();
  const roomCode = document.getElementById('join-room-code').value.trim();
  const displayName = document.getElementById('join-display-name').value.trim();

  try {
    const response = await fetch('/api/join-room', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify({ roomCode, displayName })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Unable to join room.');
    }

    state.token = payload.token;
    setTabSessionToken(state.token);
    state.room = payload.room;
    setAuthMessage('');
    connectSocket();
    renderRoom();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function loadGames() {
  try {
    const response = await fetch('/api/games');
    const payload = await response.json();
    state.games = payload.games || [];
  } catch (error) {
    console.error('Unable to load the game catalogue', error);
  }
}

async function restoreSession() {
  try {
    const tabToken = getTabSessionToken();
    const response = await fetch('/api/restore-session', {
      headers: getRequestHeaders({
        'x-session-token': tabToken || ''
      })
    });
    const payload = await response.json();

    if (!payload.room || !payload.token) {
      return;
    }

    state.token = payload.token;
    setTabSessionToken(state.token);
    state.room = payload.room;
    connectSocket();
    renderRoom();
  } catch (error) {
    console.error(error);
  }
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const previousText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = previousText;
    }, 1200);
  } catch (error) {
    console.error('Clipboard copy failed', error);
  }
}

function normalizeRoomCodeInput(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function bindEvents() {
  document.querySelector('[data-action="show-create"]').addEventListener('click', () => {
    setAuthView('create');
  });

  document.querySelector('[data-action="show-join"]').addEventListener('click', () => {
    setAuthView('join');
  });

  document.querySelector('[data-action="back-to-home"]').addEventListener('click', () => {
    setAuthMessage('');
    showScreen('landing');
  });

  document.getElementById('create-room-form').addEventListener('submit', createRoom);
  document.getElementById('join-room-form').addEventListener('submit', joinRoom);

  document.getElementById('join-room-code').addEventListener('input', (event) => {
    event.target.value = normalizeRoomCodeInput(event.target.value);
  });

  document.getElementById('copy-code-button').addEventListener('click', () => {
    if (state.room) {
      copyText(state.room.code, document.getElementById('copy-code-button'));
    }
  });

  document.getElementById('copy-link-button').addEventListener('click', () => {
    if (state.room) {
      const roomUrl = `${window.location.origin}?room=${state.room.code}`;
      copyText(roomUrl, document.getElementById('copy-link-button'));
    }
  });

  document.getElementById('leave-room-button').addEventListener('click', async () => {
    if (!state.token) return;

    try {
      await fetch('/api/leave-room', {
        method: 'POST',
        headers: getRequestHeaders()
      });
    } catch (error) {
      console.error('Unable to clear session cookie', error);
    }

    if (state.socket) {
      state.socket.emit('room:leave', { sessionToken: state.token });
    }

    state.room = null;
    state.token = null;
    setTabSessionToken(null);
    clearRoomNotice();
    setConnectionStatus('');
    showScreen('landing');
  });

  document.getElementById('start-game-button').addEventListener('click', () => {
    if (!state.socket || !state.token) return;
    state.socket.emit('room:start', { sessionToken: state.token });
  });

  document.querySelectorAll('[data-action="show-round-history"]').forEach((button) => {
    button.addEventListener('click', () => {
      renderRoundHistory();
      roundHistoryOverlayEl.classList.remove('hidden');
    });
  });

  document.getElementById('close-round-history-button').addEventListener('click', () => {
    roundHistoryOverlayEl.classList.add('hidden');
  });

  roundHistoryOverlayEl.addEventListener('click', (event) => {
    if (event.target === roundHistoryOverlayEl) {
      roundHistoryOverlayEl.classList.add('hidden');
    }
  });

  roundHistoryListEl.addEventListener('click', (event) => {
    const replayButton = event.target.closest('[data-replay-game-id]');
    if (!replayButton || !state.socket || !state.token) return;
    state.socket.emit('room:pick-game', {
      sessionToken: state.token,
      gameId: replayButton.dataset.replayGameId
    });
    roundHistoryOverlayEl.classList.add('hidden');
  });

  document.getElementById('back-to-selection-button').addEventListener('click', () => {
    if (!state.socket || !state.token) return;
    const isHost = state.room && state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
    if (!isHost) return;
    state.socket.emit('room:choose-next-game', { sessionToken: state.token });
  });

  document.getElementById('vote-button').addEventListener('click', () => {
    setAuthMessage('Voting is ready for the selected game in the next implementation stage.');
  });

  // Most Likely To controls
  if (mostLikelyToNextBtn) {
    mostLikelyToNextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:most-likely-to-next', { sessionToken: state.token });
    });
  }
  if (mostLikelyToEndBtn) {
    mostLikelyToEndBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:most-likely-to-end', { sessionToken: state.token });
    });
  }

  // Hot Take controls
  if (hotTakeAgreeBtn) {
    hotTakeAgreeBtn.addEventListener('click', () => {
      const selectedGame = state.room && state.room.selectedGame;
      if (!selectedGame || selectedGame.id !== 'hot-take-game') return;
      const myPlayer = selectedGame.players && selectedGame.players.find((p) => p.sessionToken === state.token);
      if (myPlayer && (myPlayer.hasSubmitted || myPlayer.locked)) return;
      localHotTakeSelection = 'agree';
      renderHotTakeGame(selectedGame);
    });
  }
  if (hotTakeDisagreeBtn) {
    hotTakeDisagreeBtn.addEventListener('click', () => {
      const selectedGame = state.room && state.room.selectedGame;
      if (!selectedGame || selectedGame.id !== 'hot-take-game') return;
      const myPlayer = selectedGame.players && selectedGame.players.find((p) => p.sessionToken === state.token);
      if (myPlayer && (myPlayer.hasSubmitted || myPlayer.locked)) return;
      localHotTakeSelection = 'disagree';
      renderHotTakeGame(selectedGame);
    });
  }
  if (hotTakeLockBtn) {
    hotTakeLockBtn.addEventListener('click', () => {
      if (!state.socket || !state.token || !localHotTakeSelection) return;
      hotTakeLockBtn.disabled = true;
      hotTakeStatusMsgEl.textContent = 'Locking in your choice…';
      state.socket.emit('game:hot-take-choice', { sessionToken: state.token, choice: localHotTakeSelection });
    });
  }
  if (hotTakeNextBtn) {
    hotTakeNextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:hot-take-next', { sessionToken: state.token });
    });
  }
  if (hotTakeEndBtn) {
    hotTakeEndBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:hot-take-end', { sessionToken: state.token });
    });
  }

  // 5-Second Rule controls
  if (fiveSecondStartBtn) {
    fiveSecondStartBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:five-second-start', { sessionToken: state.token });
    });
  }
  if (fiveSecondPassBtn) {
    fiveSecondPassBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:five-second-judge', { sessionToken: state.token, judgment: 'pass' });
    });
  }
  if (fiveSecondFailBtn) {
    fiveSecondFailBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:five-second-judge', { sessionToken: state.token, judgment: 'fail' });
    });
  }
  if (fiveSecondNextBtn) {
    fiveSecondNextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:five-second-next', { sessionToken: state.token });
    });
  }

  // Heads Up controls
  if (headsUpStartBtn) {
    headsUpStartBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:heads-up-start', { sessionToken: state.token });
    });
  }
  if (headsUpNextBtn) {
    headsUpNextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:heads-up-next', { sessionToken: state.token });
    });
  }

  // Don't Laugh Challenge controls
  if (dontLaughStartBtn) {
    dontLaughStartBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:dont-laugh-start', { sessionToken: state.token });
    });
  }
  if (dontLaughNextBtn) {
    dontLaughNextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:dont-laugh-next', { sessionToken: state.token });
    });
  }

  const submitHeadsUpAction = (action) => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    headsUpCorrectButton.disabled = true;
    headsUpSkipButton.disabled = true;
    headsUpFeedbackEl.textContent = action === 'correct' ? 'Recording the correct answer…' : 'Skipping this word…';
    state.socket.emit('game:heads-up-action', {
      sessionToken: state.token,
      action,
      wordNumber: state.room.selectedGame.wordNumber
    });
  };
  headsUpCorrectButton.addEventListener('click', () => submitHeadsUpAction('correct'));
  headsUpSkipButton.addEventListener('click', () => submitHeadsUpAction('skip'));

  describeWordGamePanelEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-describe-action]');
    if (!button || !state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    const action = button.dataset.describeAction;
    if (action === 'nominate') {
      button.disabled = true;
      describeWordFeedbackEl.textContent = 'Sending the describer nomination…';
      state.socket.emit('game:describe-the-word-nominate', {
        sessionToken: state.token,
        nomineeSessionToken: button.dataset.nomineeSessionToken
      });
    } else if (action === 'accept' || action === 'decline') {
      button.disabled = true;
      describeWordFeedbackEl.textContent = action === 'accept' ? 'Accepting the nomination…' : 'Declining the nomination…';
      state.socket.emit('game:describe-the-word-nomination-response', {
        sessionToken: state.token,
        accepted: action === 'accept'
      });
    } else {
      describeWordActionsEl.querySelectorAll('button').forEach((actionButton) => {
        actionButton.disabled = true;
      });
      describeWordFeedbackEl.textContent = action === 'correct' ? 'Correct — next word…' : 'Skipped — next word…';
      state.socket.emit('game:describe-the-word-action', {
        sessionToken: state.token,
        action,
        wordActionNumber: state.room.selectedGame.wordActionNumber
      });
    }
  });

  if (describeWordEndBtn) {
    describeWordEndBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      if (confirm('Are you sure you want to end Describe the Word early? Current points and progress will be preserved.')) {
        state.socket.emit('game:describe-the-word-end', { sessionToken: state.token });
      }
    });
  }

  // Guess Who controls
  if (guessWhoFactFormEl) {
    guessWhoFactFormEl.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.socket || !state.token) return;
      const fact = guessWhoFactInputEl.value.trim();
      if (!fact) return;
      guessWhoSubmitFactBtn.disabled = true;
      guessWhoSubmitFactBtn.textContent = 'Submitting…';
      state.socket.emit('game:guess-who-submit-fact', { sessionToken: state.token, fact });
    });
  }
  if (guessWhoCloseSubmissionsBtn) {
    guessWhoCloseSubmissionsBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:guess-who-close-submissions', { sessionToken: state.token });
    });
  }
  if (guessWhoNextFactBtn) {
    guessWhoNextFactBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:guess-who-next-fact', { sessionToken: state.token });
    });
  }

  // Who Am I controls
  if (whoAmIStartBtn) {
    whoAmIStartBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:who-am-i-start', { sessionToken: state.token });
    });
  }
  if (whoAmIMakeGuessBtn) {
    whoAmIMakeGuessBtn.addEventListener('click', () => {
      whoAmIGuessFormEl.classList.remove('hidden');
      whoAmIGuessInputEl.focus();
    });
  }
  if (whoAmIGuessFormEl) {
    whoAmIGuessFormEl.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.socket || !state.token) return;
      const guess = whoAmIGuessInputEl.value.trim();
      if (!guess) return;
      state.socket.emit('game:who-am-i-guess', { sessionToken: state.token, guess });
      whoAmIGuessInputEl.value = '';
      whoAmIGuessFormEl.classList.add('hidden');
    });
  }
  if (whoAmINextBtn) {
    whoAmINextBtn.addEventListener('click', () => {
      if (!state.socket || !state.token) return;
      state.socket.emit('game:who-am-i-next', { sessionToken: state.token });
    });
  }

  const readNameThatTuneSongs = () => {
    const songs = Array.from({ length: 10 }, () => ({ title: '', artist: '' }));
    nameThatTuneSongFieldsEl.querySelectorAll('input[data-song-index]').forEach((input) => {
      songs[Number(input.dataset.songIndex)][input.dataset.songField] = input.value.trim();
    });
    return songs;
  };

  nameThatTuneSetupFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    const submitButton = nameThatTuneSetupFormEl.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    nameThatTuneFeedbackEl.textContent = 'Saving the song list…';
    state.socket.emit('game:name-that-tune-save-playlist', {
      sessionToken: state.token,
      songs: readNameThatTuneSongs()
    });
  });

  nameThatTuneStartButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    nameThatTuneStartButton.disabled = true;
    nameThatTuneFeedbackEl.textContent = 'Locking the answers and starting the game…';
    state.socket.emit('game:name-that-tune-start', {
      sessionToken: state.token,
      songs: readNameThatTuneSongs()
    });
  });

  nameThatTuneBuzzButton.addEventListener('click', () => {
    if (!state.socket || !state.token) {
      return;
    }

    nameThatTuneBuzzButton.disabled = true;
    nameThatTuneFeedbackEl.textContent = 'Buzzing in…';
    state.socket.emit('game:name-that-tune-buzz', { sessionToken: state.token });
  });

  nameThatTuneAttemptFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    const submitButton = nameThatTuneAttemptFormEl.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    nameThatTuneFeedbackEl.textContent = 'Sending your attempt to the host…';
    state.socket.emit('game:name-that-tune-attempt', {
      sessionToken: state.token,
      title: nameThatTuneTitleInputEl.value.trim(),
      artist: nameThatTuneArtistInputEl.value.trim()
    });
  });

  nameThatTuneJudgeButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    const titleCorrect = nameThatTuneJudgeActionsEl.querySelector('input[name="name-that-tune-title-correct"]:checked');
    const artistCorrect = nameThatTuneJudgeActionsEl.querySelector('input[name="name-that-tune-artist-correct"]:checked');
    if (!titleCorrect || !artistCorrect) {
      nameThatTuneFeedbackEl.textContent = 'Judge both the title and the artist.';
      return;
    }

    nameThatTuneJudgeButton.disabled = true;
    nameThatTuneFeedbackEl.textContent = 'Submitting the judgment…';
    state.socket.emit('game:name-that-tune-judge', {
      sessionToken: state.token,
      titleCorrect: titleCorrect.value === 'true',
      artistCorrect: artistCorrect.value === 'true'
    });
  });

  nameThatTuneRevealButton.addEventListener('click', () => {
    if (!state.socket || !state.token) {
      return;
    }

    nameThatTuneRevealButton.disabled = true;
    state.socket.emit('game:name-that-tune-reveal', { sessionToken: state.token });
  });

  nameThatTuneNextButton.addEventListener('click', () => {
    if (!state.socket || !state.token) {
      return;
    }

    nameThatTuneNextButton.disabled = true;
    state.socket.emit('game:name-that-tune-next', { sessionToken: state.token });
  });

  doNotSpillStartButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    doNotSpillStartButton.disabled = true;
    doNotSpillFeedbackEl.textContent = 'Starting the game…';
    state.socket.emit('game:do-not-spill-start', { sessionToken: state.token });
  });

  doNotSpillSpillButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    doNotSpillSpillButton.disabled = true;
    doNotSpillFeedbackEl.textContent = 'Recording your spill…';
    state.socket.emit('game:do-not-spill-spill', { sessionToken: state.token });
  });

  doNotSpillSpinButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    doNotSpillSpinButton.disabled = true;
    doNotSpillFeedbackEl.textContent = 'Spinning the consequence wheel…';
    state.socket.emit('game:do-not-spill-spin', { sessionToken: state.token });
  });

  const decideDoNotSpillConsequence = (accepted) => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    doNotSpillAcceptButton.disabled = true;
    doNotSpillPassButton.disabled = true;
    doNotSpillFeedbackEl.textContent = accepted
      ? 'Recording your acceptance…'
      : 'Recording your pass…';
    state.socket.emit('game:do-not-spill-decision', {
      sessionToken: state.token,
      accepted
    });
  };
  doNotSpillAcceptButton.addEventListener('click', () => decideDoNotSpillConsequence(true));
  doNotSpillPassButton.addEventListener('click', () => decideDoNotSpillConsequence(false));

  doNotSpillEndButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    doNotSpillEndButton.disabled = true;
    doNotSpillFeedbackEl.textContent = 'Ending the game…';
    state.socket.emit('game:do-not-spill-end', { sessionToken: state.token });
  });

  nextGameButton.addEventListener('click', () => {
    if (!state.socket || !state.token) return;
    const isHost = state.room && state.room.players.some((player) => player.sessionToken === state.token && player.isHost);
    if (!isHost) return;
    state.socket.emit('room:choose-next-game', { sessionToken: state.token });
  });

  replayGameButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    state.socket.emit('room:pick-game', {
      sessionToken: state.token,
      gameId: state.room.selectedGame.id
    });
  });

  const submitDontLaughVote = (didLaugh) => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    dontLaughLaughedButton.disabled = true;
    dontLaughStraightFaceButton.disabled = true;
    dontLaughFeedbackEl.textContent = 'Submitting your vote…';
    state.socket.emit('game:dont-laugh-vote', {
      sessionToken: state.token,
      didLaugh
    });
  };
  dontLaughLaughedButton.addEventListener('click', () => submitDontLaughVote(true));
  dontLaughStraightFaceButton.addEventListener('click', () => submitDontLaughVote(false));

  findSpyDoneButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }
    findSpyDoneButton.disabled = true;
    findSpyStatusEl.textContent = 'Marking your clue done…';
    state.socket.emit('game:find-the-spy-clue-done', { sessionToken: state.token });
  });

  findSpyGuessFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.socket || !state.token) {
      return;
    }

    const guess = findSpyGuessInputEl.value.trim();
    if (!guess) {
      findSpyGuessInputEl.focus();
      return;
    }

    findSpyGuessFormEl.querySelector('button[type="submit"]').disabled = true;
    findSpyStatusEl.textContent = 'Submitting your final guess…';
    state.socket.emit('game:find-the-spy-guess', {
      sessionToken: state.token,
      guess
    });
  });

  const submitFingerDownResponse = (response) => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    fingerDownResponseButtons.forEach((button) => {
      button.disabled = true;
    });
    fingerDownFeedbackEl.textContent = 'Submitting your response…';
    state.socket.emit('game:put-a-finger-down-response', {
      sessionToken: state.token,
      response
    });
  };

  fingerDownButton.addEventListener('click', () => submitFingerDownResponse('finger-down'));
  fingerDownStillUpButton.addEventListener('click', () => submitFingerDownResponse('still-up'));
  fingerDownPreferNotButton.addEventListener('click', () => submitFingerDownResponse('prefer-not-to-answer'));

  fingerDownContinueButton.addEventListener('click', () => {
    if (!state.socket || !state.token || !state.room || !state.room.selectedGame) {
      return;
    }

    state.socket.emit('game:put-a-finger-down-next', { sessionToken: state.token });
  });
}

bindEvents();
loadGames();
restoreSession();
showScreen('landing');
window.setInterval(() => {
  updateMostLikelyToSuspenseCountdown();
  updateFiveSecondCountdown();
  updateDontLaughCountdown();
  updateHeadsUpCountdown();
  updateWhoAmICountdown();
  updateFindSpyCountdown();
  updateNameThatTuneCountdown();
  updateDescribeWordCountdown();
}, 200);
