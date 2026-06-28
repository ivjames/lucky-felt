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

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.CASINO_DB || "./casino.db";
const STARTING_BALANCE = 1000;
const ATM_AMOUNT = 500;
const ATM_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_BET = 1;
const MAX_BET = 500;          // per single-stake game (slots, craps, poker)
const MAX_TOTAL_BET = 5000;   // total across a multi-bet round (roulette, sic bo)

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
`);

const q = {
  getUser: db.prepare("SELECT email, balance, last_atm AS lastAtm, created FROM users WHERE email = ?"),
  insertUser: db.prepare("INSERT INTO users (email, balance, last_atm, created) VALUES (?, ?, 0, ?)"),
  setBalance: db.prepare("UPDATE users SET balance = ? WHERE email = ?"),
  setAtm: db.prepare("UPDATE users SET balance = ?, last_atm = ? WHERE email = ?"),
  insertSession: db.prepare("INSERT INTO sessions (token, email, created) VALUES (?, ?, ?)"),
  getSession: db.prepare("SELECT email FROM sessions WHERE token = ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
};

// Per-user in-progress hand state for the stateful games (craps point, poker
// deck). Ephemeral by design — a server restart simply drops any hand in flight
// and the client falls back to starting a fresh round.
const crapsState = new Map(); // email -> { type, phase, point, bet }
const pokerState = new Map(); // email -> { deck, player, dealer, community, bet, pot, phase }

// ---- App -----------------------------------------------------------------
const app = express();
app.use(express.json());
app.set("trust proxy", 1); // behind nginx; needed for correct rate-limit keys

const betLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // generous for a human clicking spin; blunts scripted abuse
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — slow down." },
});

// ---- Helpers -------------------------------------------------------------
function newToken() {
  return crypto.randomBytes(24).toString("hex");
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
app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email address." });
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

app.post("/api/logout", auth, (req, res) => {
  const header = req.get("authorization") || "";
  const token = header.slice(7);
  q.deleteSession.run(token);
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Read-only smoke-test endpoint (no token): balance lookup only. Kept for the
// `curl .../api/user/test@test.com` health check in the handoff.
app.get("/api/user/:email", (req, res) => {
  const u = q.getUser.get(String(req.params.email).toLowerCase());
  if (!u) return res.status(404).json({ error: "Not found." });
  res.json({ email: u.email, balance: u.balance, created: u.created });
});

app.get("/api/config", (req, res) => {
  res.json({ ...publicConfig(), limits: { minBet: MIN_BET, maxBet: MAX_BET, maxTotalBet: MAX_TOTAL_BET, atmAmount: ATM_AMOUNT, atmCooldownMs: ATM_COOLDOWN_MS } });
});

// ---- ATM (server-enforced cooldown) --------------------------------------
app.post("/api/atm", auth, (req, res) => {
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
app.post("/api/bet/slots", betLimiter, auth, (req, res) => {
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
app.post("/api/bet/roulette", betLimiter, auth, (req, res) => {
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
app.post("/api/bet/sicbo", betLimiter, auth, (req, res) => {
  const u = req.user;
  const err = validateBetMap(req.body?.bets, SICBO_IDS, u.balance);
  if (err) return res.status(400).json({ error: err });
  const total = Object.values(req.body.bets).reduce((a, b) => a + b, 0);
  const { dice, sum, winnings, wins } = spinSicBo(req.body.bets);
  const balance = u.balance - total + winnings;
  q.setBalance.run(balance, u.email);
  res.json({ balance, dice, sum, winnings, wins, delta: winnings - total });
});

// ---- Craps (stateful) ----------------------------------------------------
app.post("/api/bet/craps", betLimiter, auth, (req, res) => {
  const u = req.user;
  let state = crapsState.get(u.email);
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
  if (roll.outcome === "win") { balance += state.bet * 2; delta = state.bet; crapsState.delete(u.email); }
  else if (roll.outcome === "lose") { delta = -state.bet; crapsState.delete(u.email); }
  else if (roll.outcome === "push") { balance += state.bet; delta = 0; crapsState.delete(u.email); }
  else { state.phase = roll.nextPhase; state.point = roll.nextPoint; crapsState.set(u.email, state); }

  q.setBalance.run(balance, u.email);
  res.json({
    balance, dice: roll.dice, sum: roll.sum, outcome: roll.outcome, label: roll.label,
    phase: roll.outcome === "continue" ? roll.nextPhase : "comeout",
    point: roll.outcome === "continue" ? roll.nextPoint : null,
    bet: state.bet, type: state.type, delta,
    settled: roll.outcome !== "continue",
  });
});

// ---- Poker (stateful; dealer cards stay server-side until showdown) -------
app.post("/api/poker/deal", betLimiter, auth, (req, res) => {
  const u = req.user;
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
  pokerState.set(u.email, state);
  const balance = u.balance - bet;
  q.setBalance.run(balance, u.email);
  res.json({ balance, player: state.player, pot: state.pot, phase: "deal" });
});

app.post("/api/poker/advance", auth, (req, res) => {
  const u = req.user;
  const state = pokerState.get(u.email);
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  const order = { deal: "flop", flop: "turn", turn: "river" };
  const next = order[state.phase];
  if (!next) return res.status(409).json({ error: "Nothing left to deal." });
  if (next === "flop") { state.community = state.deck.slice(0, 3); state.deck = state.deck.slice(3); }
  else { state.community.push(state.deck[0]); state.deck = state.deck.slice(1); }
  state.phase = next;
  pokerState.set(u.email, state);
  res.json({ community: state.community, phase: state.phase });
});

app.post("/api/poker/showdown", auth, (req, res) => {
  const u = req.user;
  const state = pokerState.get(u.email);
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  // Complete the board if the player rushed to showdown early.
  while (state.community.length < 5) { state.community.push(state.deck.shift()); }
  const pH = bestOf7([...state.player, ...state.community]);
  const dH = bestOf7([...state.dealer, ...state.community]);
  let win = false, push = false;
  if (pH.rank > dH.rank || (pH.rank === dH.rank && compareTB(pH.tb, dH.tb) > 0)) win = true;
  else if (pH.rank === dH.rank && compareTB(pH.tb, dH.tb) === 0) push = true;
  const balance = u.balance + (win ? state.pot * 2 : push ? state.pot : 0);
  q.setBalance.run(balance, u.email);
  pokerState.delete(u.email);
  res.json({
    balance, dealer: state.dealer, community: state.community,
    playerHand: pH.name, dealerHand: dH.name,
    won: win, push, delta: win ? state.pot : push ? 0 : -state.pot,
  });
});

app.post("/api/poker/fold", auth, (req, res) => {
  const u = req.user;
  const state = pokerState.get(u.email);
  if (!state) return res.status(409).json({ error: "No hand in progress." });
  // Stake already deducted at deal; folding just forfeits it.
  pokerState.delete(u.email);
  res.json({ balance: u.balance, delta: -state.pot });
});

app.listen(PORT, () => {
  console.log(`Lucky Felt API (server-authoritative) listening on :${PORT}`);
});

export { app };
