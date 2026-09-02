import { useState } from "react";
import * as api from "../api";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import { BET_CHIPS, CHIP_COLORS } from "../lib/constants";
import { sleep } from "../lib/sleep";
import "./RouletteGame.css";

export default function RouletteGame({ user, onUpdate, onBack, onAtm, onError, config }) {
  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState({});
  const [chipVal, setChipVal] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState(null);
  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const broke = balance < 1;
  const redNums = config.redNums;
  const isRed = (n) => redNums.includes(n);

  async function spin() {
    if (totalBet <= 0 || spinning || totalBet > balance) return;
    setSpinning(true);
    setResult(null);
    setErr(null);
    try {
      const [r] = await Promise.all([api.betRoulette(bets), sleep(1400)]);
      setLanded(r.landed);
      setBalance(r.balance);
      const wins = r.wins;
      setResult({
        label: r.delta > 0 ? "You win!" : "Dealer wins this round",
        won: r.delta > 0,
        delta: r.delta,
        detail: `Ball landed on ${r.landed} ${isRed(r.landed) ? "🔴" : r.landed === 0 ? "🟢" : "⚫"}${
          wins.length ? " · Hits: " + wins.join(", ") : ""
        }`,
      });
      setHistory((h) => [{ n: r.landed, color: r.landed === 0 ? "green" : isRed(r.landed) ? "red" : "black" }, ...h].slice(0, 14));
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

  const landedTone = landed === 0 ? " lf-roulette__landed--zero" : isRed(landed) ? " lf-roulette__landed--red" : "";

  return (
    <div className="lf-app lf-app--game">
      <GameHeader title="European Roulette" balance={balance} onBack={onBack} onAtm={onAtm} />
      <div className="lf-panel">
        <div className="lf-roulette__display">
          {spinning ? (
            <div className="lf-roulette__wheel" role="status" aria-label="Wheel spinning">
              🎡
            </div>
          ) : landed !== null ? (
            <div className={`lf-roulette__landed${landedTone}`} role="status" aria-label={`Ball landed on ${landed}`}>
              {landed}
            </div>
          ) : (
            <div className="lf-roulette__wheel lf-roulette__wheel--idle" aria-hidden="true">
              🎡
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="lf-roulette__history" aria-label="Recent results">
            {history.map((h, i) => (
              <span key={i} className={`lf-roulette__pip lf-roulette__pip--${h.color}`}>
                {h.n}
              </span>
            ))}
          </div>
        )}

        <div className="lf-section-title">Chip value</div>
        <div className="lf-roulette__chips">
          {BET_CHIPS.map((v, i) => (
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
            <div className="lf-section-title">Place bets</div>
            <div className="lf-roulette__board">
              {config.roulette.map((b) => (
                <button
                  key={b.id}
                  className={`lf-roulette__bet${bets[b.id] ? " lf-roulette__bet--active" : ""}`}
                  aria-pressed={!!bets[b.id]}
                  onClick={() => {
                    if (!spinning && balance - totalBet >= chipVal) {
                      setBets((p) => ({ ...p, [b.id]: (p[b.id] || 0) + chipVal }));
                    }
                  }}
                >
                  <span>{b.label}</span>
                  {bets[b.id] > 0 && <span className="lf-roulette__bet-amount">${bets[b.id]}</span>}
                </button>
              ))}
            </div>
            <div className="lf-roulette__total" aria-live="polite">
              Total bet: ${totalBet}
            </div>
            <div className="lf-roulette__actions">
              <button
                className="lf-btn lf-btn--gold"
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
      </div>
    </div>
  );
}
