import { useState } from "react";
import * as api from "../api";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import SlotSymbol from "../components/icons/SlotSymbol";
import { paylineLabel, symbolName } from "../lib/symbols";
import { sleep } from "../lib/sleep";
import { useReducedMotion } from "../lib/useReducedMotion";
import "./SlotMachine.css";

/** The combination column of the paytable: the symbols themselves, or a
 *  neutral "any" marker for the wildcard rows. */
function PaylineCombo({ line }) {
  if (line.any) {
    return (
      <span className="lf-slots__combo">
        {Array.from({ length: line.count }, (_, i) => (
          <span key={i} className="lf-slots__any" aria-hidden="true" />
        ))}
        <span className="lf-slots__combo-text">{paylineLabel(line)}</span>
      </span>
    );
  }
  return (
    <span className="lf-slots__combo">
      {Array.from({ length: line.count }, (_, i) => (
        <SlotSymbol key={i} id={line.symbol} className="lf-slots__combo-symbol" />
      ))}
      <span className="lf-slots__combo-text">{paylineLabel(line)}</span>
    </span>
  );
}

export default function SlotMachine({ user, onUpdate, onBack, onAtm, onError, gameId, config }) {
  const { name, symbols, reelCount, paylines } = config;
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(user.balance);
  const [bet, setBet] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState(Array.from({ length: reelCount }, () => symbols[0]));
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const broke = balance < 1;

  async function spin() {
    if (spinning || bet <= 0 || bet > balance) return;
    setSpinning(true);
    setResult(null);
    setErr(null);
    // Animation-only randomness — the whirl. The FINAL symbols come from the
    // server response, never from this loop. Skipped for reduced motion.
    const intervals = reduced
      ? []
      : Array.from({ length: reelCount }, (_, ri) =>
          setInterval(() => {
            setDisplay((prev) => {
              const n = [...prev];
              n[ri] = symbols[Math.floor(Math.random() * symbols.length)];
              return n;
            });
          }, 80 + ri * 30)
        );
    const stopAnim = () => intervals.forEach(clearInterval);
    try {
      const [r] = await Promise.all([api.betSlots(gameId, bet), sleep(700 + reelCount * 180)]);
      stopAnim();
      setDisplay(r.reels);
      setBalance(r.balance);
      const line = r.reels.map(symbolName).join(", ");
      // The headline describes the net, matching the banner's colour: a $3 win
      // on a $5 spin is still $2 down.
      const label =
        r.win <= 0
          ? "No win this spin"
          : r.delta > 0
            ? "You win!"
            : r.delta === 0
              ? "Bet returned"
              : "Partial win";
      setResult({
        label,
        won: r.win > 0,
        delta: r.delta,
        detail: r.win > 0 ? `Paid $${r.win} — ${line}` : line,
      });
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
      stopAnim();
      if (e.status === 401) {
        onError(e);
        return;
      }
      setErr(e.message);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div className="lf-app">
      <GameHeader title={name} balance={balance} onBack={onBack} onAtm={onAtm} />
      <main className="lf-shell lf-game lf-game--narrow">
        <section className="lf-panel lf-slots">
          <div className="lf-slots__cabinet" style={{ "--lf-reels": reelCount }}>
            <div
              className="lf-slots__window"
              role="img"
              aria-label={spinning ? "Reels spinning" : `Reels showing ${display.map(symbolName).join(", ")}`}
            >
              {display.map((sym, i) => (
                <div key={i} className={`lf-slots__reel${spinning ? " lf-slots__reel--spinning" : ""}`}>
                  <SlotSymbol id={sym} className="lf-slots__symbol" />
                </div>
              ))}
            </div>
            <div className="lf-slots__payline-marker" aria-hidden="true" />
          </div>

          <div className="lf-slots__lower">
            <div className="lf-slots__payouts">
              <h2 className="lf-section-title">Paytable</h2>
              <table className="lf-slots__table">
                <caption className="lf-visually-hidden">Winning combinations and their payout multipliers</caption>
                <thead>
                  <tr>
                    <th scope="col">Combination</th>
                    <th scope="col">Pays</th>
                  </tr>
                </thead>
                <tbody>
                  {paylines.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <PaylineCombo line={p} />
                      </td>
                      <td className="lf-slots__multiplier">{p.m}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lf-slots__controls">
              {broke ? (
                <BrokeNotice onAtm={onAtm} />
              ) : (
                <>
                  <h2 className="lf-section-title">Your bet</h2>
                  <BetInput balance={balance} bet={bet} setBet={setBet} disabled={spinning} />
                  <button
                    className="lf-btn lf-btn--gold lf-btn--wide lf-slots__spin"
                    onClick={spin}
                    disabled={spinning || bet <= 0 || bet > balance}
                  >
                    {spinning ? "Spinning…" : "Spin"}
                  </button>
                </>
              )}
            </div>
          </div>

          <ResultBanner result={result} />
          <ErrorNotice error={err} />
        </section>
      </main>
    </div>
  );
}
