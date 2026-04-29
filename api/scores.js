import { Redis } from "@upstash/redis";

const LEADERBOARD_KEY = "school-runner:leaderboard";
const MAX_ENTRIES = 20;

// ─── In-memory fallback for local dev ────────────────────────────
const memoryStore = []; // [{member, score}]

const memoryKV = {
  async zrange(_key, start, end, opts = {}) {
    const sorted = opts.rev
      ? [...memoryStore].sort((a, b) => b.score - a.score)
      : [...memoryStore].sort((a, b) => a.score - b.score);
    return sorted.slice(start, end + 1);
  },
  async zadd(_key, entry) {
    memoryStore.push({ member: entry.member, score: entry.score });
  },
  async zcard(_key) {
    return memoryStore.length;
  },
  async zremrangebyrank(_key, start, end) {
    const sorted = [...memoryStore].sort((a, b) => a.score - b.score);
    const toRemove = new Set(sorted.slice(start, end + 1).map((e) => e.member));
    for (let i = memoryStore.length - 1; i >= 0; i--) {
      if (toRemove.has(memoryStore[i].member)) memoryStore.splice(i, 1);
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

async function getLeaderboard() {
  const raw = await store.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, {
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
      return res.status(200).json({ leaderboard: await getLeaderboard() });
    }

    if (req.method === "POST") {
      const { name, score } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (typeof score !== "number" || score < 0 || !Number.isFinite(score)) {
        return res.status(400).json({ error: "Valid score is required" });
      }

      const cleanName = name.trim().slice(0, 16).toUpperCase();
      const member = `${cleanName}::${Date.now()}`;

      await store.zadd(LEADERBOARD_KEY, { score, member });

      const count = await store.zcard(LEADERBOARD_KEY);
      if (count > MAX_ENTRIES * 2) {
        await store.zremrangebyrank(LEADERBOARD_KEY, 0, count - MAX_ENTRIES - 1);
      }

      return res.status(200).json({ leaderboard: await getLeaderboard() });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
