import { useState } from "react";
import * as api from "../api";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import { DICE_SYMBOLS } from "../lib/constants";
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

  return (
    <div className="lf-app lf-app--game">
      <GameHeader title="Craps" balance={balance} onBack={onBack} onAtm={onAtm} />
      <div className="lf-panel">
        <div className="lf-craps__types" role="group" aria-label="Bet type">
          <button
            className={`lf-btn lf-btn--${type === "pass" ? "gold" : "ghost"} lf-craps__type`}
            onClick={() => {
              if (phase === "comeout" && !rolling) setType("pass");
            }}
            aria-pressed={type === "pass"}
          >
            Pass Line
          </button>
          <button
            className={`lf-btn lf-btn--${type === "dontpass" ? "gold" : "ghost"} lf-craps__type`}
            onClick={() => {
              if (phase === "comeout" && !rolling) setType("dontpass");
            }}
            aria-pressed={type === "dontpass"}
          >
            Don't Pass
          </button>
        </div>

        {point && (
          <div className="lf-craps__point" aria-live="polite">
            Point: {point}
          </div>
        )}

        <div
          className="lf-craps__dice"
          role="status"
          aria-label={rolling ? "Dice rolling" : `Dice showing ${dice[0] || "?"} and ${dice[1] || "?"}`}
        >
          {dice.map((d, i) => (
            <div key={i} className="lf-craps__die" aria-hidden="true">
              {rolling ? "🎲" : d ? DICE_SYMBOLS[d] : "🎲"}
            </div>
          ))}
        </div>

        {dice[0] && !rolling && (
          <div className="lf-craps__sum" aria-live="polite">
            Sum: <b>{dice[0] + dice[1]}</b>
          </div>
        )}

        <div className="lf-craps__msg" aria-live="polite">
          {msg}
        </div>

        {broke && phase === "comeout" ? (
          <BrokeNotice onAtm={onAtm} />
        ) : (
          <>
            {phase === "comeout" && (
              <BetInput balance={balance} bet={bet} setBet={setBet} disabled={rolling} />
            )}
            <button
              className="lf-btn lf-btn--gold"
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
      </div>
    </div>
  );
}
