import { LoseIcon, PushIcon, WinIcon } from "./icons/UiIcons";
import "./ResultBanner.css";

const ICONS = { win: WinIcon, push: PushIcon, lose: LoseIcon };

export default function ResultBanner({ result }) {
  if (!result) return null;

  // Tone follows what actually happened to the balance, so a green banner
  // never sits next to a negative number.
  const tone = result.delta > 0 ? "win" : result.delta === 0 ? "push" : "lose";
  const Icon = ICONS[tone];
  const netStr = result.delta > 0 ? `+$${result.delta}` : result.delta < 0 ? `-$${Math.abs(result.delta)}` : "";

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
