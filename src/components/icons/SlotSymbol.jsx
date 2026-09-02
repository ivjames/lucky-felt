/* Reel symbols. The server sends plain ids ("cherry", "bar", "seven"…) and
   this maps each one to a drawing. Symbols sit on the machine's cream reel
   strip, so they carry their own saturated colours plus a dark keyline for
   definition. Human-readable names live in src/lib/symbols.js. */

const INK = "#28362d";
const RED = "#c62b33";
const DEEP_RED = "#961a22";
const GOLD = "#e0a92a";
const DEEP_GOLD = "#a97c14";
const GREEN = "#2f8f4e";
const LEAF = "#3f9e52";
const PURPLE = "#6b3fa0";
const ORANGE = "#e07b1e";
const YELLOW = "#e9c72c";
const PINK = "#e2718a";
const CYAN = "#3aa6d0";
const SLATE = "#4a6275";

const STAR_5 =
  "M16 3 19.17 11.63 28.36 11.98 21.14 17.67 23.64 26.52 16 21.4 8.36 26.52 10.86 17.67 3.64 11.98 12.83 11.63Z";
const SPARK_4 = "M16 3c1 8 5 12 13 13-8 1-12 5-13 13-1-8-5-12-13-13 8-1 12-5 13-13Z";

const SYMBOLS = {
  cherry: (
    <>
      <path
        d="M17.5 5.5c-3.4 3.6-6.8 7.2-8.2 12M17.5 5.5c2.6 4.4 4.6 7.6 6.2 11.4"
        fill="none"
        stroke={LEAF}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M17.5 5.5c3.4-2.8 7.2-2.6 9 .2-2.8 2.2-6.4 2-9-.2Z" fill={LEAF} stroke={INK} strokeWidth="1" />
      <circle cx="9.6" cy="23" r="6" fill={RED} stroke={INK} strokeWidth="1.2" />
      <circle cx="23.2" cy="22.2" r="6" fill={DEEP_RED} stroke={INK} strokeWidth="1.2" />
      <circle cx="7.6" cy="21" r="1.5" fill="#fff" opacity="0.55" />
      <circle cx="21.2" cy="20.2" r="1.5" fill="#fff" opacity="0.45" />
    </>
  ),
  bar: (
    <>
      <rect x="2.5" y="10" width="27" height="12" rx="3" fill={INK} stroke={DEEP_GOLD} strokeWidth="1.6" />
      <text
        x="16"
        y="16.4"
        textAnchor="middle"
        dominantBaseline="central"
        fill={GOLD}
        fontSize="9.4"
        fontWeight="800"
        letterSpacing="0.6"
      >
        BAR
      </text>
    </>
  ),
  seven: (
    <path
      d="M6.5 4h19v5.2L16.4 28h-6.6l9.2-18.2H6.5V4Z"
      fill={RED}
      stroke={INK}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  ),
  diamond: (
    <>
      <path d="M16 3.5 29 13 16 28.5 3 13 16 3.5Z" fill={CYAN} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M16 3.5 21.6 13 16 28.5 10.4 13 16 3.5Z" fill="#7fd0ea" opacity="0.85" />
      <path d="M3 13h26" stroke={INK} strokeWidth="1.1" opacity="0.5" />
    </>
  ),
  star: <path d={STAR_5} fill={GOLD} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />,
  bell: (
    <>
      <path
        d="M16 4.4a2 2 0 0 1 2 2v.6a8.4 8.4 0 0 1 6.2 8.1v4.3l2 3.2H5.8l2-3.2v-4.3A8.4 8.4 0 0 1 14 7v-.6a2 2 0 0 1 2-2Z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="25.4" r="2.6" fill={DEEP_GOLD} stroke={INK} strokeWidth="1.2" />
    </>
  ),
  lemon: (
    <>
      <ellipse cx="16" cy="18" rx="11.4" ry="8.2" fill={YELLOW} stroke={INK} strokeWidth="1.3" transform="rotate(-18 16 18)" />
      <path d="M25.6 12.2c1.6-.7 2.6-.5 3.2.4-1 .8-2.2.9-3.2-.4Z" fill={LEAF} stroke={INK} strokeWidth="0.9" />
      <path d="M9.2 15.6c1.6 1.4 3.6 2.2 5.4 2.2" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
    </>
  ),
  orange: (
    <>
      <circle cx="16" cy="18.4" r="10.4" fill={ORANGE} stroke={INK} strokeWidth="1.3" />
      <path d="M16 8v20.8M6 15.6h20M6.6 22.6h18.8" stroke={INK} strokeWidth="0.9" opacity="0.35" />
      <path d="M16 8.2c-.6-3-2.4-4.6-5-5 .4 2.8 2 4.6 5 5Z" fill={LEAF} stroke={INK} strokeWidth="0.9" />
    </>
  ),
  grape: (
    <>
      <path d="M16 3.4v5" stroke={LEAF} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4.2c2.6-2 5.4-1.8 6.8.2-2.2 1.6-4.8 1.4-6.8-.2Z" fill={LEAF} stroke={INK} strokeWidth="0.9" />
      <g fill={PURPLE} stroke={INK} strokeWidth="1.1">
        <circle cx="16" cy="12.4" r="4" />
        <circle cx="10.4" cy="17" r="4" />
        <circle cx="21.6" cy="17" r="4" />
        <circle cx="16" cy="19.8" r="4" />
        <circle cx="12.6" cy="24.6" r="4" />
        <circle cx="19.4" cy="24.6" r="4" />
      </g>
      <circle cx="14.6" cy="11" r="1.2" fill="#fff" opacity="0.4" />
    </>
  ),
  melon: (
    <>
      <path d="M1.8 12.4h28.4A14.2 14.2 0 0 1 1.8 12.4Z" fill="#d8323c" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M0.6 8.4h30.8v4.4H0.6Z" fill={GREEN} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      <g fill={INK}>
        <ellipse cx="10.6" cy="17.4" rx="1.3" ry="1.9" />
        <ellipse cx="16" cy="20.6" rx="1.3" ry="1.9" />
        <ellipse cx="21.4" cy="17.4" rx="1.3" ry="1.9" />
      </g>
    </>
  ),
  strawberry: (
    <>
      <path
        d="M16 28.6c-5.6-2.4-9.4-6.8-9.4-11.6 0-3.6 4-6.2 9.4-6.2s9.4 2.6 9.4 6.2c0 4.8-3.8 9.2-9.4 11.6Z"
        fill={RED}
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M16 4.6v5.4M9.2 8.2c1.6 1.6 3.8 2.6 6.8 2.6s5.2-1 6.8-2.6c-1.8-.8-4-1.2-6.8-1.2s-5 .4-6.8 1.2Z"
        fill={LEAF}
        stroke={INK}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <g fill={YELLOW}>
        <circle cx="12.4" cy="16.6" r="1" />
        <circle cx="19.6" cy="16.6" r="1" />
        <circle cx="16" cy="20.4" r="1" />
        <circle cx="12.8" cy="22.4" r="1" />
        <circle cx="19.2" cy="22.4" r="1" />
      </g>
    </>
  ),
  peach: (
    <>
      <circle cx="11.6" cy="18.8" r="8.6" fill={PINK} stroke={INK} strokeWidth="1.2" />
      <circle cx="20.4" cy="18.8" r="8.6" fill="#f2a06a" stroke={INK} strokeWidth="1.2" />
      <path d="M16 10.6v16.6" stroke={INK} strokeWidth="1.1" opacity="0.5" />
      <path d="M16 10.4c1.4-3.2 3.8-4.8 6.6-4.8-.6 3.2-3 5-6.6 4.8Z" fill={LEAF} stroke={INK} strokeWidth="1" />
    </>
  ),
  northstar: <path d={SPARK_4} fill={GOLD} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />,
  comet: (
    <>
      <path d="M4 26.4 15.4 15l2.6 2.6L6.6 29 4 26.4Z" fill={ORANGE} stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.6 24.4 13 20M11.4 27.2l4.4-4.4" stroke="#fff" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <g transform="translate(20 12) scale(0.44) translate(-16 -16)">
        <path d={SPARK_4} fill={GOLD} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      </g>
      <g transform="translate(26.4 5.4) scale(0.26) translate(-16 -16)">
        <path d={SPARK_4} fill={GOLD} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      </g>
    </>
  ),
  sparkle: (
    <>
      <g transform="translate(12 13) scale(0.62) translate(-16 -16)">
        <path d={SPARK_4} fill={GOLD} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
      </g>
      <g transform="translate(23.4 8.6) scale(0.32) translate(-16 -16)">
        <path d={SPARK_4} fill={GOLD} stroke={INK} strokeWidth="3.6" strokeLinejoin="round" />
      </g>
      <g transform="translate(22.6 23.4) scale(0.42) translate(-16 -16)">
        <path d={SPARK_4} fill={DEEP_GOLD} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      </g>
    </>
  ),
  moon: (
    <>
      <path
        d="M20.6 3.6a12.6 12.6 0 1 0 6.6 20.6A13.4 13.4 0 0 1 20.6 3.6Z"
        fill={GOLD}
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="12.4" cy="13.4" r="1.8" fill={DEEP_GOLD} opacity="0.7" />
      <circle cx="10.6" cy="21" r="1.2" fill={DEEP_GOLD} opacity="0.55" />
    </>
  ),
  sun: (
    <>
      <g stroke={GOLD} strokeWidth="2.4" strokeLinecap="round">
        <path d="M16 1.8v4.4M16 25.8v4.4M1.8 16h4.4M25.8 16h4.4M5.9 5.9l3.1 3.1M23 23l3.1 3.1M26.1 5.9 23 9M9 23l-3.1 3.1" />
      </g>
      <circle cx="16" cy="16" r="8.2" fill={YELLOW} stroke={INK} strokeWidth="1.3" />
      <circle cx="13.2" cy="13.2" r="2.2" fill="#fff" opacity="0.45" />
    </>
  ),
  planet: (
    <>
      <circle cx="16" cy="15" r="8.6" fill={SLATE} stroke={INK} strokeWidth="1.3" />
      <circle cx="12.8" cy="12" r="2" fill="#7d94a6" opacity="0.8" />
      <circle cx="18.6" cy="17.6" r="2.8" fill="#7d94a6" opacity="0.6" />
      <ellipse
        cx="16"
        cy="17.4"
        rx="14"
        ry="4.4"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.2"
        transform="rotate(-18 16 17.4)"
      />
    </>
  ),
  rocket: (
    <>
      <path
        d="M16 2.4c4 3.4 6.2 8.2 6.2 13.6v5.4h-12.4V16c0-5.4 2.2-10.2 6.2-13.6Z"
        fill="#e8e2d2"
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9.8 15.4 5.4 21v4.6l4.4-3.2V15.4Z" fill={RED} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M22.2 15.4 26.6 21v4.6l-4.4-3.2V15.4Z" fill={RED} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="16" cy="12.4" r="3.1" fill={CYAN} stroke={INK} strokeWidth="1.2" />
      <path d="M12.8 21.4h6.4L16 29.6l-3.2-8.2Z" fill={ORANGE} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
    </>
  ),
};

/** One reel symbol. Decorative — every place it renders also carries the
 *  symbol's name in text or in an aria-label on the surrounding element. */
export default function SlotSymbol({ id, className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {SYMBOLS[id] ?? SYMBOLS.star}
    </svg>
  );
}
