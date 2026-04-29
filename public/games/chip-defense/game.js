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
// Seeded random for consistent grass/path textures per cell
function cellRng(r, c, i) {
  let h = (r * 374761 + c * 668265 + i * 982451) & 0xffffffff;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  return ((h >> 16) ^ h & 0xffff) / 0xffff;
}

function isPath(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && (MAP[r][c] === 1 || MAP[r][c] === 3 || MAP[r][c] === 2);
}

function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL, y = r * CELL;
      const tile = MAP[r][c];
      if (tile === 0) {
        // Grass — varied green base
        const shade = cellRng(r, c, 0) * 12;
        ctx.fillStyle = `rgb(${34 + shade},${64 + shade},${34 + shade})`;
        ctx.fillRect(x, y, CELL, CELL);
        // Grass tufts
        ctx.fillStyle = `rgb(${42 + shade},${78 + shade},${42 + shade})`;
        for (let i = 0; i < 4; i++) {
          const gx = x + cellRng(r, c, i + 10) * 32 + 2;
          const gy = y + cellRng(r, c, i + 20) * 28 + 4;
          ctx.fillRect(gx, gy, 2, 4);
          ctx.fillRect(gx - 1, gy + 1, 1, 3);
        }
        // Flowers / pebbles
        if (cellRng(r, c, 99) > 0.7) {
          ctx.fillStyle = cellRng(r, c, 88) > 0.5 ? "#aacc44" : "#dddd55";
          ctx.fillRect(x + 14 + cellRng(r, c, 77) * 10, y + 10 + cellRng(r, c, 66) * 16, 2, 2);
        }
      } else if (tile === 1 || tile === 3) {
        // Path — dirt with edge detection
        ctx.fillStyle = "#5a5544";
        ctx.fillRect(x, y, CELL, CELL);
        // Inner dirt (lighter)
        ctx.fillStyle = "#6a6555";
        ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
        // Gravel texture
        ctx.fillStyle = "#4a4538";
        for (let i = 0; i < 6; i++) {
          const gx = x + cellRng(r, c, i + 30) * 34 + 2;
          const gy = y + cellRng(r, c, i + 40) * 34 + 2;
          const gs = 1 + Math.floor(cellRng(r, c, i + 50) * 2);
          ctx.fillRect(gx, gy, gs, gs);
        }
        // Light pebbles
        ctx.fillStyle = "#7a7565";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(x + cellRng(r, c, i + 60) * 30 + 4, y + cellRng(r, c, i + 70) * 30 + 4, 2, 2);
        }
        // Edge borders (dark where path meets grass)
        ctx.fillStyle = "#3a352a";
        if (!isPath(r - 1, c)) ctx.fillRect(x, y, CELL, 2);
        if (!isPath(r + 1, c)) ctx.fillRect(x, y + CELL - 2, CELL, 2);
        if (!isPath(r, c - 1)) ctx.fillRect(x, y, 2, CELL);
        if (!isPath(r, c + 1)) ctx.fillRect(x + CELL - 2, y, 2, CELL);
      } else if (tile === 2) {
        // Chip platform — dark PCB
        ctx.fillStyle = "#0a1a12";
        ctx.fillRect(x, y, CELL, CELL);
        // PCB traces
        ctx.fillStyle = "#0f2f1f";
        ctx.fillRect(x + 4, y + 8, CELL - 8, 2);
        ctx.fillRect(x + 4, y + 16, CELL - 8, 2);
        ctx.fillRect(x + 4, y + 24, CELL - 8, 2);
        ctx.fillRect(x + 10, y + 4, 2, CELL - 8);
        ctx.fillRect(x + 22, y + 4, 2, CELL - 8);
        // Solder pads
        ctx.fillStyle = "#b87333";
        ctx.fillRect(x + 6, y + 6, 3, 3);
        ctx.fillRect(x + 28, y + 6, 3, 3);
        ctx.fillRect(x + 6, y + 28, 3, 3);
        ctx.fillRect(x + 28, y + 28, 3, 3);
        drawMicrochip(x + CELL / 2, y + CELL / 2, 14);
      }
    }
  }
}

function drawMicrochip(cx, cy, sz) {
  // PCB body
  ctx.fillStyle = "#1a3a2a";
  ctx.fillRect(cx - sz, cy - sz * 0.7, sz * 2, sz * 1.4);
  // Bevel
  ctx.fillStyle = "#244a34";
  ctx.fillRect(cx - sz, cy - sz * 0.7, sz * 2, 2);
  ctx.fillStyle = "#102a1a";
  ctx.fillRect(cx - sz, cy + sz * 0.7 - 2, sz * 2, 2);
  // Die
  ctx.fillStyle = "#99aabb";
  ctx.fillRect(cx - sz * 0.55, cy - sz * 0.35, sz * 1.1, sz * 0.7);
  ctx.fillStyle = "#aabbcc";
  ctx.fillRect(cx - sz * 0.5, cy - sz * 0.3, sz * 1.0, sz * 0.6);
  // Die markings
  ctx.fillStyle = "#88999a";
  ctx.fillRect(cx - sz * 0.3, cy - sz * 0.15, sz * 0.6, 1);
  ctx.fillRect(cx - sz * 0.3, cy + sz * 0.05, sz * 0.6, 1);
  // Pins (all 4 sides)
  ctx.fillStyle = "#ccd";
  for (let i = 0; i < 4; i++) {
    const py = cy - sz * 0.5 + i * sz * 0.3;
    ctx.fillRect(cx - sz - 4, py, 5, 2);
    ctx.fillRect(cx + sz - 1, py, 5, 2);
  }
  for (let i = 0; i < 3; i++) {
    const px = cx - sz * 0.5 + i * sz * 0.4;
    ctx.fillRect(px, cy - sz * 0.7 - 3, 2, 4);
    ctx.fillRect(px, cy + sz * 0.7 - 1, 2, 4);
  }
  // Red dot
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(cx - sz + 3, cy - sz * 0.55, 3, 3);
  // Charge glow (pulsing ring)
  const chargePct = charge / 100;
  const glowAlpha = 0.15 + Math.sin(frame * 0.05) * 0.08;
  const glowCol = charge > 50 ? `rgba(0,255,136,${glowAlpha})` : charge > 25 ? `rgba(255,220,0,${glowAlpha})` : `rgba(255,50,50,${glowAlpha + 0.1})`;
  ctx.fillStyle = glowCol;
  ctx.beginPath();
  ctx.arc(cx, cy, sz * 1.3, 0, Math.PI * 2);
  ctx.fill();
  // Inner charge ring
  ctx.strokeStyle = glowCol.replace(String(glowAlpha), String(glowAlpha * 2));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, sz * 0.95, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargePct);
  ctx.stroke();
}

function drawTower(tower) {
  const x = tower.x, y = tower.y;
  const col = tower.type.color;
  const shooting = tower.cooldown > tower.type.fireRate - 5;

  // Desk
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(x - 14, y + 2, 28, 10);
  ctx.fillStyle = "#6a5a4a";
  ctx.fillRect(x - 13, y + 3, 26, 4);
  // Desk legs
  ctx.fillStyle = "#4a3a2a";
  ctx.fillRect(x - 12, y + 10, 3, 4);
  ctx.fillRect(x + 9, y + 10, 3, 4);

  // Monitor
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 8, y - 6, 16, 11);
  ctx.fillStyle = shooting ? "#44ff88" : "#1a3a2a";
  ctx.fillRect(x - 6, y - 4, 12, 7);
  // Screen content
  if (!shooting) {
    ctx.fillStyle = "#0a5a2a";
    ctx.fillRect(x - 5, y - 3, 8, 1);
    ctx.fillRect(x - 5, y - 1, 6, 1);
    ctx.fillRect(x - 5, y + 1, 9, 1);
  }
  // Monitor stand
  ctx.fillStyle = "#333";
  ctx.fillRect(x - 2, y + 5, 4, 2);

  // Chair
  ctx.fillStyle = "#333";
  ctx.fillRect(x - 6, y + 6, 12, 3);

  // Body (shirt)
  ctx.fillStyle = col;
  ctx.fillRect(x - 7, y - 10, 14, 12);
  // Shirt collar
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 3, y - 10, 6, 2);

  // Arms (typing)
  const armBob = shooting ? 0 : Math.sin(frame * 0.1 + tower.x) * 1;
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x - 10, y - 4 + armBob, 4, 8);
  ctx.fillRect(x + 6, y - 4 - armBob, 4, 8);

  // Head
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(x - 6, y - 18, 12, 9);
  // Ears
  ctx.fillStyle = "#ffbb88";
  ctx.fillRect(x - 7, y - 16, 2, 4);
  ctx.fillRect(x + 5, y - 16, 2, 4);

  // Hair (varies by grade)
  const hairColors = { D: "#884400", C: "#553311", B: "#222", A: "#aa6622", S: "#eee" };
  ctx.fillStyle = hairColors[tower.type.grade] || "#553311";
  ctx.fillRect(x - 6, y - 20, 12, 4);
  if (tower.type.grade === "S") {
    // CTO has slick hair
    ctx.fillRect(x - 7, y - 19, 14, 2);
  }

  // GLASSES (thick & prominent!)
  ctx.fillStyle = "#111";
  // Frames
  ctx.fillRect(x - 6, y - 15, 5, 4);
  ctx.fillRect(x + 1, y - 15, 5, 4);
  // Bridge
  ctx.fillRect(x - 1, y - 14, 2, 2);
  // Arms of glasses
  ctx.fillRect(x - 7, y - 14, 2, 1);
  ctx.fillRect(x + 5, y - 14, 2, 1);
  // Lens glare
  ctx.fillStyle = "rgba(150,200,255,0.5)";
  ctx.fillRect(x - 5, y - 14, 2, 2);
  ctx.fillRect(x + 2, y - 14, 2, 2);

  // Grade badge (on shirt)
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x + 3, y - 8, 8, 8);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.font = "bold 7px 'Courier New'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tower.type.grade, x + 7, y - 4);

  // Shooting flash
  if (shooting) {
    ctx.fillStyle = `${tower.type.projColor}66`;
    ctx.beginPath();
    ctx.arc(x, y - 2, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Range indicator on hover
  if (hoverCell && hoverCell.r === tower.r && hoverCell.c === tower.c) {
    ctx.save();
    ctx.strokeStyle = `${col}44`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, tower.type.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawEnemy(e) {
  const x = e.x, y = e.y;
  const walk = Math.sin(frame * 0.15 + e.x * 0.1) * 2;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.id === "farmer") {
    // Overalls
    ctx.fillStyle = "#556633";
    ctx.fillRect(x - 4, y + 3, 3, 9 + walk);
    ctx.fillRect(x + 1, y + 3, 3, 9 - walk);
    // Boots
    ctx.fillStyle = "#4a3a1a";
    ctx.fillRect(x - 5, y + 10 + walk, 5, 3);
    ctx.fillRect(x, y + 10 - walk, 5, 3);
    // Body — plaid shirt
    ctx.fillStyle = "#cc4444";
    ctx.fillRect(x - 8, y - 8, 16, 14);
    ctx.fillStyle = "#aa3333";
    ctx.fillRect(x - 6, y - 6, 2, 10);
    ctx.fillRect(x - 1, y - 6, 2, 10);
    ctx.fillRect(x + 4, y - 6, 2, 10);
    // Head
    ctx.fillStyle = "#ffcc99";
    ctx.fillRect(x - 5, y - 15, 10, 8);
    // Straw hat
    ctx.fillStyle = "#ccaa44";
    ctx.fillRect(x - 8, y - 17, 16, 3);
    ctx.fillRect(x - 5, y - 20, 10, 4);
    ctx.fillStyle = "#aa8833";
    ctx.fillRect(x - 5, y - 17, 10, 1);
    // Eyes
    ctx.fillStyle = "#222";
    ctx.fillRect(x - 3, y - 12, 2, 2);
    ctx.fillRect(x + 2, y - 12, 2, 2);
    // Water gun
    ctx.fillStyle = "#2288dd";
    ctx.fillRect(x + 7, y - 6, 8, 4);
    ctx.fillStyle = "#55bbff";
    ctx.fillRect(x + 13, y - 5, 4, 2);
    // Water spray
    if (Math.sin(frame * 0.2) > 0.3) {
      ctx.fillStyle = "rgba(80,180,255,0.5)";
      ctx.fillRect(x + 16, y - 5 + Math.sin(frame * 0.3) * 2, 3, 2);
    }
  } else if (e.id === "kid") {
    // Shorts & legs
    ctx.fillStyle = "#ffcc99";
    ctx.fillRect(x - 3, y + 2, 3, 8 + walk);
    ctx.fillRect(x + 1, y + 2, 3, 8 - walk);
    ctx.fillStyle = "#3366aa";
    ctx.fillRect(x - 4, y, 8, 5);
    // Sneakers
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 4, y + 9 + walk, 4, 2);
    ctx.fillRect(x + 1, y + 9 - walk, 4, 2);
    // T-shirt
    ctx.fillStyle = "#ff6644";
    ctx.fillRect(x - 7, y - 8, 14, 12);
    // Head
    ctx.fillStyle = "#ffcc99";
    ctx.fillRect(x - 5, y - 14, 10, 7);
    // Backwards cap
    ctx.fillStyle = "#ff2222";
    ctx.fillRect(x - 5, y - 16, 10, 4);
    ctx.fillRect(x - 8, y - 14, 4, 2);
    // Cheeky grin
    ctx.fillStyle = "#222";
    ctx.fillRect(x - 2, y - 10, 2, 1);
    ctx.fillRect(x + 1, y - 10, 2, 1);
    ctx.fillStyle = "#cc6655";
    ctx.fillRect(x - 2, y - 9, 5, 1);
    // Balloon
    ctx.fillStyle = "#ff4466";
    ctx.beginPath();
    ctx.arc(x + 9, y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6688";
    ctx.beginPath();
    ctx.arc(x + 8, y - 9, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 3);
    ctx.lineTo(x + 7, y - 2);
    ctx.stroke();
  } else if (e.id === "sprinkler") {
    // Robot legs
    ctx.fillStyle = "#666677";
    ctx.fillRect(x - 4, y + 2, 3, 8);
    ctx.fillRect(x + 1, y + 2, 3, 8);
    // Body — metal box
    ctx.fillStyle = "#778899";
    ctx.fillRect(x - 8, y - 8, 16, 14);
    ctx.fillStyle = "#8899aa";
    ctx.fillRect(x - 7, y - 7, 14, 2);
    // Rivets
    ctx.fillStyle = "#99aabb";
    ctx.fillRect(x - 6, y - 2, 2, 2);
    ctx.fillRect(x + 4, y - 2, 2, 2);
    // Head — dome
    ctx.fillStyle = "#889";
    ctx.fillRect(x - 5, y - 14, 10, 7);
    ctx.fillStyle = "#99a";
    ctx.fillRect(x - 4, y - 13, 8, 2);
    // Red eye
    ctx.fillStyle = "#ff2222";
    ctx.fillRect(x - 2, y - 12, 4, 2);
    // Antenna
    ctx.fillStyle = "#667";
    ctx.fillRect(x, y - 18, 2, 5);
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(x - 1, y - 19, 4, 2);
    // Spray nozzles
    ctx.fillStyle = "#556";
    ctx.fillRect(x + 7, y - 5, 6, 3);
    ctx.fillRect(x + 7, y, 6, 3);
    // Spray particles
    ctx.fillStyle = "rgba(80,180,255,0.5)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 12 + i * 3, y - 4 + Math.sin(frame * 0.3 + i) * 3, 2, 2);
    }
  } else if (e.id === "agent") {
    // Legs (suit pants)
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(x - 4, y + 2, 3, 9 + walk);
    ctx.fillRect(x + 1, y + 2, 3, 9 - walk);
    // Shoes
    ctx.fillStyle = "#111";
    ctx.fillRect(x - 5, y + 10 + walk, 5, 2);
    ctx.fillRect(x, y + 10 - walk, 5, 2);
    // Suit body
    ctx.fillStyle = "#222233";
    ctx.fillRect(x - 8, y - 9, 16, 14);
    // Tie
    ctx.fillStyle = "#aa2222";
    ctx.fillRect(x - 1, y - 8, 2, 8);
    // Lapels
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x - 6, y - 8, 4, 8);
    ctx.fillRect(x + 2, y - 8, 4, 8);
    // Head
    ctx.fillStyle = "#ffcc99";
    ctx.fillRect(x - 5, y - 16, 10, 8);
    // Sunglasses
    ctx.fillStyle = "#000";
    ctx.fillRect(x - 5, y - 14, 4, 3);
    ctx.fillRect(x + 1, y - 14, 4, 3);
    ctx.fillRect(x - 1, y - 13, 2, 1);
    // Earpiece
    ctx.fillStyle = "#333";
    ctx.fillRect(x + 4, y - 13, 3, 4);
    // Stern mouth
    ctx.fillStyle = "#cc9988";
    ctx.fillRect(x - 2, y - 10, 4, 1);
    // EMP device
    const pulse = Math.sin(frame * 0.12) * 3;
    ctx.strokeStyle = `rgba(100,120,255,${0.4 + Math.sin(frame * 0.1) * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 4, 12 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 4, 7 + pulse * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.id === "storm") {
    // Drone body
    ctx.fillStyle = "#3a3a66";
    ctx.fillRect(x - 10, y - 6, 20, 10);
    ctx.fillStyle = "#4a4a88";
    ctx.fillRect(x - 8, y - 4, 16, 6);
    // Propellers (spinning)
    const spin = frame * 0.3;
    ctx.fillStyle = "#555";
    ctx.fillRect(x - 14 + Math.sin(spin) * 2, y - 8, 8, 2);
    ctx.fillRect(x + 6 + Math.sin(spin + 1) * 2, y - 8, 8, 2);
    // Red lights
    ctx.fillStyle = Math.sin(frame * 0.15) > 0 ? "#ff0000" : "#660000";
    ctx.fillRect(x - 2, y - 2, 4, 3);
    // EMP field
    const p = Math.sin(frame * 0.08) * 4;
    ctx.strokeStyle = `rgba(80,80,255,${0.2 + Math.sin(frame * 0.06) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16 + p, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120,120,255,${0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, 22 + p, 0, Math.PI * 2);
    ctx.stroke();
    // Antenna
    ctx.fillStyle = "#667";
    ctx.fillRect(x - 1, y - 10, 2, 5);
  }

  // HP bar (better styled)
  const hpPct = e.hp / e.maxHp;
  const barW = 18;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x - barW / 2 - 1, y - 22, barW + 2, 5);
  ctx.fillStyle = "#222";
  ctx.fillRect(x - barW / 2, y - 21, barW, 3);
  const hpCol = hpPct > 0.6 ? "#00dd44" : hpPct > 0.3 ? "#ddaa00" : "#dd2200";
  ctx.fillStyle = hpCol;
  ctx.fillRect(x - barW / 2, y - 21, barW * hpPct, 3);
}

function drawProjectiles() {
  for (const p of projectiles) {
    // Trail
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      ctx.strokeStyle = `${p.color}44`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - (dx / dist) * 8, p.y - (dy / dist) * 8);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    // Core
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    // Outer glow
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `${p.color}33`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 15);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    // Glow
    ctx.fillStyle = `${p.color}44`;
    ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
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
  ctx.save();
  ctx.strokeStyle = canPlace ? "rgba(0,255,136,0.25)" : "rgba(255,0,0,0.25)";
  ctx.fillStyle = canPlace ? "rgba(0,255,136,0.05)" : "rgba(255,0,0,0.05)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, def.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Ghost tower
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = canPlace ? def.color : "#ff0000";
  ctx.fillRect(c * CELL + 6, r * CELL + 6, CELL - 12, CELL - 12);
  ctx.globalAlpha = 1;

  // Cost text
  ctx.fillStyle = canPlace ? "#ffdd57" : "#ff4444";
  ctx.font = "bold 9px 'Courier New'";
  ctx.textAlign = "center";
  ctx.fillText(`$${def.cost}`, x, r * CELL - 2);
}

function drawChargeBar() {
  const chipCell = { r: 8, c: 15 };
  const cx = chipCell.c * CELL + CELL / 2;
  const cy = chipCell.r * CELL - 8;
  const barW = 34;
  // Background
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(cx - barW / 2 - 1, cy - 1, barW + 2, 7);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(cx - barW / 2, cy, barW, 5);
  // Fill
  const chargePct = charge / 100;
  const col = charge > 50 ? "#00ff88" : charge > 25 ? "#ffdd00" : "#ff4444";
  ctx.fillStyle = col;
  ctx.fillRect(cx - barW / 2, cy, barW * chargePct, 5);
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(cx - barW / 2, cy, barW * chargePct, 2);
  // Label
  ctx.fillStyle = col;
  ctx.font = "bold 7px 'Courier New'";
  ctx.textAlign = "center";
  ctx.fillText(`${charge}%`, cx, cy - 3);
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
