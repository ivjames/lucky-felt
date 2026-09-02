/* The four card suits, drawn as SVG so a card face never depends on a font's
   dingbat coverage. Each suit is a filled silhouette in `currentColor`; the
   card sets the colour. */

const PATHS = {
  spades: (
    <>
      <circle cx="7.7" cy="13.2" r="4.7" />
      <circle cx="16.3" cy="13.2" r="4.7" />
      <path d="M12 2.6 5.4 10.6h13.2L12 2.6Z" />
      <path d="M12 12.4c.5 3.9 1.4 6.7 3.1 8.8H8.9c1.7-2.1 2.6-4.9 3.1-8.8Z" />
    </>
  ),
  hearts: (
    <>
      <circle cx="7.9" cy="8.9" r="4.7" />
      <circle cx="16.1" cy="8.9" r="4.7" />
      <path d="M3.4 10.8 12 21.8l8.6-11H3.4Z" />
    </>
  ),
  diamonds: <path d="M12 2.2 20.5 12 12 21.8 3.5 12 12 2.2Z" />,
  clubs: (
    <>
      <circle cx="12" cy="7.3" r="4.1" />
      <circle cx="7.3" cy="13.7" r="4.1" />
      <circle cx="16.7" cy="13.7" r="4.1" />
      <path d="M12 11.8c.5 3.9 1.4 6.9 3.1 9.4H8.9c1.7-2.5 2.6-5.5 3.1-9.4Z" />
    </>
  ),
};

export default function Suit({ suit, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {PATHS[suit] ?? PATHS.spades}
    </svg>
  );
}
