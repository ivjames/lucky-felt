import { useEffect, useState } from "react";
import * as api from "../api";
import Card from "../components/Card";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import "./PokerGame.css";

export default function PokerGame({ user, onUpdate, onBack, onAtm, onError }) {
  const [phase, setPhase] = useState("bet"); // bet | deal | flop | turn | river | showdown
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [community, setCommunity] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [bet, setBet] = useState(10);
  const [pot, setPot] = useState(0);
  const [result, setResult] = useState(null);
  const [balance, setBalance] = useState(user.balance);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const broke = balance < 1;

  function fail(e) {
    if (e.status === 401) {
      onError(e);
      return;
    }
    setErr(e.message);
  }

  function resume(s) {
    setPlayer(s.player);
    setCommunity(s.community);
    setPot(s.pot);
    setPhase(s.phase);
    setDealer([]);
    setRevealed(false);
    setResult(null);
  }

  // Recover an in-progress hand if the player reloaded mid-hand, so its already-
  // deducted stake isn't stranded server-side.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api.pokerState();
        if (alive && s.active) resume(s);
      } catch {
        /* start fresh */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function deal() {
    if (busy || bet <= 0 || bet > balance) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.pokerDeal(bet);
      setPlayer(r.player);
      setDealer([]);
      setCommunity([]);
      setRevealed(false);
      setPot(r.pot);
      setBalance(r.balance);
      setResult(null);
      setPhase("deal");
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
      // Server says a hand is already live — pull it in rather than erroring out.
      if (e.status === 409) {
        try {
          const s = await api.pokerState();
          if (s.active) {
            resume(s);
            setErr("Resumed your hand in progress.");
          }
        } catch {
          fail(e);
        }
      } else {
        fail(e);
      }
    } finally {
      setBusy(false);
    }
  }

  async function advance() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.pokerAdvance();
      setCommunity(r.community);
      setPhase(r.phase);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function showdown() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.pokerShowdown();
      setDealer(r.dealer);
      setCommunity(r.community);
      setRevealed(true);
      setBalance(r.balance);
      setResult({
        label: r.won ? "You win!" : r.push ? "Push — tie hand" : "Dealer wins",
        won: r.won,
        delta: r.delta,
        detail: `You: ${r.playerHand} · Dealer: ${r.dealerHand}`,
      });
      setPhase("showdown");
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function fold() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.pokerFold();
      setBalance(r.balance);
      setResult({ label: "Folded", won: false, delta: r.delta, detail: "You surrendered the pot." });
      setPhase("showdown");
      onUpdate({ ...user, balance: r.balance });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBet((b) => Math.min(b || 10, balance));
    setPhase("bet");
    setResult(null);
    setPlayer([]);
    setDealer([]);
    setCommunity([]);
    setRevealed(false);
  }

  return (
    <div className="lf-app lf-app--game">
      <GameHeader title="Texas Hold'em Poker" balance={balance} onBack={onBack} onAtm={onAtm} />
      <div className="lf-panel">
        <div className="lf-section-title">Dealer's hand</div>
        <div className="lf-poker__cards">
          {phase === "bet" ? (
            <span className="lf-poker__placeholder">waiting for deal…</span>
          ) : revealed ? (
            dealer.map((c, i) => <Card key={i} card={c} />)
          ) : (
            [0, 1].map((i) => <Card key={i} card={{}} hidden />)
          )}
        </div>

        <div className="lf-section-title lf-section-title--spaced">Community cards</div>
        <div className="lf-poker__cards">
          {community.map((c, i) => (
            <Card key={i} card={c} />
          ))}
          {!community.length && <span className="lf-poker__placeholder">awaiting flop…</span>}
        </div>

        <div className="lf-section-title lf-section-title--spaced">Your hand</div>
        <div className="lf-poker__cards">
          {player.map((c, i) => (
            <Card key={i} card={c} />
          ))}
          {!player.length && <span className="lf-poker__placeholder">waiting for deal…</span>}
        </div>

        <div className="lf-poker__controls">
          {phase === "bet" &&
            (broke ? (
              <BrokeNotice onAtm={onAtm} />
            ) : (
              <>
                <BetInput balance={balance} bet={bet} setBet={setBet} disabled={busy} />
                <button
                  className="lf-btn lf-btn--gold lf-poker__deal"
                  onClick={deal}
                  disabled={busy || bet <= 0 || bet > balance}
                >
                  {busy ? "Dealing…" : "Deal cards"}
                </button>
              </>
            ))}
          {phase === "deal" && (
            <div className="lf-poker__actions">
              <button className="lf-btn lf-btn--green" onClick={advance} disabled={busy}>
                Check / see flop
              </button>
              <button className="lf-btn lf-btn--red" onClick={fold} disabled={busy}>
                Fold
              </button>
            </div>
          )}
          {phase === "flop" && (
            <button className="lf-btn lf-btn--green" onClick={advance} disabled={busy}>
              Check / see turn
            </button>
          )}
          {phase === "turn" && (
            <button className="lf-btn lf-btn--green" onClick={advance} disabled={busy}>
              Check / see river
            </button>
          )}
          {phase === "river" && (
            <button className="lf-btn lf-btn--gold" onClick={showdown} disabled={busy}>
              Go to showdown
            </button>
          )}
        </div>

        <div className="lf-poker__pot" aria-live="polite">
          Pot: ${pot}
        </div>
        <ResultBanner result={result} />
        <ErrorNotice error={err} />
        {phase === "showdown" && (
          <button className="lf-btn lf-btn--gold lf-poker__replay" onClick={reset}>
            New hand
          </button>
        )}
      </div>
    </div>
  );
}
