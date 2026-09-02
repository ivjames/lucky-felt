// Server-authoritative game logic — the SINGLE source of truth for RNG and payouts.
// Nothing in here trusts the client; every outcome and every payout is decided here.

import crypto from "node:crypto";

// ---- Secure-ish RNG helpers ---------------------------------------------
// crypto.randomInt is uniform and unpredictable, unlike Math.random which the
// old client used. Money outcomes must never be guessable or seeded.
export function randInt(maxExclusive) {
  return crypto.randomInt(0, maxExclusive);
}
function pick(arr) {
  return arr[randInt(arr.length)];
}
function rollDie() {
  return randInt(6) + 1; // 1..6
}

// ---- Cards / Poker -------------------------------------------------------
// Suits are plain ids, not glyphs — the client draws each suit as an SVG.
const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VAL = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };

export function makeDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s });
  return d;
}
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getRank(card) {
  return RANK_VAL[card.r];
}
export function evaluateHand(cards) {
  const sorted = [...cards].sort((a, b) => getRank(b) - getRank(a));
  const ranks = sorted.map((c) => getRank(c));
  const suits = sorted.map((c) => c.s);
  const rankCounts = {};
  ranks.forEach((r) => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const groups = Object.entries(rankCounts).map(([r, c]) => ({ r: +r, c })).sort((a, b) => b.c - a.c || b.r - a.r);
  const counts = groups.map((g) => g.c);
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = uniqueRanks.length === 5 && uniqueRanks[0] - uniqueRanks[4] === 4;
  const isWheelStraight = uniqueRanks.join(",") === "14,5,4,3,2";
  if ((isStraight || isWheelStraight) && isFlush) {
    const high = isWheelStraight ? 5 : uniqueRanks[0];
    return { rank: 8, name: high === 14 ? "Royal Flush" : "Straight Flush", tb: [high] };
  }
  if (counts[0] === 4) return { rank: 7, name: "Four of a Kind", tb: [groups[0].r, groups[1].r] };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 6, name: "Full House", tb: [groups[0].r, groups[1].r] };
  if (isFlush) return { rank: 5, name: "Flush", tb: ranks };
  if (isStraight || isWheelStraight) return { rank: 4, name: "Straight", tb: [isWheelStraight ? 5 : uniqueRanks[0]] };
  if (counts[0] === 3) {
    const kickers = groups.filter((g) => g.c === 1).map((g) => g.r).sort((a, b) => b - a);
    return { rank: 3, name: "Three of a Kind", tb: [groups[0].r, ...kickers] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const kicker = groups.find((g) => g.c === 1)?.r || 0;
    return { rank: 2, name: "Two Pair", tb: [groups[0].r, groups[1].r, kicker] };
  }
  if (counts[0] === 2) {
    const kickers = groups.filter((g) => g.c === 1).map((g) => g.r).sort((a, b) => b - a);
    return { rank: 1, name: "Pair", tb: [groups[0].r, ...kickers] };
  }
  return { rank: 0, name: "High Card (" + sorted[0].r + ")", tb: ranks };
}
export function bestOf7(cards) {
  let best = null;
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const five = cards.filter((_, idx) => idx !== i && idx !== j);
      const ev = evaluateHand(five);
      if (!best || ev.rank > best.rank || (ev.rank === best.rank && compareTB(ev.tb, best.tb) > 0)) best = ev;
    }
  return best;
}
export function compareTB(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// ---- Slots ---------------------------------------------------------------
// Reels and payout rules live here, server-side, as the single source of truth.
// Symbols are plain string ids; the client maps each id to an SVG symbol and a
// human-readable name. Paylines are structured so the client can render a real
// table: { symbol, count, m } for a named combination, { any: true, count, m }
// for "any matching symbols".
// The client receives a read-only copy of the display tables via /api/config.
export const SLOT_CONFIGS = {
  slots1: {
    name: "Classic Slots",
    reels: [
      ["seven", "bar", "bar", "cherry", "bell", "diamond", "star", "bar", "cherry"],
      ["seven", "bar", "cherry", "bar", "bell", "diamond", "star", "bar", "cherry"],
      ["seven", "bar", "cherry", "bar", "bell", "diamond", "bar", "star", "cherry"],
    ],
    symbols: ["cherry", "bar", "seven", "diamond", "star", "bell"],
    paylines: [
      { symbol: "seven", count: 3, m: 100 }, { symbol: "diamond", count: 3, m: 50 },
      { symbol: "bar", count: 3, m: 20 }, { symbol: "star", count: 3, m: 10 },
      { symbol: "cherry", count: 3, m: 5 }, { symbol: "cherry", count: 2, m: 2 },
      { symbol: "cherry", count: 1, m: 0.5 },
    ],
    getWin(r, bet) {
      const [a, b, c] = r;
      if (a === "seven" && b === "seven" && c === "seven") return bet * 100;
      if (a === "diamond" && b === "diamond" && c === "diamond") return bet * 50;
      if (a === "bar" && b === "bar" && c === "bar") return bet * 20;
      if (a === b && b === c) return bet * 10;
      if (a === "cherry" && b === "cherry") return bet * 2;
      if (a === "cherry") return Math.ceil(bet * 0.5);
      return 0;
    },
  },
  slots2: {
    name: "Fruit Slots",
    reels: [
      ["cherry", "lemon", "orange", "grape", "melon", "strawberry", "peach", "star", "cherry", "lemon"],
      ["cherry", "lemon", "orange", "grape", "melon", "strawberry", "peach", "star", "cherry", "lemon"],
      ["cherry", "lemon", "orange", "grape", "melon", "strawberry", "peach", "star", "cherry", "lemon"],
    ],
    symbols: ["cherry", "lemon", "orange", "grape", "melon", "strawberry", "peach", "star"],
    paylines: [
      { symbol: "star", count: 3, m: 75 }, { symbol: "melon", count: 3, m: 30 },
      { symbol: "grape", count: 3, m: 25 }, { symbol: "cherry", count: 3, m: 8 },
      { symbol: "cherry", count: 2, m: 3 }, { symbol: "cherry", count: 1, m: 0.5 },
    ],
    getWin(r, bet) {
      const [a, b, c] = r;
      if (a === b && b === c) {
        if (a === "star") return bet * 75;
        if (a === "melon") return bet * 30;
        if (a === "grape") return bet * 25;
        if (a === "peach") return bet * 20;
        if (a === "strawberry") return bet * 15;
        if (a === "orange") return bet * 12;
        if (a === "lemon") return bet * 10;
        if (a === "cherry") return bet * 8;
      }
      if (a === "cherry" && b === "cherry") return bet * 3;
      if (a === "cherry") return Math.ceil(bet * 0.5);
      return 0;
    },
  },
  slots3: {
    name: "Lucky Stars",
    reels: [
      ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
      ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
      ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
      ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
      ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
    ],
    symbols: ["star", "northstar", "comet", "sparkle", "moon", "sun", "planet", "rocket"],
    paylines: [
      { symbol: "rocket", count: 5, m: 500 }, { symbol: "sun", count: 5, m: 200 },
      { symbol: "northstar", count: 5, m: 100 }, { symbol: "star", count: 5, m: 50 },
      { any: true, count: 5, m: 10 }, { any: true, count: 4, m: 3 }, { any: true, count: 3, m: 2 },
    ],
    getWin(r, bet) {
      if (r.every((x) => x === r[0])) {
        const s = r[0];
        if (s === "rocket") return bet * 500;
        if (s === "sun") return bet * 200;
        if (s === "planet") return bet * 150;
        if (s === "northstar") return bet * 100;
        if (s === "star") return bet * 50;
        if (s === "comet") return bet * 30;
        return bet * 10;
      }
      const counts = {};
      r.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
      const max = Math.max(...Object.values(counts));
      if (max >= 4) return bet * 3;
      if (max >= 3) return bet * 2;
      if (max >= 2) return Math.ceil(bet * 0.5);
      return 0;
    },
  },
};

export function spinSlots(gameId, bet) {
  const cfg = SLOT_CONFIGS[gameId];
  if (!cfg) return null;
  const reels = cfg.reels.map((reel) => pick(reel));
  const win = cfg.getWin(reels, bet);
  return { reels, win };
}

// ---- Roulette ------------------------------------------------------------
export const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const ROULETTE_BETS = [
  { id: "red", label: "Red", payout: 1, check: (n) => RED_NUMS.includes(n) },
  { id: "black", label: "Black", payout: 1, check: (n) => n > 0 && !RED_NUMS.includes(n) },
  { id: "odd", label: "Odd", payout: 1, check: (n) => n % 2 !== 0 && n > 0 },
  { id: "even", label: "Even", payout: 1, check: (n) => n % 2 === 0 && n > 0 },
  { id: "1-18", label: "1–18", payout: 1, check: (n) => n >= 1 && n <= 18 },
  { id: "19-36", label: "19–36", payout: 1, check: (n) => n >= 19 && n <= 36 },
  { id: "1st12", label: "1st 12", payout: 2, check: (n) => n >= 1 && n <= 12 },
  { id: "2nd12", label: "2nd 12", payout: 2, check: (n) => n >= 13 && n <= 24 },
  { id: "3rd12", label: "3rd 12", payout: 2, check: (n) => n >= 25 && n <= 36 },
  { id: "0", label: "Zero", payout: 35, check: (n) => n === 0 },
];

export function spinRoulette(bets) {
  const n = randInt(37); // 0..36, single-zero European wheel
  let winnings = 0;
  const wins = [];
  for (const [id, amount] of Object.entries(bets)) {
    const bt = ROULETTE_BETS.find((b) => b.id === id);
    if (bt && bt.check(n)) {
      winnings += amount * (bt.payout + 1);
      wins.push(bt.label);
    }
  }
  return { landed: n, winnings, wins };
}

// ---- Sic Bo --------------------------------------------------------------
export const SIC_BO_BETS = [
  { id: "small", label: "Small (4–10)", payout: 1, check: (s, d) => s >= 4 && s <= 10 && !(d[0] === d[1] && d[1] === d[2]) },
  { id: "big", label: "Big (11–17)", payout: 1, check: (s, d) => s >= 11 && s <= 17 && !(d[0] === d[1] && d[1] === d[2]) },
  { id: "even", label: "Even sum", payout: 1, check: (s) => s % 2 === 0 },
  { id: "odd", label: "Odd sum", payout: 1, check: (s) => s % 2 !== 0 },
  { id: "triple", label: "Any triple", payout: 30, check: (_, d) => d[0] === d[1] && d[1] === d[2] },
  { id: "sum7", label: "Sum = 7", payout: 12, check: (s) => s === 7 },
  { id: "sum14", label: "Sum = 14", payout: 12, check: (s) => s === 14 },
  { id: "sum4", label: "Sum = 4", payout: 50, check: (s) => s === 4 },
  { id: "sum17", label: "Sum = 17", payout: 50, check: (s) => s === 17 },
];

export function spinSicBo(bets) {
  const d = [rollDie(), rollDie(), rollDie()];
  const s = d.reduce((a, b) => a + b, 0);
  let winnings = 0;
  const wins = [];
  for (const [id, amount] of Object.entries(bets)) {
    const bt = SIC_BO_BETS.find((b) => b.id === id);
    if (bt && bt.check(s, d)) {
      winnings += amount * (bt.payout + 1);
      wins.push(bt.label);
    }
  }
  return { dice: d, sum: s, winnings, wins };
}

// ---- Craps (stateful, one roll at a time) --------------------------------
// Resolves a single roll given the current phase/point. The caller owns the
// bankroll math; this returns what happened and the next phase/point.
export function crapsRoll({ type, phase, point }) {
  const d1 = rollDie();
  const d2 = rollDie();
  const sum = d1 + d2;
  const dice = [d1, d2];
  // outcome: 'win' | 'lose' | 'push' | 'continue' (assigned in every branch below)
  let outcome;
  let nextPhase = phase;
  let nextPoint = point;
  let label;

  if (phase === "comeout") {
    if (type === "pass") {
      if (sum === 7 || sum === 11) { outcome = "win"; label = "Natural — you win!"; }
      else if (sum === 2 || sum === 3 || sum === 12) { outcome = "lose"; label = "Craps — you lose"; }
      else { outcome = "continue"; nextPhase = "point"; nextPoint = sum; label = `Point is ${sum}. Roll it again before a 7.`; }
    } else { // dontpass
      if (sum === 2 || sum === 3) { outcome = "win"; label = "Win! (Craps)"; }
      else if (sum === 12) { outcome = "push"; label = "Push (Bar 12)"; }
      else if (sum === 7 || sum === 11) { outcome = "lose"; label = "Don't Pass loses"; }
      else { outcome = "continue"; nextPhase = "point"; nextPoint = sum; label = `Point is ${sum}. Roll a 7 to win.`; }
    }
  } else { // point phase
    if (type === "pass") {
      if (sum === point) { outcome = "win"; label = "Hit the point — you win!"; }
      else if (sum === 7) { outcome = "lose"; label = "Seven out — you lose"; }
      else { outcome = "continue"; label = `Point: ${point}. Keep rolling…`; }
    } else { // dontpass
      if (sum === 7) { outcome = "win"; label = "7 before point — you win!"; }
      else if (sum === point) { outcome = "lose"; label = "Point hit — you lose"; }
      else { outcome = "continue"; label = `Point: ${point}. Keep rolling…`; }
    }
    if (outcome !== "continue") { nextPhase = "comeout"; nextPoint = null; }
  }
  return { dice, sum, outcome, label, nextPhase, nextPoint };
}

// ---- Read-only config the client may display -----------------------------
export function publicConfig() {
  return {
    slots: Object.fromEntries(
      Object.entries(SLOT_CONFIGS).map(([id, c]) => [id, { name: c.name, symbols: c.symbols, reelCount: c.reels.length, paylines: c.paylines }])
    ),
    roulette: ROULETTE_BETS.map(({ id, label, payout }) => ({ id, label, payout })),
    sicbo: SIC_BO_BETS.map(({ id, label, payout }) => ({ id, label, payout })),
    redNums: RED_NUMS,
  };
}
