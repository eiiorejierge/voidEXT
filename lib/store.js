// =============================================================================
// Storage layer
// -----------------------------------------------------------------------------
// Railway uses DATABASE_URL and a Postgres-backed key/value table. Existing
// Upstash Redis REST deployments remain supported. Local development falls
// back to process memory.
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let pool = null;
let postgresReady = null;

function postgresPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    pool.on('error', function (error) {
      console.error('[Scale XT] Postgres pool error:', error.message);
    });
  }
  return pool;
}

function ensurePostgres() {
  if (!postgresReady) {
    postgresReady = postgresPool().query(
      'CREATE TABLE IF NOT EXISTS scale_xt_store (' +
        'key TEXT PRIMARY KEY,' +
        'kind TEXT NOT NULL,' +
        'value TEXT NOT NULL,' +
        'expires_at BIGINT,' +
        'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()' +
      ');' +
      'CREATE INDEX IF NOT EXISTS scale_xt_store_expiry_idx ' +
        'ON scale_xt_store (expires_at) WHERE expires_at IS NOT NULL;'
    ).catch(function (error) {
      postgresReady = null;
      throw error;
    });
  }
  return postgresReady;
}

async function pgRow(key, client) {
  const db = client || postgresPool();
  const found = await db.query(
    'SELECT kind, value, expires_at FROM scale_xt_store WHERE key = $1',
    [key]
  );
  const row = found.rows[0] || null;
  if (row && row.expires_at != null && Number(row.expires_at) <= Date.now()) {
    await db.query('DELETE FROM scale_xt_store WHERE key = $1', [key]);
    return null;
  }
  return row;
}

async function pgWrite(key, kind, value, client) {
  const db = client || postgresPool();
  await db.query(
    'INSERT INTO scale_xt_store (key, kind, value, expires_at, updated_at) ' +
    'VALUES ($1, $2, $3, NULL, NOW()) ' +
    'ON CONFLICT (key) DO UPDATE SET ' +
      'kind = EXCLUDED.kind, value = EXCLUDED.value, expires_at = NULL, updated_at = NOW()',
    [key, kind, String(value)]
  );
}

async function pgIncrement(key, amount) {
  const client = await postgresPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    const row = await pgRow(key, client);
    const next = Number(row && row.kind === 'string' ? row.value : 0) + Number(amount);
    await pgWrite(key, 'string', String(next), client);
    await client.query('COMMIT');
    return next;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function pgCollection(key, kind, mutate) {
  const client = await postgresPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    const row = await pgRow(key, client);
    let current = [];
    if (row && row.kind === kind) {
      try { current = JSON.parse(row.value); } catch (error) { current = []; }
    }
    if (!Array.isArray(current)) current = [];
    const result = mutate(current);
    await pgWrite(key, kind, JSON.stringify(current), client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function pgCmd(args) {
  await ensurePostgres();
  const op = String(args[0]).toUpperCase();
  const key = args[1];

  switch (op) {
    case 'PING':
      await postgresPool().query('SELECT 1');
      return 'PONG';
    case 'GET': {
      const row = await pgRow(key);
      return row && row.kind === 'string' ? row.value : null;
    }
    case 'SET':
      await pgWrite(key, 'string', args[2]);
      return 'OK';
    case 'DEL': {
      const deleted = await postgresPool().query('DELETE FROM scale_xt_store WHERE key = $1', [key]);
      return deleted.rowCount;
    }
    case 'INCR':
      return pgIncrement(key, 1);
    case 'INCRBY':
      return pgIncrement(key, Number(args[2]));
    case 'EXPIRE': {
      const expiresAt = Date.now() + Math.max(0, Number(args[2]) || 0) * 1000;
      const updated = await postgresPool().query(
        'UPDATE scale_xt_store SET expires_at = $2, updated_at = NOW() WHERE key = $1',
        [key, expiresAt]
      );
      return updated.rowCount ? 1 : 0;
    }
    case 'TTL': {
      const row = await pgRow(key);
      if (!row) return -2;
      if (row.expires_at == null) return -1;
      return Math.max(0, Math.ceil((Number(row.expires_at) - Date.now()) / 1000));
    }
    case 'SADD':
      return pgCollection(key, 'set', function (items) {
        if (items.includes(args[2])) return 0;
        items.push(args[2]);
        return 1;
      });
    case 'SREM':
      return pgCollection(key, 'set', function (items) {
        const index = items.indexOf(args[2]);
        if (index < 0) return 0;
        items.splice(index, 1);
        return 1;
      });
    case 'SMEMBERS': {
      const row = await pgRow(key);
      if (!row || row.kind !== 'set') return [];
      try {
        const items = JSON.parse(row.value);
        return Array.isArray(items) ? items : [];
      } catch (error) {
        return [];
      }
    }
    case 'RPUSH':
      return pgCollection(key, 'list', function (items) {
        items.push(args[2]);
        return items.length;
      });
    case 'LRANGE': {
      const row = await pgRow(key);
      let items = [];
      if (row && row.kind === 'list') {
        try { items = JSON.parse(row.value); } catch (error) { items = []; }
      }
      if (!Array.isArray(items)) items = [];
      let start = Number(args[2]);
      let end = Number(args[3]);
      if (start < 0) start = Math.max(0, items.length + start);
      if (end < 0) end = items.length + end;
      return items.slice(start, end + 1);
    }
    case 'SCAN': {
      const matchAt = args.indexOf('MATCH');
      const pattern = matchAt >= 0 ? args[matchAt + 1] : '*';
      const escaped = String(pattern).replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const expression = new RegExp('^' + escaped + '$');
      const rows = await postgresPool().query(
        'SELECT key FROM scale_xt_store WHERE expires_at IS NULL OR expires_at > $1 ORDER BY key',
        [Date.now()]
      );
      return ['0', rows.rows.map(function (row) { return row.key; }).filter(function (item) {
        return expression.test(item);
      })];
    }
    default:
      return null;
  }
}

let warned = false;
function warnFallback() {
  if (warned) return;
  warned = true;
  console.warn(
    '[Scale XT] No persistent store configured. Set DATABASE_URL on Railway. ' +
    'Using in-memory storage; data will not survive a restart.'
  );
}

const mem = (globalThis.__voidMem = globalThis.__voidMem || {
  kv: new Map(),
  sets: new Map(),
  lists: new Map(),
  exp: new Map(),
});

function memExpired(key) {
  const expires = mem.exp.get(key);
  if (expires != null && Date.now() > expires) {
    mem.kv.delete(key);
    mem.sets.delete(key);
    mem.lists.delete(key);
    mem.exp.delete(key);
    return true;
  }
  return false;
}

function memCmd(args) {
  const op = String(args[0]).toUpperCase();
  const key = args[1];
  memExpired(key);

  switch (op) {
    case 'PING':
      return 'PONG';
    case 'GET':
      return mem.kv.has(key) ? mem.kv.get(key) : null;
    case 'SET':
      mem.kv.set(key, String(args[2]));
      mem.exp.delete(key);
      return 'OK';
    case 'DEL': {
      const existed = mem.kv.has(key) || mem.sets.has(key) || mem.lists.has(key);
      mem.kv.delete(key);
      mem.sets.delete(key);
      mem.lists.delete(key);
      mem.exp.delete(key);
      return existed ? 1 : 0;
    }
    case 'INCR':
    case 'INCRBY': {
      const amount = op === 'INCR' ? 1 : Number(args[2]);
      const next = Number(mem.kv.get(key) || 0) + amount;
      mem.kv.set(key, String(next));
      return next;
    }
    case 'EXPIRE':
      mem.exp.set(key, Date.now() + Number(args[2]) * 1000);
      return 1;
    case 'TTL': {
      const expires = mem.exp.get(key);
      if (expires == null) {
        return mem.kv.has(key) || mem.sets.has(key) || mem.lists.has(key) ? -1 : -2;
      }
      return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
    }
    case 'SADD': {
      const set = mem.sets.get(key) || new Set();
      const had = set.has(args[2]);
      set.add(args[2]);
      mem.sets.set(key, set);
      return had ? 0 : 1;
    }
    case 'SREM': {
      const set = mem.sets.get(key);
      return set && set.delete(args[2]) ? 1 : 0;
    }
    case 'SMEMBERS':
      return Array.from(mem.sets.get(key) || []);
    case 'RPUSH': {
      const list = mem.lists.get(key) || [];
      list.push(args[2]);
      mem.lists.set(key, list);
      return list.length;
    }
    case 'LRANGE': {
      const list = mem.lists.get(key) || [];
      let start = Number(args[2]);
      let end = Number(args[3]);
      if (start < 0) start = Math.max(0, list.length + start);
      if (end < 0) end = list.length + end;
      return list.slice(start, end + 1);
    }
    case 'SCAN': {
      const matchAt = args.indexOf('MATCH');
      const pattern = matchAt >= 0 ? args[matchAt + 1] : '*';
      const expression = new RegExp(
        '^' + String(pattern).replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
      );
      const keys = [...mem.kv.keys(), ...mem.sets.keys(), ...mem.lists.keys()];
      return ['0', [...new Set(keys)].filter(function (item) { return expression.test(item); })];
    }
    default:
      return null;
  }
}

async function redisCmd(args) {
  const response = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + REST_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error('KV error ' + response.status + ': ' + await response.text());
  const payload = await response.json();
  return payload.result;
}

async function cmd(args) {
  if (DATABASE_URL) return pgCmd(args);
  if (REST_URL && REST_TOKEN) return redisCmd(args);
  warnFallback();
  return memCmd(args);
}

function postgresTargetType() {
  if (!DATABASE_URL) return 'missing';
  if (String(DATABASE_URL).includes('$' + '{{')) return 'unresolved-reference';
  try {
    const hostname = new URL(DATABASE_URL).hostname.toLowerCase();
    if (hostname.endsWith('.railway.internal')) return 'railway-private';
    if (hostname.endsWith('.proxy.rlwy.net')) return 'railway-public';
    return hostname ? 'external' : 'invalid-url';
  } catch (error) {
    return 'invalid-url';
  }
}

function postgresErrorCode(error) {
  const code = String(error && error.code ? error.code : '').toUpperCase();
  if (/^[A-Z0-9_]{2,32}$/.test(code)) return code;
  const message = String(error && error.message ? error.message : '').toLowerCase();
  if (message.includes('password authentication')) return 'AUTH_FAILED';
  if (message.includes('invalid url') || message.includes('connection string')) return 'INVALID_DATABASE_URL';
  return 'CONNECTION_FAILED';
}

async function health() {
  if (DATABASE_URL) {
    try {
      const reply = await pgCmd(['PING']);
      return {
        configured: true,
        persistent: true,
        reachable: reply === 'PONG',
        provider: 'postgres',
        target: postgresTargetType(),
      };
    } catch (error) {
      console.error('[Scale XT] Postgres health check failed:', error.message);
      return {
        configured: true,
        persistent: true,
        reachable: false,
        provider: 'postgres',
        target: postgresTargetType(),
        errorCode: postgresErrorCode(error),
      };
    }
  }
  if (REST_URL && REST_TOKEN) {
    try {
      const reply = await redisCmd(['PING']);
      return { configured: true, persistent: true, reachable: reply === 'PONG', provider: 'upstash-redis' };
    } catch (error) {
      return { configured: true, persistent: true, reachable: false, provider: 'upstash-redis' };
    }
  }
  return { configured: false, persistent: false, reachable: true, provider: 'memory' };
}

module.exports = {
  hasStore: Boolean(DATABASE_URL || (REST_URL && REST_TOKEN)),
  health,
  get: function (key) { return cmd(['GET', key]); },
  set: function (key, value) { return cmd(['SET', key, value]); },
  del: function (key) { return cmd(['DEL', key]); },
  incr: function (key) { return cmd(['INCR', key]); },
  incrby: function (key, amount) { return cmd(['INCRBY', key, amount]); },
  expire: function (key, seconds) { return cmd(['EXPIRE', key, seconds]); },
  ttl: function (key) { return cmd(['TTL', key]); },
  sadd: function (key, member) { return cmd(['SADD', key, member]); },
  srem: function (key, member) { return cmd(['SREM', key, member]); },
  smembers: function (key) { return cmd(['SMEMBERS', key]); },
  scan: async function (pattern) {
    const result = await cmd(['SCAN', '0', 'MATCH', pattern, 'COUNT', 500]);
    return Array.isArray(result) && Array.isArray(result[1]) ? result[1] : [];
  },
  rpush: function (key, value) { return cmd(['RPUSH', key, value]); },
  lrange: function (key, start, end) { return cmd(['LRANGE', key, start, end]); },
};