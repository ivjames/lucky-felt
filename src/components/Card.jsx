import "./Card.css";

const RED_SUITS = ["♥", "♦"];

function isRedSuit(suit) {
  return RED_SUITS.includes(suit);
}

export default function Card({ card, hidden = false, small = false }) {
  const sizeClass = small ? " lf-card--small" : "";

  if (hidden) {
    return (
      <div role="img" aria-label="Hidden card" className={`lf-card lf-card--hidden${sizeClass}`}>
        <span className="lf-card__back">🂠</span>
      </div>
    );
  }

  const suitClass = isRedSuit(card.s) ? "lf-card--red" : "lf-card--black";
  return (
    <div role="img" aria-label={`${card.r} of ${card.s}`} className={`lf-card lf-card--face ${suitClass}${sizeClass}`}>
      <span className="lf-card__rank">{card.r}</span>
      <span className="lf-card__suit">{card.s}</span>
      <span className="lf-card__rank lf-card__rank--inverted">{card.r}</span>
    </div>
  );
}
