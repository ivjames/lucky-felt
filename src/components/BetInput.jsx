import { BET_CHIPS, CHIP_COLORS } from "../lib/constants";
import "./BetInput.css";

export default function BetInput({ balance, bet, setBet, disabled }) {
  return (
    <div className="lf-betinput" role="group" aria-label="Bet amount controls">
      <div className="lf-betinput__chips">
        {BET_CHIPS.map((v, i) => (
          <button
            key={v}
            className="lf-chip"
            style={{ background: CHIP_COLORS[i] }}
            disabled={disabled || v > balance}
            aria-label={`Add $${v} to bet`}
            onClick={() => setBet((b) => Math.min(b + v, balance))}
          >
            {v}
          </button>
        ))}
        <button
          className="lf-btn lf-btn--ghost lf-btn--tiny"
          disabled={disabled}
          onClick={() => setBet(0)}
          aria-label="Clear bet"
        >
          CLR
        </button>
        <button
          className="lf-btn lf-btn--ghost lf-btn--tiny"
          disabled={disabled}
          onClick={() => setBet((b) => Math.min(b * 2, balance))}
          aria-label="Double bet"
        >
          2×
        </button>
      </div>
      <div className="lf-betinput__total" aria-live="polite">
        Bet: <span className="lf-betinput__amount">${bet}</span>
      </div>
    </div>
  );
}
