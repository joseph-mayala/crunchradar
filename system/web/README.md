# CrunchRadar web app

**Design read:** Operator web app for programme leaders and lecturers, calm and exact, Apple-fluid motion, dark theme locked, brand tokens locked. Dials: DESIGN_VARIANCE 3, MOTION_INTENSITY 4, VISUAL_DENSITY 5. The visual source of truth is the original prototype (repo-root `index.html`): floating pill bar, background washes and film grain, glass panels, pill buttons, the hero card, the glowing load chart and the heat grid. The landing hero is preserved as the user approved it. Where the apple-design or design-taste rules conflict with `docs/BRAND.md` or the approved original, those win.

Vite + React + TypeScript + Tailwind CSS v4 + React Router, `motion` for springs, `@phosphor-icons/react` for icons. It talks only to the JSON API in `docs/API_CONTRACT.md` (`/api/*`). Charts are hand-written SVG. Brand tokens from `docs/BRAND.md` are in `src/index.css` (`@theme`).

## Run

```bash
cd system/web
npm install                # .npmrc sets legacy-peer-deps (works around an npm 10 peer-resolution crash)
npm run dev:mock           # http://localhost:5199 with the built-in mock API (VITE_MOCK=1)
npm run dev                # http://localhost:5199, proxies the API to http://localhost:8000
npm run build              # type-check (strict) + production build into dist/
npm test                   # Vitest unit tests for the pure helpers
```

`CRUNCHRADAR_BACKEND=http://host:port npm run dev` points the dev proxy somewhere else. There is no login page. If the server was started with `ADMIN_KEY`, operator calls return 401 and the app shows one calm locked state ("This server is locked with an operator key. Start it without ADMIN_KEY for the local demo."). `VITE_MOCK_LOCKED=1` with `VITE_MOCK=1` simulates that.

## Mock mode (`VITE_MOCK=1`)

`src/mock.ts` runs the same estimate model as the backend on the sample cohort: peak 48 h in W11, limit 28 h, 3 crunch weeks, 2 hidden tasks. Assumptions, approvals and extension decisions change the numbers in memory (reset on reload). Demo links:

- `/approve/demo` (pending), `/approve/used`, `/approve/expired`, `/approve/anything-else` (404)
- `/lecturer/demo/decline`, `/lecturer/used/decline`, `/lecturer/expired/decline`
- `/student?email=student@example.edu&token=demo-token` (token `bad` is rejected), `/student/extension?...`

The mock is dropped from production builds (`import.meta.env.VITE_MOCK` is replaced at build time).

## Serving from FastAPI

Build output is `dist/` with `base: "/"`: `index.html` plus hashed files under `/assets/`. Mount `dist/assets` at `/assets` and serve `dist/icon.svg`.

SPA routes for browsers: `/`, `/app` and everything under `/app/`, `/approve/*`, `/lecturer/*`, `/student` and `/student/*`. The backend already serves `index.html` for any HTML request, so deep links and refreshes work; fetches and form posts to the same paths (and everything under `/api`) stay with FastAPI. The dev proxy does the same: page loads of `/approve`, `/lecturer`, `/proposals`, `/outbox` stay in Vite, fetches go to FastAPI.

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | public | Landing page: the original hero (live tiles from `GET /api/public-summary`, count up once), How it works, What is real and what is sample, one "Open the app" call to action |
| `/app` | operator | Overview: live process stepper (Detect, Propose, Approve, Notify), stat tiles, load chart with tooltip and keyboard-focusable weeks, sensitivity strip, heat grid, suggested fixes (Best fix card), issues, brief-reader notes |
| `/app/check` | operator | Pre-publish check and brief reader (formula vs model hours, cohort hours that week, over / fits) |
| `/app/approvals` | operator | Proposal queue with status tags, expiry, why; the programme leader decides through the emailed link |
| `/app/extensions` | operator | Extension queue: draft verdict, reasons, pattern note, approve / override |
| `/app/email`, `/app/runs` | operator | Outbox as mail cards; run history with GEMINI / RULES badge and model, plus the five workflows as step chips |
| `/app/settings` | operator | Assumptions panel (classes, revision, base hours, computed limit, MQA source, reset with undo) and a live preview chart |
| `/approve/:token`, `/lecturer/:token/decline` | link | Public decision pages, including used / expired / unknown states |
| `/student`, `/student/extension` | link | Digest, marks per hour, "this week is too much" with the 30% bar, extension request |

The app shell has a left sidebar grouped by the workflow (1 Detect, 2 Propose and approve, 3 Notify and follow up, Setup) with the Sample data pill, the "Run Monday check" button (spinner, then a toast) and a pending-moves badge on Approvals. Under 980 px it becomes a drawer opened from the top bar.

## Contract gaps the UI works around

- **Extension form needs assessment ids.** `GET /api/student` items have no `id`, but `POST /api/extensions` needs `assess_id`. The UI reads an optional `id` on `due[]` and `marks_per_hour[]` items (the mock sends it). Please add `id` to those items in the backend.
- **`GET /api/extensions` item shape** is only "list with draft and status". The UI also shows `mod`, `title`, `due`, `days`, `reason`, `personal_hours`, `created` when present.
- **Extension status after override** is shown for `overridden` (or `override`).

## Design checks

Run on 2026-11-12 against the mock (`scripts/checks.mjs`, `scripts/shoot.mjs`, a keyboard script, greps). Screenshots in `screenshots/`.

| Rule | Result |
| --- | --- |
| Landing hero matches the original | PASS: compared `screenshots/original-1280.png` (old `index.html`, top 700 px) with `screenshots/landing-1280.png` in the same Chromium. Same pill bar, eyebrow with lime dot, gradient "before", lede, chips, 2x2 tiles, CRUNCH watermark. Differences: the logo bar has one "Open the app" button instead of tabs, the fourth tile is "Waiting for a person", the semester chip uses a hyphen |
| Original look in the app | PASS: background washes and grain, glass panels, pill buttons, stat tiles, heat cells with hours, chips and hot glow, glowing chart with red overload, Best fix card, mail cards, flow chips, toast |
| Press feedback: `:active` scale 0.97, 100 ms | PASS (`pressable`, `btn`, `cta`, sidebar items, email rows) |
| Springs (`bounce:0, duration:0.35`), interruptible | PASS: page enter, sidebar active pill (`layoutId`), drawer, email row expand, toast, chart tooltip. Count-up on stat tiles once, interrupted counts jump to the real number |
| Spatial consistency | PASS: the drawer enters from the left and leaves to the left; email bodies grow from their row; the toast rises from the bottom and drops back |
| Drawer: focus trap, Escape, focus return | PASS, keyboard run: first focus "Close the menu", focus stayed inside for 16 Tab presses and Shift+Tab, Escape closed it and focus returned to "Open the menu" |
| Keyboard-only sidebar | PASS: Tab order is skip link, logo, Run Monday check, the seven items in workflow order, Back to the landing page; Enter on Approvals opened `/app/approvals`. Chart weeks: one Tab stop, Left/Right/Home/End move, tooltip follows focus |
| Materials | PASS: pill bar and sidebar are blur 20px saturate 180% with a light edge; panels below are not blurred |
| `prefers-reduced-motion` | PASS, emulated on `/` and `/app`: transforms dropped (`MotionConfig reducedMotion="user"`), counts shown at once, press scale and hover lifts off |
| `prefers-reduced-transparency` | PASS, emulated: bar and sidebar solid `#16141f`, no backdrop filter, grain hidden |
| `prefers-contrast: more` | PASS, emulated: solid bar and sidebar, stronger lines, brighter muted text, outlined active item |
| 200% zoom | PASS: 640 CSS px at scale 2, no horizontal page overflow on `/`, `/app`, `/app/check`, `/approve/demo`. Text-only 200%: no page overflow |
| No em or en dashes | PASS: `grep -P "[\x{2013}\x{2014}]" src index.html scripts` finds nothing (the original "Jan-Apr" en dash became a hyphen) |
| No emoji, Phosphor only, one weight | PASS. Exceptions: the hand-made chart and grid keep the original diamond text glyph for holiday weeks; the logo is the brand SVG |
| Radius scale lock | PASS: bar 3, chip 6, cell 10, field 12, inset 16, card 20, hero 28, pill full (`@theme`) |
| Colour lock | PASS: lime is the action and "within limit"; lavender is structure; red only for overload and Rejected / Declined; amber for waiting and sample |
| Contrast (WCAG AA) | PASS, measured: lime button text 14.64:1, ghost button 18.41:1, tags 5.70:1 (red) to 15.72:1, muted text 5.49:1, inputs 17.24:1 |
| Forms: label above, help, inline error below | PASS on every form |
| Feedback in four kinds, skeletons, composed empty states, retry | PASS on every page |
| No login | PASS: no `/login`, no key form, no cookie code; 401 shows the locked state |
| Honesty | PASS: Sample data pill in the sidebar, top bar and link pages; "Demo data" chip in the hero; GEMINI / RULES badges; expiry times |
| Exceptions kept on purpose | The landing hero keeps the lime dot, gradient word and watermark (user-approved). The landing page has "Open the app" twice (top bar and closing strip), both as the lead specified. Small-caps labels on stat tiles follow the original and BRAND.md. Run trigger strings from the backend may contain a middle dot |

Bundle note: `motion` and Phosphor bring the production JS to about 575 kB (about 180 kB gzip).

## Screenshots

`screenshots/` holds the final shots taken against the mock (1280 px, 375 px, the three emulated media queries and 200% zoom). `node scripts/checks.mjs` re-runs the media, zoom and contrast checks. `node scripts/shoot.mjs [baseUrl] [outDir]` re-takes every page at 1280 px and the key pages at 375 px with headless Chromium (needs `playwright-core`; set `PW_CORE` and `CHROME`) and reports console errors and horizontal overflow.
