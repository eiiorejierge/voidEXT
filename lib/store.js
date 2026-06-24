// =============================================================================
// Storage layer
// -----------------------------------------------------------------------------
// Vercel serverless functions are stateless with an ephemeral filesystem, so we
// can't keep accounts in a JSON file. This talks to Vercel KV / Upstash Redis
// over its REST API (just fetch + a token — no SDK needed).
//
// In production, add a KV/Upstash store to the project from the Vercel dashboard
// (Storage tab). Vercel injects the env vars automatically. We accept either the
// Vercel KV names or the raw Upstash names.
//
// If no store is configured (e.g. local quick test) we fall back to an in-memory
// store. That only survives within a single warm process — fine for poking at
// it locally, NOT for real multi-user use. A warning is logged once.
// =============================================================================

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let warned = false;
function warnFallback() {
  if (warned) return;
  warned = true;
  console.warn(
    '[voidEXT] No KV/Upstash store configured (KV_REST_API_URL / KV_REST_API_TOKEN missing). ' +
      'Using in-memory storage — data will NOT persist. Add a KV store in the Vercel dashboard for production.'
  );
}

// ---- In-memory fallback (single-process only) -------------------------------
const mem = (globalThis.__voidMem = globalThis.__voidMem || {
  kv: new Map(),
  sets: new Map(),
  lists: new Map(),
});

function memCmd(args) {
  const [op, ...rest] = args;
  switch (String(op).toUpperCase()) {
    case 'GET':
      return mem.kv.has(rest[0]) ? mem.kv.get(rest[0]) : null;
    case 'SET':
      mem.kv.set(rest[0], String(rest[1]));
      return 'OK';
    case 'DEL':
      return mem.kv.delete(rest[0]) ? 1 : 0;
    case 'INCRBY': {
      const cur = Number(mem.kv.get(rest[0]) || 0) + Number(rest[1]);
      mem.kv.set(rest[0], String(cur));
      return cur;
    }
    case 'SADD': {
      const s = mem.sets.get(rest[0]) || new Set();
      const had = s.has(rest[1]);
      s.add(rest[1]);
      mem.sets.set(rest[0], s);
      return had ? 0 : 1;
    }
    case 'SREM': {
      const s = mem.sets.get(rest[0]);
      return s && s.delete(rest[1]) ? 1 : 0;
    }
    case 'SMEMBERS':
      return Array.from(mem.sets.get(rest[0]) || []);
    case 'RPUSH': {
      const l = mem.lists.get(rest[0]) || [];
      l.push(rest[1]);
      mem.lists.set(rest[0], l);
      return l.length;
    }
    case 'LRANGE': {
      const l = mem.lists.get(rest[0]) || [];
      let [a, b] = [Number(rest[1]), Number(rest[2])];
      if (b < 0) b = l.length + b;
      return l.slice(a, b + 1);
    }
    default:
      return null;
  }
}

// ---- Command dispatch -------------------------------------------------------
async function cmd(args) {
  if (!REST_URL || !REST_TOKEN) {
    warnFallback();
    return memCmd(args);
  }
  const r = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    throw new Error(`KV error ${r.status}: ${await r.text()}`);
  }
  const j = await r.json();
  return j.result;
}

module.exports = {
  hasStore: Boolean(REST_URL && REST_TOKEN),
  get: (k) => cmd(['GET', k]),
  set: (k, v) => cmd(['SET', k, v]),
  del: (k) => cmd(['DEL', k]),
  incrby: (k, n) => cmd(['INCRBY', k, n]),
  sadd: (k, m) => cmd(['SADD', k, m]),
  srem: (k, m) => cmd(['SREM', k, m]),
  smembers: (k) => cmd(['SMEMBERS', k]),
  rpush: (k, v) => cmd(['RPUSH', k, v]),
  lrange: (k, a, b) => cmd(['LRANGE', k, a, b]),
};
