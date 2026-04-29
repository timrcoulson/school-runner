import { Redis } from "@upstash/redis";

const LEADERBOARD_PREFIX = "school-runner:leaderboard";
const DEFAULT_GAME = "school-runner";
const ALLOWED_GAMES = ["school-runner", "tetris", "flappy", "chip-defense", "slither"];
const MAX_ENTRIES = 20;

function leaderboardKey(gameId) {
  return `${LEADERBOARD_PREFIX}:${gameId}`;
}

// ─── In-memory fallback for local dev ────────────────────────────
const memoryStores = {}; // { [key]: [{member, score}] }

function getMemoryStore(key) {
  if (!memoryStores[key]) memoryStores[key] = [];
  return memoryStores[key];
}

const memoryKV = {
  async zrange(key, start, end, opts = {}) {
    const store = getMemoryStore(key);
    const sorted = opts.rev
      ? [...store].sort((a, b) => b.score - a.score)
      : [...store].sort((a, b) => a.score - b.score);
    return sorted.slice(start, end + 1);
  },
  async zadd(key, entry) {
    getMemoryStore(key).push({ member: entry.member, score: entry.score });
  },
  async zcard(key) {
    return getMemoryStore(key).length;
  },
  async zremrangebyrank(key, start, end) {
    const store = getMemoryStore(key);
    const sorted = [...store].sort((a, b) => a.score - b.score);
    const toRemove = new Set(sorted.slice(start, end + 1).map((e) => e.member));
    for (let i = store.length - 1; i >= 0; i--) {
      if (toRemove.has(store[i].member)) store.splice(i, 1);
    }
  },
};

const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const store = useRedis
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : memoryKV;

if (!useRedis) {
  console.log("No Redis credentials — using in-memory leaderboard (dev mode)");
}

// ─── Helper ──────────────────────────────────────────────────────
function parseEntries(raw) {
  // Upstash may return [{member, score}] or a flat [member, score, member, score] array
  // Handle both formats
  if (!raw || raw.length === 0) return [];

  // Check if first element is an object with member property
  if (typeof raw[0] === "object" && raw[0] !== null && "member" in raw[0]) {
    return raw.map((e) => ({ name: e.member, score: e.score }));
  }

  // Flat array: [member, score, member, score, ...]
  const entries = [];
  for (let i = 0; i < raw.length; i += 2) {
    entries.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
  }
  return entries;
}

function resolveGameId(raw) {
  const id = (raw || DEFAULT_GAME).toString().toLowerCase();
  return ALLOWED_GAMES.includes(id) ? id : null;
}

async function getLeaderboard(gameId) {
  const key = leaderboardKey(gameId);
  const raw = await store.zrange(key, 0, MAX_ENTRIES - 1, {
    rev: true,
    withScores: true,
  });
  return parseEntries(raw);
}

// ─── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const gameId = resolveGameId(req.query.game);
      if (!gameId) {
        return res.status(400).json({ error: "Unknown game" });
      }
      return res.status(200).json({ leaderboard: await getLeaderboard(gameId) });
    }

    if (req.method === "POST") {
      const { name, score, game } = req.body;
      const gameId = resolveGameId(game);
      if (!gameId) {
        return res.status(400).json({ error: "Unknown game" });
      }

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (typeof score !== "number" || score < 0 || !Number.isFinite(score)) {
        return res.status(400).json({ error: "Valid score is required" });
      }

      const cleanName = name.trim().slice(0, 16).toUpperCase();
      const member = `${cleanName}::${Date.now()}`;
      const key = leaderboardKey(gameId);

      await store.zadd(key, { score, member });

      const count = await store.zcard(key);
      if (count > MAX_ENTRIES * 2) {
        await store.zremrangebyrank(key, 0, count - MAX_ENTRIES - 1);
      }

      return res.status(200).json({ leaderboard: await getLeaderboard(gameId) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
