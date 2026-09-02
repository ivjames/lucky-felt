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

/** A reel's loop: symbols to scroll past the window, laid out twice so the
 *  strip can translate by exactly half its height and wrap seamlessly. Purely
 *  what the eye sees on the way down — the symbol a reel stops on is always
 *  the one the server sent. */
function buildStrip(symbols) {
  const loop = Array.from({ length: 7 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
  return [...loop, ...loop];
}

export default function SlotMachine({ user, onUpdate, onBack, onAtm, onError, gameId, config }) {
  const { name, symbols, reelCount, paylines } = config;
  const reduced = useReducedMotion();
  const [balance, setBalance] = useState(user.balance);
  const [bet, setBet] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState(Array.from({ length: reelCount }, () => symbols[0]));
  // How many reels have come to rest this spin. Reel i is still running while
  // `i >= stopped`, which is what lets them stop one after another.
  const [stopped, setStopped] = useState(reelCount);
  const [strips, setStrips] = useState(() => Array.from({ length: reelCount }, () => buildStrip(symbols)));
  const [won, setWon] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const broke = balance < 1;

  async function spin() {
    if (spinning || bet <= 0 || bet > balance) return;
    setSpinning(true);
    setStopped(0);
    setWon(false);
    setStrips(Array.from({ length: reelCount }, () => buildStrip(symbols)));
    setResult(null);
    setErr(null);
    try {
      const [r] = await Promise.all([api.betSlots(gameId, bet), sleep(700 + reelCount * 180)]);
      setDisplay(r.reels);
      // Reels arrive left to right. The values are already the server's; this
      // only staggers when each one is uncovered.
      for (let i = 0; i < reelCount; i++) {
        setStopped(i + 1);
        if (!reduced && i < reelCount - 1) await sleep(130);
      }
      setWon(r.win > 0);
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
      setStopped(reelCount);
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
          {/* The cabinet is the pitched surface; the paytable and the bet
              controls below it stay flat. */}
          <div className="lf-stage3d lf-stage3d--soft lf-slots__stage">
            <div
              className={`lf-slots__cabinet lf-stage3d__surface${won ? " lf-slots__cabinet--won" : ""}`}
              style={{ "--lf-reels": reelCount }}
            >
              <div
                className="lf-slots__window"
                role="img"
                aria-label={spinning ? "Reels spinning" : `Reels showing ${display.map(symbolName).join(", ")}`}
              >
                {display.map((sym, i) => {
                  // Reduced motion never rolls a strip: the reel simply shows
                  // the server's symbol the moment it arrives.
                  const running = spinning && !reduced && i >= stopped;
                  return (
                    <div
                      key={i}
                      className={`lf-slots__reel${running ? " lf-slots__reel--spinning" : ""}`}
                      style={{ "--lf-reel-i": i }}
                    >
                      {/* Keyed by state so swapping the rolling strip for the
                          settled one is a real mount — which is what re-runs
                          the reel's little overshoot as it stops. */}
                      {running ? (
                        <div key="roll" className="lf-slots__strip lf-slots__strip--rolling" aria-hidden="true">
                          {strips[i].map((sy, j) => (
                            <span key={j} className="lf-slots__cell">
                              <SlotSymbol id={sy} className="lf-slots__symbol" />
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div key="stop" className="lf-slots__strip lf-slots__strip--settled">
                          <span className="lf-slots__cell">
                            <SlotSymbol id={sym} className="lf-slots__symbol" />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="lf-slots__payline-marker" aria-hidden="true" />
            </div>
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
                    className={`lf-btn lf-btn--gold lf-btn--wide lf-slots__spin${
                      spinning ? " lf-slots__spin--held" : ""
                    }`}
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
