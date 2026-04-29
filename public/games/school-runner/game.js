// ─── School Runner — 3D Perspective ──────────────────────────────
// Over-the-shoulder 3-lane runner with vanishing-point perspective.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ─── Sizing ──────────────────────────────────────────────────────
const GAME_W = 400;
const GAME_H = 700;
let scale = 1;

function resize() {
  const maxH = window.innerHeight - 32;
  const maxW = window.innerWidth - 32;
  scale = Math.min(maxW / GAME_W, maxH / GAME_H, 2);
  canvas.width = GAME_W;
  canvas.height = GAME_H;
  canvas.style.width = `${GAME_W * scale}px`;
  canvas.style.height = `${GAME_H * scale}px`;
  const container = document.getElementById("game-container");
  container.style.width = `${GAME_W * scale}px`;
  container.style.height = `${GAME_H * scale}px`;
}
window.addEventListener("resize", resize);
resize();

// ─── Perspective Constants ───────────────────────────────────────
// Vanishing point
const VP_X = GAME_W / 2;
const VP_Y = 200; // horizon line
// Road at bottom of screen
const ROAD_BOTTOM = GAME_H;
// Road width at bottom
const ROAD_W_BOTTOM = 360;
// Road width at horizon
const ROAD_W_TOP = 20;
// Player position (screen Y)
const PLAYER_SCREEN_Y = GAME_H - 130;
// How far along the road the player sits (0 = horizon, 1 = bottom)
const PLAYER_DEPTH = 0.82;

// Map a "depth" (0=horizon, 1=bottom) to screen coordinates
function projectToScreen(laneOffset, depth) {
  // laneOffset: -1 (left lane), 0 (center), 1 (right lane)
  const t = depth;
  const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
  const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
  const centerX = VP_X;
  const laneW = roadW / 3;
  const screenX = centerX + laneOffset * laneW;
  const objScale = t; // 0 at horizon, 1 at bottom
  return { x: screenX, y: screenY, scale: objScale, roadW, laneW };
}

// ─── Game Constants ──────────────────────────────────────────────
const LANE_SWITCH_LERP = 0.18;

// ─── Obstacle Types ──────────────────────────────────────────────
const OBSTACLE_TYPES = [
  {
    name: "Dog Poo",
    deathMsg: "You stepped in dog poo! Gross!",
    draw(ctx, x, y, s, frame) {
      const sz = s;
      // Poo pile
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(x - 12 * sz, y - 4 * sz, 24 * sz, 10 * sz);
      ctx.fillStyle = "#7B5236";
      ctx.fillRect(x - 9 * sz, y - 10 * sz, 18 * sz, 8 * sz);
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(x - 5 * sz, y - 16 * sz, 10 * sz, 8 * sz);
      ctx.fillStyle = "#7B5236";
      ctx.fillRect(x - 3 * sz, y - 19 * sz, 6 * sz, 5 * sz);
      // Stink lines
      if (sz > 0.3) {
        ctx.strokeStyle = "#8B8";
        ctx.lineWidth = Math.max(1, sz);
        for (let i = -1; i <= 1; i++) {
          const wave = Math.sin(Date.now() / 300 + i) * 2 * sz;
          ctx.beginPath();
          ctx.moveTo(x + i * 6 * sz, y - 19 * sz);
          ctx.lineTo(x + i * 6 * sz + wave, y - 28 * sz);
          ctx.stroke();
        }
      }
    },
  },
  {
    name: "Tree",
    deathMsg: "You ran straight into a tree!",
    draw(ctx, x, y, s) {
      const sz = s;
      // Trunk
      ctx.fillStyle = "#8B6B3D";
      ctx.fillRect(x - 5 * sz, y - 30 * sz, 10 * sz, 34 * sz);
      ctx.fillStyle = "#9B7B4D";
      ctx.fillRect(x - 3 * sz, y - 28 * sz, 6 * sz, 30 * sz);
      // Foliage
      ctx.fillStyle = "#2D7B2D";
      ctx.fillRect(x - 18 * sz, y - 44 * sz, 36 * sz, 18 * sz);
      ctx.fillStyle = "#3D8B3D";
      ctx.fillRect(x - 14 * sz, y - 56 * sz, 28 * sz, 16 * sz);
      ctx.fillStyle = "#2D7B2D";
      ctx.fillRect(x - 10 * sz, y - 64 * sz, 20 * sz, 12 * sz);
      ctx.fillStyle = "#4D9B4D";
      ctx.fillRect(x - 6 * sz, y - 68 * sz, 12 * sz, 8 * sz);
    },
  },
  {
    name: "Water Gun Kid",
    deathMsg: "Soaked by a water gun! Your homework is ruined!",
    draw(ctx, x, y, s, frame) {
      const sz = s;
      const bob = Math.sin((frame || 0) * 0.1) * sz;
      // Legs
      ctx.fillStyle = "#3344aa";
      ctx.fillRect(x - 6 * sz, y - 2 * sz + bob, 5 * sz, 12 * sz);
      ctx.fillRect(x + 1 * sz, y - 2 * sz + bob, 5 * sz, 12 * sz);
      // Body
      ctx.fillStyle = "#44aaff";
      ctx.fillRect(x - 8 * sz, y - 20 * sz + bob, 16 * sz, 20 * sz);
      // Head
      ctx.fillStyle = "#ffcc99";
      ctx.fillRect(x - 6 * sz, y - 32 * sz + bob, 12 * sz, 13 * sz);
      // Hat
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(x - 8 * sz, y - 37 * sz + bob, 16 * sz, 6 * sz);
      ctx.fillRect(x - 12 * sz, y - 34 * sz + bob, 6 * sz, 3 * sz);
      // Evil eyes
      ctx.fillStyle = "#222";
      ctx.fillRect(x - 4 * sz, y - 28 * sz + bob, 3 * sz, 3 * sz);
      ctx.fillRect(x + 1 * sz, y - 28 * sz + bob, 3 * sz, 3 * sz);
      // Grin
      ctx.fillStyle = "#cc4444";
      ctx.fillRect(x - 3 * sz, y - 23 * sz + bob, 6 * sz, 2 * sz);
      // Water gun
      ctx.fillStyle = "#ffdd00";
      ctx.fillRect(x + 8 * sz, y - 18 * sz + bob, 18 * sz, 6 * sz);
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(x + 24 * sz, y - 17 * sz + bob, 6 * sz, 4 * sz);
      // Water spray
      if (sz > 0.25) {
        ctx.fillStyle = "rgba(100,180,255,0.6)";
        for (let i = 0; i < 5; i++) {
          const sx = x + (30 + i * 4) * sz + Math.sin(Date.now() / 100) * 2 * sz;
          const sy = y - 16 * sz + Math.sin(Date.now() / 150 + i) * 4 * sz;
          ctx.fillRect(sx, sy, 3 * sz, 3 * sz);
        }
      }
    },
  },
  {
    name: "Puddle",
    deathMsg: "Slipped on a puddle! Books everywhere!",
    draw(ctx, x, y, s) {
      const sz = s;
      ctx.fillStyle = "rgba(80,140,200,0.7)";
      ctx.beginPath();
      ctx.ellipse(x, y, 24 * sz, 8 * sz, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(200,230,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(x - 6 * sz, y - 2 * sz, 10 * sz, 3 * sz, -0.3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    name: "Skateboard",
    deathMsg: "Tripped over a rogue skateboard!",
    draw(ctx, x, y, s) {
      const sz = s;
      ctx.fillStyle = "#cc6622";
      ctx.fillRect(x - 18 * sz, y - 4 * sz, 36 * sz, 7 * sz);
      ctx.fillStyle = "#444";
      ctx.fillRect(x - 16 * sz, y - 3 * sz, 32 * sz, 2 * sz);
      ctx.fillStyle = "#888";
      ctx.fillRect(x - 13 * sz, y + 3 * sz, 7 * sz, 6 * sz);
      ctx.fillRect(x + 6 * sz, y + 3 * sz, 7 * sz, 6 * sz);
    },
  },
  {
    name: "Angry Cat",
    deathMsg: "An angry cat attacked your shoelaces!",
    draw(ctx, x, y, s, frame) {
      const sz = s;
      const f = frame || 0;
      const pounce = Math.abs(Math.sin(f * 0.08)) * 3 * sz;
      // Body
      ctx.fillStyle = "#ff8833";
      ctx.fillRect(x - 10 * sz, y - 10 * sz - pounce, 20 * sz, 14 * sz);
      // Stripes
      ctx.fillStyle = "#cc6611";
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(x + i * 6 * sz, y - 8 * sz - pounce, 3 * sz, 10 * sz);
      }
      // Head
      ctx.fillStyle = "#ff8833";
      ctx.fillRect(x - 8 * sz, y - 20 * sz - pounce, 16 * sz, 12 * sz);
      // Ears
      ctx.fillRect(x - 8 * sz, y - 25 * sz - pounce, 5 * sz, 6 * sz);
      ctx.fillRect(x + 3 * sz, y - 25 * sz - pounce, 5 * sz, 6 * sz);
      // Angry eyes
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(x - 5 * sz, y - 16 * sz - pounce, 4 * sz, 3 * sz);
      ctx.fillRect(x + 1 * sz, y - 16 * sz - pounce, 4 * sz, 3 * sz);
      ctx.fillStyle = "#222";
      ctx.fillRect(x - 4 * sz, y - 15 * sz - pounce, 2 * sz, 2 * sz);
      ctx.fillRect(x + 2 * sz, y - 15 * sz - pounce, 2 * sz, 2 * sz);
      // Tail
      ctx.fillStyle = "#ff8833";
      ctx.fillRect(x + 10 * sz, y - 8 * sz - pounce, 4 * sz, 3 * sz);
      ctx.fillRect(x + 13 * sz, y - 14 * sz - pounce, 3 * sz, 8 * sz);
    },
  },
  {
    name: "Bin Bag",
    deathMsg: "Crashed into someone's bin bags! Stinky!",
    draw(ctx, x, y, s) {
      const sz = s;
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 14 * sz, y - 24 * sz, 28 * sz, 28 * sz);
      ctx.fillStyle = "#444";
      ctx.fillRect(x - 12 * sz, y - 22 * sz, 24 * sz, 24 * sz);
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 4 * sz, y - 30 * sz, 8 * sz, 8 * sz);
      ctx.fillStyle = "#555";
      ctx.fillRect(x - 2 * sz, y - 32 * sz, 4 * sz, 4 * sz);
      ctx.fillStyle = "#555";
      ctx.fillRect(x - 8 * sz, y - 18 * sz, 3 * sz, 10 * sz);
      ctx.fillStyle = "#8B8";
      ctx.fillRect(x + 10 * sz, y + 2 * sz, 6 * sz, 4 * sz);
    },
  },
];

// ─── Speed Curve ─────────────────────────────────────────────────
// Starts slow, gets faster and faster. Speed = depth units per frame.
const SPEED_START = 0.005;    // gentle walking pace
const SPEED_MAX = 0.028;      // absolute chaos
const SPEED_RAMP = 0.0000035; // per frame acceleration

function getSpeed(f) {
  return Math.min(SPEED_START + f * SPEED_RAMP, SPEED_MAX);
}

function getSpawnInterval(f) {
  // Starts at 90 frames between spawns, drops to 18 minimum
  return Math.max(18, 90 - f * 0.012);
}

// ─── Game State ──────────────────────────────────────────────────
let state = "start";
let score = 0;
let hiScore = parseInt(localStorage.getItem("schoolRunnerHi") || "0", 10);
let frame = 0;
let speed = SPEED_START;
let spawnTimer = 0;
let spawnInterval = 90;
let obstacles = [];
let particles = [];
let roadMarkingOffset = 0;
let deathMessage = "";
let screenShake = 0;
let comboTimer = 0;
let nearMissStreak = 0;

let player = {
  lane: 0, // -1, 0, 1
  laneSmooth: 0, // smooth interpolation
  bobFrame: 0,
};

// ─── Biome System ────────────────────────────────────────────────
const BIOMES = [
  {
    name: "Edinburgh",
    sky: ["#6a7a9a", "#8a9aba", "#b0c0d0"],    // grey Scottish sky
    ground: ["#5a7a5a", "#4a6a4a", "#3a5a3a"],
    road: "#555566",
    sidewalk: "#aa9988",
    banner: "EDINBURGH",
  },
  {
    name: "Forest",
    sky: ["#4a80a0", "#6aaa80", "#8ac8a0"],
    ground: ["#2a6a2a", "#1a5a1a", "#0a4a0a"],
    road: "#4a4a3a",
    sidewalk: "#776655",
    banner: "CORSTORPHINE WOODS",
  },
  {
    name: "Loch",
    sky: ["#5a8ab0", "#7aaaca", "#a0cce0"],
    ground: ["#3a6a5a", "#2a5a4a", "#1a4a3a"],
    road: "#555560",
    sidewalk: "#887766",
    banner: "LOCHSIDE PATH",
  },
  {
    name: "Village",
    sky: ["#7090c0", "#90b0d8", "#c0d8f0"],
    ground: ["#6a9a5a", "#5a8a4a", "#4a7a3a"],
    road: "#666666",
    sidewalk: "#bbaa99",
    banner: "CRAMOND VILLAGE",
  },
];

let currentBiome = 0;
let nextBiome = 1;
let biomeTransition = 0; // 0 = fully current, 1 = fully next
let biomeTimer = 0;
const BIOME_DURATION = 800;  // frames per biome
const BIOME_FADE = 120;       // frames to transition

function getBiomeColor(prop) {
  const curr = BIOMES[currentBiome];
  const next = BIOMES[nextBiome];
  const t = biomeTransition;
  if (typeof curr[prop] === "string") {
    return t < 0.5 ? curr[prop] : next[prop];
  }
  // Interpolate arrays (gradient stops)
  return curr[prop].map((c, i) => lerpColor(c, next[prop][i], t));
}

function lerpColor(a, b, t) {
  const pa = parseColor(a), pb = parseColor(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseColor(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

let biomeBannerTimer = 0;

// Scenery items (buildings, trees, etc)
let sceneryItems = [];

function initScenery() {
  sceneryItems = [];
  for (let i = 0; i < 24; i++) {
    sceneryItems.push(makeSceneryItem(Math.random()));
  }
}

function makeSceneryItem(depth) {
  const side = Math.random() > 0.5 ? -1 : 1;
  const biome = BIOMES[currentBiome].name;
  let type;
  if (biome === "Edinburgh") {
    const r = Math.random();
    if (r < 0.35) type = "tenement";
    else if (r < 0.55) type = "spire";
    else if (r < 0.7) type = "lamppost";
    else if (r < 0.85) type = "bush";
    else type = "tree";
  } else if (biome === "Forest") {
    type = Math.random() < 0.7 ? "pine" : Math.random() < 0.5 ? "tree" : "fern";
  } else if (biome === "Loch") {
    const r = Math.random();
    if (r < 0.3) type = "reed";
    else if (r < 0.5) type = "rock";
    else if (r < 0.7) type = "tree";
    else type = "bush";
  } else {
    const r = Math.random();
    if (r < 0.3) type = "cottage";
    else if (r < 0.5) type = "fence";
    else if (r < 0.75) type = "tree";
    else type = "bush";
  }
  return {
    depth,
    side,
    offset: 1.6 + Math.random() * 1.0,
    type,
    height: 0.6 + Math.random() * 0.6, // variation
    colorSeed: Math.random(),
  };
}

// ─── UI ──────────────────────────────────────────────────────────
const scoreDisplay = document.getElementById("score-display");
const hiScoreDisplay = document.getElementById("hi-score");
const speedDisplay = document.getElementById("speed-display");
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const finalScoreEl = document.getElementById("final-score");
const deathMsgEl = document.getElementById("death-message");

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);

function startGame() {
  state = "playing";
  score = 0;
  speed = SPEED_START;
  frame = 0;
  spawnTimer = 0;
  spawnInterval = 90;
  obstacles = [];
  particles = [];
  roadMarkingOffset = 0;
  screenShake = 0;
  nearMissStreak = 0;
  comboTimer = 0;
  player = { lane: 0, laneSmooth: 0, bobFrame: 0 };
  currentBiome = 0;
  nextBiome = 1;
  biomeTransition = 0;
  biomeTimer = 0;
  biomeBannerTimer = 80;
  initScenery();
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  hiScoreDisplay.textContent = `HI: ${hiScore}`;
}

function die(obstacle) {
  state = "dead";
  deathMessage = obstacle.deathMsg;
  screenShake = 15;
  // Particles
  const proj = projectToScreen(player.laneSmooth, PLAYER_DEPTH);
  for (let i = 0; i < 25; i++) {
    particles.push({
      x: proj.x,
      y: proj.y,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 8 - 2,
      life: 40 + Math.random() * 20,
      color: ["#e94560", "#ffdd57", "#fff", "#ff6b6b"][Math.floor(Math.random() * 4)],
      size: 2 + Math.random() * 5,
    });
  }
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem("schoolRunnerHi", hiScore.toString());
  }
  setTimeout(() => {
    finalScoreEl.textContent = score;
    deathMsgEl.textContent = deathMessage;
    gameOverScreen.classList.remove("hidden");
    fetchLeaderboard("leaderboard");
  }, 600);
}

// ─── Leaderboard ─────────────────────────────────────────────────
let savedName = localStorage.getItem("schoolRunnerName") || "";
const nameInput = document.getElementById("name-input");
const submitBtn = document.getElementById("submit-score-btn");
const submitMsg = document.getElementById("submit-msg");

if (savedName) nameInput.value = savedName;

submitBtn.addEventListener("click", submitScore);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitScore();
});

async function fetchLeaderboard(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div class="lb-loading">Loading...</div>';
  try {
    const res = await fetch("/api/scores");
    if (!res.ok) throw new Error("Failed");
    const { leaderboard } = await res.json();
    renderLeaderboard(container, leaderboard);
  } catch {
    container.innerHTML = '<div class="lb-loading">Leaderboard unavailable</div>';
  }
}

function renderLeaderboard(container, entries) {
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="lb-loading">No scores yet. Be the first!</div>';
    return;
  }
  let html = '<div class="lb-title">LEADERBOARD</div>';
  entries.forEach((entry, i) => {
    // Strip the ::timestamp suffix from the name
    const name = entry.name.split("::")[0];
    html += `<div class="lb-row">
      <span class="lb-rank">${i + 1}.</span>
      <span class="lb-name">${escapeHtml(name)}</span>
      <span class="lb-score">${entry.score}</span>
    </div>`;
  });
  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function submitScore() {
  const name = nameInput.value.trim();
  if (!name) {
    submitMsg.textContent = "Enter your name first!";
    return;
  }
  if (score <= 0) {
    submitMsg.textContent = "Score too low to submit";
    return;
  }

  localStorage.setItem("schoolRunnerName", name);
  savedName = name;
  submitBtn.disabled = true;
  submitBtn.textContent = "SUBMITTING...";
  submitMsg.textContent = "";

  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score }),
    });
    if (!res.ok) throw new Error("Failed");
    const { leaderboard } = await res.json();
    renderLeaderboard(document.getElementById("leaderboard"), leaderboard);
    submitBtn.textContent = "SUBMITTED!";
    submitMsg.textContent = "";
  } catch {
    submitMsg.textContent = "Failed to submit. Try again.";
    submitBtn.textContent = "SUBMIT SCORE";
    submitBtn.disabled = false;
  }
}

// ─── Input ───────────────────────────────────────────────────────
let touchStartX = 0;

function moveLeft() {
  if (player.lane > -1) player.lane--;
}
function moveRight() {
  if (player.lane < 1) player.lane++;
}

document.addEventListener("keydown", (e) => {
  if (state !== "playing") return;
  if (e.key === "ArrowLeft" || e.key === "a") moveLeft();
  if (e.key === "ArrowRight" || e.key === "d") moveRight();
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  touchStartX = e.touches[0].clientX;
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (state !== "playing") return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 30) {
    if (dx < 0) moveLeft(); else moveRight();
  }
}, { passive: false });

canvas.addEventListener("click", (e) => {
  if (state !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < rect.width / 2) moveLeft(); else moveRight();
});

// ─── Spawn ───────────────────────────────────────────────────────
function spawnObstacle() {
  const lanes = [-1, 0, 1];
  const lane = lanes[Math.floor(Math.random() * 3)];
  const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  obstacles.push({
    lane,
    depth: 0, // starts at horizon
    type,
    deathMsg: type.deathMsg,
    passed: false,
  });
}

// ─── Drawing: Sky & Ground ───────────────────────────────────────
function drawSky() {
  const skyColors = getBiomeColor("sky");
  const grad = ctx.createLinearGradient(0, 0, 0, VP_Y + 40);
  grad.addColorStop(0, skyColors[0]);
  grad.addColorStop(0.6, skyColors[1]);
  grad.addColorStop(1, skyColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_W, VP_Y + 40);

  // Clouds
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  const cloudOffset = (frame * 0.3) % (GAME_W + 200);
  drawCloud(cloudOffset - 100, VP_Y - 120, 1);
  drawCloud((cloudOffset + 250) % (GAME_W + 200) - 100, VP_Y - 80, 0.7);
  drawCloud((cloudOffset + 450) % (GAME_W + 200) - 100, VP_Y - 140, 0.5);

  // Edinburgh: castle silhouette on horizon
  const biome = BIOMES[currentBiome].name;
  if (biome === "Edinburgh" && biomeTransition < 0.5) {
    ctx.fillStyle = "rgba(60,50,70,0.4)";
    // Castle rock
    ctx.beginPath();
    ctx.moveTo(40, VP_Y + 8);
    ctx.lineTo(60, VP_Y - 20);
    ctx.lineTo(80, VP_Y - 25);
    ctx.lineTo(100, VP_Y - 30);
    ctx.lineTo(110, VP_Y - 22);
    ctx.lineTo(115, VP_Y - 32);
    ctx.lineTo(125, VP_Y - 28);
    ctx.lineTo(140, VP_Y + 8);
    ctx.fill();
    // Distant spires
    ctx.fillRect(200, VP_Y - 18, 3, 20);
    ctx.fillRect(260, VP_Y - 14, 2, 16);
    ctx.fillRect(310, VP_Y - 20, 3, 22);
    // Calton Hill
    ctx.beginPath();
    ctx.moveTo(280, VP_Y + 8);
    ctx.lineTo(300, VP_Y - 10);
    ctx.lineTo(340, VP_Y - 8);
    ctx.lineTo(360, VP_Y + 8);
    ctx.fill();
    ctx.fillRect(312, VP_Y - 16, 8, 10);
    ctx.fillRect(314, VP_Y - 20, 4, 6);
  }

  // Distant hills / terrain
  const groundColors = getBiomeColor("ground");
  ctx.fillStyle = groundColors[0];
  ctx.beginPath();
  ctx.moveTo(0, VP_Y + 10);
  for (let x = 0; x <= GAME_W; x += 15) {
    const hillH = biome === "Loch" ? 8 : biome === "Forest" ? 18 : 12;
    ctx.lineTo(x, VP_Y + 10 - Math.sin(x * 0.015 + frame * 0.0003) * hillH - Math.sin(x * 0.008) * 8);
  }
  ctx.lineTo(GAME_W, VP_Y + 40);
  ctx.lineTo(0, VP_Y + 40);
  ctx.fill();

  // Loch: water shimmer on horizon
  if (biome === "Loch" && biomeTransition < 0.5) {
    ctx.fillStyle = "rgba(80,140,180,0.35)";
    ctx.fillRect(0, VP_Y + 2, GAME_W, 8);
    ctx.fillStyle = "rgba(200,230,255,0.15)";
    for (let x = 0; x < GAME_W; x += 12) {
      const shimmer = Math.sin(x * 0.3 + frame * 0.05) * 2;
      ctx.fillRect(x, VP_Y + 4 + shimmer, 6, 1);
    }
  }
}

function drawCloud(cx, cy, s) {
  ctx.fillRect(cx, cy, 40 * s, 14 * s);
  ctx.fillRect(cx + 8 * s, cy - 8 * s, 24 * s, 10 * s);
  ctx.fillRect(cx - 6 * s, cy + 2 * s, 16 * s, 10 * s);
  ctx.fillRect(cx + 28 * s, cy + 2 * s, 16 * s, 10 * s);
}

function drawGround() {
  const groundColors = getBiomeColor("ground");
  const grad = ctx.createLinearGradient(0, VP_Y, 0, GAME_H);
  grad.addColorStop(0, groundColors[0]);
  grad.addColorStop(0.3, groundColors[1]);
  grad.addColorStop(1, groundColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, VP_Y, GAME_W, GAME_H - VP_Y);
}

function drawBiomeBanner() {
  if (biomeBannerTimer > 0) {
    const alpha = biomeBannerTimer > 40 ? 1 : biomeBannerTimer / 40;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px 'Courier New'";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText(BIOMES[currentBiome].banner, GAME_W / 2, 70);
    ctx.restore();
  }
}

// ─── Drawing: Road with Perspective ──────────────────────────────
function drawRoad() {
  // Draw road as a filled trapezoid
  const topLeft = VP_X - ROAD_W_TOP / 2;
  const topRight = VP_X + ROAD_W_TOP / 2;
  const botLeft = VP_X - ROAD_W_BOTTOM / 2;
  const botRight = VP_X + ROAD_W_BOTTOM / 2;

  // Road surface
  ctx.fillStyle = getBiomeColor("road");
  ctx.beginPath();
  ctx.moveTo(topLeft, VP_Y);
  ctx.lineTo(topRight, VP_Y);
  ctx.lineTo(botRight, ROAD_BOTTOM);
  ctx.lineTo(botLeft, ROAD_BOTTOM);
  ctx.fill();

  // Sidewalks
  drawSidewalk(-1);
  drawSidewalk(1);

  // Road edge lines (yellow)
  ctx.strokeStyle = "#ffdd57";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topLeft, VP_Y);
  ctx.lineTo(botLeft, ROAD_BOTTOM);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(topRight, VP_Y);
  ctx.lineTo(botRight, ROAD_BOTTOM);
  ctx.stroke();

  // Lane dividers (dashed, perspective)
  drawLaneDashes();

  // Grass detail stripes near road
  drawGrassStripes();
}

function drawSidewalk(side) {
  // side: -1 = left, 1 = right
  const segments = 30;
  ctx.fillStyle = getBiomeColor("sidewalk");
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
    const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
    const sidewalkW = 6 + 14 * t;
    const edgeX = VP_X + (side * roadW) / 2;
    const outerX = edgeX + side * sidewalkW;
    if (i === 0) {
      ctx.moveTo(edgeX, screenY);
    }
    ctx.lineTo(outerX, screenY);
  }
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
    const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
    const edgeX = VP_X + (side * roadW) / 2;
    ctx.lineTo(edgeX, screenY);
  }
  ctx.fill();

  // Sidewalk cross-lines — only draw close enough to see
  ctx.lineWidth = 1;
  const markSpacing = 0.08;
  const markStart = (roadMarkingOffset % markSpacing);
  for (let d = markStart; d < 1; d += markSpacing) {
    if (d < 0.2) continue;
    const t = d;
    const fade = t < 0.4 ? (t - 0.2) / 0.2 : 1;
    ctx.strokeStyle = `rgba(136,119,102,${fade * 0.6})`;
    const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
    const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
    const sidewalkW = 6 + 14 * t;
    const edgeX = VP_X + (side * roadW) / 2;
    const outerX = edgeX + side * sidewalkW;
    ctx.beginPath();
    ctx.moveTo(edgeX, screenY);
    ctx.lineTo(outerX, screenY);
    ctx.stroke();
  }
}

function drawLaneDashes() {
  ctx.lineWidth = 1.5;

  for (const laneDiv of [-1 / 3, 1 / 3]) {
    const dashSpacing = 0.06;
    const dashLen = 0.025;
    const offset = (roadMarkingOffset % dashSpacing);

    for (let d = offset; d < 1; d += dashSpacing) {
      if (d < 0.15) continue;
      const t1 = d;
      const t2 = Math.min(d + dashLen, 1);
      const fade = t1 < 0.35 ? (t1 - 0.15) / 0.2 : 1;

      ctx.strokeStyle = `rgba(255,255,255,${fade * 0.35})`;

      const y1 = VP_Y + (ROAD_BOTTOM - VP_Y) * t1;
      const y2 = VP_Y + (ROAD_BOTTOM - VP_Y) * t2;
      const roadW1 = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t1;
      const roadW2 = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t2;
      const x1 = VP_X + laneDiv * roadW1 * 0.5;
      const x2 = VP_X + laneDiv * roadW2 * 0.5;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

function drawGrassStripes() {
  const groundColors = getBiomeColor("ground");
  ctx.fillStyle = groundColors[1];
  const stripeSpacing = 0.09;
  const offset = (roadMarkingOffset) % stripeSpacing;
  for (let d = offset; d < 1; d += stripeSpacing) {
    if (d < 0.2) continue;
    const t = d;
    const fade = t < 0.4 ? (t - 0.2) / 0.2 : 1;
    ctx.globalAlpha = fade * 0.25;
    const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
    const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
    const sw = 6 + 14 * t;
    const h = 1 + 2 * t;
    ctx.fillRect(0, screenY, VP_X - roadW / 2 - sw, h);
    ctx.fillRect(VP_X + roadW / 2 + sw, screenY, GAME_W, h);
  }
  ctx.globalAlpha = 1;
}

// ─── Drawing: Scenery (biome-aware) ──────────────────────────────
function drawSceneryItem(item) {
  const t = item.depth;
  if (t < 0.12 || t > 1.05) return;
  const screenY = VP_Y + (ROAD_BOTTOM - VP_Y) * t;
  const roadW = ROAD_W_TOP + (ROAD_W_BOTTOM - ROAD_W_TOP) * t;
  const screenX = VP_X + item.side * (roadW / 2) * item.offset;
  const sz = t * 1.6;
  const x = screenX, y = screenY;
  const h = item.height;

  switch (item.type) {
    case "tree":
      ctx.fillStyle = "#8B6B3D";
      ctx.fillRect(x - 3*sz, y - 20*sz, 6*sz, 24*sz);
      ctx.fillStyle = "#2D7B2D";
      ctx.fillRect(x - 12*sz, y - 32*sz, 24*sz, 14*sz);
      ctx.fillStyle = "#3D8B3D";
      ctx.fillRect(x - 9*sz, y - 42*sz, 18*sz, 14*sz);
      ctx.fillStyle = "#2D7B2D";
      ctx.fillRect(x - 5*sz, y - 48*sz, 10*sz, 8*sz);
      break;

    case "bush":
      ctx.fillStyle = "#3D8B3D";
      ctx.fillRect(x - 10*sz, y - 8*sz, 20*sz, 12*sz);
      ctx.fillStyle = "#2D7B2D";
      ctx.fillRect(x - 7*sz, y - 14*sz, 14*sz, 8*sz);
      break;

    case "tenement": {
      // Edinburgh sandstone tenement
      const bw = 28 * sz * h;
      const bh = 50 * sz * h;
      const warm = item.colorSeed > 0.5;
      ctx.fillStyle = warm ? "#c4a872" : "#b8a070"; // sandstone
      ctx.fillRect(x - bw/2, y - bh, bw, bh);
      // Darker base
      ctx.fillStyle = warm ? "#a08858" : "#988060";
      ctx.fillRect(x - bw/2, y - bh * 0.2, bw, bh * 0.2);
      // Windows (rows)
      ctx.fillStyle = "#3a3a5a";
      const winW = 4 * sz, winH = 5 * sz, winGap = 7 * sz;
      for (let row = 0; row < 3; row++) {
        for (let col = -1; col <= 1; col++) {
          ctx.fillRect(x + col * winGap - winW/2, y - bh + 8*sz + row * (winH + 4*sz), winW, winH);
          // Window reflection
          ctx.fillStyle = "rgba(180,200,220,0.3)";
          ctx.fillRect(x + col * winGap - winW/2, y - bh + 8*sz + row * (winH + 4*sz), winW/2, winH/2);
          ctx.fillStyle = "#3a3a5a";
        }
      }
      // Door
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(x - 3*sz, y - 10*sz, 6*sz, 10*sz);
      // Roof line
      ctx.fillStyle = "#555";
      ctx.fillRect(x - bw/2 - 1*sz, y - bh - 2*sz, bw + 2*sz, 3*sz);
      // Chimney
      ctx.fillStyle = "#887766";
      ctx.fillRect(x + bw/4, y - bh - 10*sz, 4*sz, 10*sz);
      break;
    }

    case "spire": {
      // Church/monument spire
      const sw = 10 * sz;
      const sh = 60 * sz * h;
      ctx.fillStyle = "#777";
      ctx.fillRect(x - sw/2, y - sh, sw, sh);
      // Spire point
      ctx.fillStyle = "#666";
      ctx.beginPath();
      ctx.moveTo(x, y - sh - 15*sz);
      ctx.lineTo(x - sw/2, y - sh);
      ctx.lineTo(x + sw/2, y - sh);
      ctx.fill();
      // Clock face
      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.arc(x, y - sh * 0.6, 3*sz, 0, Math.PI*2);
      ctx.fill();
      // Base building
      ctx.fillStyle = "#999";
      ctx.fillRect(x - sw, y - sh * 0.3, sw * 2, sh * 0.3);
      break;
    }

    case "lamppost": {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - 1*sz, y - 30*sz, 2*sz, 30*sz);
      ctx.fillRect(x - 4*sz, y - 32*sz, 8*sz, 3*sz);
      // Lamp glow
      ctx.fillStyle = "rgba(255,220,100,0.25)";
      ctx.beginPath();
      ctx.arc(x, y - 33*sz, 6*sz, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = "#ffdd66";
      ctx.fillRect(x - 2*sz, y - 34*sz, 4*sz, 3*sz);
      break;
    }

    case "pine": {
      // Tall pine tree
      ctx.fillStyle = "#5a3a1a";
      ctx.fillRect(x - 2*sz, y - 15*sz, 4*sz, 20*sz);
      ctx.fillStyle = "#1a5a2a";
      // Triangle layers
      for (let i = 0; i < 4; i++) {
        const lw = (12 - i*2) * sz;
        const ly = y - 18*sz - i * 10*sz;
        ctx.fillRect(x - lw/2, ly, lw, 12*sz);
      }
      ctx.fillStyle = "#0a4a1a";
      for (let i = 0; i < 3; i++) {
        const lw = (10 - i*2) * sz;
        const ly = y - 22*sz - i * 10*sz;
        ctx.fillRect(x - lw/2, ly, lw, 6*sz);
      }
      break;
    }

    case "fern": {
      ctx.fillStyle = "#2a7a2a";
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x + i*3*sz - 1*sz, y - 6*sz - Math.abs(i)*2*sz, 2*sz, (8 + Math.abs(i)*2)*sz);
      }
      ctx.fillStyle = "#1a6a1a";
      ctx.fillRect(x - 4*sz, y - 4*sz, 8*sz, 6*sz);
      break;
    }

    case "reed": {
      ctx.strokeStyle = "#5a8a3a";
      ctx.lineWidth = Math.max(1, 1.5*sz);
      for (let i = -2; i <= 2; i++) {
        const sway = Math.sin(frame * 0.02 + i + item.colorSeed * 10) * 2 * sz;
        ctx.beginPath();
        ctx.moveTo(x + i*3*sz, y);
        ctx.lineTo(x + i*3*sz + sway, y - (12 + Math.random()*4)*sz);
        ctx.stroke();
      }
      break;
    }

    case "rock": {
      ctx.fillStyle = "#7a7a7a";
      ctx.fillRect(x - 8*sz, y - 5*sz, 16*sz, 8*sz);
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(x - 6*sz, y - 8*sz, 12*sz, 5*sz);
      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(x - 4*sz, y - 4*sz, 4*sz, 3*sz);
      break;
    }

    case "cottage": {
      const cw = 22*sz*h;
      const ch = 20*sz*h;
      // Walls
      ctx.fillStyle = "#e8dcc8";
      ctx.fillRect(x - cw/2, y - ch, cw, ch);
      // Roof
      ctx.fillStyle = "#8B4513";
      ctx.beginPath();
      ctx.moveTo(x, y - ch - 10*sz);
      ctx.lineTo(x - cw/2 - 3*sz, y - ch);
      ctx.lineTo(x + cw/2 + 3*sz, y - ch);
      ctx.fill();
      // Window
      ctx.fillStyle = "#5577aa";
      ctx.fillRect(x - 4*sz, y - ch + 4*sz, 4*sz, 5*sz);
      ctx.fillRect(x + 1*sz, y - ch + 4*sz, 4*sz, 5*sz);
      // Door
      ctx.fillStyle = "#6a3a1a";
      ctx.fillRect(x - 2*sz, y - 8*sz, 5*sz, 8*sz);
      // Chimney
      ctx.fillStyle = "#888";
      ctx.fillRect(x + cw/4, y - ch - 14*sz, 4*sz, 8*sz);
      break;
    }

    case "fence": {
      ctx.fillStyle = "#aa9070";
      // Posts
      ctx.fillRect(x - 8*sz, y - 10*sz, 2*sz, 12*sz);
      ctx.fillRect(x + 6*sz, y - 10*sz, 2*sz, 12*sz);
      // Rails
      ctx.fillRect(x - 8*sz, y - 9*sz, 16*sz, 2*sz);
      ctx.fillRect(x - 8*sz, y - 4*sz, 16*sz, 2*sz);
      break;
    }
  }
}

// ─── Drawing: Player (from behind, with backpack) ────────────────
function drawPlayer() {
  const proj = projectToScreen(player.laneSmooth, PLAYER_DEPTH);
  const x = proj.x;
  const y = proj.y;
  const s = proj.scale * 1.4; // slightly bigger for visibility
  const bob = Math.sin(player.bobFrame * 0.15) * 2 * s;
  const armSwing = Math.sin(player.bobFrame * 0.2) * 6 * s;
  const legSwing = Math.sin(player.bobFrame * 0.2) * 5 * s;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * s, 16 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = "#3344aa";
  ctx.fillRect(x - 8 * s, y - 10 * s + bob, 6 * s, 16 * s);
  ctx.fillRect(x + 2 * s, y - 10 * s + bob, 6 * s, 16 * s);

  // Shoes
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 9 * s, y + 4 * s + bob + legSwing, 8 * s, 4 * s);
  ctx.fillRect(x + 1 * s, y + 4 * s + bob - legSwing, 8 * s, 4 * s);

  // Body (shirt - seen from behind)
  ctx.fillStyle = "#ee4444";
  ctx.fillRect(x - 12 * s, y - 30 * s + bob, 24 * s, 22 * s);

  // Arms
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x - 16 * s, y - 26 * s + bob + armSwing, 6 * s, 16 * s);
  ctx.fillRect(x + 10 * s, y - 26 * s + bob - armSwing, 6 * s, 16 * s);

  // Backpack (prominent from behind!)
  ctx.fillStyle = "#e94560";
  ctx.fillRect(x - 10 * s, y - 34 * s + bob, 20 * s, 22 * s);
  // Backpack pocket
  ctx.fillStyle = "#cc3350";
  ctx.fillRect(x - 7 * s, y - 20 * s + bob, 14 * s, 10 * s);
  // Backpack straps
  ctx.fillStyle = "#cc3350";
  ctx.fillRect(x - 10 * s, y - 34 * s + bob, 4 * s, 16 * s);
  ctx.fillRect(x + 6 * s, y - 34 * s + bob, 4 * s, 16 * s);
  // Zip
  ctx.fillStyle = "#ffdd57";
  ctx.fillRect(x - 1 * s, y - 28 * s + bob, 2 * s, 6 * s);
  // Keychain dangling
  ctx.fillStyle = "#ffdd57";
  ctx.fillRect(x + 8 * s, y - 12 * s + bob + Math.sin(player.bobFrame * 0.3) * 2 * s, 3 * s, 3 * s);

  // Head (back of head)
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x - 8 * s, y - 46 * s + bob, 16 * s, 14 * s);

  // Hair (back)
  ctx.fillStyle = "#553311";
  ctx.fillRect(x - 9 * s, y - 48 * s + bob, 18 * s, 10 * s);
  ctx.fillRect(x - 7 * s, y - 50 * s + bob, 14 * s, 4 * s);

  // Ears
  ctx.fillStyle = "#ffbb88";
  ctx.fillRect(x - 10 * s, y - 42 * s + bob, 3 * s, 6 * s);
  ctx.fillRect(x + 7 * s, y - 42 * s + bob, 3 * s, 6 * s);
}

// ─── Drawing: Obstacles in 3D ────────────────────────────────────
function drawObstacle(obs) {
  const proj = projectToScreen(obs.lane, obs.depth);
  if (obs.depth < 0.01) return; // too far away
  obs.type.draw(ctx, proj.x, proj.y, proj.scale, frame);
}

// ─── Combo Text ──────────────────────────────────────────────────
function drawCombo() {
  if (comboTimer > 0) {
    const proj = projectToScreen(player.laneSmooth, PLAYER_DEPTH);
    ctx.save();
    ctx.globalAlpha = comboTimer / 30;
    ctx.fillStyle = "#ffdd57";
    ctx.font = `bold ${14 + nearMissStreak * 2}px 'Courier New'`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    const text = nearMissStreak > 1 ? `CLOSE! x${nearMissStreak}` : "CLOSE!";
    ctx.fillText(text, proj.x, proj.y - 70 * proj.scale - (30 - comboTimer) * 1.5);
    ctx.restore();
  }
}

// ─── Particles ───────────────────────────────────────────────────
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 60;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ─── Collision Detection (in depth space) ────────────────────────
function checkCollision(obs) {
  // Depth proximity
  const depthDist = Math.abs(obs.depth - PLAYER_DEPTH);
  if (depthDist > 0.06) return false;
  // Lane proximity (smooth)
  const laneDist = Math.abs(obs.lane - player.laneSmooth);
  return laneDist < 0.6;
}

function checkNearMiss(obs) {
  const depthDist = Math.abs(obs.depth - PLAYER_DEPTH);
  if (depthDist > 0.08) return false;
  const laneDist = Math.abs(obs.lane - player.laneSmooth);
  return laneDist >= 0.6 && laneDist < 1.2;
}

// ─── Update ──────────────────────────────────────────────────────
function update() {
  if (state !== "playing") return;

  frame++;
  player.bobFrame++;
  score = Math.floor(frame / 3);

  // Increase speed over time (slow start, ramps up)
  speed = getSpeed(frame);
  roadMarkingOffset += speed;

  // Smooth lane transition
  const targetLane = player.lane;
  player.laneSmooth += (targetLane - player.laneSmooth) * LANE_SWITCH_LERP;

  // Biome transitions
  biomeTimer++;
  if (biomeBannerTimer > 0) biomeBannerTimer--;
  if (biomeTimer >= BIOME_DURATION) {
    biomeTimer = 0;
    currentBiome = nextBiome;
    nextBiome = (nextBiome + 1) % BIOMES.length;
    biomeTransition = 0;
    biomeBannerTimer = 80;
  } else if (biomeTimer > BIOME_DURATION - BIOME_FADE) {
    biomeTransition = (biomeTimer - (BIOME_DURATION - BIOME_FADE)) / BIOME_FADE;
  } else {
    biomeTransition = 0;
  }

  // Update scenery
  for (const s of sceneryItems) {
    s.depth += speed;
    if (s.depth > 1.1) {
      const newItem = makeSceneryItem(-0.1);
      s.depth = newItem.depth;
      s.side = newItem.side;
      s.offset = newItem.offset;
      s.type = newItem.type;
      s.height = newItem.height;
      s.colorSeed = newItem.colorSeed;
    }
  }

  // Spawn obstacles (slower at start, more frequent as speed builds)
  spawnTimer++;
  spawnInterval = getSpawnInterval(frame);
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
    // Double spawns kick in once you're going fast
    if (speed > 0.015 && Math.random() > 0.55) {
      spawnObstacle();
    }
  }

  // Update obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.depth += speed;

    // Near-miss
    if (!obs.passed && obs.depth > PLAYER_DEPTH + 0.08) {
      obs.passed = true;
      if (checkNearMiss(obs)) {
        nearMissStreak++;
        comboTimer = 30;
        score += nearMissStreak * 5;
      }
    }

    if (obs.depth > 1.2) {
      obstacles.splice(i, 1);
      continue;
    }

    if (checkCollision(obs)) {
      die(obs);
      return;
    }
  }

  if (comboTimer > 0) comboTimer--;
  if (comboTimer <= 0) nearMissStreak = 0;
}

// ─── Draw (sorted by depth for correct layering) ────────────────
function draw() {
  ctx.save();

  // Screen shake
  if (screenShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake,
      (Math.random() - 0.5) * screenShake
    );
    screenShake *= 0.85;
    if (screenShake < 0.5) screenShake = 0;
  }

  drawSky();
  drawGround();
  drawRoad();

  // Collect all depth-sorted items (scenery + obstacles + player)
  const drawList = [];

  for (const s of sceneryItems) {
    drawList.push({ depth: s.depth, draw: () => drawSceneryItem(s) });
  }
  for (const obs of obstacles) {
    drawList.push({ depth: obs.depth, draw: () => drawObstacle(obs) });
  }
  // Player
  if (state === "playing" || frame % 4 < 2) {
    drawList.push({ depth: PLAYER_DEPTH, draw: () => drawPlayer() });
  }

  // Sort by depth (far to near = small to large)
  drawList.sort((a, b) => a.depth - b.depth);
  for (const item of drawList) {
    item.draw();
  }

  drawCombo();
  drawParticles();
  drawBiomeBanner();

  ctx.restore();

  scoreDisplay.textContent = score;
  hiScoreDisplay.textContent = `HI: ${hiScore}`;
  // Speed indicator (as a percentage of max)
  const speedPct = Math.round(((speed - SPEED_START) / (SPEED_MAX - SPEED_START)) * 100);
  speedDisplay.textContent = `SPEED: ${speedPct}%`;
}

// ─── Loop ────────────────────────────────────────────────────────
function loop() {
  update();
  updateParticles();
  draw();
  requestAnimationFrame(loop);
}

initScenery();
hiScoreDisplay.textContent = `HI: ${hiScore}`;
fetchLeaderboard("start-leaderboard");
loop();
