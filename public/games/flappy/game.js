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
const GRAVITY = 0.35;
const FLAP_FORCE = -6.5;
const CHIP_X = 80;
const CHIP_W = 32;
const CHIP_H = 24;
const PIPE_W = 52;
const PIPE_GAP = 170;
const PIPE_SPEED = 2;
const PIPE_SPACING = 220;
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
  sparkParticles = [];
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
    // Reset submit button for new game over
    const submitBtn = document.getElementById("submit-score-btn");
    submitBtn.disabled = false;
    submitBtn.textContent = "SUBMIT SCORE";
    document.getElementById("submit-msg").textContent = "";
    LB.fetchLeaderboard(GAME_ID, "leaderboard");
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
  if (state === "playing") {
    chipVy = FLAP_FORCE;
  } else if (state === "dead" && overlayDead.classList.contains("hidden") === false) {
    startGame();
  }
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

// ─── Drawing: Pipes (Electrical Cables) ─────────────────────────
let sparkParticles = [];

function drawPipe(pipe) {
  const botY = pipe.topH + PIPE_GAP;
  const gy = H - GROUND_H;

  // Top cable
  drawPipeSegment(pipe.x, 0, pipe.topH, true);
  // Bottom cable
  drawPipeSegment(pipe.x, botY, gy - botY, false);

  // Spark arcs near the gap (only while playing)
  if (state === "playing" || state === "menu") {
    drawGapSparks(pipe.x, pipe.topH, botY);
  }
}

function drawPipeSegment(x, y, h, isTop) {
  if (h <= 0) return;

  // Cable body — dark metallic
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(x, y, PIPE_W, h);

  // Darker edges (cable sheath)
  ctx.fillStyle = "#1a1a1e";
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + PIPE_W - 4, y, 4, h);

  // Subtle metallic highlight
  ctx.fillStyle = "rgba(180,190,210,0.08)";
  ctx.fillRect(x + 6, y, 8, h);

  // Inner wire strands (colored cables inside)
  ctx.fillStyle = "#4a2020"; // red wire
  ctx.fillRect(x + 14, y, 5, h);
  ctx.fillStyle = "#1a1a50"; // blue wire
  ctx.fillRect(x + 22, y, 5, h);
  ctx.fillStyle = "#1a401a"; // green wire
  ctx.fillRect(x + 30, y, 5, h);

  // Wire strand highlights
  ctx.fillStyle = "rgba(255,100,100,0.15)";
  ctx.fillRect(x + 15, y, 2, h);
  ctx.fillStyle = "rgba(100,100,255,0.15)";
  ctx.fillRect(x + 23, y, 2, h);
  ctx.fillStyle = "rgba(100,255,100,0.12)";
  ctx.fillRect(x + 31, y, 2, h);

  // Cable ribs / bands every 20px
  ctx.fillStyle = "rgba(60,60,70,0.6)";
  const ribStart = isTop ? y : y;
  for (let ry = ribStart; ry < y + h; ry += 20) {
    ctx.fillRect(x, ry, PIPE_W, 3);
  }

  // Connector housing (replaces lip)
  const lipW = PIPE_W + 8;
  const lipH = 16;
  const lipX = x - 4;
  const lipY = isTop ? y + h - lipH : y;

  // Housing body — dark steel
  ctx.fillStyle = "#3a3a42";
  ctx.fillRect(lipX, lipY, lipW, lipH);
  // Housing edges
  ctx.fillStyle = "#222228";
  ctx.fillRect(lipX, lipY, 4, lipH);
  ctx.fillRect(lipX + lipW - 4, lipY, 4, lipH);
  // Top bevel
  ctx.fillStyle = "#555560";
  ctx.fillRect(lipX, lipY, lipW, 2);
  // Bottom bevel
  ctx.fillStyle = "#1a1a1e";
  ctx.fillRect(lipX, lipY + lipH - 2, lipW, 2);

  // Exposed copper contacts at the gap edge
  const copperY = isTop ? lipY + lipH - 5 : lipY + 1;
  ctx.fillStyle = "#b87333"; // copper
  ctx.fillRect(lipX + 8, copperY, 6, 4);
  ctx.fillRect(lipX + 18, copperY, 6, 4);
  ctx.fillRect(lipX + 28, copperY, 6, 4);
  ctx.fillRect(lipX + 38, copperY, 6, 4);
  // Copper shine
  ctx.fillStyle = "#d4956b";
  ctx.fillRect(lipX + 9, copperY, 3, 2);
  ctx.fillRect(lipX + 19, copperY, 3, 2);
  ctx.fillRect(lipX + 29, copperY, 3, 2);
  ctx.fillRect(lipX + 39, copperY, 3, 2);

  // Warning stripe on housing
  ctx.fillStyle = "rgba(255,200,0,0.25)";
  ctx.fillRect(lipX + lipW - 12, lipY + 4, 8, lipH - 8);

  // Metallic highlight on housing
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(lipX + 6, lipY, 8, lipH);
}

function drawGapSparks(pipeX, topH, botY) {
  const cx = pipeX + PIPE_W / 2;
  const gapMid = (topH + botY) / 2;

  // Only spark intermittently
  if (Math.random() < 0.35) {
    // Small electric arc from top connector to gap
    const arcX = pipeX + 4 + Math.random() * (PIPE_W - 8);
    const arcTopY = topH + Math.random() * 8;
    const arcBotY = botY - Math.random() * 8;

    // Random arc color
    const arcColors = ["#ffee77", "#ffffff", "#77bbff", "#aaeeff", "#ffdd44"];
    const col = arcColors[Math.floor(Math.random() * arcColors.length)];

    ctx.save();
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;

    // Top spark — small bolt from top connector
    if (Math.random() < 0.5) {
      ctx.fillStyle = col;
      const sw = 1 + Math.random() * 2;
      const sh = 3 + Math.random() * 8;
      ctx.fillRect(arcX, arcTopY - 2, sw, sh);
      // Branch
      if (Math.random() < 0.4) {
        ctx.fillRect(arcX + (Math.random() > 0.5 ? 2 : -2), arcTopY + sh * 0.5, sw, sh * 0.4);
      }
    }

    // Bottom spark — small bolt from bottom connector
    if (Math.random() < 0.5) {
      ctx.fillStyle = col;
      const sw = 1 + Math.random() * 2;
      const sh = 3 + Math.random() * 8;
      ctx.fillRect(arcX, arcBotY - sh + 2, sw, sh);
      // Branch
      if (Math.random() < 0.4) {
        ctx.fillRect(arcX + (Math.random() > 0.5 ? 2 : -2), arcBotY - sh * 0.8, sw, sh * 0.4);
      }
    }

    // Occasional bright cross-gap arc
    if (Math.random() < 0.08) {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.6 + Math.random() * 0.4;
      const zigX = pipeX + 10 + Math.random() * (PIPE_W - 20);
      const segments = 3 + Math.floor(Math.random() * 3);
      const segH = (botY - topH) / segments;
      let zx = zigX;
      for (let s = 0; s < segments; s++) {
        const zy = topH + s * segH;
        const nextX = zx + (Math.random() - 0.5) * 10;
        ctx.fillRect(Math.min(zx, nextX), zy, Math.abs(nextX - zx) + 1, segH + 1);
        zx = nextX;
      }
    }

    ctx.restore();
  }

  // Glow around gap edges
  ctx.save();
  const glowIntensity = 0.03 + Math.sin(frame * 0.2) * 0.02;
  ctx.fillStyle = `rgba(100,180,255,${glowIntensity})`;
  ctx.fillRect(pipeX - 2, topH - 2, PIPE_W + 4, 6);
  ctx.fillRect(pipeX - 2, botY - 4, PIPE_W + 4, 6);
  ctx.restore();

  // Spawn spark particles occasionally
  if (state === "playing" && Math.random() < 0.12) {
    const side = Math.random() < 0.5 ? topH : botY;
    sparkParticles.push({
      x: pipeX + Math.random() * PIPE_W,
      y: side + (side === topH ? 2 : -2),
      vx: (Math.random() - 0.5) * 3,
      vy: (side === topH ? 1 : -1) * (0.5 + Math.random() * 2),
      life: 8 + Math.random() * 12,
      color: ["#ffee77", "#ffffff", "#77bbff", "#ffdd44"][Math.floor(Math.random() * 4)],
      size: 1 + Math.random() * 2,
    });
  }
}

function updateSparkParticles() {
  for (let i = sparkParticles.length - 1; i >= 0; i--) {
    const p = sparkParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life--;
    if (p.life <= 0) sparkParticles.splice(i, 1);
  }
}

function drawSparkParticles() {
  for (const p of sparkParticles) {
    ctx.globalAlpha = Math.min(1, p.life / 10);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
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
  updateSparkParticles();
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
  drawSparkParticles();
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

// ─── Leaderboard (shared module) ─────────────────────────────────
const GAME_ID = "flappy";
const LB = window.Leaderboard;

const nameInput = document.getElementById("name-input");
const submitBtn = document.getElementById("submit-score-btn");
const submitMsgEl = document.getElementById("submit-msg");

const savedName = LB.getSavedName();
if (savedName) nameInput.value = savedName;

submitBtn.addEventListener("click", handleSubmit);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSubmit();
});

async function handleSubmit() {
  const name = nameInput.value.trim();
  if (!name) {
    submitMsgEl.textContent = "Enter your name first!";
    return;
  }
  if (score <= 0) {
    submitMsgEl.textContent = "Score too low to submit";
    return;
  }

  LB.setSavedName(name);
  submitBtn.disabled = true;
  submitBtn.textContent = "SUBMITTING...";
  submitMsgEl.textContent = "";

  try {
    const leaderboard = await LB.submitScore(GAME_ID, name, score);
    LB.renderLeaderboard(document.getElementById("leaderboard"), leaderboard);
    submitBtn.textContent = "SUBMITTED!";
  } catch {
    submitMsgEl.textContent = "Failed to submit. Try again.";
    submitBtn.textContent = "SUBMIT SCORE";
    submitBtn.disabled = false;
  }
}

LB.fetchLeaderboard(GAME_ID, "start-leaderboard");
loop();
