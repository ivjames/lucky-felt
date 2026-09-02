import { useId } from "react";
import Suit from "./icons/Suit";
import { cardLabel, isRedSuit } from "../lib/cards";
import "./Card.css";

/**
 * A playing card. Face-up cards are cream paper with corner indices and a
 * centre pip in the suit colour; face-down cards show the house back pattern.
 */
export default function Card({ card, hidden = false, small = false }) {
  const sizeClass = small ? " lf-card--small" : "";
  // Each back needs its own pattern id — several of them render at once.
  const patternId = `lf-back-${useId().replace(/:/g, "")}`;

  if (hidden) {
    return (
      <div role="img" aria-label="Face-down card" className={`lf-card lf-card--back${sizeClass}`}>
        <svg className="lf-card__pattern" viewBox="0 0 40 56" aria-hidden="true" focusable="false">
          <defs>
            <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="var(--lf-pocket-green)" />
              <path d="M0 8 8 0M-2 2 2 -2M6 10 10 6" stroke="var(--lf-gold)" strokeWidth="1.1" opacity="0.55" />
            </pattern>
          </defs>
          <rect x="2" y="2" width="36" height="52" rx="4" fill={`url(#${patternId})`} />
          <rect
            x="4.6"
            y="4.6"
            width="30.8"
            height="46.8"
            rx="2.6"
            fill="none"
            stroke="var(--lf-gold)"
            strokeWidth="1.2"
            opacity="0.85"
          />
        </svg>
      </div>
    );
  }

  const toneClass = isRedSuit(card.s) ? " lf-card--red" : " lf-card--black";
  return (
    <div role="img" aria-label={cardLabel(card)} className={`lf-card lf-card--face${toneClass}${sizeClass}`}>
      <span className="lf-card__index lf-card__index--tl">
        <span className="lf-card__rank">{card.r}</span>
        <Suit suit={card.s} className="lf-card__mini" />
      </span>
      <Suit suit={card.s} className="lf-card__pip" />
      <span className="lf-card__index lf-card__index--br">
        <span className="lf-card__rank">{card.r}</span>
        <Suit suit={card.s} className="lf-card__mini" />
      </span>
    </div>
  );
}
