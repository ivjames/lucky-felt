import "./ResultBanner.css";

export default function ResultBanner({ result }) {
  if (!result) return null;

  const win = result.won === true || (!result.won && result.delta > 0);
  const push = result.delta === 0 && !result.won;
  const tone = win ? "win" : push ? "push" : "lose";
  const icon = win ? "✓" : push ? "—" : "✗";
  const netStr = result.delta > 0 ? ` +$${result.delta}` : result.delta < 0 ? ` -$${Math.abs(result.delta)}` : "";

  return (
    <div role="status" aria-live="polite" className={`lf-result lf-result--${tone}`}>
      <div className="lf-result__headline">
        {icon} {result.label}
        {netStr}
      </div>
      {result.detail && <div className="lf-result__detail">{result.detail}</div>}
    </div>
  );
}
