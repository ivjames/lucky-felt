import { ATM_AMOUNT } from "../lib/constants";
import ErrorNotice from "./ErrorNotice";
import "./AtmModal.css";

export default function AtmModal({ user, onClose, onConfirm, busy, error }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="atm-title" className="lf-modal">
      <div className="lf-panel lf-atm">
        <div className="lf-atm__icon" aria-hidden="true">
          🏧
        </div>
        <div id="atm-title" className="lf-atm__title">
          Emergency ATM
        </div>
        <div className="lf-atm__pitch">
          Running low? No judgment — grab ${ATM_AMOUNT} and get back in the game.
        </div>
        <div className="lf-atm__balance">
          Your balance: <b>${user.balance.toFixed(2)}</b> → <b>${(user.balance + ATM_AMOUNT).toFixed(2)}</b>
        </div>
        <div className="lf-atm__actions">
          <button className="lf-btn lf-btn--gold" onClick={onConfirm} autoFocus disabled={busy}>
            {busy ? "…" : `Take $${ATM_AMOUNT}`}
          </button>
          <button className="lf-btn lf-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
        <ErrorNotice error={error} />
      </div>
    </div>
  );
}
