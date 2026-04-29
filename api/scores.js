import { Redis } from "@upstash/redis";

const LEADERBOARD_KEY = "school-runner:leaderboard";
const MAX_ENTRIES = 20;

// ─── In-memory fallback for local dev ────────────────────────────
// Sorted set stored as an array of {member, score}, kept sorted desc.
// Resets when the serverless function cold-starts (fine for dev).
const memoryStore = [];

const memoryKV = {
  async zrange(_key, start, end, opts = {}) {
    const sorted = opts.rev
      ? [...memoryStore].sort((a, b) => b.score - a.score)
      : [...memoryStore].sort((a, b) => a.score - b.score);
    const slice = sorted.slice(start, end + 1);
    if (opts.withScores) return slice;
    return slice.map((e) => e.member);
  },
  async zadd(_key, { score, member }) {
    memoryStore.push({ member, score });
  },
  async zcard(_key) {
    return memoryStore.length;
  },
  async zremrangebyrank(_key, start, end) {
    const sorted = [...memoryStore].sort((a, b) => a.score - b.score);
    const toRemove = new Set(sorted.slice(start, end + 1).map((e) => e.member));
    let i = memoryStore.length;
    while (i--) {
      if (toRemove.has(memoryStore[i].member)) memoryStore.splice(i, 1);
    }
  },
};

// Use real Redis if env vars are set, otherwise in-memory
const useRedis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
const store = useRedis
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : memoryKV;

if (!useRedis) {
  console.log("⚠ No Redis credentials — using in-memory leaderboard (dev mode)");
}

// ─── Helper ──────────────────────────────────────────────────────
async function getLeaderboard() {
  const scores = await store.zrange(LEADERBOARD_KEY, 0, MAX_ENTRIES - 1, {
    rev: true,
    withScores: true,
  });
  return scores.map((entry) => ({
    name: entry.member ?? entry,
    score: entry.score ?? 0,
  }));
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

      // Trim to keep only top entries
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
