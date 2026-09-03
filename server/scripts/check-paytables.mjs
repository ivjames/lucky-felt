#!/usr/bin/env node
// Regression guard for the slot paytables (see server/games.js).
//
// For every slot machine, enumerates every possible reel-stop combination and
// checks that SLOT_CONFIGS[id].getWin() agrees with an INDEPENDENT reading of
// SLOT_CONFIGS[id].paylines — implemented locally here, not imported from
// games.js — so a future edit that lets the two drift apart again gets caught.
//
// Run: node server/scripts/check-paytables.mjs

import { SLOT_CONFIGS } from "../games.js";

// Independent re-implementation of the paytable semantics (does not import
// games.js's own evaluator): a { symbol, count, m } rule pays when the
// leftmost `count` reels are all `symbol` (or, with anywhere: true, `symbol`
// appears at least `count` times in any position); a { any: true, count, m } rule
// pays when some symbol appears at least `count` times anywhere in the
// result. First matching rule in array order wins.
function expectedWin(paylines, reel, bet) {
  for (const rule of paylines) {
    if (rule.symbol) {
      const hit = rule.anywhere
        ? reel.filter((s) => s === rule.symbol).length >= rule.count
        : reel.length >= rule.count && reel.slice(0, rule.count).every((s) => s === rule.symbol);
      if (hit) {
        return rule.m < 1 ? Math.ceil(bet * rule.m) : bet * rule.m;
      }
    } else if (rule.any) {
      const counts = {};
      for (const s of reel) counts[s] = (counts[s] || 0) + 1;
      const max = Math.max(...Object.values(counts));
      if (max >= rule.count) return rule.m < 1 ? Math.ceil(bet * rule.m) : bet * rule.m;
    }
  }
  return 0;
}

// Cartesian product over each reel's *distinct* symbols (the reel strip may
// repeat a symbol several times for weighting, which doesn't change which
// combinations are possible).
function* combos(reels) {
  if (reels.length === 0) { yield []; return; }
  const [first, ...rest] = reels;
  for (const sym of new Set(first)) {
    for (const tail of combos(rest)) yield [sym, ...tail];
  }
}

const BET = 10;
let checked = 0;
let failures = 0;

for (const [id, cfg] of Object.entries(SLOT_CONFIGS)) {
  let machineChecked = 0;
  for (const reel of combos(cfg.reels)) {
    machineChecked++;
    checked++;
    const got = cfg.getWin(reel, BET);
    const want = expectedWin(cfg.paylines, reel, BET);
    if (got !== want) {
      failures++;
      console.error(`[${id}] FAIL reel=${JSON.stringify(reel)} getWin=${got} paytable-expects=${want}`);
    }
  }
  console.log(`[${id}] ${machineChecked} combinations checked.`);
}

// Spot-check specific figures called out in the bug report, so a "matches
// itself" tautology in the loop above can't hide a wrong number making it
// into both getWin and the paytable at once.
const spotChecks = [
  ["slots1", ["cherry", "cherry", "cherry"], 5],
  ["slots1", ["bell", "bell", "bell"], 10],
  ["slots1", ["seven", "seven", "seven"], 100],
  ["slots2", ["peach", "peach", "peach"], 20],
  ["slots2", ["strawberry", "strawberry", "strawberry"], 15],
  ["slots2", ["orange", "orange", "orange"], 12],
  ["slots2", ["lemon", "lemon", "lemon"], 10],
  ["slots3", ["planet", "planet", "planet", "planet", "planet"], 150],
  ["slots3", ["comet", "comet", "comet", "comet", "comet"], 30],
  ["slots3", ["moon", "moon", "moon", "moon", "moon"], 10],
  ["slots3", ["sparkle", "sparkle", "sparkle", "sparkle", "sparkle"], 10],
  ["slots3", ["moon", "moon", "star", "sun", "rocket"], 0.5],
];
for (const [id, reel, mult] of spotChecks) {
  const want = mult < 1 ? Math.ceil(BET * mult) : BET * mult;
  const got = SLOT_CONFIGS[id].getWin(reel, BET);
  if (got !== want) {
    failures++;
    console.error(`[${id}] SPOT-CHECK FAIL reel=${JSON.stringify(reel)} getWin=${got} expected=${want}`);
  }
}
console.log(`${spotChecks.length} spot-checks run.`);

console.log(`\nChecked ${checked} total reel combinations across ${Object.keys(SLOT_CONFIGS).length} machines.`);
if (failures > 0) {
  console.error(`${failures} mismatch(es) between getWin() and the displayed paytable.`);
  process.exit(1);
}
console.log("All slot payouts match their displayed paytables.");
