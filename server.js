const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cinevault_dev_secret_change_in_production';
const OMDB_KEY = process.env.OMDB_KEY || '';

// ── DATABASE SETUP ──────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'cinevault.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password    TEXT    NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    imdb_id     TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    year        TEXT,
    poster      TEXT,
    added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, imdb_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    imdb_id     TEXT    NOT NULL,
    title       TEXT,
    year        TEXT,
    poster      TEXT,
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    rated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, imdb_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── AUTH ROUTES ──────────────────────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' });

    const hash = await bcrypt.hash(password, 12);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username.trim(), hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username: username.trim() },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ token, username: username.trim() });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, username: user.username });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/me  (verify token & get user info)
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ── MOVIE ROUTES (OMDB PROXY) ────────────────────────────────────────────────

// GET /api/search?q=inception&page=1
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    if (!OMDB_KEY) return res.status(503).json({ error: 'OMDB API key not configured on server. Add OMDB_KEY to environment variables.' });

    const url = `https://www.omdbapi.com/?s=${encodeURIComponent(q)}&type=movie&page=${page}&apikey=${OMDB_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error('Search error:', e);
    res.status(500).json({ error: 'Failed to fetch from OMDB' });
  }
});

// GET /api/movie/:imdbID
app.get('/api/movie/:imdbID', requireAuth, async (req, res) => {
  try {
    if (!OMDB_KEY) return res.status(503).json({ error: 'OMDB API key not configured' });
    const url = `https://www.omdbapi.com/?i=${req.params.imdbID}&plot=full&apikey=${OMDB_KEY}`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// ── WATCHLIST ROUTES ─────────────────────────────────────────────────────────

// GET /api/watchlist
app.get('/api/watchlist', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC').all(req.user.id);
  res.json(items);
});

// POST /api/watchlist
app.post('/api/watchlist', requireAuth, (req, res) => {
  try {
    const { imdb_id, title, year, poster } = req.body;
    if (!imdb_id || !title) return res.status(400).json({ error: 'imdb_id and title required' });
    db.prepare('INSERT OR IGNORE INTO watchlist (user_id, imdb_id, title, year, poster) VALUES (?, ?, ?, ?, ?)').run(req.user.id, imdb_id, title, year || '', poster || '');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/watchlist/:imdbID
app.delete('/api/watchlist/:imdbID', requireAuth, (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE user_id = ? AND imdb_id = ?').run(req.user.id, req.params.imdbID);
  res.json({ success: true });
});

// ── RATINGS ROUTES ───────────────────────────────────────────────────────────

// GET /api/ratings
app.get('/api/ratings', requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM ratings WHERE user_id = ? ORDER BY rated_at DESC').all(req.user.id);
  res.json(items);
});

// POST /api/ratings
app.post('/api/ratings', requireAuth, (req, res) => {
  try {
    const { imdb_id, title, year, poster, rating } = req.body;
    if (!imdb_id || !rating) return res.status(400).json({ error: 'imdb_id and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    db.prepare(`
      INSERT INTO ratings (user_id, imdb_id, title, year, poster, rating)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, imdb_id) DO UPDATE SET rating = excluded.rating, rated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, imdb_id, title || '', year || '', poster || '', rating);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── STATS ROUTE ───────────────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', requireAuth, (req, res) => {
  const wlCount = db.prepare('SELECT COUNT(*) as c FROM watchlist WHERE user_id = ?').get(req.user.id).c;
  const rtCount = db.prepare('SELECT COUNT(*) as c FROM ratings WHERE user_id = ?').get(req.user.id).c;
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM ratings WHERE user_id = ?').get(req.user.id).avg;
  res.json({
    watchlistCount: wlCount,
    ratedCount: rtCount,
    averageRating: avgRating ? avgRating.toFixed(1) : null
  });
});

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CineVault',
    omdb: OMDB_KEY ? 'configured' : 'NOT configured — add OMDB_KEY env variable',
    time: new Date().toISOString()
  });
});

// Serve frontend for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START SERVER ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬  CineVault is running on port ${PORT}`);
  console.log(`    Local: http://localhost:${PORT}`);
  console.log(`    OMDB key: ${OMDB_KEY ? '✅ configured' : '❌ missing — add OMDB_KEY env var'}\n`);
});
