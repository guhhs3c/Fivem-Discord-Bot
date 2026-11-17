import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { config } from '../config/config.js';
import { getDb } from '../database/db.js';
import { getActiveLoops } from '../commands/player/loop.js';
import { getActiveMonitors } from '../services/monitor/monitorService.js';
import { registerPremium } from './premium.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [
    d && `${d}d`,
    h && `${h}h`,
    m && `${m}m`,
    `${s}s`
  ].filter(Boolean).join(' ');
}

// ============================================================
// LIVE FIVE M STATUS
// ============================================================

const liveStatusCache = new Map();
const firstSeenOnline = new Map();

function liveStatusKey(server) {
  return server.cfx_code || server.endpoint || server.alias || server.name;
}

function normalizeEndpoint(value) {
  if (!value || typeof value !== 'string') return null;

  let v = value.trim();

  if (!v) return null;

  if (!/^https?:\/\//i.test(v)) {
    v = `http://${v}`;
  }

  return v.replace(/\/+$/, '');
}

function isDirectEndpoint(value) {
  if (!value || typeof value !== 'string') return false;

  return /^(?:https?:\/\/)?(?:[a-z0-9.-]+|\[[0-9a-f:]+\]):\d{2,6}$/i.test(
    value.trim()
  );
}

function buildLiveResult(data, elapsedMs, key) {
  const info = data?.Data || data?.data || data;

  if (!info || typeof info !== 'object') {
    return null;
  }

  const clients =
    Array.isArray(info.players)
      ? info.players.length
      : Array.isArray(info.clients)
        ? info.clients.length
        : Number.isFinite(Number(info.clients))
          ? Number(info.clients)
          : Number.isFinite(Number(info.vars?.clients))
            ? Number(info.vars.clients)
            : null;

  const maxPlayers =
    Number.isFinite(Number(info.sv_maxclients))
      ? Number(info.sv_maxclients)
      : Number.isFinite(Number(info.vars?.sv_maxClients))
        ? Number(info.vars.sv_maxClients)
        : Number.isFinite(Number(info.vars?.sv_maxclients))
          ? Number(info.vars.sv_maxclients)
          : null;

  if (!firstSeenOnline.has(key)) {
    firstSeenOnline.set(key, Date.now());
  }

  return {
    status: 'online',
    players: clients,
    maxPlayers,
    ping: elapsedMs,
    uptime: formatUptime(
      (Date.now() - firstSeenOnline.get(key)) / 1000
    )
  };
}

async function fetchJson(url) {
  const startedAt = Date.now();

  const response = await axios.get(url, {
    timeout: Math.max(
      Number(config.fivem?.timeout) || 8000,
      5000
    ),

    validateStatus: status =>
      status >= 200 && status < 300,

    headers: {
      'User-Agent': 'STRONAUT-Server-Monitor/1.0',
      'Accept': 'application/json'
    }
  });

  return {
    data: response.data,
    elapsedMs: Date.now() - startedAt
  };
}

async function fetchLiveStatus(server) {
  const key = liveStatusKey(server);

  if (!key) {
    return {
      status: 'offline',
      players: null,
      maxPlayers: null,
      ping: null,
      uptime: null
    };
  }

  const cached = liveStatusCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let result = {
    status: 'offline',
    players: null,
    maxPlayers: null,
    ping: null,
    uptime: null
  };

  // CFX lookup
  if (server.cfx_code) {
    const code = String(server.cfx_code)
      .trim()
      .replace(
        /^https?:\/\/cfx\.re\/join\//i,
        ''
      );

    const base = String(
      config.fivem?.apiBase ||
      'https://servers-frontend.fivem.net/api/servers/single'
    ).replace(/\/+$/, '');

    try {
      const { data, elapsedMs } =
        await fetchJson(
          `${base}/${encodeURIComponent(code)}`
        );

      const live =
        buildLiveResult(
          data,
          elapsedMs,
          key
        );

      if (live) {
        result = live;
      }
    } catch (err) {
      console.warn(
        `[ServerMonitor] CFX lookup failed for ${server.name || key}: ` +
        `${err.response?.status || err.code || err.message}`
      );
    }
  }

  // Direct endpoint fallback
  if (
    result.status !== 'online' &&
    isDirectEndpoint(server.endpoint)
  ) {
    const endpoint =
      normalizeEndpoint(server.endpoint);

    for (
      const pathName of [
        '/dynamic.json',
        '/info.json'
      ]
    ) {
      try {
        const { data, elapsedMs } =
          await fetchJson(
            `${endpoint}${pathName}`
          );

        const live =
          buildLiveResult(
            data,
            elapsedMs,
            key
          );

        if (live) {
          result = live;
          break;
        }
      } catch (err) {
        console.warn(
          `[ServerMonitor] ${pathName} failed for ${server.name || key}: ` +
          `${err.response?.status || err.code || err.message}`
        );
      }
    }
  }

  if (result.status !== 'online') {
    firstSeenOnline.delete(key);
  }

  liveStatusCache.set(key, {
    data: result,
    expiresAt: Date.now() + 15000
  });

  return result;
}

// ============================================================
// DATABASE SCHEMA
// ============================================================

function ensureSchema(db) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      server_input TEXT NOT NULL,
      interval_sec INTEGER DEFAULT 60,
      created_by TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
}

// ============================================================
// DASHBOARD
// ============================================================

export function startDashboard(client) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers
  app.use((req, res, next) => {
    res.setHeader(
      'X-Content-Type-Options',
      'nosniff'
    );

    res.setHeader(
      'X-Frame-Options',
      'DENY'
    );

    res.setHeader(
      'Referrer-Policy',
      'strict-origin-when-cross-origin'
    );

    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    next();
  });

  app.use(
    express.json({
      limit: '256kb'
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: '256kb'
    })
  );

  // Database
  try {
    ensureSchema(getDb());
  } catch (err) {
    console.error(
      '[Dashboard] Gagal memastikan skema database:',
      err.message
    );
  }

  if (
    !config.dashboard.user ||
    !config.dashboard.pass
  ) {
    console.warn(
      '[Dashboard] DASHBOARD_USER/DASHBOARD_PASS belum diisi.'
    );
  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================

  const publicOrigin =
    config.dashboard.publicOrigin;

  const configuredOrigins =
    publicOrigin
      ? publicOrigin
          .split(',')
          .map(o => o.trim())
          .filter(Boolean)
      : [];

  function isAllowedOrigin(origin) {
    if (!origin) return true;

    if (origin === 'null') return true;

    if (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
        .test(origin)
    ) {
      return true;
    }

    return configuredOrigins.includes(origin);
  }

  const publicCors = cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(
        `[Dashboard] Origin ditolak di /api/public/*: ${origin}`
      );

      callback(null, false);
    },

    methods: ['GET']
  });

  console.log(
    `[Dashboard] /api/public/* aktif — origin diizinkan: ` +
    `localhost/127.0.0.1 (dev)` +
    (
      configuredOrigins.length
        ? ` + ${configuredOrigins.join(', ')}`
        : ' (PUBLIC_SITE_ORIGIN kosong)'
    )
  );

  const publicRouter =
    express.Router();

  // Public status
  publicRouter.get(
    '/api/public/status',
    (req, res) => {
      const guilds =
        client.guilds.cache.size;

      res.json({
        botName: config.bot.name,
        version: config.bot.version,
        status: client.isReady()
          ? 'online'
          : 'offline',
        uptime: formatUptime(
          process.uptime()
        ),
        guilds,

        inviteUrl:
          config.bot.inviteUrl ||
          (
            client.user?.id
              ? `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&permissions=0`
              : '#'
          )
      });
    }
  );

  // Public servers
  publicRouter.get(
    '/api/public/servers',
    async (req, res) => {
      try {
        const db = getDb();

        const rows = db.prepare(`
          SELECT
            name,
            alias,
            endpoint,
            cfx_code,
            banner_url
          FROM servers
          WHERE is_active = 1
          ORDER BY name ASC
        `).all();

        const withStatus =
          await Promise.all(
            rows.map(
              async row => {
                const live =
                  await fetchLiveStatus(row);

                return {
                  name: row.name,
                  alias: row.alias,
                  banner_url:
                    row.banner_url,
                  ...live
                };
              }
            )
          );

        res.json(withStatus);

      } catch (err) {
        console.error(
          '[Dashboard] Gagal mengambil /api/public/servers:',
          err.message
        );

        res.status(500).json({
          error:
            'Gagal mengambil data server'
        });
      }
    }
  );

  app.use(
    publicCors,
    publicRouter
  );

  // ==========================================================
  // SESSION AUTH
  // ==========================================================

  const sessions = new Map();

  const SESSION_TTL =
    12 * 60 * 60 * 1000;

  function parseCookies(req) {
    const out = {};

    const raw =
      req.headers.cookie || '';

    raw.split(';').forEach(part => {
      const i =
        part.indexOf('=');

      if (i > -1) {
        out[
          part
            .slice(0, i)
            .trim()
        ] =
          decodeURIComponent(
            part
              .slice(i + 1)
              .trim()
          );
      }
    });

    return out;
  }

  function safeEqual(a, b) {
    const aa =
      Buffer.from(
        String(a ?? '')
      );

    const bb =
      Buffer.from(
        String(b ?? '')
      );

    return (
      aa.length === bb.length &&
      crypto.timingSafeEqual(
        aa,
        bb
      )
    );
  }

  function cleanupSessions() {
    const now = Date.now();

    for (
      const [
        token,
        session
      ] of sessions
    ) {
      if (
        session.expiresAt <= now
      ) {
        sessions.delete(token);
      }
    }
  }

  setInterval(
    cleanupSessions,
    15 * 60 * 1000
  ).unref();

  function requireAdmin(
    req,
    res,
    next
  ) {
    const token =
      parseCookies(req)
        .stronaut_admin;

    const session =
      token
        ? sessions.get(token)
        : null;

    if (
      !session ||
      session.expiresAt <= Date.now()
    ) {
      if (token) {
        sessions.delete(token);
      }

      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
        code: 'ADMIN_LOGIN_REQUIRED'
      });
    }

    session.expiresAt =
      Date.now() + SESSION_TTL;

    req.admin = {
      username:
        session.username
    };

    next();
  }

  // ==========================================================
  // LOGIN RATE LIMIT
  // ==========================================================

  const loginAttempts =
    new Map();

  const LOGIN_WINDOW_MS =
    15 * 60 * 1000;

  const LOGIN_MAX_ATTEMPTS = 10;

  function loginRateLimit(
    req,
    res,
    next
  ) {
    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();

    const current =
      loginAttempts.get(ip) || {
        count: 0,
        resetAt:
          now + LOGIN_WINDOW_MS
      };

    if (
      current.resetAt <= now
    ) {
      current.count = 0;
      current.resetAt =
        now + LOGIN_WINDOW_MS;
    }

    if (
      current.count >=
      LOGIN_MAX_ATTEMPTS
    ) {
      const retryAfter =
        Math.ceil(
          (
            current.resetAt -
            now
          ) / 1000
        );

      res.setHeader(
        'Retry-After',
        retryAfter
      );

      return res.status(429).json({
        ok: false,
        error:
          'Terlalu banyak percobaan login. Coba lagi nanti.'
      });
    }

    current.count += 1;

    loginAttempts.set(
      ip,
      current
    );

    next();
  }

  setInterval(
    () => {
      const now = Date.now();

      for (
        const [
          ip,
          entry
        ] of loginAttempts
      ) {
        if (
          entry.resetAt <= now
        ) {
          loginAttempts.delete(ip);
        }
      }
    },
    LOGIN_WINDOW_MS
  ).unref();

  // ==========================================================
  // AUTH LOGIN
  // ==========================================================

  app.post(
    '/api/auth/login',
    loginRateLimit,
    (req, res) => {
      const username =
        String(
          req.body?.username || ''
        ).trim();

      const password =
        String(
          req.body?.password || ''
        );

      if (
        !safeEqual(
          username,
          config.dashboard.user
        ) ||
        !safeEqual(
          password,
          config.dashboard.pass
        )
      ) {
        return res.status(401).json({
          ok: false,
          error:
            'Username atau password admin salah.'
        });
      }

      const token =
        crypto
          .randomBytes(32)
          .toString('hex');

      sessions.set(
        token,
        {
          username,
          expiresAt:
            Date.now() +
            SESSION_TTL
        }
      );

      loginAttempts.delete(
        req.ip ||
        req.socket.remoteAddress ||
        'unknown'
      );

      const secure =
        req.headers[
          'x-forwarded-proto'
        ] === 'https' ||
        req.secure;

      res.setHeader(
        'Set-Cookie',
        `stronaut_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${secure ? '; Secure' : ''}`
      );

      res.json({
        ok: true,
        username,
        expiresIn:
          SESSION_TTL
      });
    }
  );

  app.get(
    '/api/auth/me',
    (req, res) => {
      const token =
        parseCookies(req)
          .stronaut_admin;

      const session =
        token
          ? sessions.get(token)
          : null;

      if (
        !session ||
        session.expiresAt <= Date.now()
      ) {
        if (token) {
          sessions.delete(token);
        }

        return res.status(401).json({
          ok: false,
          authenticated: false
        });
      }

      session.expiresAt =
        Date.now() + SESSION_TTL;

      res.json({
        ok: true,
        authenticated: true,
        username:
          session.username,
        expiresAt:
          session.expiresAt
      });
    }
  );

  app.post(
    '/api/auth/logout',
    (req, res) => {
      const token =
        parseCookies(req)
          .stronaut_admin;

      if (token) {
        sessions.delete(token);
      }

      res.setHeader(
        'Set-Cookie',
        'stronaut_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      );

      res.json({
        ok: true
      });
    }
  );

  // Premium checkout (Pakasir) — rute publik, harus sebelum requireAdmin
  const registerPremiumAdmin = registerPremium(app, {
    getDb,
    client,
    requireAdmin
  });

  // ==========================================================
  // STATIC DASHBOARD
  // ==========================================================

  app.use(
    express.static(
      path.join(
        __dirname,
        'public'
      ),
      {
        index: 'index.html'
      }
    )
  );

  // Semua API admin membutuhkan login
  app.use(
    '/api',
    requireAdmin
  );

  if (registerPremiumAdmin) registerPremiumAdmin();

  app.use(
    '/api',
    (req, res, next) => {
      res.setHeader(
        'Cache-Control',
        'no-store'
      );

      next();
    }
  );

  // ==========================================================
  // BOT STATS
  // ==========================================================

  app.get(
    '/api/stats',
    (req, res) => {
      const guilds =
        client.guilds.cache.size;

      let totalUsers = 0;

      client.guilds.cache.forEach(
        guild => {
          totalUsers +=
            guild.memberCount;
        }
      );

      res.json({
        botName:
          config.bot.name,

        version:
          config.bot.version,

        status:
          client.isReady()
            ? 'online'
            : 'offline',

        uptime:
          formatUptime(
            process.uptime()
          ),

        uptimeSeconds:
          Math.floor(
            process.uptime()
          ),

        guilds,
        totalUsers,

        activeLoops:
          getActiveLoops().size,

        activeMonitors:
          getActiveMonitors().size,

        wsLatency:
          client.ws.ping >= 0
            ? client.ws.ping
            : null,

        prefix:
          config.bot.prefix,

        nodeVersion:
          process.version,

        memoryMB:
          Math.round(
            process
              .memoryUsage()
              .heapUsed /
            1024 /
            1024
          )
      });
    }
  );

  // ==========================================================
  // SERVERS
  // ==========================================================

  app.get(
    '/api/servers',
    (req, res) => {
      try {
        const db = getDb();

        const servers =
          db.prepare(`
            SELECT *
            FROM servers
            ORDER BY
              is_active DESC,
              name ASC
          `).all();

        res.json(servers);

      } catch {
        res.json([]);
      }
    }
  );

  app.post(
    '/api/servers',
    (req, res) => {
      try {
        const {
          name,
          endpoint,
          alias,
          banner_url
        } = req.body;

        if (
          !name ||
          !endpoint
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'name dan endpoint wajib diisi'
          });
        }

        const isCfx =
          /^[a-zA-Z0-9]+$/.test(
            endpoint
          ) &&
          !endpoint.includes(':');

        const db = getDb();

        db.prepare(`
          INSERT INTO servers
          (
            name,
            cfx_code,
            endpoint,
            alias,
            banner_url,
            added_by
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          name,
          isCfx
            ? endpoint
            : null,
          endpoint,
          alias || '',
          banner_url || null,
          'dashboard'
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  app.put(
    '/api/servers/:id',
    (req, res) => {
      try {
        const db = getDb();

        const existing =
          db.prepare(`
            SELECT *
            FROM servers
            WHERE id = ?
          `).get(
            req.params.id
          );

        if (!existing) {
          return res.status(404).json({
            ok: false,
            error:
              'Server tidak ditemukan'
          });
        }

        const name =
          req.body.name ??
          existing.name;

        const endpoint =
          req.body.endpoint ??
          existing.endpoint;

        const alias =
          req.body.alias ??
          existing.alias;

        const banner_url =
          req.body.banner_url ??
          existing.banner_url;

        if (
          !name ||
          !endpoint
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'name dan endpoint wajib diisi'
          });
        }

        const isCfx =
          /^[a-zA-Z0-9]+$/.test(
            endpoint
          ) &&
          !endpoint.includes(':');

        db.prepare(`
          UPDATE servers
          SET
            name = ?,
            cfx_code = ?,
            endpoint = ?,
            alias = ?,
            banner_url = ?
          WHERE id = ?
        `).run(
          name,
          isCfx
            ? endpoint
            : null,
          endpoint,
          alias,
          banner_url,
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  app.delete(
    '/api/servers/:id',
    (req, res) => {
      try {
        const db = getDb();

        db.prepare(`
          UPDATE servers
          SET is_active = 0
          WHERE id = ?
        `).run(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  app.post(
    '/api/servers/:id/restore',
    (req, res) => {
      try {
        const db = getDb();

        db.prepare(`
          UPDATE servers
          SET is_active = 1
          WHERE id = ?
        `).run(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  // ==========================================================
  // REQUESTS
  // ==========================================================

  app.get(
    '/api/requests',
    (req, res) => {
      try {
        const db = getDb();

        const rows =
          db.prepare(`
            SELECT *
            FROM server_requests
            ORDER BY created_at DESC
            LIMIT 50
          `).all();

        res.json(rows);

      } catch {
        res.json([]);
      }
    }
  );

  app.post(
    '/api/requests/:id/approve',
    (req, res) => {
      try {
        const db = getDb();

        const request =
          db.prepare(`
            SELECT *
            FROM server_requests
            WHERE id = ?
          `).get(
            req.params.id
          );

        if (!request) {
          return res.status(404).json({
            ok: false,
            error:
              'Request tidak ditemukan'
          });
        }

        const isCfx =
          /^[a-zA-Z0-9]+$/.test(
            request.cfx_code
          ) &&
          !request.cfx_code.includes(':');

        db.prepare(`
          INSERT INTO servers
          (
            name,
            cfx_code,
            endpoint,
            alias,
            added_by
          )
          VALUES (?, ?, ?, ?, ?)
        `).run(
          request.name,
          isCfx
            ? request.cfx_code
            : null,
          request.cfx_code,
          request.name
            .toLowerCase()
            .replace(/\s+/g, ''),
          'approved'
        );

        db.prepare(`
          UPDATE server_requests
          SET status = 'approved'
          WHERE id = ?
        `).run(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  app.post(
    '/api/requests/:id/reject',
    (req, res) => {
      try {
        const db = getDb();

        db.prepare(`
          UPDATE server_requests
          SET status = 'rejected'
          WHERE id = ?
        `).run(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  // ==========================================================
  // LOOPS
  // ==========================================================

  app.get(
    '/api/loops',
    (req, res) => {
      try {
        const db = getDb();

        const rows =
          db.prepare(`
            SELECT *
            FROM loopfinder
            WHERE is_active = 1
            ORDER BY created_at DESC
          `).all();

        const active =
          getActiveLoops();

        res.json({
          count: active.size,
          entries: rows
        });

      } catch {
        res.json({
          count: 0,
          entries: []
        });
      }
    }
  );

  app.delete(
    '/api/loops/:id',
    (req, res) => {
      try {
        const db = getDb();

        db.prepare(`
          UPDATE loopfinder
          SET is_active = 0
          WHERE id = ?
        `).run(
          req.params.id
        );

        const active =
          getActiveLoops();

        active.delete?.(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  // ==========================================================
  // MONITORS
  // ==========================================================

  app.get(
    '/api/monitors',
    (req, res) => {
      try {
        const db = getDb();

        const rows =
          db.prepare(`
            SELECT *
            FROM monitors
            WHERE is_active = 1
            ORDER BY created_at DESC
          `).all();

        res.json({
          count:
            getActiveMonitors().size,
          entries: rows
        });

      } catch {
        res.json({
          count: 0,
          entries: []
        });
      }
    }
  );

  app.delete(
    '/api/monitors/:id',
    (req, res) => {
      try {
        const db = getDb();

        db.prepare(`
          UPDATE monitors
          SET is_active = 0
          WHERE id = ?
        `).run(
          req.params.id
        );

        const active =
          getActiveMonitors();

        active.delete?.(
          req.params.id
        );

        res.json({
          ok: true
        });

      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err.message
        });
      }
    }
  );

  // ==========================================================
  // DASHBOARD FALLBACK
  //
  // Express 5 tidak menerima app.get('*').
  // Gunakan /{*splat} agar / dan route lain masuk ke index.html.
  // ==========================================================

  app.get(
    '/{*splat}',
    (req, res) => {
      res.sendFile(
        path.join(
          __dirname,
          'public',
          'index.html'
        )
      );
    }
  );

  // ==========================================================
  // START SERVER
  // ==========================================================

  const port =
    config.dashboard.port;

  const host =
    config.dashboard.host ||
    '0.0.0.0';

  const server =
    app.listen(
      port,
      host,
      () => {
        console.log(
          `[Dashboard] Running at http://${host}:${port}`
        );

        if (
          config.dashboard.user
        ) {
          console.log(
            `[Dashboard] Admin user: ${config.dashboard.user}`
          );
        }
      }
    );

  // ==========================================================
  // SHUTDOWN
  // ==========================================================

  const shutdown =
    signal => {
      console.log(
        `[Dashboard] ${signal} received, shutting down...`
      );

      server.close(
        () => process.exit(0)
      );

      setTimeout(
        () => process.exit(1),
        10000
      ).unref();
    };

  process.once(
    'SIGTERM',
    () => shutdown('SIGTERM')
  );

  process.once(
    'SIGINT',
    () => shutdown('SIGINT')
  );

  return app;
}