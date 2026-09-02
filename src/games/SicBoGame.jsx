import { useState } from "react";
import * as api from "../api";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import Die from "../components/Die";
import { CHIP_COLORS } from "../lib/constants";
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
      // A net-zero roll here only happens when at least one bet actually won
      // (Sic Bo has no bet that itself pushes) — a winning bet offset a
      // losing one. That's a break-even round, not a push.
      setResult({
        label: r.delta > 0 ? "You win!" : r.delta === 0 ? (r.wins.length > 0 ? "Break even" : "Bets returned") : "No win this roll",
        won: r.delta > 0,
        delta: r.delta,
        detail: `Dice ${r.dice.join(", ")} · total ${r.sum}${r.wins.length ? " · hits: " + r.wins.join(", ") : ""}`,
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

  const rolled = dice[0] != null && !rolling;
  const sum = rolled ? dice.reduce((a, b) => a + b, 0) : null;

  return (
    <div className="lf-app">
      <GameHeader title="Sic Bo" balance={balance} onBack={onBack} onAtm={onAtm} />
      <main className="lf-shell lf-game lf-game--split">
        <section className="lf-panel lf-game__stage">
          <div
            className="lf-dice-tray"
            role="status"
            aria-label={rolling ? "Dice rolling" : rolled ? `Dice ${dice.join(", ")}, total ${sum}` : "No roll yet"}
          >
            {dice.map((d, i) => (
              <Die key={i} value={d} rolling={rolling} size={66} />
            ))}
          </div>
          <div className="lf-sicbo__total-readout" aria-live="polite">
            <span className="lf-sicbo__total-label">Total</span>
            <span className="lf-sicbo__total-value">{sum ?? "—"}</span>
          </div>

          <h2 className="lf-section-title lf-sicbo__chips-title">Chip value</h2>
          <div className="lf-sicbo__chips">
            {SICBO_CHIPS.map((v, i) => (
              <button
                key={v}
                className={`lf-chip${chipVal === v ? " lf-chip--active" : ""}`}
                style={{ background: CHIP_COLORS[i] }}
                onClick={() => setChipVal(v)}
                aria-pressed={chipVal === v}
                aria-label={`Chip value $${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </section>

        <section className="lf-panel">
          {broke ? (
            <BrokeNotice onAtm={onAtm} />
          ) : (
            <>
              <h2 className="lf-section-title">Place your bets</h2>
              <div className="lf-sicbo__board">
                {config.sicbo.map((b) => (
                  <button
                    key={b.id}
                    className={`lf-bettile${bets[b.id] ? " lf-bettile--active" : ""}`}
                    aria-pressed={!!bets[b.id]}
                    onClick={() => {
                      if (!rolling && balance - totalBet >= chipVal) {
                        setBets((p) => ({ ...p, [b.id]: (p[b.id] || 0) + chipVal }));
                      }
                    }}
                  >
                    <span className="lf-bettile__label">{b.label}</span>
                    <span className="lf-bettile__meta">
                      {bets[b.id] > 0 ? (
                        <span className="lf-bettile__stake">${bets[b.id]} on {b.payout}:1</span>
                      ) : (
                        `pays ${b.payout}:1`
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div className="lf-total" aria-live="polite">
                Total bet ${totalBet}
              </div>
              <div className="lf-actions">
                <button
                  className="lf-btn lf-btn--gold lf-btn--wide"
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
        </section>
      </main>
    </div>
  );
}
