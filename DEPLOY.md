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

Port 3001 predates the droplet's 8060+ convention. Changing it means editing the
vhost's `proxy_pass`, the `.env`, and `CASINO_PORT` together; leave it unless
you're doing all three.

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
   `git archive` (so `node_modules`, `.env`, `*.db` there are never touched),
   removes any file deleted from `server/` since the last deploy, and stamps
   the commit into `/var/www/casino-api/.deployed-commit`.
4. `npm ci --omit=dev` in the API dir.
5. Sources the API `.env`, then `pm2 restart casino-api --update-env` (or
   `pm2 start` if the process doesn't exist yet), `pm2 save`.
6. Probes `/api/health` locally and publicly, and the public `/`.

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
| `CASINO_DB` | `/var/data/casino.db` — outside the API dir so deploys and redeploys can't touch it |
| `NODE_ENV` | `production` — also hard-disables the dev code echo |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.resend.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | `resend` / the Resend API key |
| `MAIL_FROM` | `'Lucky Felt Casino <no-reply@casino.lab980.com>'` — must be on the Resend-verified domain |
| `AUTH_DEV_ECHO` | **never set in production.** Dev only: returns the sign-in code in the API response when no SMTP is configured. |

If the process was originally started with env vars on the `pm2 start` command
line rather than a `.env` file, those are still in the pm2 dump and survive
`restart`. Moving them into `.env` is the supported path; `casino deploy`
sources it before every restart.

## One-time bring-up (on a fresh droplet, as root)

The vhost for `casino.lab980.com` already exists on the current box. From
scratch:

```bash
git clone https://github.com/ivjames/lucky-felt /var/www/lucky-felt
ln -sf /var/www/lucky-felt/bin/casino /usr/local/bin/casino
mkdir -p /var/www/casino-api /var/data
cp /var/www/lucky-felt/server/.env.example /var/www/casino-api/.env
chmod 600 /var/www/casino-api/.env
$EDITOR /var/www/casino-api/.env          # fill the keys above
casino deploy                             # builds, copies, starts casino-api under pm2
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
