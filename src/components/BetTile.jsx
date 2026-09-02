// One bet on a roulette or sic bo board.
//
// Tapping the tile places the current chip (and stacks another on a placed
// bet). A placed bet also shows two small controls: + adds another chip, ×
// takes the whole bet off. Placed state is announced through aria-pressed on
// the main control; the tools carry explicit labels.
export default function BetTile({ name, label, payoutText, stake, chipVal, disabled, canAdd, onAdd, onRemove }) {
  const placed = stake > 0;
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
            className="lf-bettile__tool lf-bettile__tool--remove"
            aria-label={`Remove bet on ${name}`}
            disabled={disabled}
            onClick={onRemove}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
