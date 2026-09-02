import "./GameHeader.css";

export default function GameHeader({ title, balance, onBack, onAtm }) {
  const canAtm = onAtm && balance < 5;
  const shown = typeof balance === "number" ? balance.toFixed(2) : balance;
  return (
    <div className="lf-header lf-header--game">
      <button className="lf-btn lf-btn--ghost" onClick={onBack} aria-label="Return to lobby">
        ← Lobby
      </button>
      <div className="lf-gameheader__title">{title}</div>
      <div className="lf-gameheader__aside">
        {canAtm && (
          <button className="lf-btn lf-btn--ghost lf-btn--compact" onClick={onAtm}>
            🏧 ATM
          </button>
        )}
        <div className="lf-gameheader__balance" aria-label={`Balance: $${shown}`}>
          $<span className="lf-gameheader__balance-value">{shown}</span>
        </div>
      </div>
    </div>
  );
}
