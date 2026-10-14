// ============================================
// CALLBREAK TRACKER — script.js
// ============================================

const PLAYER_COUNT = 4;
const TOTAL_ROUNDS = 5;
const TRICKS_PER_ROUND = 13;
const TOTAL_TRICKS = TRICKS_PER_ROUND;

// Suit glyphs, indexed 0-3. Assigned per-game, unique per player.
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'];

let state = {
  phase: 'setup',
  players: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  suits: [0, 1, 2, 3],
  round: 1,
  bids: [1, 1, 1, 1],
  locks: [false, false, false, false],
  tricks: [0, 0, 0, 0],
  history: [],
  totals: [0, 0, 0, 0]
};

// ---------- PERSISTENCE ----------
function save() {
  localStorage.setItem('callbreak_state', JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem('callbreak_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.players && parsed.players.length === PLAYER_COUNT) {
        state = parsed;
        if (!state.locks || state.locks.length !== PLAYER_COUNT) {
          state.locks = [false, false, false, false];
        }
        if (!state.suits || state.suits.length !== PLAYER_COUNT) {
          state.suits = [0, 1, 2, 3];
        }
      }
    }
  } catch (e) {}
}

// ---------- SCORING ----------
function calcScore(bid, won) {
  if (won === bid) return bid;
  if (won < bid) return -bid;
  return bid + 0.1 * (won - bid);
}

// ---------- HELPERS ----------
const $ = id => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatScore(n) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function shuffleSuits() {
  const arr = [0, 1, 2, 3];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getBidOrder() {
  const start = (state.round - 1) % PLAYER_COUNT;
  const order = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    order.push((start + i) % PLAYER_COUNT);
  }
  return order;
}

function getActivePlayer() {
  const order = getBidOrder();
  for (const idx of order) {
    if (!state.locks[idx]) return idx;
  }
  return null;
}

// ---------- RENDER ----------
function showPhase() {
  ['setup', 'bidding', 'tricks', 'scores', 'final'].forEach(p => {
    $(p).classList.toggle('hidden', state.phase !== p);
  });
}

function renderSetup() {
  const el = $('setupPlayers');
  el.innerHTML = '';
  state.players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-name">
        <input type="text" value="${escapeHtml(name)}" data-idx="${i}" maxlength="16" />
      </div>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      // don't write empty strings into state — keep last known value until blur
      const val = e.target.value;
      if (val.trim()) {
        state.players[idx] = val;
      } else {
        state.players[idx] = '';
      }
      save();
    });

    // On blur: if empty, snap to "Player N" and update the visible input
    inp.addEventListener('blur', e => {
      const idx = +e.target.dataset.idx;
      const trimmed = e.target.value.trim();
      if (!trimmed) {
        const fallback = `Player ${idx + 1}`;
        state.players[idx] = fallback;
        e.target.value = fallback;
        save();
      } else if (trimmed !== e.target.value) {
        state.players[idx] = trimmed;
        e.target.value = trimmed;
        save();
      }
    });
  });
}

function renderBidPhase() {
  $('bidRoundLabel').textContent = `Round ${state.round} of ${TOTAL_ROUNDS}`;
  const el = $('bidPlayers');
  el.innerHTML = '';

  const order = getBidOrder();
  const activeIdx = getActivePlayer();

  order.forEach((playerIdx, position) => {
    const name = state.players[playerIdx];
    const suit = SUIT_GLYPHS[state.suits[playerIdx]];
    const locked = state.locks[playerIdx];
    const isActive = playerIdx === activeIdx;

    let rowClass = 'player-row';
    if (locked) rowClass += ' locked';
    else if (!isActive) rowClass += ' waiting';
    if (isActive) rowClass += ' active';

    const stepperDisabled = locked || !isActive;
    const minusDisabled = stepperDisabled || state.bids[playerIdx] <= 1;
    const plusDisabled  = stepperDisabled || state.bids[playerIdx] >= TRICKS_PER_ROUND;
    const lockBtnDisabled = !locked && !isActive;

    const row = document.createElement('div');
    row.className = rowClass;
    row.innerHTML = `
      <div class="player-name">
        <span class="suit-badge">${suit}</span>
        ${escapeHtml(name)}
        ${position === 0 ? '<span class="round-detail">Starts this round</span>' : ''}
        ${isActive ? '<span class="round-detail active-label">Their turn</span>' : ''}
      </div>
      <div class="stepper">
        <button data-idx="${playerIdx}" data-delta="-1" ${minusDisabled ? 'disabled' : ''}>−</button>
        <div class="value">${state.bids[playerIdx]}</div>
        <button data-idx="${playerIdx}" data-delta="1" ${plusDisabled ? 'disabled' : ''}>+</button>
      </div>
      <button class="lock-btn ${locked ? 'locked' : ''} ${isActive ? 'active' : ''}"
              data-lock="${playerIdx}"
              ${lockBtnDisabled ? 'disabled' : ''}>
        ${locked ? '🔒' : '✓'}
      </button>
    `;
    el.appendChild(row);
  });

  el.querySelectorAll('.stepper button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      const delta = +btn.dataset.delta;
      if (state.locks[idx]) return;
      if (idx !== activeIdx) return;
      state.bids[idx] = Math.max(1, Math.min(TRICKS_PER_ROUND, state.bids[idx] + delta));
      save();
      renderBidPhase();
    });
  });

  el.querySelectorAll('.lock-btn').forEach(btn => {
    const idx = +btn.dataset.lock;
    let pressTimer = null;
    let longPressed = false;

    const startPress = () => {
      longPressed = false;
      if (!state.locks[idx]) return;
      pressTimer = setTimeout(() => {
        longPressed = true;
        if (navigator.vibrate) navigator.vibrate(40);
        state.locks[idx] = false;
        save();
        renderBidPhase();
      }, 1500);
    };

    const endPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    btn.addEventListener('click', () => {
      if (longPressed) { longPressed = false; return; }
      if (state.locks[idx]) return;
      if (idx !== getActivePlayer()) return;
      state.locks[idx] = true;
      if (navigator.vibrate) navigator.vibrate(20);
      save();
      renderBidPhase();
    });

    btn.addEventListener('touchstart', startPress, { passive: true });
    btn.addEventListener('touchend', endPress);
    btn.addEventListener('touchcancel', endPress);
    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);
    btn.addEventListener('mouseleave', endPress);
  });

  updateBidWarning();
  updateBidGate();
}

function updateBidWarning() {
  const total = state.bids.reduce((a, b) => a + b, 0);
  const warn = $('bidWarning');
  if (total < 13) {
    warn.textContent = `Total bids: ${total} / ${TOTAL_TRICKS} — quite low`;
    warn.classList.remove('hidden');
  } else if (total > TOTAL_TRICKS) {
    warn.textContent = `Total bids: ${total} — more than ${TOTAL_TRICKS} tricks available!`;
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
}

function updateBidGate() {
  const allLocked = state.locks.every(Boolean);
  $('startRoundBtn').disabled = !allLocked;
}

function renderTrickPhase() {
  $('trickRoundLabel').textContent = `Round ${state.round} of ${TOTAL_ROUNDS}`;
  const el = $('trickPlayers');
  el.innerHTML = '';
  const tableTotal = state.tricks.reduce((a, b) => a + b, 0);

  state.players.forEach((name, i) => {
    const suit = SUIT_GLYPHS[state.suits[i]];
    const row = document.createElement('div');
    row.className = 'player-row';
    const canIncrease = state.tricks[i] < TRICKS_PER_ROUND && tableTotal < TOTAL_TRICKS;
    row.innerHTML = `
      <div class="player-name">
        <span class="suit-badge">${suit}</span>
        ${escapeHtml(name)}
        <span class="round-detail">Bid: ${state.bids[i]}</span>
      </div>
      <div class="stepper">
        <button data-idx="${i}" data-delta="-1" ${state.tricks[i] <= 0 ? 'disabled' : ''}>−</button>
        <div class="value">${state.tricks[i]}</div>
        <button data-idx="${i}" data-delta="1" ${!canIncrease ? 'disabled' : ''}>+</button>
      </div>
    `;
    el.appendChild(row);
  });

  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      const delta = +btn.dataset.delta;
      state.tricks[idx] = Math.max(0, Math.min(TRICKS_PER_ROUND, state.tricks[idx] + delta));
      save();
      renderTrickPhase();
    });
  });

  updateTrickWarning();
}

function updateTrickWarning() {
  const total = state.tricks.reduce((a, b) => a + b, 0);
  const warn = $('trickWarning');
  if (total !== TOTAL_TRICKS) {
    warn.textContent = `Total tricks: ${total} / ${TOTAL_TRICKS} — must add to exactly ${TOTAL_TRICKS}`;
    warn.classList.remove('hidden');
    $('finishRoundBtn').disabled = true;
  } else {
    warn.classList.add('hidden');
    $('finishRoundBtn').disabled = false;
  }
}

function renderScoreboard() {
  const table = $('scoreTable');
  let html = '<thead><tr><th>Player</th>';
  for (let r = 0; r < TOTAL_ROUNDS; r++) html += `<th>R${r + 1}</th>`;
  html += '<th>Total</th></tr></thead><tbody>';

  state.players.forEach((name, i) => {
    html += `<tr><td>${escapeHtml(name)}</td>`;
    for (let r = 0; r < TOTAL_ROUNDS; r++) {
      const entry = state.history[r] && state.history[r][i];
      if (entry) {
        const cls = entry.score < 0 ? 'score-negative' : (entry.score > 0 ? 'score-positive' : '');
        html += `<td class="${cls}">${formatScore(entry.score)}</td>`;
      } else {
        html += `<td style="color:#4d5878;">—</td>`;
      }
    }
    html += `<td style="font-weight:700;">${formatScore(state.totals[i])}</td></tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;

  const isLastRound = state.history.length >= TOTAL_ROUNDS;
  $('scoresPhaseLabel').textContent = isLastRound ? 'Game over' : `After Round ${state.history.length}`;
  $('nextRoundBtn').textContent = isLastRound ? 'See Final Result' : 'Next Round';
}

function renderFinal() {
  const max = Math.max(...state.totals);
  const winners = state.players.filter((_, i) => state.totals[i] === max);

  $('winnerText').textContent = winners.length === 1
    ? `🏆 ${winners[0]} wins with ${formatScore(max)} points!`
    : `🏆 Tie: ${winners.join(', ')} — ${formatScore(max)} points!`;

  const table = $('finalTable');
  let html = '<thead><tr><th>Player</th><th>Total</th></tr></thead><tbody>';
  const sorted = state.players
    .map((name, i) => ({ name, total: state.totals[i] }))
    .sort((a, b) => b.total - a.total);
  sorted.forEach(p => {
    html += `<tr><td>${escapeHtml(p.name)}</td><td style="font-weight:600;">${formatScore(p.total)}</td></tr>`;
  });
  html += '</tbody>';
  table.innerHTML = html;
}

// ---------- FLOW ----------
function startGame() {
  // Safety net: fill any empty names before the game starts
  state.players = state.players.map((name, i) => {
    const trimmed = (name || '').trim();
    return trimmed || `Player ${i + 1}`;
  });

  state.phase = 'bidding';
  state.round = 1;
  state.history = [];
  state.totals = [0, 0, 0, 0];
  state.bids = [1, 1, 1, 1];
  state.locks = [false, false, false, false];
  state.tricks = [0, 0, 0, 0];
  state.suits = shuffleSuits();
  save();
  render();
}

function startRound() {
  if (!state.locks.every(Boolean)) return;
  state.phase = 'tricks';
  state.tricks = [0, 0, 0, 0];
  save();
  render();
}

function finishRound() {
  const entry = [];
  state.players.forEach((_, i) => {
    const score = calcScore(state.bids[i], state.tricks[i]);
    entry.push({ bid: state.bids[i], tricks: state.tricks[i], score });
    state.totals[i] += score;
  });
  state.totals = state.totals.map(t => Math.round(t * 10) / 10);
  state.history.push(entry);
  save();
  state.phase = 'scores';
  render();
}

function nextRound() {
  if (state.history.length >= TOTAL_ROUNDS) {
    state.phase = 'final';
  } else {
    state.round = state.history.length + 1;
    state.bids = [1, 1, 1, 1];
    state.locks = [false, false, false, false];
    state.tricks = [0, 0, 0, 0];
    state.phase = 'bidding';
  }
  save();
  render();
}

function resetGame() {
  if (!confirm('Reset the entire game? This cannot be undone.')) return;
  state = {
    phase: 'setup',
    players: state.players,
    suits: [0, 1, 2, 3],
    round: 1,
    bids: [1, 1, 1, 1],
    locks: [false, false, false, false],
    tricks: [0, 0, 0, 0],
    history: [],
    totals: [0, 0, 0, 0]
  };
  save();
  render();
}

function newGame() {
  state = {
    phase: 'setup',
    players: state.players,
    suits: [0, 1, 2, 3],
    round: 1,
    bids: [1, 1, 1, 1],
    locks: [false, false, false, false],
    tricks: [0, 0, 0, 0],
    history: [],
    totals: [0, 0, 0, 0]
  };
  save();
  render();
}

function render() {
  showPhase();
  if (state.phase === 'setup') renderSetup();
  else if (state.phase === 'bidding') renderBidPhase();
  else if (state.phase === 'tricks') renderTrickPhase();
  else if (state.phase === 'scores') renderScoreboard();
  else if (state.phase === 'final') renderFinal();
}

// ---------- WIRE UP ----------
$('startBtn').addEventListener('click', startGame);
$('startRoundBtn').addEventListener('click', startRound);
$('finishRoundBtn').addEventListener('click', finishRound);
$('nextRoundBtn').addEventListener('click', nextRound);
$('resetBtn').addEventListener('click', resetGame);
$('newGameBtn').addEventListener('click', newGame);

// ---------- SECRET LOGO RESET (3 taps fast) ----------
let logoTaps = 0;
let logoTapTimer = null;

$('logoReset').addEventListener('click', () => {
  logoTaps++;
  clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => { logoTaps = 0; }, 1500);

  $('logoReset').style.transform = 'scale(0.95)';
  setTimeout(() => { $('logoReset').style.transform = 'scale(1)'; }, 80);

  if (logoTaps >= 3) {
    logoTaps = 0;
    clearTimeout(logoTapTimer);
    if (navigator.vibrate) navigator.vibrate(50);
    doSecretReset();
  }
});

function doSecretReset() {
  state = {
    phase: 'setup',
    players: state.players,
    suits: [0, 1, 2, 3],
    round: 1,
    bids: [1, 1, 1, 1],
    locks: [false, false, false, false],
    tricks: [0, 0, 0, 0],
    history: [],
    totals: [0, 0, 0, 0]
  };
  save();
  render();

  const logo = $('logoReset');
  const original = logo.textContent;
  logo.textContent = '✅ Reset';
  setTimeout(() => { logo.textContent = original; }, 900);
}

// ---------- INIT ----------
load();
render();