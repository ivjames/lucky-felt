import { useEffect, useRef, useState } from "react";
import { useSoundtrack } from "../lib/useSoundtrack";
import { MusicIcon, SoundOffIcon, SoundOnIcon } from "./icons/UiIcons";
import "./MusicControl.css";

/* The soundtrack's one piece of chrome: mute, volume, skip, and the credits.
 *
 * The credits are not decoration. The music is under CC BY 4.0, which is a
 * licence to redistribute *provided* the attribution travels with it — so the
 * panel below is the condition on which the audio in public/audio/ may be
 * served at all, and it renders from the same manifest the player reads. Add a
 * track and it credits itself; remove the panel and the tracks are unlicensed.
 */
export default function MusicControl() {
  const { enabled, volume, playing, track, tracks, artist, licence, toggle, setVolume, skip } = useSoundtrack();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const toggleRef = useRef(null);

  /* Click-away and Escape, the same as any other transient panel. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !toggleRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Speaker = enabled ? SoundOnIcon : SoundOffIcon;

  return (
    <div className="lf-music">
      {open && (
        <div className="lf-music__panel" ref={panelRef} role="dialog" aria-label="Soundtrack">
          <div className="lf-music__now">
            <MusicIcon className="lf-music__now-icon" />
            <div>
              <p className="lf-music__now-title">{track.title}</p>
              <p className="lf-music__now-state">{playing ? "Now playing" : enabled ? "Paused" : "Music off"}</p>
            </div>
            <button className="lf-btn lf-btn--ghost lf-btn--sm" onClick={skip} disabled={!enabled}>
              Skip
            </button>
          </div>

          <label className="lf-music__volume">
            <span className="lf-music__volume-label">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={!enabled}
              aria-label={`Music volume, ${Math.round(volume * 100)} percent`}
            />
          </label>

          <h2 className="lf-section-title lf-music__heading">Soundtrack</h2>
          <p className="lf-music__credit">
            Music by{" "}
            <a href={artist.url} target="_blank" rel="noreferrer noopener">
              {artist.name} (incompetech.com)
            </a>
            , licensed under{" "}
            <a href={licence.url} target="_blank" rel="noreferrer noopener">
              {licence.name}
            </a>
            .
          </p>
          <ol className="lf-music__list">
            {tracks.map((t) => (
              <li key={t.id} className={t.id === track.id ? "lf-music__track lf-music__track--current" : "lf-music__track"}>
                <a href={t.source} target="_blank" rel="noreferrer noopener">
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="lf-music__bar">
        <button
          className="lf-music__btn"
          onClick={toggle}
          aria-label={enabled ? "Turn music off" : "Turn music on"}
          aria-pressed={enabled}
        >
          <Speaker className="lf-music__btn-icon" />
        </button>
        <button
          className="lf-music__btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Soundtrack and credits"
          ref={toggleRef}
        >
          <MusicIcon className="lf-music__btn-icon" />
        </button>
      </div>
    </div>
  );
}
