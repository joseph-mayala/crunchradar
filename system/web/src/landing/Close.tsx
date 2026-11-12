import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { useMedia } from "./shared";
import { BrandMark, TrademarkNote } from "../components/BrandMark";
import { Radar, type Series } from "./art/Motif";
import { FooterSectionLinks } from "./SectionNav";

const REPO = "https://github.com/joseph-mayala/crunchradar";
const POINTER_SPRING = { stiffness: 120, damping: 22, mass: 1 } as const; // about critically damped

/**
 * Beat 6, resolve. The CRUNCH watermark returns large behind the close and leans gently toward
 * the pointer (motion values and springs, no React state). It holds; nothing fades out.
 */
export function Close({ data = null }: { data?: Series | null }) {
  const reduce = useReducedMotion();
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const live = fine && !reduce;
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, POINTER_SPRING);
  const sy = useSpring(my, POINTER_SPRING);
  const rotateY = useTransform(sx, (v) => v * 9);
  const rotateX = useTransform(sy, (v) => v * -7);
  const x = useTransform(sx, (v) => v * 28);
  const y = useTransform(sy, (v) => v * 16);

  const onMove = (e: React.PointerEvent) => {
    if (!live || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section ref={ref} className="close" aria-labelledby="close-h" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="close-radar-wrap" aria-hidden="true">
        <Radar data={data} className="close-radar" />
      </div>
      <div className="close-mark-wrap" aria-hidden="true">
        <motion.div className="watermark close-mark" style={live ? { rotateX, rotateY, x, y } : undefined}>
          CRUNCH
        </motion.div>
      </div>
      <div className="close-body">
        <h2 id="close-h" className="close-h">
          Spot the crunch before students hit it.
        </h2>
        <Link to="/app" className="btn-primary close-cta">
          Open the app
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <footer className="close-foot">
        <FooterSectionLinks />
        <p>Nothing changes until a person decides.</p>
        <p>
          <a href={REPO} className="pal-link inline-flex min-h-11 items-center gap-1.5" rel="noreferrer" target="_blank">
            <BrandMark brand="github" size={18} />
            joseph-mayala/crunchradar
          </a>
        </p>
        <p className="close-note">Built for the APU Cloud Innovation Hackathon 2026. Module names are from the APD2F2606SE programme; assessments, dates and hours are sample data.</p>
        <TrademarkNote className="close-tm" />
      </footer>
    </section>
  );
}
