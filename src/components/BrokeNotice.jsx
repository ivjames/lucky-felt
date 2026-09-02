import "./BrokeNotice.css";

export default function BrokeNotice({ onAtm }) {
  return (
    <div className="lf-broke">
      <div className="lf-broke__title">⚠ Running on empty</div>
      <div className="lf-broke__text">Your balance is too low to bet. Hit the ATM for a top-up.</div>
      <button className="lf-btn lf-btn--gold lf-broke__action" onClick={onAtm}>
        🏧 Get $500 from ATM
      </button>
    </div>
  );
}
