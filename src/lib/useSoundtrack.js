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

/* Chromium builds without proprietary codecs — several Linux distro packages,
 * ungoogled-chromium, and Playwright's bundled browser — have no AAC decoder.
 * Every track then fails to demux, and since a failure skips to the next one,
 * the whole soundtrack gets requested back to back before the give-up guard
 * stops it. Ask once instead of finding out 27 times. */
const AAC = 'audio/mp4; codecs="mp4a.40.2"';

function canPlayAac() {
  try {
    return document.createElement("audio").canPlayType(AAC) !== "";
  } catch {
    return false;
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
  /* The order and the position in it are one value, not two. Splitting them
   * meant advancing had to reshuffle from inside the cursor's updater, and an
   * updater that calls another setter is not pure — StrictMode double-invokes
   * it, so the reshuffle ran twice and the `avoid` guard below could end up
   * measured against an order that was then thrown away. */
  const [queue, setQueue] = useState(() => ({ order: shuffle(TRACKS.length), cursor: 0 }));
  const [playing, setPlaying] = useState(false);
  /* Asked once: the answer cannot change while the page is open. */
  const [supported] = useState(canPlayAac);
  const audioRef = useRef(null);
  /* What is actually loaded into the element, so the effect below can compare
   * identity rather than guessing from the URL. */
  const loadedRef = useRef(null);
  /* Consecutive tracks that failed to load. A whole pass of failures means the
   * audio is not being served at all, and skipping on would spin. */
  const failuresRef = useRef(0);

  const track = TRACKS[queue.order[queue.cursor]];

  useEffect(() => savePrefs(prefs), [prefs]);

  const advance = useCallback(() => {
    setQueue(({ order, cursor }) =>
      cursor + 1 < order.length
        ? { order, cursor: cursor + 1 }
        : { order: shuffle(TRACKS.length, order[cursor]), cursor: 0 },
    );
  }, []);

  /* One <audio> for the life of the app. It is created here rather than
   * rendered as JSX so that navigating between the lobby and a game — which
   * unmounts everything below App — cannot interrupt the music. */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    return () => {
      audio.pause();
      /* `src = ""` resolves against the document URL, so the browser would go
       * and fetch the page itself and try to decode it as media. */
      audio.removeAttribute("src");
      audio.load();
      loadedRef.current = null;
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
    const onEnded = () => {
      failuresRef.current = 0;
      advance();
    };
    const onPlaying = () => {
      failuresRef.current = 0;
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    /* A track that fails to load fires `error` and never `ended`, so without
     * this the queue stops dead on the first bad file and the panel sits there
     * reading "Paused". It is not hypothetical: the vhost falls back to
     * `/index.html`, so a missing .m4a arrives as a 200 of text/html. Skip on,
     * but give up once a full pass has failed rather than spinning. */
    const onError = () => {
      setPlaying(false);
      failuresRef.current += 1;
      if (failuresRef.current < TRACKS.length) advance();
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [advance]);

  /* Load and play whatever the cursor now points at. A browser that refuses
   * to start without a gesture rejects here; the retry is wired below rather
   * than pretending the track is playing. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    /* Before the src is set, so an unplayable format costs nothing rather than
     * 27 requests the browser cannot use. */
    if (!supported) return;
    if (!prefs.enabled) {
      audio.pause();
      return;
    }
    /* Compare what is loaded, not the tail of the URL: `endsWith` would call
     * a track named "Shuffle" already loaded while "George Street Shuffle"
     * was the thing actually playing. */
    if (loadedRef.current !== track.file) {
      loadedRef.current = track.file;
      audio.src = `${import.meta.env.BASE_URL}audio/${track.file}`;
      audio.load();
    }
    audio.play().catch(() => setPlaying(false));
  }, [prefs.enabled, supported, track.file]);

  /* Autoplay is blocked until the page has been interacted with, so every
   * gesture retries it. Deliberately not `{once: true}`: the first gesture is
   * not guaranteed to satisfy the browser, and consuming the listener on a
   * rejected attempt left no way to ever start the music while the button
   * still claimed it was on. These come off when `playing` flips. */
  useEffect(() => {
    if (!supported || !prefs.enabled || playing) return undefined;
    const retry = () => audioRef.current?.play().catch(() => {});
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [prefs.enabled, playing, supported]);

  const toggle = useCallback(() => {
    /* Turning the music back on is the player asking for another go, so the
     * give-up counter starts over — otherwise a transient outage that burned
     * through a full pass would leave the soundtrack dead until a reload. */
    failuresRef.current = 0;
    setPrefs((p) => ({ ...p, enabled: !p.enabled }));
  }, []);
  const setVolume = useCallback((volume) => setPrefs((p) => ({ ...p, volume: clamp(volume) })), []);

  return {
    supported,
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
