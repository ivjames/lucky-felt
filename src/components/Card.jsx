import { useId } from "react";
import Suit from "./icons/Suit";
import { cardLabel, isRedSuit } from "../lib/cards";
import "./Card.css";

/**
 * A playing card. Face-up cards are cream paper with corner indices and a
 * centre pip in the suit colour; face-down cards show the house back pattern.
 *
 * Both faces are always in the DOM, back-to-back on a flipper, so turning a
 * card over is a real Y-axis rotation rather than a swap: a dealer hole card
 * keeps its element from the deal through to the showdown and simply turns.
 *
 * `dealIndex` throws the card in from the deck with that card's place in the
 * stagger; `flipIn` turns it face-up as it arrives (the board). Both are mount
 * animations — a card already on the table never re-deals itself — and both
 * are presentation only: the rank and suit come from the server.
 */
export default function Card({ card, hidden = false, small = false, dealIndex = null, flipIn = false }) {
  const sizeClass = small ? " lf-card--small" : "";
  // Each back needs its own pattern id — several of them render at once.
  const patternId = `lf-back-${useId().replace(/:/g, "")}`;
  const face = card && card.s ? card : null;
  const toneClass = face ? (isRedSuit(face.s) ? " lf-card--red" : " lf-card--black") : "";
  const dealt = dealIndex !== null ? " lf-card--deal" : "";

  return (
    <div
      role="img"
      aria-label={hidden || !face ? "Face-down card" : cardLabel(face)}
      className={`lf-card${hidden ? " lf-card--back" : " lf-card--face"}${toneClass}${sizeClass}${dealt}`}
      style={dealIndex !== null ? { "--lf-deal-i": dealIndex } : undefined}
    >
      <div
        className={`lf-card__flipper${hidden ? " lf-card__flipper--down" : ""}${
          flipIn ? " lf-card__flipper--in" : ""
        }`}
      >
        <div className="lf-card__side lf-card__side--front">
          {face && (
            <>
              <span className="lf-card__index lf-card__index--tl">
                <span className="lf-card__rank">{face.r}</span>
                <Suit suit={face.s} className="lf-card__mini" />
              </span>
              <Suit suit={face.s} className="lf-card__pip" />
              <span className="lf-card__index lf-card__index--br">
                <span className="lf-card__rank">{face.r}</span>
                <Suit suit={face.s} className="lf-card__mini" />
              </span>
            </>
          )}
        </div>
        <div className="lf-card__side lf-card__side--back">
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
      </div>
    </div>
  );
}
