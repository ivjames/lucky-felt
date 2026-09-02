import { useCountUp } from "../lib/useCountUp";
import { AtmIcon, BackIcon } from "./icons/UiIcons";
import "./GameHeader.css";

export default function GameHeader({ title, balance, onBack, onAtm }) {
  // Always show the shortcut when the game offers one — the modal itself
  // enforces the cooldown, so gating it here on balance just hid the button
  // exactly when a mid-cooldown player still wanted to check it.
  const canAtm = !!onAtm;
  // The visible number rolls to the new balance; the label carries the real
  // one, so what a screen reader hears is never a frame of an animation.
  const rolling = useCountUp(typeof balance === "number" ? balance : 0);
  const shown = typeof balance === "number" ? rolling.toFixed(2) : balance;
  const exact = typeof balance === "number" ? balance.toFixed(2) : balance;
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
          <div className="lf-gameheader__balance" aria-label={`Balance: $${exact}`}>
            <span aria-hidden="true">${shown}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
