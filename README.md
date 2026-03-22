# 🎬 CineVault — Full Stack Movie App

A complete movie discovery app with real authentication, watchlist, ratings, and live OMDB search.

---

## 🚀 Deploy in 5 Minutes (Get a Free Public URL)

### Option A — Railway (Recommended, Free URL)

1. **Create accounts** (free):
   - [github.com](https://github.com) — create account
   - [railway.app](https://railway.app) — sign up with GitHub

2. **Upload your code to GitHub:**
   - Go to github.com → New Repository → name it `cinevault`
   - Upload all these files to the repo

3. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app) → New Project
   - Click "Deploy from GitHub repo" → select `cinevault`
   - Railway auto-detects Node.js and deploys!

4. **Add Environment Variables** (in Railway dashboard → Variables):
   ```
   OMDB_KEY     = your_omdb_api_key_here
   JWT_SECRET   = any_long_random_string_here_like_abc123xyz789
   ```

5. **Get your URL:**
   - Railway gives you a URL like: `https://cinevault-production.up.railway.app`
   - Share this URL — anyone can use it from any browser!

---

### Option B — Render (Also Free)

1. Push code to GitHub (same as above)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect GitHub repo
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Add environment variables: `OMDB_KEY` and `JWT_SECRET`
7. Click Deploy — get URL like `https://cinevault.onrender.com`

---

### Option C — Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env and add your OMDB_KEY

# 3. Start the server
npm start

# 4. Open in browser
# http://localhost:3000
```

---

## 🔑 Getting Your OMDB API Key (Required)

1. Go to [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Select **FREE** (1,000 searches/day)
3. Enter your email and submit
4. Check email → click **Activate API Key**
5. Copy the key and add it to Railway/Render environment variables

---

## ✨ Features

- ✅ Real user accounts (registration + login)
- ✅ JWT authentication (tokens expire in 30 days)
- ✅ SQLite database (stores all user data)
- ✅ Live movie search (500,000+ movies via OMDB)
- ✅ Watchlist (per user, stored in database)
- ✅ Star ratings 1-5 (per user, stored in database)
- ✅ Movie detail pages (director, cast, IMDB rating, plot)
- ✅ Pagination for search results
- ✅ User stats dashboard
- ✅ Responsive design

## 📁 Project Structure

```
cinevault/
├── server.js          ← Express backend (API + auth + DB)
├── package.json       ← Dependencies
├── .env.example       ← Environment variables template
├── README.md          ← This file
└── public/
    └── index.html     ← Frontend (HTML + CSS + JS)
```

## 🔧 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/register | No | Create account |
| POST | /api/login | No | Sign in |
| GET | /api/me | Yes | Get current user |
| GET | /api/search?q=query | Yes | Search movies |
| GET | /api/movie/:id | Yes | Movie details |
| GET | /api/watchlist | Yes | Get watchlist |
| POST | /api/watchlist | Yes | Add to watchlist |
| DELETE | /api/watchlist/:id | Yes | Remove from watchlist |
| GET | /api/ratings | Yes | Get ratings |
| POST | /api/ratings | Yes | Rate a movie |
| GET | /api/stats | Yes | Get user stats |
| GET | /api/health | No | Server health check |
