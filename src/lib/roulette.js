// Physical pocket order of a European single-zero wheel, clockwise from 0.
// The SVG wheel draws its pockets in exactly this order so the picture matches
// a real wheel rather than counting 0..36 around the rim.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

/** "green" | "red" | "black" for a pocket number. `redNums` comes from
 *  /api/config so the server stays the source of truth for the red set. */
export function pocketColor(n, redNums) {
  if (n === 0) return "green";
  return redNums.includes(n) ? "red" : "black";
}
