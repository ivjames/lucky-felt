// Lucky Felt Casino — server-authoritative API.
//
// The browser sends ACTIONS (which game, how much, which bets). The server owns
// the RNG, the payout tables, and the money. The client can no longer decide an
// outcome or write a balance directly, which closes the "open dev tools and POST
// balance: 999999" hole the old blind-write API had.

import express from "express";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import rateLimit from "express-rate-limit";
import {
  spinSlots, spinRoulette, spinSicBo, crapsRoll,
  makeDeck, shuffle, bestOf7, compareTB, publicConfig,
  SLOT_CONFIGS, ROULETTE_BETS, SIC_BO_BETS,
} from "./games.js";
import { sendLoginCode, mailerConfigured } from "./mailer.js";

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.CASINO_DB || "./casino.db";
const STARTING_BALANCE = 1000;
const ATM_AMOUNT = 500;
const ATM_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_BET = 1;
const MAX_BET = 500;          // per single-stake game (slots, craps, poker)
const MAX_TOTAL_BET = 5000;   // total across a multi-bet round (roulette, sic bo)
const CODE_TTL_MS = 10 * 60 * 1000;   // sign-in code validity window
const MAX_CODE_ATTEMPTS = 5;          // wrong guesses before a code is burned
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // sessions expire 30 days after creation
// Dev convenience ONLY: when no SMTP is configured AND this flag is set, the
// code is returned in the request response so local dev needs no mail server.
// Never enable in production.
const DEV_ECHO = process.env.AUTH_DEV_ECHO === "1" && !mailerConfigured() && process.env.NODE_ENV !== "production";
// Deliberate, temporary override for when email delivery is not working in
// production: the code is returned in the response and shown on the page, and
// a failing mailer no longer blocks sign-in. Anyone who can type an address
// can sign in as it, so this is for a play-money site while SMTP is sorted
// out, and nothing else. Remove the key from .env when email works.
const SHOW_CODE = process.env.AUTH_SHOW_CODE === "1";
if (SHOW_CODE) console.warn("[auth] AUTH_SHOW_CODE=1: sign-in codes are returned to the browser. Email ownership is NOT being verified.");

// ---- DB ------------------------------------------------------------------
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email   TEXT PRIMARY KEY,
    balance REAL NOT NULL,
    last_atm INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token   TEXT PRIMARY KEY,
    email   TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_codes (
    email     TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires   INTEGER NOT NULL,
    attempts  INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS game_state (
    email   TEXT NOT NULL,
    game    TEXT NOT NULL,
    data    TEXT NOT NULL,
    updated INTEGER NOT NULL,
    PRIMARY KEY (email, game)
  );
`);

const q = {
  getUser: db.prepare("SELECT email, balance, last_atm AS lastAtm, created FROM users WHERE email = ?"),
  insertUser: db.prepare("INSERT INTO users (email, balance, last_atm, created) VALUES (?, ?, 0, ?)"),
  setBalance: db.prepare("UPDATE users SET balance = ? WHERE email = ?"),
  setAtm: db.prepare("UPDATE users SET balance = ?, last_atm = ? WHERE email = ?"),
  insertSession: db.prepare("INSERT INTO sessions (token, email, created) VALUES (?, ?, ?)"),
  getSession: db.prepare("SELECT email, created FROM sessions WHERE token = ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
  deleteExpiredSessions: db.prepare("DELETE FROM sessions WHERE created < ?"),
  upsertCode: db.prepare(`INSERT INTO login_codes (email, code_hash, expires, attempts) VALUES (?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires = excluded.expires, attempts = 0`),
  getCode: db.prepare("SELECT code_hash AS codeHash, expires, attempts FROM login_codes WHERE email = ?"),
  bumpCodeAttempts: db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?"),
  deleteCode: db.prepare("DELETE FROM login_codes WHERE email = ?"),
  deleteExpiredCodes: db.prepare("DELETE FROM login_codes WHERE expires < ?"),
  getState: db.prepare("SELECT data FROM game_state WHERE email = ? AND game = ?"),
  setState: db.prepare(`INSERT INTO game_state (email, game, data, updated) VALUES (?, ?, ?, ?)
    ON CONFLICT(email, game) DO UPDATE SET data = excluded.data, updated = excluded.updated`),
  deleteState: db.prepare("DELETE FROM game_state WHERE email = ? AND game = ?"),
};

// Purge anything already stale so a long-idle DB doesn't keep dead rows around
// forever. Safe to run every boot — it only removes rows past their own TTL.
function cleanupExpired() {
  const now = Date.now();
  q.deleteExpiredSessions.run(now - SESSION_TTL_MS);
  q.deleteExpiredCodes.run(now);
}
cleanupExpired();

// Per-user in-progress hand state for the stateful games (craps point, poker
// deck), persisted in SQLite (`game_state`) so a server restart doesn't drop a
// hand whose stake was already debited. Reads/writes happen synchronously
// (better-sqlite3) inside the same handler that mutates balance, with no
// awaits in between, and balance + state changes that must land together are
// wrapped in a single db.transaction so they can't partially apply.
function getGameState(email, game) {
  const row = q.getState.get(email, game);
  return row ? JSON.parse(row.data) : null;
}
function setGameState(email, game, state) {
  q.setState.run(email, game, JSON.stringify(state), Date.now());
}
function clearGameState(email, game) {
  q.deleteState.run(email, game);
}

// ---- App -----------------------------------------------------------------
const app = express();
app.use(express.json());
app.set("trust proxy", 1); // behind nginx; needed for correct rate-limit keys

// Every route lives on this router, which is mounted at BOTH /api and /.
// The browser calls /api/...; whether the request reaches us as /api/... or
// as /... depends on the nginx vhost (`proxy_pass http://host:port;` keeps
// the prefix, `proxy_pass http://host:port/;` strips it). Answering both
// makes the API indifferent to that one trailing slash.
const api = express.Router();

const betLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // generous for a human clicking spin; blunts scripted abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
});

// Tighter limit on the auth endpoints to blunt code-guessing / spam.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts — wait a minute and retry." },
});

// ---- Helpers -------------------------------------------------------------
function newToken() {
  return crypto.randomBytes(24).toString("hex");
}
// 6-digit numeric code, zero-padded, from a CSPRNG.
function newLoginCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
// Codes are stored hashed (salted by email), never in plaintext.
function hashCode(email, code) {
  return crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");
}
function safeEqualHex(a, b) {
  const ba = Buffer.from(a, "hex"); const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function publicUser(u) {
  return { email: u.email, balance: u.balance, lastAtm: u.lastAtm, created: u.created };
}
// Auth middleware: resolves the bearer token to a user row. Acting as another
// user now requires their token, not just guessing their email.
function auth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token." });
  const session = q.getSession.get(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired session." });
  if (Date.now() - session.created > SESSION_TTL_MS) {
    q.deleteSession.run(token);
    return res.status(401).json({ error: "Invalid or expired session." });
  }
  const user = q.getUser.get(session.email);
  if (!user) return res.status(401).json({ error: "Account not found." });
  req.user = user;
  next();
}
// Validates a single integer stake against the table limits and the bankroll.
function validateBet(bet, balance) {
  if (typeof bet !== "number" || !Number.isInteger(bet)) return "Bet must be a whole number.";
  if (bet < MIN_BET) return `Minimum bet is $${MIN_BET}.`;
  if (bet > MAX_BET) return `Maximum bet is $${MAX_BET}.`;
  if (bet > balance) return "Insufficient balance.";
  return null;
}
// Validates a {betId: amount} map for the multi-bet games.
function validateBetMap(bets, validIds, balance) {
  if (!bets || typeof bets !== "object" || Array.isArray(bets)) return "No bets provided.";
  const entries = Object.entries(bets);
  if (entries.length === 0) return "No bets provided.";
  let total = 0;
  for (const [id, amount] of entries) {
    if (!validIds.has(id)) return `Unknown bet: ${id}.`;
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1) return "Bet amounts must be whole numbers ≥ 1.";
    total += amount;
  }
  if (total > MAX_TOTAL_BET) return `Total bet exceeds the $${MAX_TOTAL_BET} table limit.`;
  if (total > balance) return "Insufficient balance.";
  return null;
}
const ROULETTE_IDS = new Set(ROULETTE_BETS.map((b) => b.id));
const SICBO_IDS = new Set(SIC_BO_BETS.map((b) => b.id));

// ---- Auth / account ------------------------------------------------------
function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}
// Conservative shape check: one @, no whitespace/control chars (also guards the
// address against CRLF header-injection before it reaches the mailer).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validEmail(email) {
  return email.length <= 254 && EMAIL_RE.test(email);
}

// Step 1: email a one-time code. No token is minted here, so simply knowing an
// email no longer grants a session — the requester must prove they can read the
// inbox. Response is uniform whether or not the account exists (no enumeration).
api.post("/login/request", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  q.deleteExpiredCodes.run(Date.now()); // sweep stale codes (any email) on each new request
  const code = newLoginCode();
  q.upsertCode.run(email, hashCode(email, code), Date.now() + CODE_TTL_MS);
  try {
    await sendLoginCode(email, code);
  } catch (e) {
    console.error("[login] failed to send code:", e.message);
    if (!SHOW_CODE) return res.status(502).json({ error: "Couldn't send the sign-in code. Try again shortly." });
  }
  if (SHOW_CODE) return res.json({ ok: true, devCode: code, shown: true });
  res.json({ ok: true, ...(DEV_ECHO ? { devCode: code } : {}) });
});

// Step 2: verify the code, then mint the session (and create the account on
// first successful sign-in). Codes are single-use, time-limited, attempt-capped.
api.post("/login/verify", authLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code from your email." });
  const row = q.getCode.get(email);
  if (!row) return res.status(400).json({ error: "Request a new code." });
  if (Date.now() > row.expires) { q.deleteCode.run(email); return res.status(400).json({ error: "That code expired. Request a new one." }); }
  if (row.attempts >= MAX_CODE_ATTEMPTS) { q.deleteCode.run(email); return res.status(429).json({ error: "Too many wrong codes. Request a new one." }); }
  if (!safeEqualHex(row.codeHash, hashCode(email, code))) {
    q.bumpCodeAttempts.run(email);
    return res.status(400).json({ error: "Incorrect code." });
  }
  q.deleteCode.run(email);
  let user = q.getUser.get(email);
  let isNew = false;
  if (!user) {
    q.insertUser.run(email, STARTING_BALANCE, Date.now());
    user = q.getUser.get(email);
    isNew = true;
  }
  const token = newToken();
  q.insertSession.run(token, email, Date.now());
  res.json({ token, user: publicUser(user), isNew, startingBalance: STARTING_BALANCE });
});

api.post("/logout", auth, (req, res) => {
  const header = req.get("authorization") || "";
  const token = header.slice(7);
  q.deleteSession.run(token);
  res.json({ ok: true });
});

api.get("/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Unauthenticated health check only — no account data. (Balance lookups
// require a session token; see GET /api/me.)
api.get("/health", (req, res) => {
  res.json({ ok: true });
});

api.get("/config", (req, res) => {
  res.json({ ...publicConfig(), limits: { minBet: MIN_BET, maxBet: MAX_BET, maxTotalBet: MAX_TOTAL_BET, atmAmount: ATM_AMOUNT, atmCooldownMs: ATM_COOLDOWN_MS } });
});

// ---- ATM (server-enforced cooldown) --------------------------------------
api.post("/atm", auth, (req, res) => {
  const u = req.user;
  const now = Date.now();
  const elapsed = now - u.lastAtm;
  if (elapsed < ATM_COOLDOWN_MS) {
    const remainingMs = ATM_COOLDOWN_MS - elapsed;
    return res.status(429).json({ error: "ATM is on cooldown.", remainingMs });
  }
  const balance = u.balance + ATM_AMOUNT;
  q.setAtm.run(balance, now, u.email);
  res.json({ balance, lastAtm: now, amount: ATM_AMOUNT });
});

// ---- Slots ---------------------------------------------------------------
api.post("/bet/slots", betLimiter, auth, (req, res) => {
  const u = req.user;
  const { game, bet } = req.body || {};
  if (!SLOT_CONFIGS[game]) return res.status(400).json({ error: "Unknown slot machine." });
  const err = validateBet(bet, u.balance);
  if (err) return res.status(400).json({ error: err });
  const { reels, win } = spinSlots(game, bet);
  const balance = u.balance - bet + win;
  q.setBalance.run(balance, u.email);
  res.json({ balance, reels, win, delta: win - bet });
});

// ---- Roulette ------------------------------------------------------------
api.post("/bet/roulette", betLimiter, auth, (req, res) => {
  const u = req.user;
  const err = validateBetMap(req.body?.bets, ROULETTE_IDS, u.balance);
  if (err) return res.status(400).json({ error: err });
  const total = Object.values(req.body.bets).reduce((a, b) => a + b, 0);
  const { landed, winnings, wins } = spinRoulette(req.body.bets);
  const balance = u.balance - total + winnings;
  q.setBalance.run(balance, u.email);
  res.json({ balance, landed, winnings, wins, delta: winnings - total });
});

// ---- Sic Bo --------------------------------------------------------------
api.post("/bet/sicbo", betLimiter, auth, (req, res) => {
  const u = req.user;
  const err = validateBetMap(req.body?.bets, SICBO_IDS, u.balance);
  if (err) return res.status(400).json({ error: err });
  const total = Object.values(req.body.bets).reduce((a, b) => a + b, 0);
  const { dice, sum, winnings, wins } = spinSicBo(req.body.bets);
  const balance = u.balance - total + winnings;
  q.setBalance.run(balance, u.email);
  res.json({ balance, dice, sum, winnings, wins, delta: winnings - total });
});

// ---- Craps (stateful; persisted so a restart never strands the stake) -----
api.post("/bet/craps", betLimiter, auth, (req, res) => {
  const u = req.user;
  let state = getGameState(u.email, "craps");
  let balance = u.balance;

  // No active point game → this roll opens a new round (deduct the stake now).
  if (!state || state.phase === "comeout") {
    const { bet, type } = req.body || {};
    if (type !== "pass" && type !== "dontpass") return res.status(400).json({ error: "Choose Pass or Don't Pass." });
    const err = validateBet(bet, balance);
    if (err) return res.status(400).json({ error: err });
    balance -= bet;
    state = { type, phase: "comeout", point: null, bet };
  }

  const roll = crapsRoll(state);
  let delta = 0;
  let settled = true;
  if (roll.outcome === "win") { balance += state.bet * 2; delta = state.bet; }
  else if (roll.outcome === "lose") { delta = -state.bet; }
  else if (roll.outcome === "push") { balance += state.bet; delta = 0; }
  else { state.phase = roll.nextPhase; state.point = roll.nextPoint; settled = false; }

  // Balance + hand-state changes land together, atomically — synchronous
  // better-sqlite3, no awaits between reading and writing.
  db.transaction(() => {
    q.setBalance.run(balance, u.email);
    if (settled) clearGameState(u.email, "craps");
    else setGameState(u.email, "craps", state);
  })();

  res.json({
    balance, dice: roll.dice, sum: roll.sum, outcome: roll.outcome, label: roll.label,
    phase: roll.outcome === "continue" ? roll.nextPhase : "comeout",
    point: roll.outcome === "continue" ? roll.nextPoint : null,
    bet: state.bet, type: state.type, delta,
    settled,
  });
});

// ---- Poker (stateful; dealer cards stay server-side until showdown) -------
// Hand state (deck/player/dealer/community/bet/pot/phase) is persisted in
// `game_state` so a server restart mid-hand doesn't strand the already-
// debited stake — GET /api/poker/state recovers it after a restart exactly
// as it would after a page reload.
api.post("/poker/deal", betLimiter, auth, (req, res) => {
  const u = req.user;
  // A hand already in progress (e.g. the player reloaded mid-hand) must not be
  // clobbered — its stake is already deducted. Reject and let the client resume
  // via GET /api/poker/state instead of silently forfeiting the live pot.
  if (getGameState(u.email, "poker")) return res.status(409).json({ error: "Finish your hand in progress first.", active: true });
  const { bet } = req.body || {};
  const err = validateBet(bet, u.balance);
  if (err) return res.status(400).json({ error: err });
  const d = shuffle(makeDeck());
  const state = {
    deck: d.slice(4),
    player: [d[0], d[2]],
    dealer: [d[1], d[3]], // held server-side; never sent before showdown
    community: [],
    bet, pot: bet, phase: "deal",
  };
  const balance = u.balance - bet;
  db.transaction(() => {
    q.setBalance.run(balance, u.email);
    setGameState(u.email, "poker", state);
  })();
  res.json({ balance, player: state.player, pot: state.pot, phase: "deal" });
});

// Lets a reconnecting client recover a hand it was in the middle of — including
// after a server restart, since the hand lives in SQLite, not memory. Dealer
// hole cards stay hidden — same rule as deal.
api.get("/poker/state", auth, (req, res) => {
  const state = getGameState(req.user.email, "poker");
  if (!state) return res.json({ active: false });
  res.json({ active: true, player: state.player, community: state.community, pot: state.pot, phase: state.phase });
});

api.post("/poker/advance", auth, (req, res) => {
  const u = req.user;
  const state = getGameState(u.email, "poker");
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  const order = { deal: "flop", flop: "turn", turn: "river" };
  const next = order[state.phase];
  if (!next) return res.status(409).json({ error: "Nothing left to deal." });
  if (next === "flop") { state.community = state.deck.slice(0, 3); state.deck = state.deck.slice(3); }
  else { state.community.push(state.deck[0]); state.deck = state.deck.slice(1); }
  state.phase = next;
  setGameState(u.email, "poker", state);
  res.json({ community: state.community, phase: state.phase });
});

api.post("/poker/showdown", auth, (req, res) => {
  const u = req.user;
  const state = getGameState(u.email, "poker");
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  // Complete the board if the player rushed to showdown early.
  while (state.community.length < 5) { state.community.push(state.deck.shift()); }
  const pH = bestOf7([...state.player, ...state.community]);
  const dH = bestOf7([...state.dealer, ...state.community]);
  let win = false, push = false;
  if (pH.rank > dH.rank || (pH.rank === dH.rank && compareTB(pH.tb, dH.tb) > 0)) win = true;
  else if (pH.rank === dH.rank && compareTB(pH.tb, dH.tb) === 0) push = true;
  const balance = u.balance + (win ? state.pot * 2 : push ? state.pot : 0);
  db.transaction(() => {
    q.setBalance.run(balance, u.email);
    clearGameState(u.email, "poker");
  })();
  res.json({
    balance, dealer: state.dealer, community: state.community,
    playerHand: pH.name, dealerHand: dH.name,
    won: win, push, delta: win ? state.pot : push ? 0 : -state.pot,
  });
});

api.post("/poker/fold", auth, (req, res) => {
  const u = req.user;
  const state = getGameState(u.email, "poker");
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  // Stake already deducted at deal; folding just forfeits it.
  clearGameState(u.email, "poker");
  res.json({ balance: u.balance, delta: -state.pot });
});

app.use("/api", api);
app.use("/", api);

// Bind loopback IPv4 explicitly. A bare listen(PORT) binds every interface,
// and listen(PORT, "localhost") resolves to ::1 on a dual-stack box, which is
// how this API once ran v6-only behind a vhost that happened to proxy to
// `localhost`. nginx on the droplet proxies to 127.0.0.1:<port>; match it.
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Lucky Felt API (server-authoritative) listening on ${HOST}:${PORT}`);
});

export { app };
