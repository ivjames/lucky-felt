import { LoseIcon, PushIcon, WinIcon } from "./icons/UiIcons";
import "./ResultBanner.css";

const ICONS = { win: WinIcon, push: PushIcon, lose: LoseIcon };

// Most games settle in whole dollars, but blackjack's 3:2 pays a half on an
// odd bet. Show the cents only when there are some, so "+$10" doesn't become
// "+$10.00" everywhere else.
function money(n) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default function ResultBanner({ result }) {
  if (!result) return null;

  // Tone follows what actually happened to the balance, so a green banner
  // never sits next to a negative number.
  const tone = result.delta > 0 ? "win" : result.delta === 0 ? "push" : "lose";
  const Icon = ICONS[tone];
  const netStr = result.delta > 0 ? `+${money(result.delta)}` : result.delta < 0 ? `-${money(Math.abs(result.delta))}` : "";

  return (
    <div role="status" aria-live="polite" className={`lf-result lf-result--${tone}`}>
      <div className="lf-result__headline">
        <Icon className="lf-result__icon" />
        <span>{result.label}</span>
        {netStr && <span className="lf-result__net">{netStr}</span>}
      </div>
      {result.detail && <div className="lf-result__detail">{result.detail}</div>}
    </div>
  );
}
