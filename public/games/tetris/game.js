// ─── TNTetris ────────────────────────────────────────────────────
// Classic Tetris with TNT blocks that explode on landing.

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");

// ─── Board Config ────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 28;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// ─── Pieces ──────────────────────────────────────────────────────
const PIECES = [
  { shape: [[1,1,1,1]], color: "#00f0f0" },           // I
  { shape: [[1,0,0],[1,1,1]], color: "#0000f0" },      // J
  { shape: [[0,0,1],[1,1,1]], color: "#f0a000" },      // L
  { shape: [[1,1],[1,1]], color: "#f0f000" },           // O
  { shape: [[0,1,1],[1,1,0]], color: "#00f000" },       // S
  { shape: [[0,1,0],[1,1,1]], color: "#a000f0" },       // T
  { shape: [[1,1,0],[0,1,1]], color: "#f00000" },       // Z
];

const TNT_COLOR = "#ff4400";
const TNT_ACCENT = "#ffaa00";
const EXPLOSION_RADIUS = 3; // cells in each direction

// ─── State ───────────────────────────────────────────────────────
let board = [];       // ROWS x COLS, 0 = empty, string = color
let current = null;   // { shape, color, x, y, isTNT }
let next = null;
let state = "menu";   // menu | playing | gameover
let score = 0;
let lines = 0;
let level = 1;
let dropTimer = 0;
let dropInterval = 800; // ms
let lastTime = 0;
let lockDelay = 0;
let explosions = [];  // [{x, y, radius, frame, maxFrames}]
let screenShake = 0;
let piecesPlaced = 0;

// TNT frequency: roughly 1 in 8 pieces, but not before piece 5
const TNT_CHANCE = 0.12;

// ─── UI refs ─────────────────────────────────────────────────────
const scoreEl = document.getElementById("score-val");
const levelEl = document.getElementById("level-val");
const linesEl = document.getElementById("lines-val");
const overlay = document.getElementById("overlay");
const overlayGO = document.getElementById("overlay-gameover");
const finalScoreEl = document.getElementById("final-score");
const tntWarning = document.getElementById("tnt-warning");

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);

function startGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  piecesPlaced = 0;
  explosions = [];
  screenShake = 0;
  state = "playing";
  overlay.classList.add("hidden");
  overlayGO.classList.add("hidden");
  next = randomPiece();
  spawnPiece();
  lastTime = performance.now();
  updateUI();
}

function gameOver() {
  state = "gameover";
  finalScoreEl.textContent = score;
  overlayGO.classList.remove("hidden");
}

// ─── Piece Generation ────────────────────────────────────────────
function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  const isTNT = piecesPlaced >= 5 && Math.random() < TNT_CHANCE;
  return {
    shape: p.shape.map((r) => [...r]),
    color: isTNT ? TNT_COLOR : p.color,
    isTNT,
  };
}

function spawnPiece() {
  current = next;
  current.x = Math.floor((COLS - current.shape[0].length) / 2);
  current.y = 0;
  next = randomPiece();
  piecesPlaced++;
  dropTimer = 0;
  lockDelay = 0;

  if (current.isTNT) {
    tntWarning.style.opacity = "1";
    setTimeout(() => (tntWarning.style.opacity = "0"), 600);
  }

  if (collides(current.shape, current.x, current.y)) {
    gameOver();
  }

  drawNext();
}

// ─── Collision ───────────────────────────────────────────────────
function collides(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const bx = ox + c;
      const by = oy + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

// ─── Rotation ────────────────────────────────────────────────────
function rotate(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c];
    }
  }
  return rotated;
}

function tryRotate() {
  if (!current) return;
  const rotated = rotate(current.shape);
  // Wall kicks: try 0, -1, +1, -2, +2
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

// ─── Movement ────────────────────────────────────────────────────
function moveLeft() {
  if (current && !collides(current.shape, current.x - 1, current.y)) {
    current.x--;
  }
}

function moveRight() {
  if (current && !collides(current.shape, current.x + 1, current.y)) {
    current.x++;
  }
}

function moveDown() {
  if (!current) return false;
  if (!collides(current.shape, current.x, current.y + 1)) {
    current.y++;
    dropTimer = 0;
    return true;
  }
  return false;
}

function hardDrop() {
  if (!current) return;
  while (!collides(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 2;
  }
  lockPiece();
}

// ─── Lock & Clear ────────────────────────────────────────────────
function lockPiece() {
  if (!current) return;
  const wasTNT = current.isTNT;

  // Place cells on board
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const bx = current.x + c;
      const by = current.y + r;
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
        board[by][bx] = current.color;
      }
    }
  }

  if (wasTNT) {
    triggerExplosion(current.x + Math.floor(current.shape[0].length / 2),
                     current.y + Math.floor(current.shape.length / 2));
  }

  // Clear completed lines
  clearLines();

  current = null;
  setTimeout(() => {
    if (state === "playing") spawnPiece();
  }, wasTNT ? 300 : 0);
}

function triggerExplosion(cx, cy) {
  screenShake = 12;
  explosions.push({
    x: cx * CELL + CELL / 2,
    y: cy * CELL + CELL / 2,
    radius: 0,
    maxRadius: EXPLOSION_RADIUS * CELL,
    frame: 0,
    maxFrames: 25,
  });

  // Destroy cells in radius
  let destroyed = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c]) continue;
      const dx = c - cx;
      const dy = r - cy;
      if (Math.abs(dx) <= EXPLOSION_RADIUS && Math.abs(dy) <= EXPLOSION_RADIUS) {
        board[r][c] = 0;
        destroyed++;
      }
    }
  }

  // Bonus score for destruction
  score += destroyed * 10;

  // Apply gravity after explosion (cells above fall down)
  applyGravity();
}

function applyGravity() {
  // For each column, compact non-empty cells to bottom
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c]) {
        board[writeRow][c] = board[r][c];
        if (writeRow !== r) board[r][c] = 0;
        writeRow--;
      }
    }
    // Clear remaining cells above
    for (let r = writeRow; r >= 0; r--) {
      board[r][c] = 0;
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((cell) => cell !== 0)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      r++; // re-check this row
    }
  }

  if (cleared > 0) {
    // Scoring: 100, 300, 500, 800
    const points = [0, 100, 300, 500, 800];
    score += (points[cleared] || 800) * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(80, 800 - (level - 1) * 70);
    updateUI();
  }
}

function updateUI() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

// ─── Input ───────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (state !== "playing") return;
  switch (e.key) {
    case "ArrowLeft": case "a": moveLeft(); break;
    case "ArrowRight": case "d": moveRight(); break;
    case "ArrowDown": case "s": moveDown(); score += 1; break;
    case "ArrowUp": case "w": tryRotate(); break;
    case " ": hardDrop(); break;
  }
  e.preventDefault();
});

// Touch controls
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const dt = Date.now() - touchStartTime;

  if (dt < 200 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
    tryRotate();
  } else if (Math.abs(dy) > 60 && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
    hardDrop();
  } else if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) moveLeft(); else moveRight();
  }
}, { passive: false });

// Mobile buttons
document.getElementById("btn-left").addEventListener("click", () => state === "playing" && moveLeft());
document.getElementById("btn-right").addEventListener("click", () => state === "playing" && moveRight());
document.getElementById("btn-down").addEventListener("click", () => { if (state === "playing") { moveDown(); score += 1; } });
document.getElementById("btn-rotate").addEventListener("click", () => state === "playing" && tryRotate());
document.getElementById("btn-drop").addEventListener("click", () => state === "playing" && hardDrop());

// ─── Drawing ─────────────────────────────────────────────────────
function drawCell(x, y, color, isTNT = false) {
  const px = x * CELL;
  const py = y * CELL;

  // Main fill
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

  // Highlight (top-left bevel)
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
  ctx.fillRect(px + 1, py + 1, 3, CELL - 2);

  // Shadow (bottom-right bevel)
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(px + 1, py + CELL - 4, CELL - 2, 3);
  ctx.fillRect(px + CELL - 4, py + 1, 3, CELL - 2);

  if (isTNT) {
    // TNT label
    ctx.fillStyle = TNT_ACCENT;
    ctx.font = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T", px + CELL / 2, py + CELL / 2);

    // Flashing border
    const flash = Math.sin(Date.now() * 0.008) * 0.4 + 0.6;
    ctx.strokeStyle = `rgba(255, 170, 0, ${flash})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
  }
}

function drawGhost() {
  if (!current) return;
  let ghostY = current.y;
  while (!collides(current.shape, current.x, ghostY + 1)) {
    ghostY++;
  }
  if (ghostY === current.y) return;

  ctx.globalAlpha = 0.2;
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const bx = current.x + c;
      const by = ghostY + r;
      if (by >= 0) {
        drawCell(bx, by, current.color, false);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBoard() {
  // Background
  ctx.fillStyle = "#0a0a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }

  // Board cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawCell(c, r, board[r][c], false);
      }
    }
  }
}

function drawCurrent() {
  if (!current) return;
  for (let r = 0; r < current.shape.length; r++) {
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const bx = current.x + c;
      const by = current.y + r;
      if (by >= 0) {
        drawCell(bx, by, current.color, current.isTNT);
      }
    }
  }
}

function drawNext() {
  nextCtx.fillStyle = "#0a0a1a";
  nextCtx.fillRect(0, 0, 80, 80);

  if (!next) return;
  const cellSz = 16;
  const shape = next.shape;
  const offX = Math.floor((80 - shape[0].length * cellSz) / 2);
  const offY = Math.floor((80 - shape.length * cellSz) / 2);

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const px = offX + c * cellSz;
      const py = offY + r * cellSz;
      nextCtx.fillStyle = next.color;
      nextCtx.fillRect(px + 1, py + 1, cellSz - 2, cellSz - 2);
      nextCtx.fillStyle = "rgba(255,255,255,0.2)";
      nextCtx.fillRect(px + 1, py + 1, cellSz - 2, 2);
      nextCtx.fillRect(px + 1, py + 1, 2, cellSz - 2);
      if (next.isTNT) {
        nextCtx.fillStyle = TNT_ACCENT;
        nextCtx.font = "bold 8px 'Courier New'";
        nextCtx.textAlign = "center";
        nextCtx.textBaseline = "middle";
        nextCtx.fillText("T", px + cellSz / 2, py + cellSz / 2);
      }
    }
  }
}

function drawExplosions() {
  for (const ex of explosions) {
    const progress = ex.frame / ex.maxFrames;
    const radius = ex.maxRadius * Math.min(progress * 2, 1);
    const alpha = 1 - progress;

    // Outer glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = "#ff4400";
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // White core
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Sparks
    ctx.fillStyle = "#ffdd00";
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + progress * 2;
      const dist = radius * (0.5 + Math.random() * 0.5);
      const sx = ex.x + Math.cos(angle) * dist;
      const sy = ex.y + Math.sin(angle) * dist;
      ctx.globalAlpha = alpha * Math.random();
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    ctx.restore();
  }
}

// ─── Game Loop ───────────────────────────────────────────────────
function update(time) {
  if (state !== "playing") return;

  const dt = time - lastTime;
  lastTime = time;

  dropTimer += dt;
  if (dropTimer >= dropInterval) {
    dropTimer = 0;
    if (!moveDown()) {
      lockDelay += dropInterval;
      if (lockDelay >= 500) {
        lockPiece();
        lockDelay = 0;
      }
    } else {
      lockDelay = 0;
    }
  }

  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].frame++;
    if (explosions[i].frame >= explosions[i].maxFrames) {
      explosions.splice(i, 1);
    }
  }

  // Screen shake decay
  if (screenShake > 0) screenShake *= 0.88;
  if (screenShake < 0.3) screenShake = 0;

  updateUI();
}

function draw() {
  ctx.save();

  if (screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
  }

  drawBoard();
  drawGhost();
  drawCurrent();
  drawExplosions();

  ctx.restore();
}

function loop(time) {
  update(time || 0);
  draw();
  requestAnimationFrame(loop);
}

loop();
