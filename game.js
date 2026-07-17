'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#3f51b5', // J - indigo oscuro
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const POWERUP_LINE_INTERVAL = 5;
const POWERUP_INFO = {
  bomb:      { color: '#ff5252', icon: '💣', label: 'BOMBA', desc: 'Destruye un área 3×3 al aterrizar' },
  lightning: { color: '#ffee58', icon: '⚡', label: 'RAYO', desc: 'Limpia la fila y la columna completas donde cae' },
  dye:       { color: '#ce93d8', icon: '🎨', label: 'TINTE', desc: 'Elimina el color más frecuente del tablero y compacta' },
  gravity:   { color: '#4dd0e1', icon: '🌀', label: 'GRAVEDAD', desc: 'Compacta los huecos de todas las columnas' },
  freeze:    { color: '#81d4fa', icon: '❄️', label: 'CONGELAR', desc: 'Pausa la caída automática durante 5s' },
};
const POWERUP_KINDS = Object.keys(POWERUP_INFO);

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const powerupLegend = document.getElementById('powerup-legend');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const highscoreListPanelEl = document.getElementById('highscore-list');
const bestComboValueEl = document.getElementById('best-combo-value');
const maxLinesValueEl = document.getElementById('max-lines-value');
const resetHighscoresBtn = document.getElementById('reset-highscores-btn');
const highscoreEntryEl = document.getElementById('highscore-entry');
const playerNameInputEl = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayHighscoresEl = document.getElementById('overlay-highscores');
const highscoreListOverlayEl = document.getElementById('overlay-highscore-list');

const THEME_STORAGE_KEY = 'tetris-theme';

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function toggleTheme() {
  const newTheme = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

const HIGHSCORES_STORAGE_KEY = 'tetris-highscores';
const STATS_STORAGE_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HIGHSCORES_STORAGE_KEY, JSON.stringify(list));
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    const stats = raw ? JSON.parse(raw) : null;
    return stats && typeof stats === 'object'
      ? { bestCombo: stats.bestCombo || 0, maxLines: stats.maxLines || 0 }
      : { bestCombo: 0, maxLines: 0 };
  } catch (e) {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
}

function qualifiesForHighScore(candidateScore) {
  const list = loadHighScores();
  if (list.length < MAX_HIGHSCORES) return true;
  return candidateScore > list[list.length - 1].score;
}

function addHighScore(name, candidateScore) {
  const entry = { name: name || 'Jugador', score: candidateScore };
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_HIGHSCORES);
  saveHighScores(trimmed);
  return { list: trimmed, entry };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderHighScoreList(listEl, list, highlightEntry) {
  if (!listEl) return;
  if (!list.length) {
    listEl.innerHTML = '<li class="hs-empty">Sin puntuaciones aún</li>';
    return;
  }
  listEl.innerHTML = list.map(entry => {
    const isNew = !!highlightEntry && entry.name === highlightEntry.name && entry.score === highlightEntry.score;
    return `<li class="${isNew ? 'is-new-record' : ''}"><span class="hs-name">${escapeHtml(entry.name)}</span><span class="hs-score">${entry.score.toLocaleString()}</span></li>`;
  }).join('');
}

function renderStats() {
  const stats = loadStats();
  bestComboValueEl.textContent = stats.bestCombo;
  maxLinesValueEl.textContent = stats.maxLines;
}

function renderAllHighScores(highlightEntry) {
  const list = loadHighScores();
  renderHighScoreList(highscoreListPanelEl, list, highlightEntry);
  renderHighScoreList(highscoreListOverlayEl, list, highlightEntry);
  renderStats();
}

function initHighScores() {
  renderAllHighScores();
}

function submitHighScore() {
  const rawName = playerNameInputEl.value.trim();
  const name = rawName ? rawName.slice(0, 12) : 'Jugador';
  const { entry } = addHighScore(name, score);
  highscoreEntryEl.classList.add('hidden');
  renderAllHighScores(entry);
}

saveScoreBtn.addEventListener('click', submitHighScore);
playerNameInputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitHighScore();
  }
});

resetHighscoresBtn.addEventListener('click', () => {
  const confirmed = confirm('¿Seguro que deseas borrar los récords guardados? Esta acción no se puede deshacer.');
  if (!confirmed) return;
  localStorage.removeItem(HIGHSCORES_STORAGE_KEY);
  localStorage.removeItem(STATS_STORAGE_KEY);
  renderAllHighScores();
});

powerupLegend.innerHTML = POWERUP_KINDS.map(kind => {
  const info = POWERUP_INFO[kind];
  return `<div class="powerup-item"><span class="pu-icon">${info.icon}</span><span><strong>${info.label}</strong> — ${info.desc}</span></div>`;
}).join('');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, gameOverRow;
let linesUntilPowerUp, pendingPowerUp, freezeUntil, activeMessage;
let combo, maxCombo;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerUpPiece() {
  const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
  return { type: 'powerup', powerUp: kind, shape: [[1]], x: Math.floor(COLS / 2), y: 0 };
}

function makeNextPiece() {
  if (pendingPowerUp) {
    pendingPowerUp = false;
    return randomPowerUpPiece();
  }
  return randomPiece();
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    linesUntilPowerUp -= cleared;
    if (linesUntilPowerUp <= 0) {
      linesUntilPowerUp += POWERUP_LINE_INTERVAL;
      pendingPowerUp = true;
    }
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.powerUp) {
    activatePowerUp(current.powerUp, current.x, current.y);
    // bomb/dye/freeze don't clear full lines themselves, so they break a combo;
    // lightning/gravity already run clearLines() internally, which manages combo.
    if (current.powerUp === 'bomb' || current.powerUp === 'dye' || current.powerUp === 'freeze') {
      combo = 0;
    }
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  next = makeNextPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function activatePowerUp(kind, x, y) {
  switch (kind) {
    case 'bomb': bombEffect(x, y); break;
    case 'lightning': lightningEffect(x, y); break;
    case 'dye': dyeEffect(); break;
    case 'gravity': gravityEffect(); break;
    case 'freeze': freezeEffect(); break;
  }
  showPowerUpBanner(kind);
  updateHUD();
}

function bombEffect(x, y) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = y + dr, nc = x + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (board[nr][nc]) {
        board[nr][nc] = 0;
        score += 15;
      }
    }
  }
}

function lightningEffect(x, y) {
  for (let c = 0; c < COLS; c++) board[y][c] = board[y][c] || 1;
  clearLines();
  for (let r = 0; r < ROWS; r++) board[r][x] = 0;
}

function dyeEffect() {
  const counts = new Array(COLORS.length).fill(0);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) counts[board[r][c]]++;
  let targetColor = 0, max = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > max) { max = counts[i]; targetColor = i; }
  }
  if (!targetColor) return;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === targetColor) board[r][c] = 0;
  compactColumns();
}

function gravityEffect() {
  compactColumns();
  clearLines();
}

function compactColumns() {
  for (let c = 0; c < COLS; c++) {
    const values = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) values.push(board[r][c]);
    }
    for (let r = 0; r < ROWS; r++) {
      const idx = r - (ROWS - values.length);
      board[r][c] = idx >= 0 ? values[idx] : 0;
    }
  }
}

function freezeEffect() {
  freezeUntil = performance.now() + 5000;
}

function showPowerUpBanner(kind) {
  const info = POWERUP_INFO[kind];
  activeMessage = { text: `${info.label} ${info.icon}`, until: performance.now() + 1200 };
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawPowerUpBlock(context, x, y, kind, size, alpha) {
  const info = POWERUP_INFO[kind];
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = info.color;
  context.shadowBlur = 12;
  context.fillStyle = info.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.font = `${size * 0.7}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(info.icon, x * size + size / 2, y * size + size / 2 + 1);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw(ts) {
  const now = ts ?? performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        if (current.powerUp) drawPowerUpBlock(ctx, current.x + c, gy + r, current.powerUp, BLOCK, 0.2);
        else drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
      }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        if (current.powerUp) drawPowerUpBlock(ctx, current.x + c, current.y + r, current.powerUp, BLOCK);
        else drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
      }

  // game over: highlight the top line in neon
  if (gameOver && gameOverRow != null) {
    ctx.save();
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, gameOverRow * BLOCK + 1, COLS * BLOCK - 2, BLOCK - 2);
    ctx.restore();
  }

  // freeze indicator
  if (now < freezeUntil) {
    const remaining = ((freezeUntil - now) / 1000).toFixed(1);
    ctx.save();
    ctx.fillStyle = '#81d4fa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`❄ ${remaining}s`, canvas.width - 8, 8);
    ctx.restore();
  }

  // power-up activation banner
  if (activeMessage && now < activeMessage.until) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 6;
    ctx.fillText(activeMessage.text, canvas.width / 2, 8);
    ctx.restore();
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        if (next.powerUp) drawPowerUpBlock(nextCtx, offX + c, offY + r, next.powerUp, NB);
        else drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
      }
}

function endGame() {
  gameOver = true;
  gameOverRow = 0;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  powerupLegend.classList.add('hidden');

  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveStats(stats);

  overlayHighscoresEl.classList.remove('hidden');
  if (qualifiesForHighScore(score)) {
    highscoreEntryEl.classList.remove('hidden');
    playerNameInputEl.value = '';
    renderAllHighScores();
    setTimeout(() => playerNameInputEl.focus(), 0);
  } else {
    highscoreEntryEl.classList.add('hidden');
    renderAllHighScores();
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    powerupLegend.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    powerupLegend.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (ts >= freezeUntil) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw(ts);
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  gameOverRow = null;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  linesUntilPowerUp = POWERUP_LINE_INTERVAL;
  pendingPowerUp = false;
  freezeUntil = 0;
  activeMessage = null;
  combo = 0;
  maxCombo = 0;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  powerupLegend.classList.add('hidden');
  highscoreEntryEl.classList.add('hidden');
  overlayHighscoresEl.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initHighScores();
init();
