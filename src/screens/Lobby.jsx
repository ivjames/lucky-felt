import { useEffect, useState } from "react";
import BrandMark from "../components/icons/BrandMark";
import GameIcon from "../components/icons/GameIcon";
import { AlertIcon, AtmIcon } from "../components/icons/UiIcons";
import { ATM_AMOUNT, ATM_COOLDOWN_MS, GAMES } from "../lib/constants";
import { useCountUp } from "../lib/useCountUp";
import "./Lobby.css";

export default function Lobby({ user, onGame, onAtm, onLogout }) {
  // Ticking clock (display-only; the server is the real cooldown enforcer) so
  // the cooldown label counts down live instead of going stale after mount,
  // and the button becomes genuinely enabled — not just less transparent —
  // the moment the cooldown actually ends.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Display only: the pill rolls up to a top-up rather than jumping. The
  // aria-label below stays on the authoritative figure.
  const rolling = useCountUp(user.balance);
  const canAtm = now - user.lastAtm > ATM_COOLDOWN_MS;
  const cooldownMin = Math.max(0, Math.ceil((ATM_COOLDOWN_MS - (now - user.lastAtm)) / 60000));
  const broke = user.balance < 1;

  return (
    <div className="lf-app">
      <header className="lf-lobby__header">
        <div className="lf-shell">
          <div className="lf-brand">
            <BrandMark className="lf-brand__mark" />
            <h1 className="lf-title">Lucky Felt</h1>
          </div>
          <p className="lf-subtitle">Casino &amp; gaming club</p>
          <div className="lf-lobby__actions">
            <div className="lf-balance" aria-label={`Your balance is $${user.balance.toFixed(2)}`}>
              <span className="lf-balance__label" aria-hidden="true">
                Balance
              </span>
              <span className="lf-balance__value" aria-hidden="true">
                ${rolling.toFixed(2)}
              </span>
            </div>
            <button
              className={`lf-btn lf-btn--ghost lf-lobby__atm${canAtm ? "" : " lf-lobby__atm--cooldown"}`}
              onClick={onAtm}
              disabled={!canAtm}
              aria-label={canAtm ? `Free ATM top-up, add $${ATM_AMOUNT}` : `ATM available in ${cooldownMin} minutes`}
            >
              <AtmIcon className="lf-btn__icon" />
              {canAtm ? `Free top-up +$${ATM_AMOUNT}` : `ATM — ${cooldownMin}m left`}
            </button>
            <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onLogout}>
              Sign out
            </button>
          </div>
          <p className="lf-lobby__email">{user.email}</p>
          {broke && (
            <p className="lf-lobby__warning">
              <AlertIcon className="lf-lobby__warning-icon" />
              You're out of chips — {canAtm ? "grab a free top-up above." : "the ATM will be free soon."}
            </p>
          )}
        </div>
      </header>
      <main className="lf-shell lf-lobby__body">
        <h2 className="lf-section-title">Choose a game</h2>
        <div className="lf-lobby__grid" role="list">
          {GAMES.map((g) => (
            <div key={g.id} role="listitem">
              <button className="lf-gamecard" onClick={() => onGame(g.id)}>
                <GameIcon id={g.id} className="lf-gamecard__icon" />
                <span className="lf-gamecard__name">{g.name}</span>
                <span className="lf-gamecard__desc">{g.desc}</span>
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
