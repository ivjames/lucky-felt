# Lucky Felt Casino

A friendly browser casino. Texas Hold'em, Roulette, Craps, Sic Bo, and three slot machines. Email-based passwordless accounts via localStorage.

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

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Notes

- Accounts persist in **localStorage** — per-browser, no server needed
- To make accounts cross-device, replace `src/storage.js` with API calls to a backend
- No real money involved
