import { useState } from "react";
import * as api from "../api";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import { sleep } from "../lib/sleep";
import "./SlotMachine.css";

export default function SlotMachine({ user, onUpdate, onBack, onAtm, onError, gameId, config }) {
  const { name, symbols, reelCount, paylines } = config;
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
    // Animation-only randomness — the blur/whirl. The FINAL symbols come from
    // the server response, never from this loop.
    const intervals = Array.from({ length: reelCount }, (_, ri) =>
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
      setResult(
        r.win > 0
          ? { label: "You win!", won: true, delta: r.delta, detail: `Won $${r.win} — ${r.reels.join(" ")}` }
          : { label: "No match — try again", won: false, delta: r.delta, detail: r.reels.join(" ") }
      );
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
    <div className="lf-app lf-app--game">
      <GameHeader title={name} balance={balance} onBack={onBack} onAtm={onAtm} />
      <div className="lf-panel lf-slots">
        <div
          className="lf-slots__reels"
          role="img"
          aria-label={spinning ? "Reels spinning" : `Reels showing: ${display.join(", ")}`}
        >
          {display.map((sym, i) => (
            <div key={i} className={`lf-slots__reel${spinning ? " lf-slots__reel--spinning" : ""}`}>
              {sym}
            </div>
          ))}
        </div>

        <div className="lf-slots__payouts">
          <div className="lf-section-title">Payouts</div>
          <div className="lf-slots__paylines">
            {paylines.map((p, i) => (
              <div key={i} className="lf-slots__payline">
                {p.s} → {p.m}×
              </div>
            ))}
          </div>
        </div>

        {broke ? (
          <BrokeNotice onAtm={onAtm} />
        ) : (
          <>
            <BetInput balance={balance} bet={bet} setBet={setBet} disabled={spinning} />
            <button
              className="lf-btn lf-btn--gold lf-slots__spin"
              onClick={spin}
              disabled={spinning || bet <= 0 || bet > balance}
            >
              {spinning ? "Spinning…" : "Spin 🎰"}
            </button>
          </>
        )}

        <ResultBanner result={result} />
        <ErrorNotice error={err} />
      </div>
    </div>
  );
}
