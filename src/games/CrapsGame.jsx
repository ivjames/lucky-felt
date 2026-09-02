import { useState } from "react";
import * as api from "../api";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import Die from "../components/Die";
import { sleep } from "../lib/sleep";
import "./CrapsGame.css";

export default function CrapsGame({ user, onUpdate, onBack, onAtm, onError }) {
  const [balance, setBalance] = useState(user.balance);
  const [bet, setBet] = useState(10);
  const [type, setType] = useState("pass");
  const [phase, setPhase] = useState("comeout");
  const [point, setPoint] = useState(null);
  const [dice, setDice] = useState([null, null]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("Choose Pass or Don't Pass, set your bet, then roll.");
  const [err, setErr] = useState(null);
  const broke = balance < 1;

  async function roll() {
    if (rolling) return;
    if (phase === "comeout" && (bet <= 0 || bet > balance)) return;
    setRolling(true);
    setResult(null);
    setErr(null);
    try {
      const [r] = await Promise.all([api.crapsRoll(bet, type), sleep(650)]);
      setDice(r.dice);
      setBalance(r.balance);
      setPhase(r.phase);
      setPoint(r.point);
      setMsg(r.label);
      if (r.settled) {
        setResult({ label: r.label, won: r.outcome === "win", delta: r.delta, detail: `Rolled ${r.sum}` });
        onUpdate({ ...user, balance: r.balance });
      } else {
        onUpdate({ ...user, balance: r.balance });
      }
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

  function newRound() {
    setResult(null);
    setDice([null, null]);
    setPhase("comeout");
    setPoint(null);
    setMsg("Choose Pass or Don't Pass and roll.");
  }

  const rolled = dice[0] != null && !rolling;

  return (
    <div className="lf-app">
      <GameHeader title="Craps" balance={balance} onBack={onBack} onAtm={onAtm} />
      <main className="lf-shell lf-game lf-game--split">
        <section className="lf-panel lf-game__stage lf-craps__stage">
          {/* The tray is the pitched surface; the readout and the wager
              controls below it stay flat. */}
          <div className="lf-stage3d lf-dice-stage">
            <div
              className="lf-stage3d__surface lf-dice-tray"
              role="status"
              aria-label={rolling ? "Dice rolling" : `Dice showing ${dice[0] ?? "nothing"} and ${dice[1] ?? "nothing"}`}
            >
              {dice.map((d, i) => (
                <Die key={i} value={d} rolling={rolling} size={78} index={i} />
              ))}
            </div>
          </div>

          <div className="lf-craps__readout">
            <div className="lf-craps__stat" aria-live="polite">
              <span className="lf-craps__stat-label">Total</span>
              <span className="lf-craps__stat-value">{rolled ? dice[0] + dice[1] : "—"}</span>
            </div>
            <div className="lf-craps__stat" aria-live="polite">
              <span className="lf-craps__stat-label">Point</span>
              <span className="lf-craps__stat-value">{point ?? "—"}</span>
            </div>
          </div>

          <p className="lf-craps__msg" aria-live="polite">
            {msg}
          </p>
        </section>

        <section className="lf-panel">
          <h2 className="lf-section-title">Your wager</h2>
          <div className="lf-craps__types" role="group" aria-label="Bet type">
            <button
              className={`lf-btn lf-btn--${type === "pass" ? "gold" : "ghost"} lf-craps__type`}
              onClick={() => {
                if (phase === "comeout" && !rolling) setType("pass");
              }}
              aria-pressed={type === "pass"}
            >
              Pass line
            </button>
            <button
              className={`lf-btn lf-btn--${type === "dontpass" ? "gold" : "ghost"} lf-craps__type`}
              onClick={() => {
                if (phase === "comeout" && !rolling) setType("dontpass");
              }}
              aria-pressed={type === "dontpass"}
            >
              Don't pass
            </button>
          </div>

          {broke && phase === "comeout" ? (
            <BrokeNotice onAtm={onAtm} />
          ) : (
            <>
              {phase === "comeout" && (
                <BetInput balance={balance} bet={bet} setBet={setBet} disabled={rolling} />
              )}
              <button
                className="lf-btn lf-btn--gold lf-btn--wide"
                onClick={roll}
                disabled={rolling || (phase === "comeout" && bet <= 0)}
              >
                {rolling ? "Rolling…" : "Roll the dice"}
              </button>
            </>
          )}

          <ResultBanner result={result} />
          <ErrorNotice error={err} />
          {result && phase === "comeout" && (
            <button className="lf-btn lf-btn--green lf-craps__replay" onClick={newRound}>
              New round
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
