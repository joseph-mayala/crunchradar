import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CircleNotch,
  ClipboardText,
  EnvelopeSimple,
  Lightning,
  List,
  LockSimple,
  SealCheck,
  SlidersHorizontal,
  Target,
  Timer,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { api, MOCK } from "../api";
import { useSession } from "../session";
import { LogoMark, Wordmark } from "./Logo";
import { TrademarkNote } from "./BrandMark";
import { ErrorBox, Loading, SampleBadge, SPRING } from "./ui";

export { SampleBadge };

/* ---------- Toast (original look, spring in from the bottom) ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMsg({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setMsg(null), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        <AnimatePresence>
          {msg && (
            <motion.div key={msg.id} className="toast" initial={{ opacity: 0, y: 16, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 16, x: "-50%" }} transition={SPRING}>
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** Lets pages ask the shell to refresh shared counts (pending approvals) after they change something. */
const RefreshCtx = createContext<() => void>(() => {});
export const useShellRefresh = () => useContext(RefreshCtx);

interface Item {
  to: string;
  label: string;
  icon: Icon;
  end?: boolean;
  badge?: "pending";
}
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "1 Spot the crunch",
    items: [
      { to: "/app", label: "Crunch weeks", icon: Target, end: true },
      { to: "/app/check", label: "Check a deadline", icon: ClipboardText },
    ],
  },
  {
    title: "2 Decide the fix",
    items: [
      { to: "/app/approvals", label: "Moves to approve", icon: SealCheck, badge: "pending" },
      { to: "/app/extensions", label: "Extension requests", icon: Timer },
    ],
  },
  {
    title: "3 Tell people, then check",
    items: [
      { to: "/app/email", label: "Email outbox", icon: EnvelopeSimple },
      { to: "/app/runs", label: "What the agent did", icon: Lightning },
    ],
  },
  { title: "Your limits", items: [{ to: "/app/settings", label: "Limit and assumptions", icon: SlidersHorizontal }] },
];

function SkipLink() {
  return (
    <a href="#main" className="sr-only z-[60] rounded-field bg-accent px-3 py-2 font-semibold text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
      Skip to content
    </a>
  );
}

function MondayCta({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.mondayCheck();
      toast(r.status === "Needs review" ? "Check finished. A move is waiting for the programme leader." : "Check finished. Nothing new needs a decision.");
      onDone();
      navigate("/app/runs");
    } catch (e) {
      toast(`The check did not run: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="cta w-full justify-center" onClick={() => void run()} disabled={busy} aria-busy={busy}>
      {busy ? (
        <>
          <CircleNotch size={16} className="animate-spin" aria-hidden />
          Running the check
        </>
      ) : (
        <>
          Run Monday check now
          <ArrowRight size={15} aria-hidden />
        </>
      )}
    </button>
  );
}

function SidebarBody({ pending, onRefresh, onNavigate, idPrefix }: { pending: number; onRefresh: () => void; onNavigate?: () => void; idPrefix: string }) {
  return (
    <div className="flex min-h-full flex-col gap-5 p-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 pr-10 min-[980px]:pr-0">
        <Link to="/app" onClick={onNavigate} className="pressable flex items-center gap-2.5 rounded-full" aria-label="CrunchRadar overview">
          <LogoMark size={34} title="" />
          <b className="font-display text-[1.0625rem] font-extrabold tracking-[-0.02em] text-ink">CrunchRadar</b>
        </Link>
        <SampleBadge />
      </div>
      <MondayCta onDone={onRefresh} />
      <nav aria-label="Workflow" className="flex flex-col gap-4">
        {GROUPS.map((g, gi) => (
          <div key={g.title}>
            <h2 id={`${idPrefix}-g${gi}`} className="mb-1.5 px-3 font-sans text-[0.78125rem] font-semibold tracking-normal text-mute">
              {g.title}
            </h2>
            <ul aria-labelledby={`${idPrefix}-g${gi}`} className="flex flex-col gap-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end={it.end} onClick={onNavigate} className="side-item pressable">
                    {({ isActive }) => (
                      <>
                        {isActive && <motion.span layoutId={`${idPrefix}-active`} transition={SPRING} className="tab-active absolute inset-0 rounded-full" aria-hidden />}
                        <it.icon size={17} className="relative shrink-0" aria-hidden />
                        <span className="relative flex-1">{it.label}</span>
                        {it.badge === "pending" && pending > 0 && (
                          <span className="count relative" aria-label={`${pending} waiting`}>
                            {pending}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
        <Link to="/" className="pressable inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:text-ink">
          <ArrowLeft size={15} aria-hidden /> About CrunchRadar
        </Link>
        <p className="px-3 text-xs leading-relaxed text-mute">Nothing changes until a person decides.</p>
      </div>
    </div>
  );
}

/** Focus trap and Escape for the drawer; focus returns to the opener on close. */
function useDrawerKeys(open: boolean, panel: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () => (panel.current ? [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')] : []);
    const t = window.setTimeout(() => focusables()[0]?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, panel, close]);
}

function Locked() {
  return (
    <div className="card mx-auto mt-[10vh] max-w-xl text-center">
      <LockSimple size={28} className="mx-auto text-warn" aria-hidden />
      <h1 className="mt-3 text-2xl font-bold">This server is locked</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">This server is locked with an operator key. Start it without ADMIN_KEY for the local demo.</p>
      <Link to="/" className="btn-ghost btn-sm mt-5">
        About CrunchRadar
      </Link>
    </div>
  );
}

/** The app shell under /app: a sidebar that follows the workflow, a drawer under 980 px. */
export function AppLayout() {
  const { session, error, locked, refresh } = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const panel = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDrawerKeys(open, panel, close);

  const loadPending = useCallback(() => {
    api
      .proposals()
      .then((ps) => setPending(ps.filter((p) => p.status === "pending").length))
      .catch(() => setPending(0));
  }, []);
  useEffect(() => {
    if (session && !locked) loadPending();
  }, [session, locked, location.pathname, loadPending]);
  useEffect(() => setOpen(false), [location.pathname]);

  let content: ReactNode;
  if (error && !session) content = <ErrorBox error={error} onRetry={() => void refresh()} />;
  else if (!session) content = <Loading label="Loading" shape="overview" />;
  else if (locked) content = <Locked />;
  else
    content = (
      <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
        <Outlet />
      </motion.div>
    );

  return (
    <ToastHost>
      <RefreshCtx.Provider value={loadPending}>
        <SkipLink />
        <div className="min-h-[100dvh] min-[980px]:grid min-[980px]:grid-cols-[16.5rem_minmax(0,1fr)]">
          <motion.aside layoutRoot className="sidebar sidebar-desktop hidden min-[980px]:block" aria-label="CrunchRadar workflow">
            <SidebarBody pending={pending} onRefresh={loadPending} idPrefix="side" />
          </motion.aside>

          <div className="sticky top-0 z-20 px-3 pt-3 min-[980px]:hidden">
            <div className="navbar !gap-2 !py-1.5">
              <button type="button" className="btn-ghost btn-sm !min-h-11 !min-w-11 !px-2.5" aria-label="Open the menu" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
                <List size={20} aria-hidden />
              </button>
              <Link to="/app" className="flex items-center gap-2" aria-label="CrunchRadar overview">
                <LogoMark size={30} title="" />
                <b className="font-display text-base font-extrabold tracking-[-0.02em] text-ink">CrunchRadar</b>
              </Link>
              <span className="ml-auto">
                <SampleBadge />
              </span>
            </div>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div key="scrim" className="fixed inset-0 z-40 bg-bg/75 min-[980px]:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={close} aria-hidden />
            )}
            {open && (
              <motion.aside
                key="drawer"
                id="drawer"
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="sidebar fixed inset-y-0 left-0 z-50 w-[min(18rem,86vw)] overflow-y-auto min-[980px]:hidden"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={SPRING}
              >
                <button type="button" className="btn-ghost btn-sm absolute right-3 top-3 z-10 !min-h-11 !min-w-11 !px-2.5" aria-label="Close the menu" onClick={close}>
                  <X size={18} aria-hidden />
                </button>
                <SidebarBody pending={pending} onRefresh={loadPending} onNavigate={close} idPrefix="drawer" />
              </motion.aside>
            )}
          </AnimatePresence>

          <div className="min-w-0 px-4 pb-14 pt-5 sm:px-6 min-[980px]:pt-7">
            <main id="main" className="mx-auto max-w-[72rem]">
              {content}
            </main>
            <footer className="mx-auto mt-9 max-w-[72rem] border-t border-line pt-4 text-[0.78125rem] leading-relaxed text-mute">
              CrunchRadar finds crunch weeks and proposes fixes. Nothing changes until a named person approves. Cohort {session?.cohort ?? "APD2F2606SE"}.
              {session?.sample_data && " The calendar is sample data until a real cohort feed is connected."}
              {MOCK && " Running against the built-in mock API."}
              <TrademarkNote className="mt-2" />
            </footer>
          </div>
        </div>
      </RefreshCtx.Provider>
    </ToastHost>
  );
}

/** Public link pages (approval, decline, student): logo on top, original glass look. */
export function PublicLayout({ wide = false }: { wide?: boolean }) {
  return (
    <div className="min-h-[100dvh]">
      <SkipLink />
      <header className={`mx-auto flex ${wide ? "max-w-5xl" : "max-w-[37.5rem]"} items-center justify-between gap-3 px-4 pt-6`}>
        <Wordmark size={30} />
        <SampleBadge />
      </header>
      <main id="main" className={`mx-auto ${wide ? "max-w-5xl" : "max-w-[37.5rem]"} px-4 pb-16 pt-6`}>
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <Outlet />
        </motion.div>
      </main>
      <footer className={`mx-auto ${wide ? "max-w-5xl" : "max-w-[37.5rem]"} border-t border-line px-4 pb-10 pt-4`}>
        <TrademarkNote />
      </footer>
    </div>
  );
}
