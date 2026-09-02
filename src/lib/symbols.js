// Human-readable names for the reel symbol ids the server sends. Used for
// aria-labels, the result line and the paytable, so the machine never has to
// describe itself with a picture alone.
export const SYMBOL_NAMES = {
  cherry: "Cherry",
  bar: "Bar",
  seven: "Seven",
  diamond: "Diamond",
  star: "Star",
  bell: "Bell",
  lemon: "Lemon",
  orange: "Orange",
  grape: "Grapes",
  melon: "Watermelon",
  strawberry: "Strawberry",
  peach: "Peach",
  northstar: "North Star",
  comet: "Comet",
  sparkle: "Sparkle",
  moon: "Moon",
  sun: "Sun",
  planet: "Planet",
  rocket: "Rocket",
};

export function symbolName(id) {
  return SYMBOL_NAMES[id] ?? id;
}

/** Describe a payline row in words, for screen readers and the table's
 *  left column: `{ symbol, count }` or `{ any: true, count }`. */
export function paylineLabel(line) {
  if (line.any) return `Any ${line.count} matching`;
  const name = symbolName(line.symbol);
  return line.count > 1 ? `${line.count} × ${name}` : `1 × ${name}`;
}
