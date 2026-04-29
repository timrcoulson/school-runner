// ─── Chip Defense ────────────────────────────────────────────────
// Tower defense: protect your microchip from water guns, EMPs & more.
// Place nerds to defend it!

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ─── Grid / Map ──────────────────────────────────────────────────
const COLS = 16;
const ROWS = 10;
const CELL = 40;
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// 0 = grass (buildable), 1 = path, 2 = chip (goal), 3 = spawn
// Path winds from left to right
const MAP = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [3,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,0,1,1,1,1,0,0,0],
  [0,0,0,1,1,1,1,0,0,1,0,0,1,0,0,0],
  [0,0,0,0,0,0,1,0,0,1,0,0,1,1,1,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Build path as ordered waypoints
const PATH = [];
function buildPath() {
  // BFS from spawn to chip
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const parent = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let startR = -1, startC = -1, endR = -1, endC = -1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 3) { startR = r; startC = c; }
      if (MAP[r][c] === 2) { endR = r; endC = c; }
    }
  }
  const queue = [[startR, startC]];
  visited[startR][startC] = true;
  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    if (cr === endR && cc === endC) break;
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = cr + dr, nc = cc + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && MAP[nr][nc] !== 0) {
        visited[nr][nc] = true;
        parent[nr][nc] = [cr, cc];
        queue.push([nr, nc]);
      }
    }
  }
  // Trace back
  const rawPath = [];
  let cur = [endR, endC];
  while (cur) {
    rawPath.unshift(cur);
    cur = parent[cur[0]][cur[1]];
  }
  PATH.length = 0;
  for (const [r, c] of rawPath) {
    PATH.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
  }
}
buildPath();

// ─── Defender Types ──────────────────────────────────────────────
const DEFENDERS = [
  {
    id: "intern",
    name: "Intern",
    grade: "D",
    cost: 50,
    range: 80,
    damage: 8,
    fireRate: 45, // frames between shots
    color: "#77bb77",
    desc: "Slow but cheap",
    projColor: "#aaffaa",
  },
  {
    id: "junior",
    name: "Junior Dev",
    grade: "C",
    cost: 100,
    range: 100,
    damage: 18,
    fireRate: 35,
    color: "#5599dd",
    desc: "Balanced fighter",
    projColor: "#88ccff",
  },
  {
    id: "senior",
    name: "Senior Dev",
    grade: "B",
    cost: 200,
    range: 120,
    damage: 35,
    fireRate: 30,
    color: "#dd77dd",
    desc: "Strong & steady",
    projColor: "#ffaaff",
  },
  {
    id: "lead",
    name: "Tech Lead",
    grade: "A",
    cost: 350,
    range: 140,
    damage: 55,
    fireRate: 25,
    color: "#ffaa44",
    desc: "High damage, big range",
    projColor: "#ffdd88",
  },
  {
    id: "cto",
    name: "CTO",
    grade: "S",
    cost: 600,
    range: 160,
    damage: 100,
    fireRate: 40,
    color: "#ff4466",
    desc: "Devastating",
    projColor: "#ff8888",
  },
];

// ─── Enemy Types ─────────────────────────────────────────────────
const ENEMY_TYPES = [
  {
    id: "farmer",
    name: "Farmer",
    hp: 60,
    speed: 0.8,
    damage: 5,
    reward: 20,
    color: "#8B6B3D",
    hat: "#4a7a3a",
    weapon: "watergun",
  },
  {
    id: "kid",
    name: "Water Balloon Kid",
    hp: 40,
    speed: 1.4,
    damage: 3,
    reward: 15,
    color: "#ffcc99",
    hat: "#ff4444",
    weapon: "balloon",
  },
  {
    id: "sprinkler",
    name: "Sprinkler Bot",
    hp: 120,
    speed: 0.5,
    damage: 8,
    reward: 35,
    color: "#888899",
    hat: "#667",
    weapon: "spray",
  },
  {
    id: "agent",
    name: "CIA Agent",
    hp: 200,
    speed: 0.9,
    damage: 15,
    reward: 60,
    color: "#222233",
    hat: "#111",
    weapon: "emp",
  },
  {
    id: "storm",
    name: "EMP Drone",
    hp: 400,
    speed: 0.6,
    damage: 25,
    reward: 120,
    color: "#4444aa",
    hat: "#6666cc",
    weapon: "pulse",
  },
];

// ─── Game State ──────────────────────────────────────────────────
let state = "menu"; // menu | playing | dead
let charge = 100; // chip health
let money = 150;
let score = 0;
let wave = 0;
let frame = 0;
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let waveEnemies = []; // queue of enemies to spawn this wave
let spawnTimer = 0;
let spawnInterval = 40;
let waveDelay = 0; // countdown between waves
let selectedDefender = null;
let hoverCell = null;

// ─── UI ──────────────────────────────────────────────────────────
const hudCharge = document.getElementById("hud-charge");
const hudMoney = document.getElementById("hud-money");
const hudWave = document.getElementById("hud-wave");
const hudScore = document.getElementById("hud-score");
const overlay = document.getElementById("overlay");
const overlayDead = document.getElementById("overlay-dead");
const finalScoreEl = document.getElementById("final-score");
const waveBanner = document.getElementById("wave-banner");
const shopEl = document.getElementById("shop");

// Build shop buttons
DEFENDERS.forEach((def, i) => {
  const btn = document.createElement("div");
  btn.className = "shop-btn";
  btn.dataset.index = i;
  btn.innerHTML = `<div class="shop-name">${def.name}</div><div class="shop-cost">$${def.cost}</div><div class="shop-stat">Grade ${def.grade} · ${def.desc}</div>`;
  btn.addEventListener("click", () => selectDefender(i));
  shopEl.appendChild(btn);
});

function selectDefender(i) {
  if (money < DEFENDERS[i].cost) return;
  selectedDefender = i;
  document.querySelectorAll(".shop-btn").forEach((b, j) => {
    b.classList.toggle("selected", j === i);
  });
}

function updateShopUI() {
  document.querySelectorAll(".shop-btn").forEach((b, i) => {
    b.classList.toggle("disabled", money < DEFENDERS[i].cost);
    if (money < DEFENDERS[i].cost && selectedDefender === i) {
      selectedDefender = null;
      b.classList.remove("selected");
    }
  });
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("retry-btn").addEventListener("click", startGame);

function startGame() {
  state = "playing";
  charge = 100;
  money = 150;
  score = 0;
  wave = 0;
  frame = 0;
  towers = [];
  enemies = [];
  projectiles = [];
  particles = [];
  waveEnemies = [];
  spawnTimer = 0;
  waveDelay = 60;
  selectedDefender = null;
  overlay.classList.add("hidden");
  overlayDead.classList.add("hidden");
  updateShopUI();
  nextWave();
}

function gameOver() {
  state = "dead";
  finalScoreEl.textContent = score;
  overlayDead.classList.remove("hidden");
  const submitBtn = document.getElementById("submit-score-btn");
  submitBtn.disabled = false;
  submitBtn.textContent = "SUBMIT SCORE";
  document.getElementById("submit-msg").textContent = "";
  if (window.Leaderboard) window.Leaderboard.fetchLeaderboard("chip-defense", "leaderboard");
}

// ─── Waves ───────────────────────────────────────────────────────
function nextWave() {
  wave++;
  waveDelay = 90;
  waveBanner.textContent = `WAVE ${wave}`;
  waveBanner.style.opacity = "1";
  setTimeout(() => (waveBanner.style.opacity = "0"), 1500);

  // Generate enemies for this wave
  waveEnemies = [];
  const baseCount = 4 + wave * 2;
  for (let i = 0; i < baseCount; i++) {
    let type;
    const r = Math.random();
    if (wave <= 2) {
      type = r < 0.7 ? ENEMY_TYPES[0] : ENEMY_TYPES[1];
    } else if (wave <= 4) {
      type = r < 0.4 ? ENEMY_TYPES[0] : r < 0.7 ? ENEMY_TYPES[1] : r < 0.9 ? ENEMY_TYPES[2] : ENEMY_TYPES[3];
    } else if (wave <= 7) {
      type = r < 0.2 ? ENEMY_TYPES[0] : r < 0.4 ? ENEMY_TYPES[1] : r < 0.6 ? ENEMY_TYPES[2] : r < 0.85 ? ENEMY_TYPES[3] : ENEMY_TYPES[4];
    } else {
      type = r < 0.1 ? ENEMY_TYPES[1] : r < 0.3 ? ENEMY_TYPES[2] : r < 0.6 ? ENEMY_TYPES[3] : ENEMY_TYPES[4];
    }
    // Scale HP with wave
    const hpScale = 1 + (wave - 1) * 0.15;
    waveEnemies.push({
      ...type,
      hp: Math.round(type.hp * hpScale),
      maxHp: Math.round(type.hp * hpScale),
    });
  }
  spawnInterval = Math.max(20, 45 - wave * 2);
  spawnTimer = 0;
}

// ─── Canvas Input ────────────────────────────────────────────────
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  hoverCell = { c: Math.floor(mx / CELL), r: Math.floor(my / CELL) };
});

canvas.addEventListener("click", (e) => {
  if (state !== "playing" || selectedDefender === null || !hoverCell) return;
  const { r, c } = hoverCell;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (MAP[r][c] !== 0) return; // can only build on grass
  if (towers.some((t) => t.r === r && t.c === c)) return; // occupied

  const def = DEFENDERS[selectedDefender];
  if (money < def.cost) return;

  money -= def.cost;
  towers.push({
    r, c,
    x: c * CELL + CELL / 2,
    y: r * CELL + CELL / 2,
    type: def,
    cooldown: 0,
    angle: 0,
  });
  updateShopUI();
});

// ─── Update ──────────────────────────────────────────────────────
function update() {
  if (state !== "playing") return;
  frame++;

  // Wave delay
  if (waveDelay > 0) {
    waveDelay--;
    return;
  }

  // Spawn enemies
  if (waveEnemies.length > 0) {
    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const eType = waveEnemies.shift();
      enemies.push({
        ...eType,
        pathIdx: 0,
        x: PATH[0].x,
        y: PATH[0].y,
        progress: 0, // 0 to PATH.length-1
      });
    }
  }

  // Move enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const target = PATH[Math.min(Math.ceil(e.progress), PATH.length - 1)];
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < e.speed * 2) {
      e.progress++;
      if (e.progress >= PATH.length) {
        // Reached the chip!
        charge -= e.damage;
        // Damage particle
        for (let j = 0; j < 5; j++) {
          particles.push({
            x: e.x, y: e.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 20, color: "#ff4444", size: 3,
          });
        }
        enemies.splice(i, 1);
        if (charge <= 0) { charge = 0; gameOver(); return; }
        continue;
      }
    } else {
      e.x += (dx / dist) * e.speed;
      e.y += (dy / dist) * e.speed;
    }
  }

  // Tower shooting
  for (const tower of towers) {
    if (tower.cooldown > 0) { tower.cooldown--; continue; }
    // Find closest enemy in range
    let closest = null;
    let closestDist = Infinity;
    for (const e of enemies) {
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= tower.type.range && d < closestDist) {
        closest = e;
        closestDist = d;
      }
    }
    if (closest) {
      tower.angle = Math.atan2(closest.y - tower.y, closest.x - tower.x);
      tower.cooldown = tower.type.fireRate;
      projectiles.push({
        x: tower.x,
        y: tower.y,
        tx: closest.x,
        ty: closest.y,
        target: closest,
        speed: 4,
        damage: tower.type.damage,
        color: tower.type.projColor,
      });
    }
  }

  // Move projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < p.speed * 2) {
      // Hit
      if (p.target && enemies.includes(p.target)) {
        p.target.hp -= p.damage;
        if (p.target.hp <= 0) {
          money += p.target.reward;
          score += p.target.reward;
          // Death particles
          for (let j = 0; j < 8; j++) {
            particles.push({
              x: p.target.x, y: p.target.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 25, color: p.target.color, size: 3,
            });
          }
          const idx = enemies.indexOf(p.target);
          if (idx !== -1) enemies.splice(idx, 1);
          updateShopUI();
        }
      }
      // Hit spark
      particles.push({
        x: p.x, y: p.y,
        vx: 0, vy: 0,
        life: 8, color: p.color, size: 5,
      });
      projectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Check wave complete
  if (waveEnemies.length === 0 && enemies.length === 0 && waveDelay <= 0) {
    // Bonus money between waves
    money += 25 + wave * 5;
    score += wave * 10;
    updateShopUI();
    nextWave();
  }

  // HUD
  hudCharge.textContent = charge;
  hudMoney.textContent = `$${money}`;
  hudWave.textContent = wave;
  hudScore.textContent = score;
}

// ─── Drawing ─────────────────────────────────────────────────────
function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      const tile = MAP[r][c];
      if (tile === 0) {
        // Grass
        ctx.fillStyle = "#2a4a2a";
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = "#325a32";
        ctx.fillRect(x, y, CELL, 1);
        // Grass texture
        if ((r + c) % 3 === 0) {
          ctx.fillStyle = "#1a3a1a";
          ctx.fillRect(x + 8, y + 12, 3, 6);
        }
      } else if (tile === 1 || tile === 3) {
        // Path
        ctx.fillStyle = "#4a4a3a";
        ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = "#555544";
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
        // Gravel dots
        ctx.fillStyle = "#3a3a2a";
        ctx.fillRect(x + 8, y + 8, 2, 2);
        ctx.fillRect(x + 20, y + 16, 2, 2);
        ctx.fillRect(x + 30, y + 6, 2, 2);
      } else if (tile === 2) {
        // Chip goal
        ctx.fillStyle = "#1a2a1a";
        ctx.fillRect(x, y, CELL, CELL);
        // Circuit board pattern
        ctx.fillStyle = "#0a3a2a";
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
        drawMicrochip(x + CELL / 2, y + CELL / 2, 14);
      }
      // Grid line
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.strokeRect(x, y, CELL, CELL);
    }
  }
}

function drawMicrochip(cx, cy, sz) {
  ctx.fillStyle = "#1a3a2a";
  ctx.fillRect(cx - sz, cy - sz * 0.7, sz * 2, sz * 1.4);
  ctx.fillStyle = "#aabbcc";
  ctx.fillRect(cx - sz * 0.6, cy - sz * 0.4, sz * 1.2, sz * 0.8);
  // Pins
  ctx.fillStyle = "#ccc";
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx - sz - 3, cy - sz * 0.4 + i * sz * 0.4, 4, 2);
    ctx.fillRect(cx + sz - 1, cy - sz * 0.4 + i * sz * 0.4, 4, 2);
  }
  // Red dot
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(cx - sz + 3, cy - sz * 0.5, 3, 3);
  // Charge glow
  const glow = 0.2 + Math.sin(frame * 0.05) * 0.1;
  ctx.fillStyle = `rgba(0,255,136,${glow})`;
  ctx.beginPath();
  ctx.arc(cx, cy, sz * 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTower(tower) {
  const x = tower.x, y = tower.y;
  const s = 14;
  const col = tower.type.color;

  // Base platform
  ctx.fillStyle = "#333";
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.fillStyle = "#444";
  ctx.fillRect(x - s + 2, y - s + 2, s * 2 - 4, s * 2 - 4);

  // Body
  ctx.fillStyle = col;
  ctx.fillRect(x - 8, y - 10, 16, 16);

  // Head (from behind/above)
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x - 5, y - 14, 10, 6);

  // Glasses!
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 5, y - 13, 4, 3);
  ctx.fillRect(x + 1, y - 13, 4, 3);
  ctx.fillStyle = "rgba(150,200,255,0.4)";
  ctx.fillRect(x - 4, y - 12, 2, 1);
  ctx.fillRect(x + 2, y - 12, 2, 1);
  // Bridge
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 1, y - 12, 2, 1);

  // Hair
  ctx.fillStyle = "#553311";
  ctx.fillRect(x - 5, y - 16, 10, 3);

  // Grade badge
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 6, y - 6, 8, 8);
  ctx.fillStyle = tower.type.color;
  ctx.font = "bold 7px 'Courier New'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tower.type.grade, x + 10, y - 2);

  // Range indicator on hover
  if (hoverCell && hoverCell.r === tower.r && hoverCell.c === tower.c) {
    ctx.strokeStyle = `rgba(255,255,255,0.15)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, tower.type.range, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemy(e) {
  const x = e.x, y = e.y;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const walk = Math.sin(frame * 0.15 + e.x) * 3;
  ctx.fillStyle = "#555";
  ctx.fillRect(x - 4, y + 2, 3, 8 + walk);
  ctx.fillRect(x + 1, y + 2, 3, 8 - walk);

  // Body
  ctx.fillStyle = e.color;
  ctx.fillRect(x - 7, y - 8, 14, 14);

  // Head
  ctx.fillStyle = "#ffcc99";
  if (e.id === "sprinkler" || e.id === "storm") ctx.fillStyle = e.color;
  ctx.fillRect(x - 5, y - 14, 10, 7);

  // Hat / headgear
  ctx.fillStyle = e.hat;
  ctx.fillRect(x - 6, y - 16, 12, 4);

  // Weapon indicator
  if (e.weapon === "watergun") {
    ctx.fillStyle = "#44aaff";
    ctx.fillRect(x + 6, y - 6, 6, 3);
  } else if (e.weapon === "balloon") {
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(x + 8, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.weapon === "emp") {
    const pulse = Math.sin(frame * 0.1) * 2;
    ctx.strokeStyle = "rgba(100,100,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y - 4, 10 + pulse, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.weapon === "pulse") {
    ctx.fillStyle = "rgba(100,100,255,0.3)";
    ctx.beginPath();
    ctx.arc(x, y, 12 + Math.sin(frame * 0.08) * 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.weapon === "spray") {
    ctx.fillStyle = "rgba(80,180,255,0.4)";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 7 + i * 3, y - 6 + Math.sin(frame * 0.2 + i) * 2, 2, 2);
    }
  }

  // HP bar
  const hpPct = e.hp / e.maxHp;
  ctx.fillStyle = "#333";
  ctx.fillRect(x - 8, y - 20, 16, 3);
  ctx.fillStyle = hpPct > 0.5 ? "#0f0" : hpPct > 0.25 ? "#ff0" : "#f00";
  ctx.fillRect(x - 8, y - 20, 16 * hpPct, 3);
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = `${p.color}44`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 25;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlacementPreview() {
  if (state !== "playing" || selectedDefender === null || !hoverCell) return;
  const { r, c } = hoverCell;
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  const canPlace = MAP[r][c] === 0 && !towers.some((t) => t.r === r && t.c === c);
  const def = DEFENDERS[selectedDefender];
  const x = c * CELL + CELL / 2;
  const y = r * CELL + CELL / 2;

  // Range circle
  ctx.strokeStyle = canPlace ? "rgba(0,255,136,0.2)" : "rgba(255,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, def.range, 0, Math.PI * 2);
  ctx.stroke();

  // Ghost tower
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = canPlace ? def.color : "#ff0000";
  ctx.fillRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
  ctx.globalAlpha = 1;
}

function drawChargeBar() {
  // Charge bar at the chip location
  const chipCell = { r: 8, c: 15 };
  const cx = chipCell.c * CELL + CELL / 2;
  const cy = chipCell.r * CELL - 6;
  const barW = 30;
  ctx.fillStyle = "#333";
  ctx.fillRect(cx - barW / 2, cy, barW, 4);
  ctx.fillStyle = charge > 50 ? "#00ff88" : charge > 25 ? "#ffdd00" : "#ff4444";
  ctx.fillRect(cx - barW / 2, cy, barW * (charge / 100), 4);
}

// ─── Main Draw ───────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawPlacementPreview();

  for (const tower of towers) drawTower(tower);
  for (const e of enemies) drawEnemy(e);
  drawProjectiles();
  drawParticles();
  drawChargeBar();
}

// ─── Loop ────────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── Leaderboard ─────────────────────────────────────────────────
const GAME_ID = "chip-defense";
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
