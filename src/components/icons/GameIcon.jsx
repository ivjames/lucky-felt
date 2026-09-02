/* One drawing per lobby game, each visually distinct — no two games share a
   mark. 32x32, `currentColor` for the gold linework, with `--lf-paper` and the
   pocket colours for the few filled areas. */

function Frame({ className, children }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const PAPER = "var(--lf-paper, #f7f2e6)";
const INK = "var(--lf-ink, #1e2a23)";

/* Texas Hold'em — a fanned pair of cards. */
export function CardsIcon({ className }) {
  return (
    <Frame className={className}>
      <g transform="rotate(-14 12 19)">
        <rect x="3.5" y="8.5" width="13" height="18" rx="2.4" fill={PAPER} stroke="currentColor" strokeWidth="1.5" />
      </g>
      <rect x="14" y="5.5" width="14.5" height="20" rx="2.6" fill={PAPER} stroke="currentColor" strokeWidth="1.5" />
      <g fill={INK} transform="translate(15.6 9.2) scale(0.46)">
        <circle cx="7.7" cy="13.2" r="4.7" />
        <circle cx="16.3" cy="13.2" r="4.7" />
        <path d="M12 2.6 5.4 10.6h13.2L12 2.6Z" />
        <path d="M12 12.4c.5 3.9 1.4 6.7 3.1 8.8H8.9c1.7-2.1 2.6-4.9 3.1-8.8Z" />
      </g>
    </Frame>
  );
}

/* Roulette — a sectored wheel with a ball track pointer. */
export function WheelIcon({ className }) {
  return (
    <Frame className={className}>
      <circle cx="16" cy="17" r="12.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g fill="currentColor" opacity="0.85">
        <path d="M16 17 16 5.4A11.6 11.6 0 0 1 24.2 8.8Z" />
        <path d="M16 17 27.6 17A11.6 11.6 0 0 1 24.2 25.2Z" />
        <path d="M16 17 16 28.6A11.6 11.6 0 0 1 7.8 25.2Z" />
        <path d="M16 17 4.4 17A11.6 11.6 0 0 1 7.8 8.8Z" />
      </g>
      <circle cx="16" cy="17" r="4.4" fill="var(--lf-surface-2, #16341f)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 1.4 19.2 6h-6.4L16 1.4Z" fill="currentColor" />
    </Frame>
  );
}

function DieFace({ x, y, size, pips, rotate = 0 }) {
  const u = size / 4;
  const spots = {
    2: [
      [1, 1],
      [3, 3],
    ],
    3: [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    5: [
      [1, 1],
      [3, 1],
      [2, 2],
      [1, 3],
      [3, 3],
    ],
    4: [
      [1, 1],
      [3, 1],
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
  }[pips];
  return (
    <g transform={`rotate(${rotate} ${x + size / 2} ${y + size / 2})`}>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.22} fill={PAPER} stroke="currentColor" strokeWidth="1.4" />
      {spots.map(([cx, cy], i) => (
        <circle key={i} cx={x + cx * u} cy={y + cy * u} r={size * 0.085} fill={INK} />
      ))}
    </g>
  );
}

/* Craps — two dice. */
export function TwoDiceIcon({ className }) {
  return (
    <Frame className={className}>
      <DieFace x={2.5} y={9} size={14} pips={5} rotate={-10} />
      <DieFace x={16} y={13} size={13} pips={2} rotate={12} />
    </Frame>
  );
}

/* Sic Bo — three dice. */
export function ThreeDiceIcon({ className }) {
  return (
    <Frame className={className}>
      <DieFace x={1.5} y={14} size={12} pips={3} rotate={-12} />
      <DieFace x={18} y={15} size={12} pips={4} rotate={10} />
      <DieFace x={9.5} y={3} size={13} pips={6} rotate={-3} />
    </Frame>
  );
}

/* Classic slots — the cabinet, with a lever. */
export function CabinetIcon({ className }) {
  return (
    <Frame className={className}>
      <path
        d="M3.5 13.5a10.5 10.5 0 0 1 21 0V26a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V13.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="7" y="11.5" width="14" height="9" rx="1.5" fill={PAPER} />
      <path d="M11.7 11.5v9M16.3 11.5v9" stroke={INK} strokeWidth="0.9" opacity="0.35" />
      <rect x="7.5" y="23.5" width="13" height="3" rx="1.4" fill="currentColor" opacity="0.55" />
      <path d="M24.5 18.5h4.2v-6.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="28.7" cy="9.4" r="2.4" fill="currentColor" />
    </Frame>
  );
}

/* Fruit slots — a cherry pair with a leaf. */
export function FruitIcon({ className }) {
  return (
    <Frame className={className}>
      <path
        d="M16 5c-3 4.5-6.6 7.6-8.4 12M16 5c2.4 4.8 4.6 8 6.6 11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M16 5c3.6-2.6 7.4-2.2 9 .6-2.8 2-6.4 1.7-9-.6Z" fill="currentColor" opacity="0.75" />
      <circle cx="8.6" cy="22.4" r="5.4" fill="var(--lf-pocket-red, #b6202c)" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="22.3" cy="21.6" r="5.4" fill="var(--lf-pocket-red, #b6202c)" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6.8" cy="20.6" r="1.3" fill={PAPER} opacity="0.7" />
      <circle cx="20.5" cy="19.8" r="1.3" fill={PAPER} opacity="0.7" />
    </Frame>
  );
}

/* Lucky Stars — a star with two sparks. */
export function StarIcon({ className }) {
  return (
    <Frame className={className}>
      <path
        d="M14.6 3.4 17.9 11l8.2.7-6.2 5.4 1.9 8-7.2-4.3-7.2 4.3 1.9-8L3.1 11.7 11.3 11l3.3-7.6Z"
        fill="currentColor"
      />
      <path d="M26.4 20.6 27.4 23l2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4Z" fill="currentColor" opacity="0.7" />
      <path d="M25.6 3.2 26.3 5l1.8.7-1.8.7-.7 1.8-.7-1.8L23.1 5.7 24.9 5l.7-1.8Z" fill="currentColor" opacity="0.55" />
    </Frame>
  );
}

const BY_ID = {
  poker: CardsIcon,
  roulette: WheelIcon,
  craps: TwoDiceIcon,
  sicbo: ThreeDiceIcon,
  slots1: CabinetIcon,
  slots2: FruitIcon,
  slots3: StarIcon,
};

/** Dispatches to the mark for a lobby game id. Decorative — the card next to
 *  it always carries the game's name as text. */
export default function GameIcon({ id, className }) {
  const Mark = BY_ID[id] ?? CardsIcon;
  return <Mark className={className} />;
}
