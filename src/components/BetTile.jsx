// One bet on a roulette or sic bo board.
//
// Tapping the tile places the current chip (and stacks another on a placed
// bet). A placed bet also shows two small controls: + adds another chip; the
// second is − while more than one chip's worth is down (takes one chip off)
// and × once a single tap would clear it. Placed state is announced through
// aria-pressed on the main control; the tools carry explicit labels.
export default function BetTile({ name, label, payoutText, stake, chipVal, disabled, canAdd, onAdd, onSubtract }) {
  const placed = stake > 0;
  const clears = stake <= chipVal;
  return (
    <div className={`lf-bettile${placed ? " lf-bettile--active" : ""}`}>
      <button
        type="button"
        className="lf-bettile__main"
        aria-pressed={placed}
        aria-label={placed ? `${name}: $${stake} placed. Add $${chipVal}` : `Place $${chipVal} on ${name}`}
        disabled={disabled}
        onClick={onAdd}
      >
        <span className="lf-bettile__label">{label}</span>
        <span className="lf-bettile__meta">
          {placed ? (
            <span className="lf-bettile__stake">${stake} on {payoutText}</span>
          ) : (
            `pays ${payoutText}`
          )}
        </span>
      </button>
      {placed && (
        <span className="lf-bettile__tools">
          <button
            type="button"
            className="lf-bettile__tool"
            aria-label={`Add $${chipVal} to ${name}`}
            disabled={disabled || !canAdd}
            onClick={onAdd}
          >
            +
          </button>
          <button
            type="button"
            className={`lf-bettile__tool${clears ? " lf-bettile__tool--remove" : ""}`}
            aria-label={clears ? `Remove bet on ${name}` : `Remove $${chipVal} from ${name}`}
            disabled={disabled}
            onClick={onSubtract}
          >
            {clears ? "×" : "−"}
          </button>
        </span>
      )}
    </div>
  );
}
