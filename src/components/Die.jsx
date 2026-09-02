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
 * face cycles and the die tumbles in three dimensions; when it stops it drops
 * and bounces onto the tray. `index` picks one of three tumbles and offsets the
 * timing, so two or three dice in a tray are never in phase. All of it is
 * suppressed for viewers who asked for reduced motion, and none of it chooses a
 * pip: the settled value is whatever the server sent. Decorative — the dice
 * tray around it owns the label.
 */
export default function Die({ value, rolling = false, size = 72, index = 0 }) {
  const reduced = useReducedMotion();
  const [face, setFace] = useState(value ?? 1);

  useEffect(() => {
    if (!rolling) return undefined;
    if (reduced) return undefined;
    // Off-phase cycling as well, so the faces don't flicker in lockstep.
    const t = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90 + index * 17);
    return () => clearInterval(t);
  }, [rolling, reduced, index]);

  // Not rolling: the settled value wins. Rolling: the cycling face.
  const shown = rolling ? face : (value ?? face);
  const landed = !rolling && value != null;
  const u = 32 / 4;

  const die = (
    <svg
      className={`lf-die${rolling ? " lf-die--rolling" : ""}${landed ? " lf-die--landed" : ""}`}
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

  // The slot floats the die above the tray and casts its contact shadow onto
  // it; the die inside does the tumbling.
  return (
    <span
      className="lf-die-slot lf-contact"
      style={{ width: size, height: size, "--lf-die-i": index }}
      aria-hidden="true"
    >
      {die}
    </span>
  );
}
