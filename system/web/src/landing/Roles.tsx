import { motion, useReducedMotion } from "motion/react";
import { ChalkboardTeacher, SealCheck, Student, type Icon } from "@phosphor-icons/react";
import { SPRING } from "./shared";

const ROLES: { icon: Icon; role: string; gets: string; text: string }[] = [
  { icon: SealCheck, role: "Programme leader", gets: "Decides", text: "Sees the crunch weeks every Monday and approves or rejects each move with one link." },
  { icon: ChalkboardTeacher, role: "Lecturer", gets: "Is told", text: "Hears about a move only after it is approved, with the reason and the new week." },
  { icon: Student, role: "Student", gets: "Feels it", text: "Gets fewer weeks over the limit, and a Monday note on the weeks ahead." },
];

/** A short beat: who uses CrunchRadar and what each person gets. An editorial list, not cards. */
export function Roles() {
  const reduce = useReducedMotion();
  return (
    <section className="beat roles" id="who-it-is-for" data-section aria-labelledby="roles-h">
      <div className="roles-copy">
        <h2 id="roles-h" className="beat-h">
          Who it is for.
        </h2>
        <p className="beat-lede">Three people touch every move. Only one of them decides.</p>
      </div>
      <ol className="roles-list">
        {ROLES.map((r, i) => (
          <motion.li
            key={r.role}
            className="roles-row"
            initial={reduce ? false : { opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={reduce ? { duration: 0 } : { type: "spring", ...SPRING, delay: i * 0.08 }}
          >
            <span className="roles-icon" aria-hidden>
              <r.icon size={28} weight="duotone" />
            </span>
            <div className="roles-who">
              <h3>{r.role}</h3>
              <span className={`roles-gets ${i === 0 ? "is-decides" : ""}`}>{r.gets}</span>
            </div>
            <p>{r.text}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
