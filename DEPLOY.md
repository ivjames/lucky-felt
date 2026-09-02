# Deploying Lucky Felt Casino

Target: **https://casino.lab980.com** — served from the lab980 droplet
(conventions in the `ivjames/lab980.com` repo's `CLAUDE.md`).

## Shape

One repo, two halves on the box. This is a split layout, not the plain
"nginx proxies everything to one pm2 process" app shape:

| half | where | how it runs |
|---|---|---|
| frontend | `/var/www/lucky-felt` (this repo, checked out) | `npm run build` writes `dist/`; nginx serves it as static files |
| API | `/var/www/casino-api` (a **copy** of `server/`, not a checkout) | pm2 process `casino-api`, `node index.js`, listens on `127.0.0.1:3001`; nginx proxies `/api/` to it |

State lives outside the checkout and survives deploys: the API's `.env` at
`/var/www/casino-api/.env` and the SQLite database at `/var/data/casino.db`.

The API binds **`127.0.0.1`** (override with `HOST` in `.env`) and mounts
every route at both `/api/...` and `/...`, so it answers whether the vhost's
`proxy_pass` keeps the `/api` prefix (`proxy_pass http://127.0.0.1:3001;`) or
strips it (`proxy_pass http://host:3001/;`, trailing slash). The convention on
the box is the former, and `casino setup` pins it.

Port 3001 predates the droplet's 8060+ convention. Changing it means editing the
vhost's `proxy_pass`, the `.env`, and `CASINO_PORT` together; leave it unless
you're doing all three.

## First time on a box that already runs the site: `casino setup`

Idempotent; re-running it is harmless. On the droplet, as root:

```bash
cd /var/www/lucky-felt && git fetch origin main && git reset --hard origin/main
bin/casino setup
```

It does, in order:

1. Symlinks itself to `/usr/local/bin/casino`.
2. Seeds `/var/www/casino-api/.env` **from the running pm2 process** if the file
   doesn't exist yet (the box's original state: env given on the first
   `pm2 start` line), so nothing is lost when `deploy` restarts with
   `--update-env`. With no process yet it copies `server/.env.example` and
   tells you to fill it in. Creates the `CASINO_DB` directory.
3. Runs `casino deploy` **first**, so the API is already up on `127.0.0.1`
   before nginx is pointed at it (the pre-CLI process may be bound to `::1`
   only; pinning first would 502 the site for the length of the build).
4. Pins the vhost: every `proxy_pass` at the API port becomes
   `proxy_pass http://127.0.0.1:3001;` (prefix kept, IPv4 loopback); each API
   location block that lacks the forwarded headers gets them; a `.bak` is
   kept beside the file; `nginx -t`, reload. It finds the file by
   `server_name`; override with `CASINO_VHOST`. Then a final probe.

## Deploying updates

Land changes on `main` (via a PR — see `CLAUDE.md`), then on the droplet:

```bash
casino deploy          # sync, build dist/, copy server/ -> casino-api, npm ci, pm2 restart, probe
```

What `deploy` does, in order:

1. `git fetch` + `git reset --hard origin/main` in `/var/www/lucky-felt`. A
   tracked file edited on the droplet is destroyed silently — fix it in the repo.
2. `npm ci` + `npm run build` for the frontend. `--no-build` skips this when
   only `server/` changed.
3. Copies the committed contents of `server/` into `/var/www/casino-api` with
   `git archive` (so `node_modules`, `.env`, `*.db` there are never touched)
   and removes any file deleted from `server/` since the last activated
   deploy.
4. `npm ci --omit=dev` in the API dir.
5. Sources the API `.env`, then `pm2 restart casino-api --update-env` (or
   `pm2 start` if the process doesn't exist yet), `pm2 save`. Only now is the
   commit stamped into `/var/www/casino-api/.deployed-commit`, so a deploy
   that fails at `npm ci` leaves the stamp on the commit still running.
6. Probes `/api/health` locally and publicly, and the public `/`. The two API
   probes require the `{"ok":true}` body, not just a 200, because a vhost
   with no `/api/` location would answer 200 with the SPA's `index.html`.
   **Any failed probe makes `deploy` (and `restart`) exit nonzero** with a
   line saying which of the three failed, so a broken rollout can't pass as
   a success to an operator or a script. `status` reports the same probes
   without failing.

**Never edit files in `/var/www/casino-api` by hand** except `.env`. It is a
copy; the next deploy overwrites it from git.

## Check it

```bash
casino status              # HEAD, deployed API commit, pm2 state, probes, cert days
casino logs                # tail pm2 logs for casino-api
health-check --site casino # the droplet-wide auditor
curl -s https://casino.lab980.com/api/health   # {"ok":true}
```

A 200 proves the endpoint answered, not which build. `casino status` prints the
checkout HEAD and the commit stamped into the API dir; they should match after
a deploy.

## `.env` keys (`/var/www/casino-api/.env`)

`server/.env.example` is the template. Quote values containing spaces.

| key | what it is |
|---|---|
| `PORT` | `3001` — must match the vhost's `proxy_pass` |
| `HOST` | optional, default `127.0.0.1`. Leave unset. |
| `CASINO_DB` | `/var/data/casino.db` — outside the API dir so deploys and redeploys can't touch it |
| `NODE_ENV` | `production` — also hard-disables the dev code echo |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.resend.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | `resend` / the Resend API key |
| `MAIL_FROM` | `'Lucky Felt Casino <no-reply@casino.lab980.com>'` — must be on the Resend-verified domain |
| `AUTH_DEV_ECHO` | **never set in production.** Dev only: returns the sign-in code in the API response when no SMTP is configured. |
| `AUTH_SHOW_CODE` | **temporary.** `1` returns the sign-in code to the browser and shows it on the page, and a failing mailer no longer blocks sign-in. Nobody's inbox is verified while set. Use only until SMTP works, then remove the line and `casino restart`. |

If the process was originally started with env vars on the `pm2 start` command
line rather than a `.env` file, those are still in the pm2 dump and survive
`restart`. Moving them into `.env` is the supported path; `casino deploy`
sources it before every restart.

## Bring-up on a fresh droplet (as root)

```bash
git clone https://github.com/ivjames/lucky-felt /var/www/lucky-felt
mkdir -p /var/www/casino-api /var/data
cp /var/www/lucky-felt/server/.env.example /var/www/casino-api/.env
chmod 600 /var/www/casino-api/.env
$EDITOR /var/www/casino-api/.env          # fill the keys above
# write the vhost below, enable it, certbot
/var/www/lucky-felt/bin/casino setup      # symlink, vhost pin, build, copy, first pm2 start
```

Reboot survival needs pm2's boot hook installed **once per droplet**:
`pm2 startup systemd -u root --hp /root`, run the line it prints, then verify
`systemctl is-enabled pm2-root` prints `enabled`. `pm2 save` alone only writes
the dump.

### nginx vhost

`/etc/nginx/sites-available/casino.lab980.com` (certbot manages the TLS
block). The forwarded headers matter: the API runs behind `trust proxy` and
keys its rate limits on the client IP, so without them every player shares one
bucket.

```nginx
server {
    listen 80;
    server_name casino.lab980.com;

    root /var/www/lucky-felt/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/casino.lab980.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d casino.lab980.com
```

## Overrides

- `CASINO_FQDN` — default `casino.lab980.com`
- `CASINO_BRANCH` — default `main`
- `CASINO_PORT` — default `3001`
- `CASINO_API_DIR` — default `/var/www/casino-api`. Point it at the checkout's own `server/` to run the API in place instead of from a copy; `deploy` then skips the copy step.
- `CASINO_PM2_NAME` — default `casino-api`
- `CASINO_VHOST` — default: the file under `/etc/nginx/sites-available` whose `server_name` includes the FQDN
