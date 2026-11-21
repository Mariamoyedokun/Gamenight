# The Department of Fun

A multiplayer browser-based party game platform built with Node.js, Express, HTML, CSS, and Socket.IO.

## Project structure

- `server.js` – Express server, static frontend hosting, and Socket.IO connection handling.
- `server/roomStore.js` – Shared in-memory room engine for room creation, validation, host handling, and player membership.
- `public/index.html` – Landing page, create/join forms, and waiting-room layout.
- `public/styles.css` – Responsive party-game styling using the required burgundy/cream palette.
- `public/app.js` – Frontend client logic for create/join flows, room rendering, and socket updates.

## Architecture

This project follows the required shared game-night engine model:

- The server is authoritative for room state and player validation.
- Shared room logic lives in the in-memory `RoomStore` instead of the browser.
- Frontend screens are presentation-only and rely on Socket.IO to keep players in sync.
- Game-specific modules can be added later without reinventing the room engine.

## Stage 1 status

Completed:

- Workspace inspection and project setup
- Express + Socket.IO server scaffold
- Room creation and joining flows
- Room code validation and player name validation
- Waiting-room state rendering
- Host-only start flow over Socket.IO
- Session restoration via HTTP-only cookie flow

Validation performed:

- Create-room API request
- Join-room API request
- Restore-session API request
- Real-time Socket.IO room update and host start event

## Stage 2 status

Completed:

- Shared game catalogue for all 12 party games
- Host-only game-selection screen with minimum-player gating
- Selected game state persisted in the room
- First playable mini-game shell: Most Likely To
- Reusable server-side selection flow for later game modules

Validation performed:

- Game catalogue route returns all 12 entries
- Host can select a valid game after room start
- Selected-game state is shared to room members
- Landing-page HTML receives the updated game-selection UI

## Stage 3 status

Completed:

- Real vote submission and round resolution for Most Likely To
- Server-authoritative scoring and winner calculation
- Player-facing vote buttons for the active game
- Final round result summary shown to the room
- Second playable game module added: Hot Take Game
- Shared game-module dispatch so future games can plug into the same room flow

Validation performed:

- Three-player Most Likely To vote round completes successfully
- Three-player Hot Take Game vote round resolves to a shared winner
- Vote lifecycle works without any browser-side trust in final scoring

## Stage 4 status

Completed:

- Reconnect state is preserved for players with the same session token
- Host transfer is automatic when the host disconnects
- Stale rooms are cleaned up after inactivity to prevent orphaned rooms
- Rejoin and reconnect logic keeps the room roster consistent during active sessions
- Duplicate sockets for the same session are replaced without stale disconnects marking the player offline
- Host handoffs are announced in the UI, and reconnecting players are identified during an active game

Validation performed:

- Host handoff on disconnect succeeds in the room engine
- Reconnected players are restored to their room and marked connected
- Inactive room cleanup removes stale room data automatically
- Multi-client Socket.IO test verified duplicate-socket replacement, host transfer, and former-host reconnect

## Stage 5 status

Completed:

- Added 5-Second Rule as a server-authoritative, turn-based game
- Each connected player receives a five-second turn and a prompt
- Players submit three different answers to score a point
- The server advances turns automatically when time expires and publishes final scores
- Host and players see the live turn, countdown, answer form, and round results
- Host and players see the same completed-round score screen
- Host can choose the next game after any supported game round is complete
- Added Heads Up! with a 60-second phone-to-forehead turn and private word delivery to the group
- The group marks Correct or Skip; correct words score points and skipped words are discarded for the game
- Added Put a Finger Down with ten fresh questions per game and private Finger Down, Still Up, or Prefer Not to Answer responses
- Each shared reveal shows every submitted response and the player's updated finger count; the host advances questions
- The player or players with the most fingers remaining win

Validation performed:

- Correct answers award a point and advance the turn
- Out-of-turn answers are rejected
- The server automatically times out and advances an unanswered turn
- Two-client Socket.IO test completed a scored turn and timeout result
- Completed-round UI keeps the host on the shared results screen and exposes next-game selection only to the host
- Voting games, 5-Second Rule, and Heads Up! use a consistent host-only next-game action
- Heads Up! group controls are available to everyone except the active guesser
- Put a Finger Down checks verify ten questions, all three response choices, private responses before reveal, full per-player reveals, highest-finger winners, and fresh questions on replay

## Running locally

```bash
npm install
npm start
```

Then open `http://localhost:PORTNUMBER` in a browser. If `localhost` does not load, try `http://127.0.0.1:PORTNUMBER`. Do not open `public/index.html` directly as a file; the app needs the Express server for its API and Socket.IO connection.

The local `.env` file sets `PORT=PORTNUMBER` and is ignored by Git. To configure another port, edit `.env`; `.env.example` documents the available setting. Restart the server after changing `.env` so the new port takes effect.

## Stage 6 status

Completed:

- Added Don't Laugh Challenge with one performance turn per player and server-resolved votes and scores
- Added shared completed-round history with result summaries available to everyone in the room
- Added host-only replay controls from the results screen and round history
- Prevented changing games until the current game has finished; completed history keeps the latest 50 rounds

## Stage 7 status

Completed:

- Exactly one player is the spy; other players privately receive the same category and secret word, while the spy sees only the category
- Two generated clue rounds show the speaking order to everyone; the spy cannot speak first in round one, and each current speaker advances with DONE
- After both clue rounds, players vote privately; votes reveal after a suspense countdown
- A tie involving the spy triggers a revote limited to tied players; if the spy is caught, they get one final word guess
- Results reveal the votes, accusation, role, winner, scores, and shared round history
- Replaying the game uses an unused test word and avoids the previous spy when possible

Validation performed:

- Four-client Socket.IO checks covered host participation, private roles, both clue rounds, speaking-order authorization, hidden votes, suspense reveal, tie revote, final word guess, and saved results
- Public room state and unauthorized player views omit the spy identity and secret word; revealed vote details omit session tokens
- RoomStore checks covered self-vote rejection, wrong-accusation wins, and a caught spy's incorrect final guess
- Replay checks verified fresh words and a different spy while unused choices remain

## Stage 8 status

Completed:

- Players are randomly split into two balanced teams; each team nominates a describer who must accept
- Each team gets a five-minute turn and ten unique words; the secret word is sent only to that team's describer's device
- The describer controls Correct and Skip; skipped words can be revisited after the first ten have been attempted
- A disconnected describer pauses the timer for up to two minutes; if they do not reconnect, the team nominates a replacement and resumes with its remaining time
- Final team scores, winner or draw, and the shared round-history/replay flow use the existing game-night system

Validation performed:

- Engine checks cover balanced teams, nomination/acceptance, secret-word privacy, scoring, skipped-word revisits, turn timeout, and draw results
- Multiplayer checks cover team nominations, describer-only controls, timeout progression, disconnect pause, reconnect resume, and replacement nomination
- Browser flow checked team nomination, private word delivery, Correct/Skip controls, and the five-minute timer

## Stage 9 status

Completed:

- Added Guess Who? as a rotating-turn identity guessing game with five gradually revealed clues per player
- The host reveals clues; the active player privately submits a guess
- Correct guesses score more points when solved with fewer clues; skipped identities are revealed at game end
- Current answers and unrevealed clues are omitted from player-specific state
- Results integrate with shared round history and replay

Validation performed:

- Five-player room-engine tests covered private answers, unrevealed clues, host-only clue advancement, scoring, skipped turns, and history
- Four-client Socket.IO test verified public endpoint privacy, turn progression, shared results, and history
- Browser flow verified the game-selection card, revealed-clue list, guess form, and host clue control

## Stage 10 status

Completed:

- Each connected player receives a unique mystery identity and a 60-second turn
- The active player gets two guesses; an incorrect first guess leaves one attempt, while a correct guess ends the turn immediately
- A missed turn or two incorrect guesses reveals the identity and advances to the next player
- Identities stay hidden from their owner and are visible to other players; completed identities are revealed in the recap
- The fastest correct guess wins, with ties sharing the win; players who do not solve their identity do not qualify

Validation performed:

- Engine checks cover identity privacy, attempt limits, timer expiry, completion times, shared fastest ties, and no-winner results
- RoomStore checks cover active-player redaction, other-player identity delivery, timeout progression, and result persistence
- Two-client Socket.IO checks cover private identity delivery, wrong and correct guesses, turn advancement, fastest-winner results, and history

## Stage 11 status

Completed:

- The host enters and may edit ten title/artist pairs before starting; answers are locked once the game begins
- The host plays Spotify manually through the room speaker; the website does not play audio, and the host does not compete
- The first player to buzz gets 20 seconds to submit a title and artist; each player may attempt a song once, with at most three attempts per song
- The host judges title and artist separately; each correct part earns 0.5 points and another player may earn the remaining half
- Expired attempts are forfeited; the host can reveal a song when nobody has buzzed, and answers and awarded points appear when a song ends
- The host advances each revealed song; after ten songs, the highest score wins, with ties sharing the win
- Playlist answers and active guesses are kept out of other players' live room state

Validation performed:

- Engine and RoomStore assertions covered the ten-song playlist, editing lock, host exclusion, answer/guess privacy, first-buzzer handling, partial scoring, one attempt per player, timeouts, three-attempt exhaustion, no-buzz reveals, tied results, and history
- Multi-client Socket.IO checks covered private answers/guesses, wrong-player submission rejection, partial scoring across players, no-buzz reveal, ten-song completion, and shared results
- The live 20-second timer was verified to forfeit an attempt and keep that player locked out
- Browser flow checked the ten title/artist fields, saving and starting the game, and host answer/status rendering

## Stage 12 status

Completed:

- Added Water & Consequence with the physical spill-reporting flow; the website tracks the game but does not play or control water
- The spiller is the only player who can spin the server-selected consequence and choose Accept or Pass
- Additional spills reported while a consequence is being resolved are queued and processed in order
- The host can end the game early; otherwise it ends after five spills have been resolved
- Completed spill recaps are saved to shared round history and the game can be replayed
- The consequence list has not yet been supplied, so the wheel currently uses clearly labeled numbered placeholders

Validation performed:

- Room-engine tests covered host start/end authorization, spill attribution, spiller-only spin and decision, accept/pass recap, the five-spill end condition, and round history
- Two-player Socket.IO test verified shared wheel results, rejection of unauthorized controls, host early end, and replay
- Browser flow checked the water safety warning, start/end controls, and final recap

## Stage 13 status

Completed:

- Updated Heads Up! to 60-second turns with no per-turn word limit
- The active player holds their phone to their forehead and receives no secret word in their player state
- Other players can mark Correct or Skip from their own devices; each correct answer adds one point
- Skipped words are permanently discarded for the current game, while already-correct words can be recycled if the deck is exhausted
- Results show the highest scorer or shared winners for ties

Validation performed:

- Engine tests covered group-only controls, word secrecy, unique turn actions, skip discard, scoring, timer expiry, and tied winners
- Two-client Socket.IO flow verified private active-player state, group Correct/Skip actions, scoring, skip tracking, and stale-action rejection
- Engine tests covered timeout progression, public/player word redaction, tie results, and history serialization
- Browser flow checked phone-to-forehead instructions, the hidden active-player word, group controls, a Correct action, and the 60-second countdown

## Next stage

The next step is to add another playable game from the catalogue.
