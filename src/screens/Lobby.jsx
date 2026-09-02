import { useState } from "react";
import { ATM_AMOUNT, ATM_COOLDOWN_MS, GAMES } from "../lib/constants";
import "./Lobby.css";

export default function Lobby({ user, onGame, onAtm, onLogout }) {
  // Snapshot the clock once per mount (display-only; the server is the real
  // cooldown enforcer). Keeps render pure for the react-hooks lint rule.
  const [now] = useState(() => Date.now());
  const canAtm = now - user.lastAtm > ATM_COOLDOWN_MS;
  const cooldownMin = Math.max(0, Math.ceil((ATM_COOLDOWN_MS - (now - user.lastAtm)) / 60000));
  const broke = user.balance < 1;

  return (
    <div className="lf-app">
      <div className="lf-header">
        <div className="lf-title" role="heading" aria-level="1">
          🎰 LUCKY FELT
        </div>
        <div className="lf-subtitle">CASINO &amp; GAMING CLUB</div>
        <div className="lf-lobby__actions">
          <div className="lf-balance" aria-label={`Your balance is $${user.balance.toFixed(2)}`}>
            <span className="lf-balance__label">BALANCE</span>
            <span className="lf-balance__value">${user.balance.toFixed(2)}</span>
          </div>
          <button
            className={`lf-btn lf-btn--ghost lf-lobby__atm${canAtm ? "" : " lf-lobby__atm--cooldown"}`}
            onClick={() => canAtm && onAtm()}
            aria-label={canAtm ? `Free ATM — add $${ATM_AMOUNT}` : `ATM available in ${cooldownMin} minutes`}
          >
            {canAtm ? `🏧 Free top-up +$${ATM_AMOUNT}` : `🏧 ATM — ${cooldownMin}m cooldown`}
          </button>
          <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={onLogout}>
            Sign out
          </button>
        </div>
        <div className="lf-lobby__email">{user.email}</div>
        {broke && (
          <div className="lf-lobby__warning">
            ⚠ You're out of chips — {canAtm ? "grab a free top-up above!" : "the ATM will be free soon."}
          </div>
        )}
      </div>
      <div className="lf-lobby__body">
        <div className="lf-section-title">Choose a game</div>
        <div className="lf-lobby__grid" role="list">
          {GAMES.map((g) => (
            <div key={g.id} role="listitem">
              <button className="lf-gamecard" onClick={() => onGame(g.id)}>
                <div className="lf-gamecard__icon" aria-hidden="true">
                  {g.icon}
                </div>
                <div className="lf-gamecard__name">{g.name}</div>
                <div className="lf-gamecard__desc">{g.desc}</div>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
