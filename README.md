# Lucky Felt Casino

A friendly browser casino. Texas Hold'em, Roulette, Craps, Sic Bo, and three slot machines. Email-based passwordless accounts.

Outcomes and balances are **server-authoritative**: the React client sends *actions* (which game, how much, which bets) and the Express/SQLite backend in [`server/`](server/) owns the RNG, the payout tables, and the money. See [Security model](#security-model) below.

## Deploy to DigitalOcean App Platform (free static site)

### Option A — DO App Platform UI (easiest)

1. Push this repo to GitHub
2. Go to https://cloud.digitalocean.com/apps → New App
3. Connect your GitHub repo
4. DO auto-detects Vite. Confirm:
   - **Build command:** `npm run build`
   - **Output dir:** `dist`
5. Choose the **free static site** tier
6. Deploy — done. You get a `*.ondigitalocean.app` URL.

The `.do/app.yaml` in this repo is picked up automatically if you use the DO CLI instead.

### Option B — DO CLI

```bash
brew install doctl          # or apt install doctl
doctl auth init
doctl apps create --spec .do/app.yaml
```

### Option C — Droplet fallback

If you want a custom subdomain on an existing Droplet:

```bash
# On the droplet
apt install nginx nodejs npm -y
npm install -g serve

cd /var/www
git clone <your-repo> lucky-felt
cd lucky-felt && npm install && npm run build

# Nginx config at /etc/nginx/sites-available/casino
server {
    listen 80;
    server_name casino.yourdomain.com;
    root /var/www/lucky-felt/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

ln -s /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL (optional but recommended)
apt install certbot python3-certbot-nginx -y
certbot --nginx -d casino.yourdomain.com
```

## Local dev

The app is two processes: the Vite frontend and the API backend. Run both.

```bash
# Terminal 1 — backend (http://localhost:3001)
cd server
npm install
AUTH_DEV_ECHO=1 npm run dev   # node --watch index.js; DB defaults to ./casino.db

# Terminal 2 — frontend (http://localhost:5173)
npm install
npm run dev            # Vite proxies /api -> localhost:3001 (see vite.config.js)
```

`npm run build` produces the static frontend in `dist/`. The backend is deployed separately (see below).

**Sign-in needs an email code.** With no SMTP configured the backend logs the code to its console; set `AUTH_DEV_ECHO=1` (dev only) and the request response/login screen will show the code directly so you don't need a mail server locally.

## Security model

The browser is treated as untrusted. It never computes an outcome or writes a balance.

- **Server owns the RNG.** All money-deciding randomness (reels, wheel, dice, deck) uses `crypto.randomInt` on the backend. The client keeps only animation-only randomness (the blur/whirl); the *final* symbols/numbers come from the API response.
- **Server owns the payout tables** ([`server/games.js`](server/games.js)) as the single source of truth. The frontend fetches read-only display copies from `GET /api/config`.
- **Every bet is validated** server-side: positive integer, within table limits, `<= balance`. Bad bets are rejected.
- **The ATM cooldown is enforced server-side** (`POST /api/atm` returns `429` while on cooldown).
- **Sign-in proves inbox ownership.** A one-time 6-digit code is emailed; only verifying it mints a session token. Codes are stored hashed, expire in 10 minutes, are single-use, and are capped at 5 wrong attempts. Knowing an email is no longer enough to act as that user.
- **Sessions use bearer tokens**, not raw email in the body. Dealer hole cards in poker stay on the server until showdown.
- **Auth and bet endpoints are rate-limited** (`express-rate-limit`).

### Email (sign-in codes)

Delivery is provider-agnostic via [nodemailer](https://nodemailer.com). Configure SMTP with env vars on the backend:

| Var | Purpose |
|---|---|
| `SMTP_URL` | full SMTP URL (`smtps://user:pass@host:465`) — takes precedence |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | host-based config (port defaults 587) |
| `SMTP_USER` / `SMTP_PASS` | credentials, if the server requires auth |
| `MAIL_FROM` | From header (default `Lucky Felt Casino <no-reply@casino.lab980.com>`) |
| `AUTH_DEV_ECHO=1` | **dev only** — return the code in the API response when no SMTP is set |

With nothing configured the code is logged to the backend console (dev fallback).

### API endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/login/request` `{email}` | — | email a one-time sign-in code |
| `POST /api/login/verify` `{email,code}` | — | verify code, returns `{token, user}` |
| `POST /api/logout` | token | invalidate session |
| `GET /api/me` | token | current account |
| `GET /api/config` | — | read-only payout tables + limits |
| `POST /api/atm` | token | top-up (server-enforced cooldown) |
| `POST /api/bet/slots` `{game,bet}` | token | spin reels, returns `{balance,reels,win}` |
| `POST /api/bet/roulette` `{bets}` | token | spin wheel, returns `{balance,landed,delta}` |
| `POST /api/bet/sicbo` `{bets}` | token | roll dice, returns `{balance,dice,delta}` |
| `POST /api/bet/craps` `{bet,type}` | token | one roll (stateful point) |
| `GET /api/poker/state` | token | resume an in-progress hand (dealer hidden) |
| `POST /api/poker/{deal,advance,showdown,fold}` | token | stateful hand; dealer hidden until showdown |

## Backend deploy (droplet)

```bash
# On the droplet, where the API lives at /var/www/casino-api (PM2: "casino-api")
cd /var/www/casino-api
npm install
CASINO_DB=/var/data/casino.db PORT=3001 \
  SMTP_HOST=smtp.example.com SMTP_USER=... SMTP_PASS=... MAIL_FROM='Lucky Felt <no-reply@casino.lab980.com>' \
  pm2 restart casino-api   # or `pm2 start index.js --name casino-api`
```

nginx serves the built `dist/` and proxies `/api/ -> localhost:3001`. Set `CASINO_DB` to the persistent DB path so it survives restarts, and configure the SMTP vars (see [Email](#email-sign-in-codes)) so sign-in codes actually get delivered.

## Notes

- Accounts and balances live in **SQLite on the server** (cross-device), not localStorage. The client only caches a session token.
- No real money involved.
