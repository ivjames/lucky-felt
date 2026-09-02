import { WHEEL_ORDER, pocketColor } from "../lib/roulette";
import "./RouletteWheel.css";

const CX = 100;
const CY = 100;
const R_OUT = 90;
const R_IN = 56;
const STEP = 360 / WHEEL_ORDER.length;

const rad = (deg) => ((deg - 90) * Math.PI) / 180;
const pt = (deg, r) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];

// Pocket wedges are computed once: 37 identical slices, drawn in physical
// wheel order rather than numeric order.
const POCKETS = WHEEL_ORDER.map((n, i) => {
  const a0 = i * STEP - STEP / 2;
  const a1 = a0 + STEP;
  const [x0o, y0o] = pt(a0, R_OUT);
  const [x1o, y1o] = pt(a1, R_OUT);
  const [x1i, y1i] = pt(a1, R_IN);
  const [x0i, y0i] = pt(a0, R_IN);
  return {
    n,
    mid: i * STEP,
    d: `M${x0o.toFixed(2)} ${y0o.toFixed(2)}A${R_OUT} ${R_OUT} 0 0 1 ${x1o.toFixed(2)} ${y1o.toFixed(
      2
    )}L${x1i.toFixed(2)} ${y1i.toFixed(2)}A${R_IN} ${R_IN} 0 0 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)}Z`,
  };
});

const FILL = {
  red: "var(--lf-pocket-red)",
  black: "var(--lf-pocket-black)",
  green: "var(--lf-pocket-green)",
};

/**
 * A European single-zero wheel: 37 pockets in true physical order and the
 * correct red/black/green colouring. `rotation` is applied as a CSS transform
 * so the settle is a transition; while `spinning` the rim turns on a keyframe.
 * Decorative — the caller announces the landed number in text.
 */
export default function RouletteWheel({ rotation = 0, spinning = false, landed = null, redNums = [] }) {
  return (
    <svg className="lf-wheel" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx={CX} cy={CY} r="97" fill="var(--lf-gold-deep)" />
      <circle cx={CX} cy={CY} r="93" fill="var(--lf-surface-4)" stroke="var(--lf-gold)" strokeWidth="1.6" />
      <g
        className={`lf-wheel__rim${spinning ? " lf-wheel__rim--spinning" : ""}`}
        style={spinning ? undefined : { transform: `rotate(${rotation}deg)` }}
      >
        {POCKETS.map((p, i) => (
          <g key={i}>
            <path d={p.d} fill={FILL[pocketColor(p.n, redNums)]} stroke="var(--lf-gold-deep)" strokeWidth="0.5" />
            <g transform={`rotate(${p.mid} ${CX} ${CY})`}>
              <text
                x={CX}
                y={CY - 68}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize="10"
                fontWeight="700"
              >
                {p.n}
              </text>
            </g>
          </g>
        ))}
        <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="var(--lf-gold)" strokeWidth="1.4" />
      </g>
      <circle cx={CX} cy={CY} r={R_IN - 2} fill="var(--lf-surface-2)" stroke="var(--lf-gold-deep)" strokeWidth="1.2" />
      <g stroke="var(--lf-gold-deep)" strokeWidth="2.4" opacity="0.6">
        <path d={`M${CX - 40} ${CY} h80M${CX} ${CY - 40} v80`} />
      </g>
      <circle cx={CX} cy={CY} r="30" fill="var(--lf-surface-1)" stroke="var(--lf-gold)" strokeWidth="1.6" />
      {landed !== null && (
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--lf-gold)"
          fontSize="30"
          fontWeight="800"
        >
          {landed}
        </text>
      )}
      {/* Ball pointer, fixed at the top of the track. */}
      <path d={`M${CX} 15 l7 -12 h-14Z`} fill="var(--lf-gold)" />
      <circle cx={CX} cy="20" r="4.2" fill="var(--lf-paper)" stroke="var(--lf-ink)" strokeWidth="0.8" />
    </svg>
  );
}
