# Lucky Felt Casino

A friendly browser casino. Texas Hold'em, Roulette, Craps, Sic Bo, and three slot machines. Email-based passwordless accounts.

Outcomes and balances are **server-authoritative**: the React client sends *actions* (which game, how much, which bets) and the Express/SQLite backend in [`server/`](server/) owns the RNG, the payout tables, and the money. See [Security model](#security-model) below.

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

`npm run build` produces the static frontend in `dist/`. The backend is deployed separately (see [Deploy](#deploy) below).

**Sign-in needs an email code.** With no SMTP configured the backend logs the code to its console; set `AUTH_DEV_ECHO=1` (dev only) and the request response/login screen will show the code directly so you don't need a mail server locally.

## Security model

The browser is treated as untrusted. It never computes an outcome or writes a balance.

- **Server owns the RNG.** All money-deciding randomness (reels, wheel, dice, deck) uses `crypto.randomInt` on the backend. The client keeps only animation-only randomness (the blur/whirl); the *final* symbols/numbers come from the API response.
- **Server owns the payout tables** ([`server/games.js`](server/games.js)) as the single source of truth. The frontend fetches read-only display copies from `GET /api/config`.
- **Every bet is validated** server-side: positive integer, within table limits, `<= balance`. Bad bets are rejected.
- **The ATM cooldown is enforced server-side** (`POST /api/atm` returns `429` while on cooldown).
- **Sign-in proves inbox ownership.** A one-time 6-digit code is emailed; only verifying it mints a session token. Codes are stored hashed, expire in 10 minutes, are single-use, and are capped at 5 wrong attempts. Knowing an email is no longer enough to act as that user.
- **Sessions use bearer tokens**, not raw email in the body. Sessions expire 30 days after sign-in. Dealer hole cards in poker stay on the server until showdown.
- **In-progress hands are persistent.** Poker and craps hands are stored in a `game_state` table in SQLite, so a server restart does not forfeit a live stake.
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

#### Sending with Resend (production: `casino.lab980.com`)

[Resend](https://resend.com) works with the SMTP config above — no code changes needed. Send from a subdomain (`casino.lab980.com`) so the casino's sending reputation stays isolated from the root domain.

1. **Resend → Add Domain →** `casino.lab980.com` (choose the region nearest the droplet).
2. Add the DNS records Resend generates at `lab980.com`'s DNS host. They sit on the subdomain — copy the exact values from the dashboard (DKIM is a unique per-domain key):

   | Type | Name | Value |
   |---|---|---|
   | MX | `send.casino.lab980.com` | SES feedback host shown by Resend (priority 10) |
   | TXT | `send.casino.lab980.com` | `v=spf1 include:amazonses.com ~all` |
   | TXT | `resend._domainkey.casino.lab980.com` | DKIM key shown by Resend |
   | TXT | `_dmarc.casino.lab980.com` | `v=DMARC1; p=none;` (optional) |

   > If your DNS host auto-appends the zone, enter names relative (`send.casino`, `resend._domainkey.casino`) so you don't end up with a doubled `...lab980.com.lab980.com`.

3. Once verified, set the SMTP env on the `casino-api` process (the `SMTP_PASS` is your Resend API key):

   ```bash
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true            # set for 465; omit/false for 587
   SMTP_USER=resend            # literally the word "resend"
   SMTP_PASS=re_xxxxxxxx       # Resend API key
   MAIL_FROM='Lucky Felt Casino <no-reply@casino.lab980.com>'
   ```

   `MAIL_FROM` must be an address on the verified domain or Resend rejects the send.

### API endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/health` | — | liveness check, returns `{ok:true}` |
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

## Deploy

Production is a Droplet running nginx (serves `dist/`, proxies `/api/`) and pm2 (keeps the API process alive). DigitalOcean App Platform's free static tier does not fit this app: it has no process for the Express API, and App Platform's container disk is ephemeral, so the SQLite database would be wiped on every deploy.

### Frontend: build and serve with nginx

```bash
# On the droplet
apt install nginx nodejs npm -y
cd /var/www
git clone <your-repo> lucky-felt
cd lucky-felt && npm install && npm run build
```

nginx config at `/etc/nginx/sites-available/casino`:

```nginx
server {
    listen 80;
    server_name casino.yourdomain.com;

    root /var/www/lucky-felt/dist;
    index index.html;

    # Single-page app: unknown paths fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API. The forwarded headers matter: the server runs behind
    # `trust proxy` and keys its rate limits on the client IP.
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# HTTPS (recommended)
apt install certbot python3-certbot-nginx -y
certbot --nginx -d casino.yourdomain.com
```

### Backend: run the API with pm2

The API is the repo's `server/` directory, with its own `index.js` and `server/package.json` (distinct from the Vite frontend `package.json` at the repo root). On the droplet, **only `server/`'s contents** are deployed to `/var/www/casino-api`, so the commands below run from that directory. (Deploying a full repo clone instead? Then the entrypoint is `/var/www/lucky-felt/server`.)

```bash
cd /var/www/casino-api
npm install
CASINO_DB=/var/data/casino.db PORT=3001 \
  SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_SECURE=true \
  SMTP_USER=resend SMTP_PASS=re_xxxxxxxx \
  MAIL_FROM='Lucky Felt Casino <no-reply@casino.lab980.com>' \
  pm2 restart casino-api   # or `pm2 start index.js --name casino-api`
pm2 save                   # snapshot the process list to the dump
```

Set `CASINO_DB` to a path outside the deploy directory so the database survives redeploys, and configure the SMTP vars (see [Email](#email-sign-in-codes)) so sign-in codes are delivered.

**One time per droplet — install pm2's boot hook, or `casino-api` won't come back after a reboot.** `pm2 save` only writes the dump; without the systemd hook nothing replays it at boot, and the static `dist/` frontend will keep loading while every `/api/` call 502s.

```bash
pm2 startup systemd -u root --hp /root   # run the sudo command it prints, once
systemctl is-enabled pm2-root            # verify -> should print `enabled`
```

Health check: `curl -s https://casino.yourdomain.com/api/health` should return `{"ok":true}`.

## Notes

- Accounts and balances live in **SQLite on the server** (cross-device), not localStorage. The client only caches a session token.
- **Slot symbols and card suits** are sent from the server as plain identifiers and rendered as SVG on the client.
- **Payout tables** are derived from a single rule list in the backend ([`server/games.js`](server/games.js)); the server enforces all rules and computes payouts — the client cannot modify them.
- No real money involved.
