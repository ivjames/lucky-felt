/* The house band.
 *
 * One shuffled pass over every track, then a reshuffle — so a session hears
 * the whole soundtrack before it hears anything twice, and the reshuffle
 * never lands on the track that just finished.
 *
 * Nothing here decides money; it is the one part of the client that is
 * allowed to be purely cosmetic.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import soundtrack from "../data/soundtrack.json";

const TRACKS = soundtrack.tracks;
const STORAGE_KEY = "lf.soundtrack";
const DEFAULT_VOLUME = 0.4;

const clamp = (n) => Math.min(1, Math.max(0, n));

/* Preferences live in localStorage, which throws outright in some privacy
 * modes rather than merely coming back empty — so every access is guarded and
 * a failure just means the defaults. */
function loadPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      enabled: typeof stored.enabled === "boolean" ? stored.enabled : true,
      volume: typeof stored.volume === "number" ? clamp(stored.volume) : DEFAULT_VOLUME,
    };
  } catch {
    return { enabled: true, volume: DEFAULT_VOLUME };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Not worth a word to the player: the music still works this session. */
  }
}

/* Fisher-Yates. `avoid` is the index that just played, kept off the front so a
 * reshuffle can't repeat it back to back. */
function shuffle(length, avoid) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (length > 1 && order[0] === avoid) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export function useSoundtrack() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [order, setOrder] = useState(() => shuffle(TRACKS.length));
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const track = TRACKS[order[cursor]];

  useEffect(() => savePrefs(prefs), [prefs]);

  const advance = useCallback(() => {
    setCursor((c) => {
      if (c + 1 < order.length) return c + 1;
      setOrder((o) => shuffle(TRACKS.length, o[c]));
      return 0;
    });
  }, [order.length]);

  /* One <audio> for the life of the app. It is created here rather than
   * rendered as JSX so that navigating between the lobby and a game — which
   * unmounts everything below App — cannot interrupt the music. */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = prefs.volume;
  }, [prefs.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onEnded = () => advance();
    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
    };
  }, [advance]);

  /* Load and play whatever the cursor now points at. A browser that refuses
   * to start without a gesture rejects here; the retry is wired below rather
   * than pretending the track is playing. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!prefs.enabled) {
      audio.pause();
      return;
    }
    const src = `${import.meta.env.BASE_URL}audio/${track.file}`;
    if (!audio.src.endsWith(track.file)) {
      audio.src = src;
      audio.load();
    }
    audio.play().catch(() => setPlaying(false));
  }, [prefs.enabled, track.file]);

  /* Autoplay is blocked until the page has been interacted with. Rather than
   * asking the player to press play twice, the next click or keypress
   * anywhere retries it once. */
  useEffect(() => {
    if (!prefs.enabled || playing) return undefined;
    const retry = () => audioRef.current?.play().catch(() => {});
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [prefs.enabled, playing]);

  const toggle = useCallback(() => setPrefs((p) => ({ ...p, enabled: !p.enabled })), []);
  const setVolume = useCallback((volume) => setPrefs((p) => ({ ...p, volume: clamp(volume) })), []);

  return {
    enabled: prefs.enabled,
    volume: prefs.volume,
    playing,
    track,
    tracks: TRACKS,
    artist: soundtrack.artist,
    licence: soundtrack.licence,
    toggle,
    setVolume,
    skip: advance,
  };
}
