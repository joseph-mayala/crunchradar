import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Counts a number up from 0 once, the first time it becomes available. Reduced motion shows it at once. */
export function useCountUp(target: number | null | undefined, duration = 0.9): number | null {
  const reduce = useReducedMotion();
  const [val, setVal] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return;
    if (done.current || reduce) {
      setVal(target);
      return;
    }
    let finished = false;
    const c = animate(0, target, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => setVal(v),
      onComplete: () => {
        finished = true;
        done.current = true;
      },
    });
    return () => {
      c.stop();
      // Interrupted (unmount, new value, or React strict-mode re-run): show the real number.
      if (!finished) setVal(target);
    };
  }, [target, reduce, duration]);
  return val;
}
