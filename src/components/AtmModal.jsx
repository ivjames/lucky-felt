import { useEffect, useRef } from "react";
import { ATM_AMOUNT } from "../lib/constants";
import ErrorNotice from "./ErrorNotice";
import { AtmIcon } from "./icons/UiIcons";
import "./AtmModal.css";

const FOCUSABLE = 'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function AtmModal({ user, onClose, onConfirm, busy, error }) {
  const panelRef = useRef(null);

  // Escape closes the dialog; Tab/Shift+Tab stay trapped inside it while open.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Restore focus to whatever had it before the modal opened, once it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="atm-title" className="lf-modal">
      <div className="lf-panel lf-atm" ref={panelRef}>
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
