import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretRight } from "@phosphor-icons/react";
import { api } from "../api";
import { Card, Empty, ErrorBox, Loading, Note, PageHeader, SPRING, Tag } from "../components/ui";
import { mailKindLabel } from "../lib/status";
import { fmtShort } from "../lib/weeks";
import { useSession } from "../session";
import { useData } from "../useData";

export function EmailPage() {
  const { session } = useSession();
  const res = useData(() => api.outbox(50));
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <PageHeader title="Email" sub="Everything the system sent or drafted, newest first." />
      {session && !session.smtp && (
        <div className="mb-6">
          <Note tone="warn">No mail server is set up, so these emails stay in this outbox and are not delivered.</Note>
        </div>
      )}
      <Card>
        {res.loading && !res.data ? (
          <Loading shape="list" rows={5} label="Loading the outbox" />
        ) : res.error ? (
          <ErrorBox error={res.error} onRetry={res.reload} />
        ) : res.data && res.data.length ? (
          <ul className="grid gap-2.5">
            {res.data.map((m) => {
              const isOpen = open.has(m.id);
              const bodyId = `mail-${m.id}`;
              return (
                <li key={m.id} className="mail">
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    className="mh pressable flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left hover:bg-white/[0.06]"
                  >
                    <Tag spec={{ label: mailKindLabel(m.kind), tone: "mute" }} />
                    <b className="min-w-0 flex-1 basis-64 text-[0.875rem] font-semibold">{m.subject}</b>
                    <span className="font-mono text-xs text-mute">{fmtShort(m.created)}</span>
                    <motion.span aria-hidden className="inline-flex text-ink-2" animate={{ rotate: isOpen ? 90 : 0 }} transition={SPRING}>
                      <CaretRight size={16} />
                    </motion.span>
                    <span className="w-full text-xs text-mute">
                      to {m.to_addr}
                      {m.cc ? `, cc ${m.cc}` : ""} · {m.error ? <span className="text-warn">not sent: {m.error}</span> : m.sent ? "sent" : "outbox only"}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.pre
                        id={bodyId}
                        key="body"
                        initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
                        transition={SPRING}
                        style={{ transformOrigin: "top" }}
                        className="mb m-0 whitespace-pre-wrap break-words font-mono text-[0.78125rem] leading-relaxed text-ink-2"
                      >
                        {m.body}
                      </motion.pre>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>The outbox is empty. Emails appear here when a check, approval or extension sends one.</Empty>
        )}
      </Card>
    </>
  );
}
