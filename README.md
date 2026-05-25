# Scarcity Exchange — Continuous-Time Food Trading Survival Game

A 4-player real-time market-survival game implemented from `food_trading_survival_game_prd.md`.

## Layout

```
backend/   Node + TypeScript + Express + Socket.IO (server-authoritative)
frontend/  Next.js 14 (app router) + React + TypeScript + Tailwind
```

## Run locally

In two terminals:

```bash
# terminal 1
cd backend
npm install
npm run dev          # listens on :3001
```

```bash
# terminal 2
cd frontend
npm install
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 npm run dev    # listens on :3000
```

Open http://localhost:3000 in 4 browser tabs (or share with 3 friends), pick names, create a room in tab 1, paste the room code into tabs 2–4 to join, then the host clicks **Start game**.

### Solo mode (bots)

Don't have 3 friends handy? Create a room, then in the lobby click **Fill with bots** (or **+ Add bot** three times). Bots trade autonomously: they bid more aggressively as their starvation timers shrink, and they sell their own produced food to anyone willing to pay. Click **Start game** to play against them.

## Tests

The backend ships with three integration tests that boot a real Socket.IO server, simulate four clients, and assert engine invariants:

```bash
cd backend
# self-contained — boots its own server on :3210
npx tsx src/test/integration.ts

# requires backend running on :3401
PORT=3401 npx tsx src/index.ts &
npx tsx src/test/scenario.ts
npx tsx src/test/starvation.ts
```

`integration.ts` covers: room creation, joining, producer assignment uniqueness, deck distribution (100 of each), starting balances, maker-price matching, partial fills, cancel + reservation release, insufficient-cash rejection, production/consumption ticks.

`scenario.ts` covers: reservation locking inventory out of consumption, self-trade prevention, `cancel_all` releasing all reservations.

`starvation.ts` covers: forcing all 4 players to starve by reserving all their required food via asks, asserts `game_over` fires with reason `no_survivors`.

## Deployment (Railway + Vercel)

This is a two-service deploy: backend on Railway (long-lived Socket.IO server) + frontend on Vercel (static Next.js). Both services should pull from the same GitHub repo.

### 0. Push to GitHub

```bash
# from the repo root, if you haven't already
git init
git add .
git commit -m "Initial commit"
gh repo create scarcity-exchange --public --source=. --push
# or create the repo on github.com and push manually
```

### 1. Backend → Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select your repo.
2. After the project is created, open it → click the service → **Settings** → **Source**:
   - **Root Directory:** `backend`
3. **Settings** → **Networking** → **Generate Domain**. Copy the URL — it looks like `https://scarcity-exchange-production.up.railway.app`.
4. **Variables** → add:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = your Vercel URL (you'll set this after step 2 — for now use `*` so it doesn't block you)
5. Railway autodetects the Node app, runs `npm install && npm run build && npm start`. Health check at `/health` should turn green within ~30s.

### 2. Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import your GitHub repo.
2. **Root Directory:** click **Edit** → choose `frontend`.
3. Framework Preset: **Next.js** (autodetected).
4. **Environment Variables** → add:
   - `NEXT_PUBLIC_BACKEND_URL` = your Railway URL from step 1.3 (e.g. `https://scarcity-exchange-production.up.railway.app`)
5. **Deploy**. After ~1 min you'll get a `https://scarcity-exchange.vercel.app` URL.

### 3. Lock down CORS

Go back to Railway → backend service → **Variables** → set `FRONTEND_URL` to your Vercel production URL, e.g. `https://scarcity-exchange.vercel.app`. Railway will redeploy automatically.

If you want Vercel preview deployments to also work (every PR/branch gets its own URL), use a regex form:

```
FRONTEND_URL=/^https:\/\/scarcity-exchange.*\.vercel\.app$/
```

Or for a comma-separated allowlist:

```
FRONTEND_URL=https://scarcity-exchange.vercel.app,https://scarcity-exchange-staging.vercel.app
```

Or `*` to allow any origin (simplest, least secure).

### 4. Share the Vercel URL

Send `https://your-app.vercel.app` to your friends. Open it, create a game, share the room code (the 5-letter code at the top of the lobby), and play.

### Troubleshooting

- **Page loads but socket never connects:** open the browser console. If you see `[socket] connect_error: xhr poll error`, check that `NEXT_PUBLIC_BACKEND_URL` on Vercel exactly matches your Railway URL (`https://`, no trailing slash). Re-deploy Vercel after changing env vars (Vercel bakes `NEXT_PUBLIC_*` vars into the build).
- **CORS error in console:** the Railway backend's `FRONTEND_URL` doesn't match the page's origin. Either set it exactly, use a regex, or temporarily set `FRONTEND_URL=*` to confirm CORS is the only issue.
- **Railway service crashes on boot:** check Railway logs. Most common cause is missing `engines.node` (already set to `>=20`) or a typo in env vars.
- **WebSocket disconnects every 30s:** Railway free tier sleeps idle services. Either upgrade to Hobby ($5/mo) or add a cron job that pings `/health`.

## What's implemented

All MVP "Must have" and "Should have" items from §26 of the PRD:

- 4-player lobby, room codes, host start, reconnect via localStorage session
- Server-authoritative tick loop: every 10-second survival cycle produces +2 own food, consumes -1 of each non-produced food, checks starvation, and resolves winners by cash → food tie-break
- Continuous limit order book per food type with bids/asks/cancels, partial fills, **maker-price** execution, **price-time priority**
- Cash & inventory **reservations** that lock resources at order time and exclude reserved food from consumption (per §6.7)
- Self-trade prevention by skipping own orders during matching
- Public order book depth, recent trades feed, public event log
- Private inventory, cash, and per-food survival countdowns
- Rate limits (10 new orders/sec, 20 cancels/sec, 50 max open per player)
- 15-second disconnect grace period, then auto-death
- Game-over modal with full scoreboard

## Not implemented (PRD §27 non-goals)

Emergency markets, loans, negative cash, decimal prices/quantities, chat, custom game parameters, persistent match history, accounts.
