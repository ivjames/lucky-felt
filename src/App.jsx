import { useEffect, useState } from "react";
import * as api from "./api";
import AtmModal from "./components/AtmModal";
import CrapsGame from "./games/CrapsGame";
import PokerGame from "./games/PokerGame";
import RouletteGame from "./games/RouletteGame";
import SicBoGame from "./games/SicBoGame";
import SlotMachine from "./games/SlotMachine";
import AuthScreen from "./screens/AuthScreen";
import Lobby from "./screens/Lobby";
import "./styles/base.css";

const SLOT_GAMES = ["slots1", "slots2", "slots3"];

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("auth");
  const [game, setGame] = useState(null);
  const [showAtm, setShowAtm] = useState(false);
  const [atmBusy, setAtmBusy] = useState(false);
  const [atmError, setAtmError] = useState(null);
  const [config, setConfig] = useState(null);
  const [booting, setBooting] = useState(true);

  // On load: fetch public config and, if a token is cached, restore the session.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await api.getConfig();
        if (alive) setConfig(cfg);
      } catch {
        /* games will show a notice */
      }
      if (api.getToken()) {
        try {
          const { user: me } = await api.fetchMe();
          if (alive) {
            setUser(me);
            setScreen("lobby");
          }
        } catch {
          api.clearToken();
        }
      }
      if (alive) setBooting(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function handleLogin(u) {
    setUser(u);
    setScreen("lobby");
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
    setScreen("auth");
    setGame(null);
  }

  // Server already persisted the authoritative balance; this just syncs UI state.
  function handleUpdate(u) {
    setUser({ ...u });
  }

  // 401 → session is gone (e.g. server restart). Drop to the login screen.
  function handleAuthError() {
    api.clearToken();
    setUser(null);
    setGame(null);
    setScreen("auth");
  }

  function openAtm() {
    setAtmError(null);
    setShowAtm(true);
  }

  async function handleAtm() {
    setAtmBusy(true);
    setAtmError(null);
    try {
      const r = await api.atm();
      setUser((u) => ({ ...u, balance: r.balance, lastAtm: r.lastAtm }));
      setShowAtm(false);
    } catch (e) {
      if (e.status === 401) {
        handleAuthError();
        return;
      }
      if (e.status === 429 && e.data?.remainingMs != null) {
        const mins = Math.ceil(e.data.remainingMs / 60000);
        setAtmError(`ATM on cooldown — try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
      } else {
        setAtmError(e.message);
      }
    } finally {
      setAtmBusy(false);
    }
  }

  const gameProps = {
    user,
    onUpdate: handleUpdate,
    onAtm: openAtm,
    onBack: () => {
      setGame(null);
      setScreen("lobby");
    },
    onError: handleAuthError,
  };

  if (booting) {
    return <div className="lf-app lf-app--loading">Loading the casino…</div>;
  }

  const configReady = !!config;
  const inGame = screen === "game" && user;

  return (
    <>
      {showAtm && user && (
        <AtmModal
          user={user}
          onClose={() => setShowAtm(false)}
          onConfirm={handleAtm}
          busy={atmBusy}
          error={atmError}
        />
      )}
      {screen === "auth" && <AuthScreen onLogin={handleLogin} />}
      {screen === "lobby" && user && (
        <Lobby
          user={user}
          onGame={(id) => {
            setGame(id);
            setScreen("game");
          }}
          onAtm={openAtm}
          onLogout={handleLogout}
        />
      )}
      {inGame && !configReady && <div className="lf-app lf-app--loading">Loading game…</div>}
      {inGame && configReady && game === "poker" && <PokerGame {...gameProps} />}
      {inGame && configReady && game === "roulette" && <RouletteGame {...gameProps} config={config} />}
      {inGame && configReady && game === "craps" && <CrapsGame {...gameProps} />}
      {inGame && configReady && game === "sicbo" && <SicBoGame {...gameProps} config={config} />}
      {inGame && configReady && SLOT_GAMES.includes(game) && (
        <SlotMachine {...gameProps} gameId={game} config={config.slots[game]} />
      )}
    </>
  );
}
