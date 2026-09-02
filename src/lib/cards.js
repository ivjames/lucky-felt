// Card helpers. The server sends suits as ids ("spades", "hearts", …) rather
// than glyphs; the client draws each one as an SVG.
export const SUIT_NAMES = {
  spades: "spades",
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
};

export const RANK_NAMES = {
  A: "Ace",
  K: "King",
  Q: "Queen",
  J: "Jack",
};

export function isRedSuit(suit) {
  return suit === "hearts" || suit === "diamonds";
}

export function cardLabel(card) {
  const rank = RANK_NAMES[card.r] ?? card.r;
  return `${rank} of ${SUIT_NAMES[card.s] ?? card.s}`;
}
