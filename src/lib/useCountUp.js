import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Rolls a displayed number from where it is to `target` over `duration`.
 *
 * Display only. The value it settles on is exactly the number handed in — the
 * server's balance, never a rounded or interpolated one — and an interrupted
 * roll simply picks up from whatever is on screen and heads for the new
 * target. Viewers who asked for reduced motion get the target immediately.
 */
export function useCountUp(target, duration = 500) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    if (reduced || shown.current === target) {
      shown.current = target;
      setValue(target);
      return undefined;
    }
    const from = shown.current;
    const start = performance.now();
    let raf = 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        shown.current = target;
        setValue(target);
        return;
      }
      // Ease out cubic: quick off the mark, gentle into the number.
      const v = from + (target - from) * (1 - Math.pow(1 - t, 3));
      shown.current = v;
      setValue(v);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return value;
}
