import { useEffect, useState } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";
import "./Die.css";

// Pip layout on a 4x4 grid inside the face.
const PIPS = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [3, 1],
    [1, 3],
    [3, 3],
  ],
  5: [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 2],
    [1, 3],
    [3, 1],
    [3, 2],
    [3, 3],
  ],
};

/**
 * One die. `value` is 1–6, or null before the first roll. While `rolling` the
 * face cycles and the die tumbles; both are suppressed for viewers who asked
 * for reduced motion. Decorative — the dice tray around it owns the label.
 */
export default function Die({ value, rolling = false, size = 72 }) {
  const reduced = useReducedMotion();
  const [face, setFace] = useState(value ?? 1);

  useEffect(() => {
    if (!rolling) return undefined;
    if (reduced) return undefined;
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(t);
  }, [rolling, reduced]);

  // Not rolling: the settled value wins. Rolling: the cycling face.
  const shown = rolling ? face : (value ?? face);
  const u = 32 / 4;

  return (
    <svg
      className={`lf-die${rolling ? " lf-die--rolling" : ""}`}
      style={{ width: size, height: size }}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.4" y="1.4" width="29.2" height="29.2" rx="6.4" fill="var(--lf-paper)" />
      <rect
        x="1.4"
        y="1.4"
        width="29.2"
        height="29.2"
        rx="6.4"
        fill="none"
        stroke="var(--lf-paper-edge)"
        strokeWidth="1.2"
      />
      <path d="M6 3.2h20a4 4 0 0 1 3 1.4H3a4 4 0 0 1 3-1.4Z" fill="#fff" opacity="0.8" />
      {(PIPS[shown] ?? PIPS[1]).map(([cx, cy], i) => (
        <circle key={i} cx={cx * u} cy={cy * u} r="2.9" fill="var(--lf-ink)" />
      ))}
    </svg>
  );
}
