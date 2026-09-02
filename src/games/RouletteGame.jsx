import { useState } from "react";
import * as api from "../api";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import RouletteWheel from "../components/RouletteWheel";
import { BET_CHIPS, CHIP_COLORS } from "../lib/constants";
import { WHEEL_ORDER, pocketColor } from "../lib/roulette";
import { sleep } from "../lib/sleep";
import "./RouletteGame.css";

const POCKET_STEP = 360 / WHEEL_ORDER.length;

/** Rotation that brings a pocket under the fixed pointer at the top, always
 *  turning forwards from where the wheel currently sits. */
function rotationFor(n, from) {
  const idx = Math.max(0, WHEEL_ORDER.indexOf(n));
  const target = (360 - idx * POCKET_STEP) % 360;
  const base = Math.ceil(from / 360) * 360;
  return base + 720 + target;
}

export default function RouletteGame({ user, onUpdate, onBack, onAtm, onError, config }) {
  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState({});
  const [chipVal, setChipVal] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState(null);
  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const broke = balance < 1;
  const redNums = config.redNums;
  const colorOf = (n) => pocketColor(n, redNums);

  async function spin() {
    if (totalBet <= 0 || spinning || totalBet > balance) return;
    setSpinning(true);
    setResult(null);
    setLanded(null);
    setErr(null);
    try {
      const [r] = await Promise.all([api.betRoulette(bets), sleep(1400)]);
      setRotation((prev) => rotationFor(r.landed, prev));
      setLanded(r.landed);
      setBalance(r.balance);
      const wins = r.wins;
      const color = colorOf(r.landed);
      // A net-zero round can only happen here when at least one bet actually
      // won (roulette has no bet that itself pushes) — a winning bet offset
      // a losing one. That's a break-even round, not a push, so it shouldn't
      // read like one even though the tone stays neutral either way.
      setResult({
        label: r.delta > 0 ? "You win!" : r.delta === 0 ? (wins.length > 0 ? "Break even" : "Bets returned") : "No win this spin",
        won: r.delta > 0,
        delta: r.delta,
        detail: `Ball landed on ${r.landed} (${color})${wins.length ? " · hits: " + wins.join(", ") : ""}`,
      });
      setHistory((h) => [{ n: r.landed, color }, ...h].slice(0, 14));
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
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
      <GameHeader title="European Roulette" balance={balance} onBack={onBack} onAtm={onAtm} />
      <main className="lf-shell lf-game lf-game--split">
        <section className="lf-panel lf-game__stage">
          <RouletteWheel rotation={rotation} spinning={spinning} landed={landed} redNums={redNums} />
          <div className="lf-roulette__callout" role="status" aria-live="polite">
            {spinning
              ? "The wheel is spinning…"
              : landed !== null
                ? `Ball landed on ${landed} (${colorOf(landed)})`
                : "Place your bets and spin."}
          </div>

          {history.length > 0 && (
            <div className="lf-roulette__history">
              <h2 className="lf-section-title lf-roulette__history-title">Recent spins</h2>
              <ul className="lf-roulette__pips" aria-label="Recent results, newest first">
                {history.map((h, i) => (
                  <li key={i} className={`lf-roulette__pip lf-roulette__pip--${h.color}`}>
                    {h.n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="lf-panel">
          <h2 className="lf-section-title">Chip value</h2>
          <div className="lf-roulette__chips">
            {BET_CHIPS.map((v, i) => (
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

          {broke ? (
            <BrokeNotice onAtm={onAtm} />
          ) : (
            <>
              <h2 className="lf-section-title lf-section-title--spaced">Place your bets</h2>
              <p className="lf-section-hint">Tap a bet to place your chip on it; tap it again to take it off.</p>
              <div className="lf-roulette__board">
                {config.roulette.map((b) => (
                  <button
                    key={b.id}
                    className={`lf-bettile${bets[b.id] ? " lf-bettile--active" : ""}`}
                    aria-pressed={!!bets[b.id]}
                    onClick={() => {
                      if (spinning) return;
                      // Toggle: a tap places the current chip, a second tap
                      // takes the bet off again. To change a stake, tap it
                      // off, pick another chip, tap it on.
                      if (bets[b.id]) {
                        setBets((p) => {
                          const next = { ...p };
                          delete next[b.id];
                          return next;
                        });
                      } else if (balance - totalBet >= chipVal) {
                        setBets((p) => ({ ...p, [b.id]: chipVal }));
                      }
                    }}
                  >
                    <span className="lf-bettile__label">
                      {(b.id === "red" || b.id === "black") && (
                        <span className={`lf-swatch lf-swatch--${b.id}`} aria-hidden="true" />
                      )}
                      {b.label}
                    </span>
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
                  onClick={spin}
                  disabled={spinning || totalBet <= 0 || totalBet > balance}
                >
                  {spinning ? "Spinning…" : "Spin the wheel"}
                </button>
                <button className="lf-btn lf-btn--ghost" onClick={() => setBets({})} disabled={spinning}>
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
