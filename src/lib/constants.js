// Display-only constants. The SERVER enforces these (cooldown, payouts, RNG);
// the client keeps copies purely for rendering. Nothing here decides money.
export const ATM_AMOUNT = 500;
export const ATM_COOLDOWN_MS = 5 * 60 * 1000;

// `id` also selects the game's SVG mark — see components/icons/GameIcon.jsx.
export const GAMES = [
  { id: "poker", name: "Texas Hold'em", desc: "Five-card community poker against the dealer" },
  { id: "roulette", name: "Roulette", desc: "European single-zero wheel" },
  { id: "craps", name: "Craps", desc: "The pass / don't pass dice classic" },
  { id: "sicbo", name: "Sic Bo", desc: "Three dice, a board full of bets" },
  { id: "slots1", name: "Classic Slots", desc: "Three-reel bars and sevens" },
  { id: "slots2", name: "Fruit Slots", desc: "Cherries, lemons and watermelons" },
  { id: "slots3", name: "Lucky Stars", desc: "Five-reel cosmic bonus machine" },
];

// Chip face colours, indexed alongside the chip denomination lists.
export const CHIP_COLORS = ["#2f7d6d", "#2f5fa8", "#a13232", "#6b45a8", "#a8801c", "#2b6b42"];

export const BET_CHIPS = [1, 5, 10, 25, 50, 100];
