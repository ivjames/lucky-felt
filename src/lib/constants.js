// Display-only constants. The SERVER enforces these (cooldown, payouts, RNG);
// the client keeps copies purely for rendering. Nothing here decides money.
export const ATM_AMOUNT = 500;
export const ATM_COOLDOWN_MS = 5 * 60 * 1000;

export const GAMES = [
  { id: "poker", name: "Texas Hold'em", icon: "🃏", desc: "5-card community poker vs the dealer" },
  { id: "roulette", name: "Roulette", icon: "🎡", desc: "European single-zero wheel" },
  { id: "craps", name: "Craps", icon: "🎲", desc: "Pass/don't pass dice classic" },
  { id: "sicbo", name: "Sic Bo", icon: "🎲", desc: "Three-dice bet variety" },
  { id: "slots1", name: "Classic Slots", icon: "🎰", desc: "3-reel BAR & 7 machine" },
  { id: "slots2", name: "Fruit Slots", icon: "🍒", desc: "Cherries, lemons, watermelons" },
  { id: "slots3", name: "Lucky Stars", icon: "⭐", desc: "5-reel bonus stars machine" },
];

// Chip face colours, indexed alongside the chip denomination lists.
export const CHIP_COLORS = ["#3d8b7a", "#3a6ab5", "#9e3a3a", "#6b4ab5", "#b58a20", "#2e6e45"];

export const BET_CHIPS = [1, 5, 10, 25, 50, 100];

// Index 0 is unused so a die value maps straight to its glyph.
export const DICE_SYMBOLS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
