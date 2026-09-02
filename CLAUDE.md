# Lucky Felt Casino — working notes

A play-money browser casino: Texas Hold'em, roulette, craps, sic bo, and three
slot machines. React + Vite frontend, Express + SQLite API. No real money.

Served at **https://casino.lab980.com** from the lab980 droplet.

How work lands here — branch, PR, and the fact that merging is not deploying —
is in `.claude/rules/lab980-conventions.md`, which Claude Code loads
automatically every session. That file is owned by the lab980 scaffold and is
overwritten by it; **this** file is the site's own. For the box itself, read
the `ivjames/lab980.com` repo's `CLAUDE.md`.

## Shape

A **split app**, which is why the generic app template doesn't describe it:

- Frontend: this checkout at `/var/www/lucky-felt`; `npm run build` → `dist/`,
  served statically by nginx.
- API: `server/` is **copied** by `casino deploy` into `/var/www/casino-api`
  and run there by pm2 as `casino-api` (fork mode, `node index.js`) on
  `127.0.0.1:3001`. nginx proxies `/api/` to it.
- The API binds `127.0.0.1` explicitly (`HOST` overrides) and mounts its
  routes at both `/api` and `/`, so a vhost that strips the prefix still
  works. It once ran bound to `::1` only behind a vhost proxying to
  `localhost` with a prefix-stripping `proxy_pass`; `casino setup` pins that.
- State outside the checkout: `/var/www/casino-api/.env` and the SQLite file at
  `/var/data/casino.db`. Both survive deploys.
- Stub is `casino`, repo is `lucky-felt`: a stub/repo mismatch, recorded in
  lab980's `sites.json`.

## Deploying

On the droplet, as root:

```bash
casino setup         # once per box: symlink, .env from pm2, vhost pin, deploy
casino deploy        # sync, build, copy server/, npm ci, pm2 restart, probe
casino status        # HEAD, deployed API commit, pm2 state, probes, cert days
casino logs          # tail casino-api's pm2 logs
```

Full runbook, `.env` keys, bring-up, and the vhost: `DEPLOY.md`.

## Things worth knowing

- **The browser is untrusted.** All RNG, payout tables, bet validation, the
  ATM cooldown, and balances are server-side in `server/`. The client sends
  actions and renders responses. Keep it that way: a "small" client-side
  shortcut that decides money is the one bug class this project was rewritten
  to eliminate.
- **Payout tables are one rule list.** `server/games.js` derives each machine's
  `getWin` from its displayed `paylines`. `node server/scripts/check-paytables.mjs`
  enumerates every reel combination against an independent evaluator; run it
  after touching any slot config.
- **Symbols and suits are identifiers**, not glyphs. The server sends
  `"cherry"`, `"spades"`; the client maps them to SVG in
  `src/components/icons/`. No emoji anywhere in `src/` or `server/`.
- **In-progress poker and craps hands persist** in the `game_state` table, so a
  restart mid-hand doesn't forfeit a debited stake. Balance and state changes
  that must land together are wrapped in `db.transaction`.
- **Sign-in is an emailed one-time code** via SMTP (Resend in production).
  `AUTH_DEV_ECHO=1` returns the code in the API response for local dev only;
  the server refuses it when `NODE_ENV=production`.
- **Two package.json files.** Root is the Vite frontend; `server/package.json`
  is the API. `npm run lint` at the root covers both.
- **Local dev:** `cd server && AUTH_DEV_ECHO=1 npm run dev` on 3001, then
  `npm run dev` at the root; Vite proxies `/api` to 3001.
- **Verify a clean clone builds** before a PR, not just the working tree:

  ```bash
  d=$(mktemp -d) \
    && git archive HEAD | tar -x -C "$d" \
    && ( cd "$d" && npm ci && npm run build && cd server && npm ci ) \
    && rm -rf "$d"
  ```
