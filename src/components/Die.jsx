import { useEffect, useRef } from "react";
import { useReducedMotion } from "../lib/useReducedMotion";
import "./Die.css";

// Pip layout on a 4x4 grid inside a face.
const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]],
};

// A real die: opposite faces sum to seven. Each face is placed on the cube by
// rotating it out from the front and pushing it half a die outward.
const FACES = [
  { v: 1, place: "", role: "front" },
  { v: 6, place: "rotateY(180deg)", role: "back" },
  { v: 2, place: "rotateY(90deg)", role: "right" },
  { v: 5, place: "rotateY(-90deg)", role: "left" },
  { v: 3, place: "rotateX(90deg)", role: "top" },
  { v: 4, place: "rotateX(-90deg)", role: "bottom" },
];

// Cube rotation [rx, ry] that brings a given value to the front.
const ORIENT = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

function Face({ v, place, role }) {
  const u = 32 / 4;
  return (
    <svg
      className={`lf-cube__face lf-cube__face--${role}`}
      style={{ transform: `${place} translateZ(var(--lf-die-h))` }}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.8" y="0.8" width="30.4" height="30.4" rx="5.5" fill="var(--lf-paper)" />
      <rect x="0.8" y="0.8" width="30.4" height="30.4" rx="5.5" fill="none" stroke="var(--lf-paper-edge)" strokeWidth="1.1" />
      <path d="M6 2.4h20a3.6 3.6 0 0 1 2.8 1.3H3.2A3.6 3.6 0 0 1 6 2.4Z" fill="#fff" opacity="0.75" />
      {PIPS[v].map(([cx, cy], i) => (
        <circle key={i} cx={cx * u} cy={cy * u} r="2.9" fill="var(--lf-ink)" />
      ))}
    </svg>
  );
}

/**
 * One die, as a real cube. `value` is 1–6, or null before the first roll.
 * While `rolling` the cube tumbles on two axes and hops; when the roll ends it
 * carries on from wherever it was and decelerates onto the face the server
 * sent, then the whole die drops onto the tray. `index` de-phases the dice in
 * a tray. Under reduced motion the cube simply shows the value. Nothing here
 * chooses a pip: the settled face is always the server's value. Decorative —
 * the dice tray around it owns the label.
 */
export default function Die({ value, rolling = false, size = 72, index = 0 }) {
  const reduced = useReducedMotion();
  const cubeRef = useRef(null);
  // Current rotation, kept outside React state so the tumble can run at
  // animation-frame rate without re-rendering.
  const rot = useRef({ rx: 0, ry: 0 });
  const wasRolling = useRef(false);

  useEffect(() => {
    const el = cubeRef.current;
    if (!el) return undefined;
    const [txBase, tyBase] = ORIENT[value ?? 1];

    if (reduced) {
      el.style.transition = "none";
      el.style.transform = `rotateX(${txBase}deg) rotateY(${tyBase}deg)`;
      rot.current = { rx: txBase, ry: tyBase };
      wasRolling.current = false;
      return undefined;
    }

    if (rolling) {
      wasRolling.current = true;
      el.style.transition = "none";
      // Angular velocities in deg/s, different per die so the tray never
      // moves in lockstep; direction alternates.
      const dir = index % 2 ? -1 : 1;
      const vx = dir * (520 + index * 90);
      const vy = -dir * (410 + index * 70);
      const hop = 10 + index * 2;
      const freq = 6.5 + index * 0.9;
      let last = performance.now();
      let raf = 0;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        rot.current.rx += vx * dt;
        rot.current.ry += vy * dt;
        const y = -Math.abs(Math.sin(now / 1000 * freq)) * hop;
        el.style.transform = `translateY(${y}px) rotateX(${rot.current.rx}deg) rotateY(${rot.current.ry}deg)`;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    // Not rolling. If we were, glide onward to the target: at least most of a
    // turn more on each axis so the settle reads as deceleration, never a
    // rewind. If we weren't (first paint, reload), just show it.
    const ahead = (cur, target) => {
      const mod = ((target - cur) % 360 + 360) % 360;
      return cur + (mod < 200 ? mod + 360 : mod);
    };
    if (wasRolling.current) {
      const rx = ahead(rot.current.rx, txBase);
      const ry = ahead(rot.current.ry, tyBase);
      // Two frames: commit the last tumble pose without a transition, then
      // transition to the settled pose.
      el.style.transition = "none";
      el.style.transform = `translateY(0) rotateX(${rot.current.rx}deg) rotateY(${rot.current.ry}deg)`;
      void el.offsetWidth; // flush
      el.style.transition = "transform 0.75s cubic-bezier(0.22, 0.9, 0.3, 1.08)";
      el.style.transform = `translateY(0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      rot.current = { rx, ry };
      wasRolling.current = false;
    } else {
      el.style.transition = "none";
      el.style.transform = `rotateX(${txBase}deg) rotateY(${tyBase}deg)`;
      rot.current = { rx: txBase, ry: tyBase };
    }
    return undefined;
  }, [rolling, value, reduced, index]);

  const landed = !rolling && value != null;
  return (
    <span
      className="lf-die-slot lf-contact"
      style={{ width: size, height: size, "--lf-die-i": index, "--lf-die-h": `${size / 2}px` }}
      aria-hidden="true"
    >
      <span className={`lf-die-bounce${landed && !reduced ? " lf-die-bounce--land" : ""}`}>
        <span ref={cubeRef} className="lf-cube" data-value={value ?? ""}>
          {FACES.map((f) => (
            <Face key={f.v} {...f} />
          ))}
        </span>
      </span>
    </span>
  );
}
