import { useState } from "react";
import * as api from "../api";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import { CHIP_COLORS, DICE_SYMBOLS } from "../lib/constants";
import { sleep } from "../lib/sleep";
import "./SicBoGame.css";

const SICBO_CHIPS = [1, 5, 10, 25];

export default function SicBoGame({ user, onUpdate, onBack, onAtm, onError, config }) {
  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState({});
  const [chipVal, setChipVal] = useState(5);
  const [dice, setDice] = useState([null, null, null]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const broke = balance < 1;

  async function roll() {
    if (totalBet <= 0 || rolling || totalBet > balance) return;
    setRolling(true);
    setResult(null);
    setErr(null);
    try {
      const [r] = await Promise.all([api.betSicbo(bets), sleep(750)]);
      setDice(r.dice);
      setBalance(r.balance);
      setResult({
        label: r.delta > 0 ? "You win!" : "No match — try again",
        won: r.delta > 0,
        delta: r.delta,
        detail: `Dice: ${r.dice.join(" ")} = ${r.sum}${r.wins.length ? " · " + r.wins.join(", ") : ""}`,
      });
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
      if (e.status === 401) {
        onError(e);
        return;
      }
      setErr(e.message);
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="lf-app lf-app--game">
      <GameHeader title="Sic Bo" balance={balance} onBack={onBack} onAtm={onAtm} />
      <div className="lf-panel">
        <div
          className="lf-sicbo__dice"
          role="status"
          aria-label={rolling ? "Dice rolling" : `Dice: ${dice.filter(Boolean).join(", ")}`}
        >
          {dice.map((d, i) => (
            <div key={i} className="lf-sicbo__die" aria-hidden="true">
              {rolling ? "🎲" : d ? DICE_SYMBOLS[d] : "🎲"}
            </div>
          ))}
        </div>

        <div className="lf-section-title">Chip value: ${chipVal}</div>
        <div className="lf-sicbo__chips">
          {SICBO_CHIPS.map((v, i) => (
            <button
              key={v}
              className={`lf-chip${chipVal === v ? " lf-chip--active" : ""}`}
              style={{ background: CHIP_COLORS[i] }}
              onClick={() => setChipVal(v)}
              aria-pressed={chipVal === v}
            >
              {v}
            </button>
          ))}
        </div>

        {broke ? (
          <BrokeNotice onAtm={onAtm} />
        ) : (
          <>
            <div className="lf-sicbo__board">
              {config.sicbo.map((b) => (
                <button
                  key={b.id}
                  className={`lf-sicbo__bet${bets[b.id] ? " lf-sicbo__bet--active" : ""}`}
                  aria-pressed={!!bets[b.id]}
                  onClick={() => {
                    if (!rolling && balance - totalBet >= chipVal) {
                      setBets((p) => ({ ...p, [b.id]: (p[b.id] || 0) + chipVal }));
                    }
                  }}
                >
                  {b.label}
                  <span className="lf-sicbo__payout">
                    {b.payout}:1{bets[b.id] > 0 && " · $" + bets[b.id]}
                  </span>
                </button>
              ))}
            </div>
            <div className="lf-sicbo__total" aria-live="polite">
              Total bet: ${totalBet}
            </div>
            <div className="lf-sicbo__actions">
              <button
                className="lf-btn lf-btn--gold"
                onClick={roll}
                disabled={rolling || totalBet <= 0 || totalBet > balance}
              >
                {rolling ? "Rolling…" : "Roll the dice"}
              </button>
              <button className="lf-btn lf-btn--ghost" onClick={() => setBets({})} disabled={rolling}>
                Clear bets
              </button>
            </div>
          </>
        )}

        <ResultBanner result={result} />
        <ErrorNotice error={err} />
      </div>
    </div>
  );
}
