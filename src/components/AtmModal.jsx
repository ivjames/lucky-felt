import { ATM_AMOUNT } from "../lib/constants";
import ErrorNotice from "./ErrorNotice";
import { AtmIcon } from "./icons/UiIcons";
import "./AtmModal.css";

export default function AtmModal({ user, onClose, onConfirm, busy, error }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="atm-title" className="lf-modal">
      <div className="lf-panel lf-atm">
        <AtmIcon className="lf-atm__icon" />
        <h2 id="atm-title" className="lf-atm__title">
          ATM
        </h2>
        <p className="lf-atm__pitch">Top up with ${ATM_AMOUNT} and get back in the game.</p>
        <dl className="lf-atm__ledger">
          <div className="lf-atm__row">
            <dt>Balance now</dt>
            <dd>${user.balance.toFixed(2)}</dd>
          </div>
          <div className="lf-atm__row lf-atm__row--after">
            <dt>After top-up</dt>
            <dd>${(user.balance + ATM_AMOUNT).toFixed(2)}</dd>
          </div>
        </dl>
        <div className="lf-atm__actions">
          <button className="lf-btn lf-btn--gold" onClick={onConfirm} autoFocus disabled={busy}>
            {busy ? "Working…" : `Take $${ATM_AMOUNT}`}
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
