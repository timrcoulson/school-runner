// ─── Flappy Microchip ────────────────────────────────────────────

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ─── Sizing ──────────────────────────────────────────────────────
const W = 360;
const H = 640;

function resize() {
  const maxH = window.innerHeight - 32;
  const maxW = window.innerWidth - 32;
  const scale = Math.min(maxW / W, maxH / H, 2);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  const container = document.getElementById("game-container");
  container.style.width = `${W * scale}px`;
  container.style.height = `${H * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// ─── Constants ───────────────────────────────────────────────────
const GRAVITY = 0.45;
const FLAP_FORCE = -7.5;
const CHIP_X = 80;
const CHIP_W = 32;
const CHIP_H = 24;
const PIPE_W = 52;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.5;
const PIPE_SPACING = 200; // horizontal distance between pipes
const GROUND_H = 60;

// ─── State ───────────────────────────────────────────────────────
let state = "menu"; // menu | playing | dead
let chipY = H / 2;
let chipVy = 0;
let chipAngle = 0;
let pipes = [];
let score = 0;
let hiScore = parseInt(localStorage.getItem("flappyHi") || "0", 10);
let frame = 0;
let groundOffset = 0;
let screenShake = 0;
let particles = [];
let lastPipeX = 0;

// ─── UI ──────────────────────────────────────────────────────────
const overlay = document.getElementById("overlay");
const overlayDead = document.getElementById("overlay-dead");
const finalScoreEl = document.getElementById("final-score");

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);

function startGame() {
  state = "playing";
  chipY = H / 2.5;
  chipVy = 0;
  chipAngle = 0;
  pipes = [];
  score = 0;
  frame = 0;
  screenShake = 0;
  particles = [];
  groundOffset = 0;
  lastPipeX = W + 100;
  overlay.classList.add("hidden");
  overlayDead.classList.add("hidden");
  // Spawn initial pipes
  for (let i = 0; i < 3; i++) {
    spawnPipe(lastPipeX + i * PIPE_SPACING);
  }
}

function die() {
  if (state === "dead") return;
  state = "dead";
  screenShake = 12;
  // Sparks
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: CHIP_X + CHIP_W / 2,
      y: chipY,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 30 + Math.random() * 20,
      color: ["#ffdd57", "#e94560", "#00f0f0", "#fff"][Math.floor(Math.random() * 4)],
      size: 2 + Math.random() * 3,
    });
  }
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem("flappyHi", hiScore.toString());
  }
  setTimeout(() => {
    finalScoreEl.textContent = score;
    overlayDead.classList.remove("hidden");
  }, 500);
}

// ─── Pipes ───────────────────────────────────────────────────────
function spawnPipe(x) {
  const minTop = 80;
  const maxTop = H - GROUND_H - PIPE_GAP - 80;
  const topH = minTop + Math.random() * (maxTop - minTop);
  pipes.push({
    x,
    topH,
    scored: false,
  });
  lastPipeX = x;
}

// ─── Input ───────────────────────────────────────────────────────
function flap() {
  if (state !== "playing") return;
  chipVy = FLAP_FORCE;
}

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowUp") {
    e.preventDefault();
    flap();
  }
});
canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  flap();
}, { passive: false });

// ─── Drawing: Background ─────────────────────────────────────────
function drawBg() {
  // Sky
  const grad = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
  grad.addColorStop(0, "#4a90d9");
  grad.addColorStop(0.5, "#87CEEB");
  grad.addColorStop(1, "#B8E6FF");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H - GROUND_H);

  // Clouds (parallax)
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  const co = (frame * 0.3) % (W + 120);
  drawCloud(co - 60, 80, 0.8);
  drawCloud((co + 200) % (W + 120) - 60, 130, 0.5);
  drawCloud((co + 350) % (W + 120) - 60, 60, 0.6);

  // Distant city silhouette
  ctx.fillStyle = "#3a7a5a";
  const cityBase = H - GROUND_H;
  for (let x = 0; x < W; x += 30) {
    const bh = 20 + Math.sin(x * 0.1) * 15 + Math.sin(x * 0.23) * 10;
    ctx.fillRect(x, cityBase - bh, 22, bh);
  }
}

function drawCloud(cx, cy, s) {
  ctx.fillRect(cx, cy, 40 * s, 12 * s);
  ctx.fillRect(cx + 8 * s, cy - 6 * s, 20 * s, 8 * s);
  ctx.fillRect(cx - 4 * s, cy + 2 * s, 14 * s, 8 * s);
  ctx.fillRect(cx + 26 * s, cy + 2 * s, 14 * s, 8 * s);
}

// ─── Drawing: Ground ─────────────────────────────────────────────
function drawGround() {
  const gy = H - GROUND_H;
  // Dirt
  ctx.fillStyle = "#8B7355";
  ctx.fillRect(0, gy, W, GROUND_H);
  // Grass strip
  ctx.fillStyle = "#4a8a4a";
  ctx.fillRect(0, gy, W, 8);
  ctx.fillStyle = "#3a7a3a";
  ctx.fillRect(0, gy + 4, W, 4);
  // Ground pattern
  ctx.fillStyle = "#7a6345";
  for (let x = -groundOffset % 24; x < W; x += 24) {
    ctx.fillRect(x, gy + 16, 12, 3);
    ctx.fillRect(x + 12, gy + 30, 10, 3);
  }
}

// ─── Drawing: Pipes ──────────────────────────────────────────────
function drawPipe(pipe) {
  const botY = pipe.topH + PIPE_GAP;
  const gy = H - GROUND_H;

  // Top pipe
  drawPipeSegment(pipe.x, 0, pipe.topH, true);
  // Bottom pipe
  drawPipeSegment(pipe.x, botY, gy - botY, false);
}

function drawPipeSegment(x, y, h, isTop) {
  if (h <= 0) return;
  // Pipe body
  ctx.fillStyle = "#3CB043";
  ctx.fillRect(x, y, PIPE_W, h);
  // Darker edge
  ctx.fillStyle = "#2D8B36";
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + PIPE_W - 4, y, 4, h);
  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x + 6, y, 8, h);

  // Lip
  const lipW = PIPE_W + 8;
  const lipH = 16;
  const lipX = x - 4;
  const lipY = isTop ? y + h - lipH : y;
  ctx.fillStyle = "#3CB043";
  ctx.fillRect(lipX, lipY, lipW, lipH);
  ctx.fillStyle = "#2D8B36";
  ctx.fillRect(lipX, lipY, 4, lipH);
  ctx.fillRect(lipX + lipW - 4, lipY, 4, lipH);
  ctx.fillStyle = "#4DD85A";
  ctx.fillRect(lipX, lipY, lipW, 3);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(lipX + 6, lipY, 8, lipH);
}

// ─── Drawing: Microchip ──────────────────────────────────────────
function drawChip() {
  ctx.save();
  ctx.translate(CHIP_X + CHIP_W / 2, chipY);
  ctx.rotate(chipAngle);

  const hw = CHIP_W / 2;
  const hh = CHIP_H / 2;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(-hw + 3, -hh + 3, CHIP_W, CHIP_H);

  // Chip body (dark green PCB)
  ctx.fillStyle = "#1a3a2a";
  ctx.fillRect(-hw, -hh, CHIP_W, CHIP_H);

  // Chip die (silver center)
  ctx.fillStyle = "#aabbcc";
  ctx.fillRect(-hw + 6, -hh + 4, CHIP_W - 12, CHIP_H - 8);

  // Circuit traces
  ctx.fillStyle = "#3a6a4a";
  ctx.fillRect(-hw + 8, -hh + 6, 4, CHIP_H - 12);
  ctx.fillRect(-hw + 14, -hh + 6, 3, CHIP_H - 12);
  ctx.fillRect(-hw + 19, -hh + 8, 6, 2);
  ctx.fillRect(-hw + 8, -hh + 10, 8, 2);

  // Pins (left & right sides)
  ctx.fillStyle = "#ccc";
  for (let i = 0; i < 4; i++) {
    const py = -hh + 3 + i * 5;
    ctx.fillRect(-hw - 4, py, 5, 3); // left pins
    ctx.fillRect(hw - 1, py, 5, 3);  // right pins
  }

  // Indicator dot
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(-hw + 3, -hh + 2, 3, 3);

  // Small text on chip
  ctx.fillStyle = "#5a8a6a";
  ctx.fillRect(-hw + 20, -hh + 14, 6, 2);
  ctx.fillRect(-hw + 20, -hh + 18, 4, 2);

  // Wing flap effect
  const flapAnim = Math.sin(frame * 0.3) * 4;
  ctx.fillStyle = "rgba(100,200,255,0.4)";
  ctx.fillRect(-hw - 2, -hh - 4 + flapAnim, 8, 3);
  ctx.fillRect(hw - 6, -hh - 4 - flapAnim, 8, 3);

  ctx.restore();
}

// ─── Drawing: Score ──────────────────────────────────────────────
function drawScore() {
  if (state !== "playing") return;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px 'Courier New'";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(score, W / 2, 30);
  ctx.restore();
}

// ─── Particles ───────────────────────────────────────────────────
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 50;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ─── Collision ───────────────────────────────────────────────────
function checkCollision() {
  const gy = H - GROUND_H;

  // Ground / ceiling
  if (chipY + CHIP_H / 2 >= gy || chipY - CHIP_H / 2 <= 0) {
    return true;
  }

  // Pipes
  for (const pipe of pipes) {
    const botY = pipe.topH + PIPE_GAP;
    const chipLeft = CHIP_X;
    const chipRight = CHIP_X + CHIP_W;
    const chipTop = chipY - CHIP_H / 2;
    const chipBot = chipY + CHIP_H / 2;
    const pipeLeft = pipe.x - 4; // account for lip
    const pipeRight = pipe.x + PIPE_W + 4;

    if (chipRight > pipeLeft && chipLeft < pipeRight) {
      // In pipe column — check gap
      if (chipTop < pipe.topH || chipBot > botY) {
        return true;
      }
    }
  }

  return false;
}

// ─── Update ──────────────────────────────────────────────────────
function update() {
  frame++;

  if (state === "playing") {
    // Physics
    chipVy += GRAVITY;
    chipY += chipVy;

    // Angle based on velocity
    const targetAngle = Math.max(-0.5, Math.min(chipVy * 0.06, 1.2));
    chipAngle += (targetAngle - chipAngle) * 0.15;

    // Move pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= PIPE_SPEED;

      // Score
      if (!pipes[i].scored && pipes[i].x + PIPE_W < CHIP_X) {
        pipes[i].scored = true;
        score++;
      }

      // Remove off-screen
      if (pipes[i].x + PIPE_W + 8 < 0) {
        pipes.splice(i, 1);
      }
    }

    // Spawn new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPACING) {
      spawnPipe(W + 20);
    }

    // Ground scroll
    groundOffset = (groundOffset + PIPE_SPEED) % 24;

    // Collision
    if (checkCollision()) {
      die();
    }
  }

  // Dead: chip falls
  if (state === "dead") {
    chipVy += GRAVITY;
    chipY += chipVy;
    const gy = H - GROUND_H;
    if (chipY + CHIP_H / 2 > gy) {
      chipY = gy - CHIP_H / 2;
      chipVy = 0;
    }
    chipAngle = Math.min(chipAngle + 0.05, 1.5);
  }

  // Screen shake
  if (screenShake > 0) {
    screenShake *= 0.85;
    if (screenShake < 0.3) screenShake = 0;
  }

  updateParticles();
}

// ─── Draw ────────────────────────────────────────────────────────
function draw() {
  ctx.save();

  if (screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
  }

  drawBg();

  for (const pipe of pipes) {
    drawPipe(pipe);
  }

  drawGround();
  drawChip();
  drawParticles();
  drawScore();

  ctx.restore();
}

// ─── Loop ────────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
