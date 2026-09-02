import { AtmIcon, BackIcon } from "./icons/UiIcons";
import "./GameHeader.css";

export default function GameHeader({ title, balance, onBack, onAtm }) {
  const canAtm = onAtm && balance < 5;
  const shown = typeof balance === "number" ? balance.toFixed(2) : balance;
  return (
    <header className="lf-topbar">
      <div className="lf-shell lf-topbar__inner lf-gameheader">
        <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onBack} aria-label="Return to lobby">
          <BackIcon className="lf-btn__icon" />
          Lobby
        </button>
        <h1 className="lf-gameheader__title">{title}</h1>
        <div className="lf-gameheader__aside">
          {canAtm && (
            <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onAtm}>
              <AtmIcon className="lf-btn__icon" />
              ATM
            </button>
          )}
          <div className="lf-gameheader__balance" aria-label={`Balance: $${shown}`}>
            <span aria-hidden="true">${shown}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
