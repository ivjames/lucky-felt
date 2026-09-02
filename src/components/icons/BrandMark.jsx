/* Lucky Felt's mark: a gold poker chip with a spade at its centre. It is the
   only logo in the app and `public/favicon.svg` is the same drawing with its
   colours hard-coded. */

export default function BrandMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22" fill="currentColor" />
      <g fill="var(--lf-surface-0, #081710)">
        <rect x="20.5" y="0.6" width="7" height="9" rx="1.4" />
        <rect x="20.5" y="38.4" width="7" height="9" rx="1.4" />
        <rect x="0.6" y="20.5" width="9" height="7" rx="1.4" />
        <rect x="38.4" y="20.5" width="9" height="7" rx="1.4" />
        <rect x="5.6" y="5.6" width="7" height="9" rx="1.4" transform="rotate(-45 9.1 10.1)" />
        <rect x="35.4" y="33.4" width="7" height="9" rx="1.4" transform="rotate(-45 38.9 37.9)" />
        <rect x="33.4" y="5.6" width="7" height="9" rx="1.4" transform="rotate(45 36.9 10.1)" />
        <rect x="5.6" y="33.4" width="7" height="9" rx="1.4" transform="rotate(45 9.1 37.9)" />
      </g>
      <circle cx="24" cy="24" r="16.4" fill="var(--lf-surface-1, #0e2517)" />
      <circle cx="24" cy="24" r="16.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <g fill="currentColor" transform="translate(12 12) scale(1)">
        <circle cx="7.7" cy="13.2" r="4.7" />
        <circle cx="16.3" cy="13.2" r="4.7" />
        <path d="M12 2.6 5.4 10.6h13.2L12 2.6Z" />
        <path d="M12 12.4c.5 3.9 1.4 6.7 3.1 8.8H8.9c1.7-2.1 2.6-4.9 3.1-8.8Z" />
      </g>
    </svg>
  );
}
