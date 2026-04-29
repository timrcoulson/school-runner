// ─── Slither N Spark ─────────────────────────────────────────────
// Snake game with wires, sparks, and a rising tide.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ─── Grid ────────────────────────────────────────────────────────
const COLS = 24;
const ROWS = 24;
const CELL = 20;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const container = document.getElementById("game-container");
container.style.width = canvas.width + "px";
container.style.height = canvas.height + "px";

// ─── State ───────────────────────────────────────────────────────
let state = "menu";
let wire = [];        // [{x, y}] head is wire[0]
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let sparks = [];      // food items [{x, y, type}]
let score = 0;
let frame = 0;
let moveTimer = 0;
let moveInterval = 8; // frames between moves (gets faster)
let tideLevel = 0;    // rows flooded from bottom
let tideTimer = 0;
let tideInterval = 600; // frames between tide rises
let tideWarningShown = false;
let particles = [];
let screenShake = 0;
let deathMsg = "";

// Spark types
const SPARK_TYPES = [
  { id: "yellow", color: "#ffdd44", glow: "#ffee88", points: 10, growth: 1 },
  { id: "blue", color: "#44aaff", glow: "#88ccff", points: 25, growth: 2 },
  { id: "red", color: "#ff4466", glow: "#ff8899", points: 50, growth: 3 },
];

// ─── UI ──────────────────────────────────────────────────────────
const hudLength = document.getElementById("hud-length");
const hudScore = document.getElementById("hud-score");
const overlay = document.getElementById("overlay");
const overlayDead = document.getElementById("overlay-dead");
const finalScoreEl = document.getElementById("final-score");
const deathMsgEl = document.getElementById("death-msg");
const tideWarning = document.getElementById("tide-warning");

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);

function startGame() {
  state = "playing";
  wire = [
    { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  sparks = [];
  score = 0;
  frame = 0;
  moveTimer = 0;
  moveInterval = 8;
  tideLevel = 0;
  tideTimer = 0;
  tideWarningShown = false;
  particles = [];
  screenShake = 0;
  overlay.classList.add("hidden");
  overlayDead.classList.add("hidden");
  spawnSpark();
  spawnSpark();
}

function die(msg) {
  state = "dead";
  deathMsg = msg;
  screenShake = 10;
  // Explosion at head
  const head = wire[0];
  for (let i = 0; i < 20; i++) {
    particles.push({
      x: head.x * CELL + CELL / 2,
      y: head.y * CELL + CELL / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 25 + Math.random() * 15,
      color: ["#ffdd44", "#ff4466", "#44aaff", "#fff"][Math.floor(Math.random() * 4)],
      size: 2 + Math.random() * 4,
    });
  }
  setTimeout(() => {
    finalScoreEl.textContent = score;
    deathMsgEl.textContent = deathMsg;
    overlayDead.classList.remove("hidden");
    const submitBtn = document.getElementById("submit-score-btn");
    submitBtn.disabled = false;
    submitBtn.textContent = "SUBMIT SCORE";
    document.getElementById("submit-msg").textContent = "";
    if (window.Leaderboard) window.Leaderboard.fetchLeaderboard("slither", "leaderboard");
  }, 600);
}

// ─── Spark Spawning ──────────────────────────────────────────────
function spawnSpark() {
  let attempts = 0;
  while (attempts < 100) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * (ROWS - tideLevel));
    if (wire.some((s) => s.x === x && s.y === y)) { attempts++; continue; }
    if (sparks.some((s) => s.x === x && s.y === y)) { attempts++; continue; }

    // Pick type — rarer = better
    const r = Math.random();
    const type = r < 0.6 ? SPARK_TYPES[0] : r < 0.85 ? SPARK_TYPES[1] : SPARK_TYPES[2];
    sparks.push({ x, y, type });
    return;
  }
}

// ─── Input ───────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (state !== "playing") return;
  switch (e.key) {
    case "ArrowUp": case "w": case "W":
      if (dir.y !== 1) nextDir = { x: 0, y: -1 };
      break;
    case "ArrowDown": case "s": case "S":
      if (dir.y !== -1) nextDir = { x: 0, y: 1 };
      break;
    case "ArrowLeft": case "a": case "A":
      if (dir.x !== 1) nextDir = { x: -1, y: 0 };
      break;
    case "ArrowRight": case "d": case "D":
      if (dir.x !== -1) nextDir = { x: 1, y: 0 };
      break;
  }
  e.preventDefault();
});

// Touch controls
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: false });
canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 20 && dir.x !== -1) nextDir = { x: 1, y: 0 };
    else if (dx < -20 && dir.x !== 1) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 20 && dir.y !== -1) nextDir = { x: 0, y: 1 };
    else if (dy < -20 && dir.y !== 1) nextDir = { x: 0, y: -1 };
  }
}, { passive: false });

// ─── Update ──────────────────────────────────────────────────────
function update() {
  if (state !== "playing") { updateParticles(); return; }
  frame++;

  // Tide
  tideTimer++;
  // Show warning before tide rises
  if (!tideWarningShown && tideTimer > tideInterval - 120) {
    tideWarning.style.opacity = "1";
    tideWarningShown = true;
  }
  if (tideTimer >= tideInterval) {
    tideTimer = 0;
    tideWarningShown = false;
    tideWarning.style.opacity = "0";
    if (tideLevel < ROWS - 4) {
      tideLevel++;
      // Tide gets faster over time
      tideInterval = Math.max(200, 600 - tideLevel * 25);
      // Remove sparks swallowed by tide
      sparks = sparks.filter((s) => s.y < ROWS - tideLevel);
      // Check if wire segments are in tide
      if (wire.some((s) => s.y >= ROWS - tideLevel)) {
        die("Your wire got submerged by the tide!");
        return;
      }
    }
  }

  // Move wire
  moveTimer++;
  if (moveTimer < moveInterval) return;
  moveTimer = 0;

  dir = nextDir;
  const head = wire[0];
  const nx = head.x + dir.x;
  const ny = head.y + dir.y;

  // Collision: walls
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS - tideLevel) {
    die(ny >= ROWS - tideLevel ? "Your wire touched the water!" : "Your wire hit the wall!");
    return;
  }
  // Collision: self
  if (wire.some((s) => s.x === nx && s.y === ny)) {
    die("Your wire short-circuited itself!");
    return;
  }

  // Move
  wire.unshift({ x: nx, y: ny });

  // Check sparks
  let ate = false;
  for (let i = sparks.length - 1; i >= 0; i--) {
    if (sparks[i].x === nx && sparks[i].y === ny) {
      const spark = sparks[i];
      score += spark.type.points;
      // Grow by type amount (don't pop tail)
      for (let g = 1; g < spark.type.growth; g++) {
        wire.push({ ...wire[wire.length - 1] });
      }
      // Eat particles
      for (let j = 0; j < 8; j++) {
        particles.push({
          x: nx * CELL + CELL / 2,
          y: ny * CELL + CELL / 2,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 15 + Math.random() * 10,
          color: spark.type.glow,
          size: 2 + Math.random() * 3,
        });
      }
      sparks.splice(i, 1);
      ate = true;
      // Speed up slightly
      moveInterval = Math.max(3, moveInterval - 0.15);
      break;
    }
  }

  if (!ate) {
    wire.pop(); // normal move — remove tail
  }

  // Ensure there are always sparks
  while (sparks.length < 2) spawnSpark();
  if (sparks.length < 3 && Math.random() < 0.02) spawnSpark();

  updateParticles();
  hudLength.textContent = wire.length;
  hudScore.textContent = score;
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (screenShake > 0) { screenShake *= 0.88; if (screenShake < 0.3) screenShake = 0; }
}

// ─── Drawing ─────────────────────────────────────────────────────
function drawGrid() {
  // PCB-style background
  ctx.fillStyle = "#0a1a12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // PCB traces
  ctx.strokeStyle = "#0f2a1a";
  ctx.lineWidth = 1;
  for (let c = 0; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(canvas.width, r * CELL);
    ctx.stroke();
  }

  // Solder pads at intersections
  ctx.fillStyle = "#152a1c";
  for (let r = 0; r < ROWS; r += 3) {
    for (let c = 0; c < COLS; c += 3) {
      ctx.beginPath();
      ctx.arc(c * CELL, r * CELL, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Random circuit traces for decoration
  ctx.strokeStyle = "#0f2f1f";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const sx = ((i * 73 + 17) % COLS) * CELL;
    const sy = ((i * 37 + 11) % ROWS) * CELL;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + CELL * 2, sy);
    ctx.lineTo(sx + CELL * 2, sy + CELL);
    ctx.stroke();
  }
}

function drawTide() {
  if (tideLevel <= 0) return;
  const tideY = (ROWS - tideLevel) * CELL;
  const waveOffset = Math.sin(frame * 0.04) * 3;

  // Deep water
  ctx.fillStyle = "rgba(20,60,120,0.85)";
  ctx.fillRect(0, tideY + 6, canvas.width, canvas.height - tideY);

  // Wave surface
  ctx.fillStyle = "rgba(40,100,180,0.7)";
  ctx.beginPath();
  ctx.moveTo(0, tideY + 4);
  for (let x = 0; x <= canvas.width; x += 8) {
    const wave = Math.sin(x * 0.03 + frame * 0.06) * 3 + waveOffset;
    ctx.lineTo(x, tideY + wave);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.fill();

  // Foam
  ctx.fillStyle = "rgba(180,220,255,0.3)";
  for (let x = 0; x < canvas.width; x += 12) {
    const wave = Math.sin(x * 0.03 + frame * 0.06) * 3 + waveOffset;
    ctx.fillRect(x, tideY + wave - 2, 6, 2);
  }

  // Shimmer
  ctx.fillStyle = "rgba(200,240,255,0.1)";
  for (let x = 0; x < canvas.width; x += 20) {
    const sy = tideY + 10 + Math.sin(x * 0.1 + frame * 0.03) * 4;
    ctx.fillRect(x, sy, 8, 1);
  }

  // Danger zone indicator (1 row above tide)
  if (tideLevel > 0) {
    const dangerY = (ROWS - tideLevel - 1) * CELL;
    const flash = Math.sin(frame * 0.08) * 0.1 + 0.1;
    ctx.fillStyle = `rgba(255,80,80,${flash})`;
    ctx.fillRect(0, dangerY, canvas.width, CELL);
  }
}

function drawWire() {
  if (wire.length === 0) return;

  for (let i = wire.length - 1; i >= 0; i--) {
    const seg = wire[i];
    const x = seg.x * CELL;
    const y = seg.y * CELL;
    const isHead = i === 0;
    const t = i / wire.length; // 0 = head, 1 = tail

    // Cable sheath
    const brightness = Math.floor(30 + (1 - t) * 30);
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness + 10})`;
    ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);

    // Inner copper
    ctx.fillStyle = `rgb(${140 + Math.floor((1-t) * 40)},${80 + Math.floor((1-t) * 30)},${30})`;
    ctx.fillRect(x + 5, y + 5, CELL - 10, CELL - 10);

    // Connection to next segment (fill gaps)
    if (i < wire.length - 1) {
      const next = wire[i + 1];
      const dx = seg.x - next.x, dy = seg.y - next.y;
      if (dx === 1) { ctx.fillStyle = `rgb(${brightness},${brightness},${brightness+10})`; ctx.fillRect(x - 2, y + 2, 4, CELL - 4); ctx.fillStyle = `rgb(${140 + Math.floor((1-t)*40)},${80 + Math.floor((1-t)*30)},30)`; ctx.fillRect(x - 1, y + 5, 6, CELL - 10); }
      if (dx === -1) { ctx.fillStyle = `rgb(${brightness},${brightness},${brightness+10})`; ctx.fillRect(x + CELL - 2, y + 2, 4, CELL - 4); ctx.fillStyle = `rgb(${140 + Math.floor((1-t)*40)},${80 + Math.floor((1-t)*30)},30)`; ctx.fillRect(x + CELL - 5, y + 5, 6, CELL - 10); }
      if (dy === 1) { ctx.fillStyle = `rgb(${brightness},${brightness},${brightness+10})`; ctx.fillRect(x + 2, y - 2, CELL - 4, 4); ctx.fillStyle = `rgb(${140 + Math.floor((1-t)*40)},${80 + Math.floor((1-t)*30)},30)`; ctx.fillRect(x + 5, y - 1, CELL - 10, 6); }
      if (dy === -1) { ctx.fillStyle = `rgb(${brightness},${brightness},${brightness+10})`; ctx.fillRect(x + 2, y + CELL - 2, CELL - 4, 4); ctx.fillStyle = `rgb(${140 + Math.floor((1-t)*40)},${80 + Math.floor((1-t)*30)},30)`; ctx.fillRect(x + 5, y + CELL - 5, CELL - 10, 6); }
    }

    if (isHead) {
      // Bright head with spark effect
      ctx.fillStyle = "#ffdd44";
      ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);

      // Spark glow
      const glow = 0.3 + Math.sin(frame * 0.15) * 0.15;
      ctx.fillStyle = `rgba(255,238,100,${glow})`;
      ctx.beginPath();
      ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator (tiny spark)
      const sx = x + CELL / 2 + dir.x * 6;
      const sy = y + CELL / 2 + dir.y * 6;
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }

    // Electrical shimmer along wire
    if (!isHead && frame % 3 === 0 && Math.random() < 0.08) {
      ctx.fillStyle = "rgba(255,238,100,0.5)";
      ctx.fillRect(x + 6, y + 6, 3, 3);
    }
  }
}

function drawSparks() {
  for (const spark of sparks) {
    const x = spark.x * CELL + CELL / 2;
    const y = spark.y * CELL + CELL / 2;
    const t = frame;

    // Outer glow
    const glowR = 8 + Math.sin(t * 0.1) * 2;
    ctx.fillStyle = spark.type.glow + "33";
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = spark.type.color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bright center
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mini lightning bolts around it
    ctx.strokeStyle = spark.type.color;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + t * 0.05;
      const r1 = 5, r2 = 8 + Math.sin(t * 0.12 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * r1, y + Math.sin(angle) * r1);
      ctx.lineTo(
        x + Math.cos(angle + 0.3) * (r1 + r2) / 2,
        y + Math.sin(angle + 0.3) * (r1 + r2) / 2
      );
      ctx.lineTo(x + Math.cos(angle) * r2, y + Math.sin(angle) * r2);
      ctx.stroke();
    }

    // Points label for non-basic sparks
    if (spark.type.id !== "yellow") {
      ctx.fillStyle = spark.type.color;
      ctx.font = "bold 7px 'Courier New'";
      ctx.textAlign = "center";
      ctx.fillText(`+${spark.type.points}`, x, y - 10);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 15);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ─── Main Draw ───────────────────────────────────────────────────
function draw() {
  ctx.save();
  if (screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
  }

  drawGrid();
  drawSparks();
  drawWire();
  drawTide();
  drawParticles();

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── Leaderboard ─────────────────────────────────────────────────
const GAME_ID = "slither";
const LB = window.Leaderboard;
const nameInput = document.getElementById("name-input");
const submitBtn = document.getElementById("submit-score-btn");
const submitMsgEl = document.getElementById("submit-msg");
const savedName = LB.getSavedName();
if (savedName) nameInput.value = savedName;

submitBtn.addEventListener("click", handleSubmit);
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSubmit(); });

async function handleSubmit() {
  const name = nameInput.value.trim();
  if (!name) { submitMsgEl.textContent = "Enter your name first!"; return; }
  if (score <= 0) { submitMsgEl.textContent = "Score too low"; return; }
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
