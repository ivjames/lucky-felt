/* Small interface icons. All 24x24, all `currentColor`, all decorative — every
   one of them sits next to a real text label or an aria-label. */

function Icon({ className, children }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function BackIcon({ className }) {
  return (
    <Icon className={className}>
      <path
        d="M10.5 5 4 12l6.5 7M4.4 12H20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* A cash dispenser: screen, keypad, and a note coming out of the slot. */
export function AtmIcon({ className }) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="6" width="12" height="5" rx="1.2" fill="currentColor" opacity="0.45" />
      <rect x="6" y="14.6" width="12" height="3.4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.6 14.6v-1.9h6.8v1.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Icon>
  );
}

export function WinIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="m7.6 12.3 3 3 5.8-6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function LoseIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="m8.6 8.6 6.8 6.8m0-6.8-6.8 6.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Icon>
  );
}

export function PushIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8.2 10.3h7.6m-7.6 3.4h7.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Icon>
  );
}

export function AlertIcon({ className }) {
  return (
    <Icon className={className}>
      <path
        d="M12 3.4 22 20.6H2L12 3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 9.6v4.6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="1.2" fill="currentColor" />
    </Icon>
  );
}

/* A speaker with two arcs of sound. */
export function SoundOnIcon({ className }) {
  return (
    <Icon className={className}>
      <path
        d="M4 9.4h3.3L12 5.4v13.2l-4.7-4H4V9.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.4 9.2a4 4 0 0 1 0 5.6m2.6-8.2a7.7 7.7 0 0 1 0 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* The same speaker, arcs struck out. */
export function SoundOffIcon({ className }) {
  return (
    <Icon className={className}>
      <path
        d="M4 9.4h3.3L12 5.4v13.2l-4.7-4H4V9.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m15.6 9.8 4.8 4.4m0-4.4-4.8 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* Beamed quavers — marks the soundtrack credits, never a control on its own. */
export function MusicIcon({ className }) {
  return (
    <Icon className={className}>
      <path
        d="M9.4 17.2V5.6l9.2-1.8v11.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7.2" cy="17.4" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.4" cy="15.4" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </Icon>
  );
}
