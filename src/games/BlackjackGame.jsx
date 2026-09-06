import { useEffect, useState } from "react";
import * as api from "../api";
import Card from "../components/Card";
import BetInput from "../components/BetInput";
import BrokeNotice from "../components/BrokeNotice";
import ErrorNotice from "../components/ErrorNotice";
import GameHeader from "../components/GameHeader";
import ResultBanner from "../components/ResultBanner";
import "./BlackjackGame.css";

/** "3:2" reads better on a felt than "1.5". Anything the server ever sets that
 *  isn't a half is shown as plain odds to one. */
function paysText(pays) {
  return pays === 1.5 ? "3:2" : pays === 1.2 ? "6:5" : `${pays}:1`;
}

export default function BlackjackGame({ user, onUpdate, onBack, onAtm, onError, config }) {
  const rules = config.blackjack;
  const [phase, setPhase] = useState("bet"); // bet | player | done
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [playerTotal, setPlayerTotal] = useState(null);
  const [dealerTotal, setDealerTotal] = useState(null);
  const [canDouble, setCanDouble] = useState(false);
  const [stake, setStake] = useState(0);
  const [bet, setBet] = useState(10);
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

  // Every response — live hand or finished one — describes the whole table, so
  // one function draws all of them and the client never infers a total or a
  // payout for itself.
  function showTable(r) {
    setPlayer(r.player);
    setDealer(r.dealer);
    setDealerHidden(r.dealerHidden);
    setPlayerTotal(r.playerTotal);
    setDealerTotal(r.dealerTotal);
    setCanDouble(!!r.canDouble);
    setStake(r.stake);
    if (typeof r.balance === "number") setBalance(r.balance);
    if (r.settled) {
      setPhase("done");
      setResult({ label: r.label, won: r.outcome === "win", delta: r.delta, detail: `You ${r.playerTotal} · Dealer ${r.dealerTotal}` });
    } else {
      setPhase("player");
      setResult(null);
    }
  }

  // Same, plus telling the rest of the app about the balance. Recovering a hand
  // on mount uses showTable instead: nothing has been won or lost by looking.
  function apply(r) {
    showTable(r);
    if (typeof r.balance === "number") onUpdate({ ...user, balance: r.balance });
  }

  // Recover an in-progress hand after a reload, so its already-deducted stake
  // isn't stranded server-side.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api.blackjackState();
        if (alive && s.active) showTable(s);
      } catch {
        /* start fresh */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function act(call) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      apply(await call());
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function deal() {
    if (busy || bet <= 0 || bet > balance) return;
    setBusy(true);
    setErr(null);
    try {
      apply(await api.blackjackDeal(bet));
    } catch (e) {
      // Server says a hand is already live — pull it in rather than erroring
      // out, exactly as the poker table does.
      if (e.status === 409) {
        try {
          const s = await api.blackjackState();
          if (s.active) {
            apply(s);
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

  function newHand() {
    setBet((b) => Math.min(b || 10, balance));
    setPhase("bet");
    setResult(null);
    setPlayer([]);
    setDealer([]);
    setDealerHidden(true);
    setPlayerTotal(null);
    setDealerTotal(null);
    setCanDouble(false);
    setStake(0);
  }

  // While the hole card is down the server has sent one dealer card; the second
  // place is filled by a face-down card that keeps its element right through to
  // the reveal, so the hand ends with a card turning over rather than appearing.
  const dealerCards = dealerHidden && dealer.length ? [dealer[0], null] : dealer;
  const dealerLabel =
    phase === "bet" ? "—" : dealerHidden ? `${dealerTotal} showing` : String(dealerTotal);

  return (
    <div className="lf-app">
      <GameHeader title="Blackjack" balance={balance} onBack={onBack} onAtm={onAtm} />
      <main className="lf-shell lf-game lf-game--narrow">
        <section className="lf-panel lf-blackjack">
          {/* The felt is pitched away from the viewer; the controls below it
              stay flat and square to the pointer. */}
          <div className="lf-stage3d lf-blackjack__stage">
            <div className="lf-stage3d__surface lf-rim lf-blackjack__rim">
              <div className="lf-blackjack__table lf-felt">
                <div className="lf-blackjack__deck" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>

                {/* Both rows are a fixed card tall and never wrap, so the felt
                    is the same size whether a hand is two cards or six — see
                    the overlap rule in the stylesheet for the rare longer one. */}
                <div className="lf-blackjack__row">
                  <div className="lf-blackjack__rowhead">
                    <h2 className="lf-blackjack__rowtitle">Dealer</h2>
                    <span className="lf-blackjack__total" aria-label={`Dealer total: ${dealerLabel}`}>
                      {dealerLabel}
                    </span>
                  </div>
                  <div
                    className="lf-blackjack__hand lf-blackjack__hand--dealer"
                    role="group"
                    aria-label={phase === "bet" ? "Dealer: waiting for the deal" : "Dealer's hand"}
                  >
                    {dealerCards.map((c, i) => (
                      <Card key={i} card={c ?? {}} hidden={!c} dealIndex={i} />
                    ))}
                  </div>
                </div>

                <div className="lf-blackjack__row">
                  <div className="lf-blackjack__rowhead">
                    <h2 className="lf-blackjack__rowtitle">You</h2>
                    <span className="lf-blackjack__total" aria-label={`Your total: ${playerTotal ?? "—"}`}>
                      {playerTotal ?? "—"}
                    </span>
                  </div>
                  <div
                    className="lf-blackjack__hand lf-blackjack__hand--player"
                    role="group"
                    aria-label={player.length ? "Your hand" : "Your hand: waiting for the deal"}
                  >
                    {player.map((c, i) => (
                      <Card key={i} card={c} dealIndex={i} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lf-blackjack__controls">
            {phase === "bet" &&
              (broke ? (
                <BrokeNotice onAtm={onAtm} />
              ) : (
                <>
                  <BetInput balance={balance} bet={bet} setBet={setBet} disabled={busy} />
                  <button
                    className="lf-btn lf-btn--gold lf-btn--wide"
                    onClick={deal}
                    disabled={busy || bet <= 0 || bet > balance}
                  >
                    {busy ? "Dealing…" : "Deal cards"}
                  </button>
                </>
              ))}
            {phase === "player" && (
              <div className="lf-actions">
                <button className="lf-btn lf-btn--green" onClick={() => act(api.blackjackHit)} disabled={busy}>
                  Hit
                </button>
                <button className="lf-btn lf-btn--gold" onClick={() => act(api.blackjackStand)} disabled={busy}>
                  Stand
                </button>
                <button
                  className="lf-btn lf-btn--ghost"
                  onClick={() => act(api.blackjackDouble)}
                  disabled={busy || !canDouble}
                  title={canDouble ? undefined : "Doubling needs your first two cards and the balance to match your bet"}
                >
                  Double
                </button>
              </div>
            )}
          </div>

          <div className="lf-blackjack__stakeline" aria-live="polite">
            Stake <b>${stake}</b>
          </div>
          <ResultBanner result={result} />
          <ErrorNotice error={err} />
          {phase === "done" && (
            <button className="lf-btn lf-btn--gold lf-blackjack__replay" onClick={newHand}>
              New hand
            </button>
          )}

          <p className="lf-blackjack__rules">
            Dealer stands on {rules.dealerStandsOn}, soft or hard · Blackjack pays {paysText(rules.blackjackPays)} ·
            {rules.doubleAllowed ? " Double on your first two cards" : " No doubling"} ·
            {rules.splitAllowed ? " Splits allowed" : " No splits"},
            {rules.insuranceOffered ? " insurance offered" : " no insurance"}
          </p>
        </section>
      </main>
    </div>
  );
}
