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
| `/` | public | Scroll-driven landing page: the preserved hero, then six beats (see "Landing page" below). One call to action, "Open the app" |
| `/app` | operator | Overview: live process stepper (Detect, Propose, Approve, Notify), stat tiles, load chart with tooltip and keyboard-focusable weeks, sensitivity strip, heat grid, suggested fixes (Best fix card), issues, brief-reader notes |
| `/app/check` | operator | Pre-publish check and brief reader (formula vs model hours, cohort hours that week, over / fits) |
| `/app/approvals` | operator | Proposal queue with status tags, expiry, why; the programme leader decides through the emailed link |
| `/app/extensions` | operator | Extension queue: draft verdict, reasons, pattern note, approve / override |
| `/app/email`, `/app/runs` | operator | Outbox as mail cards; run history with GEMINI / RULES badge and model, plus the five workflows as step chips |
| `/app/settings` | operator | Assumptions panel (classes, revision, base hours, computed limit, MQA source, reset with undo) and a live preview chart |
| `/approve/:token`, `/lecturer/:token/decline` | link | Public decision pages, including used / expired / unknown states |
| `/student`, `/student/extension` | link | Digest, marks per hour, "this week is too much" with the 30% bar, extension request |

The app shell has a left sidebar grouped by the workflow (1 Detect, 2 Propose and approve, 3 Notify and follow up, Setup) with the Sample data pill, the "Run Monday check" button (spinner, then a toast) and a pending-moves badge on Approvals. Under 980 px it becomes a drawer opened from the top bar.

## Landing page

`src/pages/Landing.tsx` (feeling curve in the comment at the top), beats in `src/landing/`, styles in `src/landing.css` and `src/hero.css`, pure scroll maths in `src/lib/scrolly.ts` (tested in `scrolly.test.ts`). Every number comes from `GET /api/public-summary` (`weekly_hours`, `weekly_hours_after`, `peak_after`, `crunch_weeks_after`, `illustrated_moves`); the page never waits for it, and every block with numbers carries a "Sample data" label. Pinning is CSS `position: sticky` inside a tall wrapper; progress comes from Motion `useScroll`, mapped with `useTransform` and `useSpring` (critically damped). No scroll listeners, no React state per frame, no new dependency. Colours come from the `--pal-*` variables at the top of `hero.css` (palette D, ink indigo).

| Beat | Feeling | Device | What it shows |
| --- | --- | --- | --- |
| Hero | calm authority | parallax planes | The approved hero. On scroll the watermark lags most, the stat tiles less, the headline rides at 1x |
| (gap) | silence | none | 26vh of empty ground before the peak |
| 1 Scroll moves the deadline | tension, then relief (the peak, 420vh) | pinned, scroll-scrubbed SVG chart (signature move) | 14 bars rise to today's hours (over-limit bars red), then the four illustrated moves play one by one; bars spring to the after shape, a dashed ghost keeps the old week 11, peak 48.3 h counts to 31.8 h, crunch weeks 3 to 2. Detect, Propose, Approve, Notify light up underneath. In-between frames are a blend of the two real states |
| 2 Every Monday at 08:00 | curiosity | pinned kinetic log (210vh) | The run history of one Monday: get_overview, a found task, get_options, request_approval, finish, with GEMINI and Needs review tags |
| 3 Rules the agent cannot talk its way past | trust | horizontal pan (330vh) | Five fixed rules on a sideways track driven by vertical scroll; travel is measured from the track width |
| 4 What is real, and what is sample | candour | clip-path wipe | Real and Sample panels wipe in from opposite sides as they enter |
| 5 Built to plug into Gemini Enterprise | confidence | staggered spring stack | The four MCP tools, then calendar feed, briefs and outbox mapped to Google Calendar, Google Drive and Outlook connectors |
| (gap) | silence | none | 16vh before the close |
| 6 Close | resolve | pointer | The CRUNCH watermark returns large and leans toward the pointer (springs on motion values, fine pointers only). Tagline, "Open the app", quiet footer. It holds |

Fallbacks: below 768 px and under `prefers-reduced-motion` nothing pins and nothing is scroll-linked. Beat 1 becomes a static Today / After pair with the move list, beat 2 shows the whole log, beat 3 becomes a vertical stack, the wipe and the pointer tilt are off, the hero planes do not move. `prefers-contrast: more` and `prefers-reduced-transparency` switch panels to solid surfaces. Verify with `node scripts/landing-scroll.mjs http://localhost:5199 .shots/landing` against `npm run dev:mock` (desktop 1280x800, phone 375x812, reduced motion; half-viewport steps, contact sheets, overflow, console errors and dash count in `report.json`).

### Fuller landing at wide screens, plus section links (2026-11-13)

On a 1920 x 1080 screen the landing used to sit inside a 1200 px column with dark gaps around it. It now scales up, and every section carries artwork drawn in code from the product's own data. There are no images and no new dependencies. Styles are in `src/landing-art.css`, artwork components in `src/landing/art/`, and the pure geometry in `art/geometry.ts`, tested in `geometry.test.ts`.

- **Scale.** The container is `--land-max: clamp(75rem, 84vw, 110rem)`. Headings, ledes, cards and charts grow with `clamp()`. Section padding is tighter, and the empty "silence" gaps became a week ruler. Pinned frames are filled from top to bottom: the log stretches, the rules pan starts high, and the chart is taller. At short heights (200% zoom) some detail is dropped so the heading and content still fit in one frame.
- **Motif** (`art/Motif.tsx`). `Radar` draws rings like the logo, one tick per week, the dashed limit ring and one dot per week. Dots sit by angle (week) and distance (hours), and the crunch weeks are coral. The sweep is a CSS rotate and is static under reduced motion. `Skyline` is the 14 real weekly bars as a faint silhouette with a slight parallax. `WeekRuler` labels W1 to W14 and marks crunch weeks. All of this is decorative (`aria-hidden`) and comes from `weekly_hours` and `limit`.
- **Rules.** Each of the five cards has an SVG that shows its rule (`art/RuleArt.tsx`): the bar slides right only, the exam is locked, the deadline hops over a hatched holiday, the 72 hour ring runs down, and the gate lifts after a yes. The drawings follow each card's scroll progress. The section also has a visible heading with a standfirst and a progress rail.
- **Other beats.** AgentLog has an annotated chart (`art/LogDiagram.tsx`): the limit, the crunch weeks, and Week 12 highlighted when the "found" line arrives. Honesty has labelled icon rows, a one-Monday run strip and a hatched sample calendar. ToolBelt has four tiles, each with a small drawing, and a connector map (sample part to Gemini and MCP tools to Google Calendar, Google Drive and Microsoft Outlook) that uses the real logos from `BrandMark`. Close has the radar behind the watermark, the section links, and `TrademarkNote`. There is a new "Who it is for" beat (`Roles.tsx`).
- **Section links** (`SectionNav.tsx`, `sections.ts`, tested in `sections.test.ts`). Six links sit in the bar, or in a "Sections" menu below 1100 px (spring sheet; Escape and outside click close it; focus is trapped and returned to the button). The same links repeat in the footer. A click scrolls on an interruptible spring to the start of the section; for pinned sections that is the top of the tall wrapper. The scroll is instant under reduced motion. Focus then moves to the section heading. The jump never uses the browser's hash navigation, and `history.replaceState` is skipped when `VITE_HASH=1` (the HashRouter demo). The active link comes from an IntersectionObserver band 40% down the viewport (no scroll listener) and carries `aria-current="true"`. The landing bar stays sticky at every width.
- **Checks run** against `npm run dev:mock`. Screenshots at 1920x1080, 1440x900, 375x812, reduced motion with reduced transparency, and 960x540 (200% zoom). No horizontal overflow, no console errors, and no U+2013 or U+2014 in the page text. A click-through confirmed that each link lands at its section with the heading focused at 1920 and 375. Samples are in `screenshots/rich-*.png`.

## Pass 2 (2026-11-12): palette D, the weekly chart, the week overlay

**Palette D ("ink indigo", docs/BRAND.md)** replaces the lime and violet-glow look everywhere. The values live once, in the `@theme static` block of `src/index.css` (`bg #0a0b15`, `surface #0f101c`, `surface-2 #161827`, `tint rgba(165,175,255,.05)`, `line .12`, `line-2 .26`, `ink #eceefb`, `ink-2 #b8bcd8`, `mute #7e83a6`, `accent #8f94f5`, `accent-2 #7b84cf`, `crit #f2606a`, `good #7bd3b0`, `warn #e3b45c`, `hol #7cc4ee`, `vignette rgba(110,120,230,.10)`). `hero.css` keeps its `--pal-*` names as aliases of those tokens, so `landing.css` follows. Removed: every glow, the violet and lime background washes (one faint indigo vignette remains, plus the grain), gradient text, the lime button glow. The logo, favicon and theme colour match `docs/brand/logo.svg` and `icon.svg`. Top bar buttons and links are 44 px tall. The Pages banner is an amber note on the indigo ground.

Old-colour grep, run after the swap (`grep -rniE "c6f432|b3a1ff|ff3b3b|d8ff6a|ffc65c|08070e|7cd4ff|rgba\((198|179|104|150)," src index.html public`, excluding the test file that asserts the new ramp has no red): **0 hits**.

**Weekly load chart** (`LoadChart` in `src/components/charts.tsx`): one bar per week, dusty violet within the limit and coral over it, a dashed limit line labelled from the data ("limit 28 h", placed over the emptier end so it never covers a bar), value labels above (none under 1 h), W1 to W14 under the bars (every second week under 560 px, plus over-limit and holiday weeks), a sky dot under public-holiday weeks, light gridlines. No smoothing, glow, area fill or gradient. Bars rise on springs with a small stagger; reduced motion draws them in place. Kept: tooltip, one Tab stop with Left/Right/Home/End, Enter or a click opens the week, the "At other limits" chips, the legend (Within the limit, Over the limit, Public holiday week).

**Heat grid**: five indigo steps (near-surface, three dusty violet tints, dusty violet, periwinkle at the top); coral appears only in the Total row ("OVER" and over-limit totals). Week headers ("W11 15 Mar") and every cell are buttons that open the week.

**Week overlay** (`src/components/WeekOverlay.tsx`, data from `GET /api/week/{n}`; `api.week`, type `WeekDetail`, mock in `src/mock.ts` built from the mock's own plan so the Pages demo works). Shows the date range ("15 to 21 Mar"), the hours with "20.3 h over the 28 h limit" in coral or "within the 28 h limit" in mint, holiday, festive and revision notes, Due this week (module, title, type, weight, group, hours this week of the total, a lock for fixed test dates, the brief quote and a sky "found in a brief" tag for hidden tasks), Work building toward later deadlines, Hours by module as small bars that add up to the week, What the check noticed, and Moves touching this week with status tags and a link to Moves to approve. Opened from a grid cell, it highlights that module's rows. Behaviour: grows on a spring out of the pressed element and shrinks back into it; under 768 px it is a bottom sheet that slides up, can be dragged down, and closes downward; translucent blurred backdrop (solid under reduced transparency or more contrast); reduced motion gives a short cross-fade; `role="dialog"`, `aria-modal`, labelled by the "Week n" heading; focus starts on Close, is trapped, and returns to the trigger; Escape and a click outside close it; previous and next buttons and the Left and Right keys move between weeks (answers are cached); skeleton while loading, inline error with Retry.

**Brand marks**: the GEMINI badge carries the Gemini mark on a neutral chip; Gemini, Google Calendar, Google Drive and Outlook named in the copy use `<Brand />`; `TrademarkNote` sits in the app footer and the link-page footer.

**Checks** (`node scripts/pass2.mjs <base> <outDir>`, run against the mock on :5199 and the real backend on :8800 serving `dist`):

| Check | Result |
| --- | --- |
| `npm run build`, `npm test` (57 unit tests incl. chart ramp, overlay helpers, mock `/api/week/11`, brand srcs), `npm run build:pages` | PASS (build:pages last run at 00:00 on 2026-11-13; the lead runs the final static-demo build) |
| Overlay e2e: open from a header, a cell and a bar at 1280 and 375; date range, over-limit line, hidden-task tag; module highlight from a cell; focus trapped after 12 Tabs; Left/Right move weeks; Next button; Escape and click outside close; focus returns to the trigger | PASS (mock and real backend) |
| Old colours, em or en dashes in visible strings, glows (`text-shadow`, `drop-shadow`, blur filters, gradient text) | PASS: 0 hits in `src` (the only dash is inside a test regex that checks for dashes) |
| Contrast AA | PASS, see the table below |
| `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more` (emulated, overlay open) | PASS |
| 200% zoom (640 px at scale 2) | PASS: no horizontal page scroll; overlay opens as a bottom sheet |
| Top bar: every link and button at least 44 px | PASS at 1280 and 375 on both servers (including the landing section links) |
| Overlay on an approved move (`node scripts/pass2-moves.mjs`): approve `/approve/demo` through the app, then open weeks 11 and 13 | PASS on the mock: both show "Approved, Move SWAT Architecture report from Week 11 to Week 13". Not run on :8800, which was kept read-only for this pass (approving there changes the shared demo state) |
| Console errors | PASS on the mock. Exception on :8800: one expected 404 from `GET /api/approve/demo`, because the "demo" token exists only in the mock; the page shows its "unknown link" state. `/` and `/app` load with no 4xx or 5xx |

Screenshots: `screenshots/pass2-*.png`.

## Contract gaps the UI works around

- **Extension form needs assessment ids.** `GET /api/student` items have no `id`, but `POST /api/extensions` needs `assess_id`. The UI reads an optional `id` on `due[]` and `marks_per_hour[]` items (the mock sends it). Please add `id` to those items in the backend.
- **`GET /api/extensions` item shape** is only "list with draft and status". The UI also shows `mod`, `title`, `due`, `days`, `reason`, `personal_hours`, `created` when present.
- **Extension status after override** is shown for `overridden` (or `override`).

## Design checks

Run on 2026-11-12 against the mock (`scripts/checks.mjs`, `scripts/shoot.mjs`, a keyboard script, greps). Screenshots in `screenshots/`.

| Rule | Result |
| --- | --- |
| Landing hero matches the original | PASS: compared `screenshots/original-1280.png` (old `index.html`, top 700 px) with `screenshots/landing-1280.png` in the same Chromium. Same pill bar, eyebrow with lime dot, gradient "before", lede, chips, 2x2 tiles, CRUNCH watermark. Differences: the logo bar has one "Open the app" button instead of tabs, the fourth tile is "Waiting for a person", the semester chip uses a hyphen |
| Look in the app (palette D) | PASS: one faint indigo vignette and the film grain, tinted panels, pill buttons, stat tiles, heat cells with hours, Best fix card, mail cards, flow chips, toast. No glows, no washes, no gradient text |
| Press feedback: `:active` scale 0.97, 100 ms | PASS (`pressable`, `btn`, `cta`, sidebar items, email rows) |
| Springs (`bounce:0, duration:0.35`), interruptible | PASS: page enter, sidebar active pill (`layoutId`), drawer, email row expand, toast, chart tooltip. Count-up on stat tiles once, interrupted counts jump to the real number |
| Spatial consistency | PASS: the drawer enters from the left and leaves to the left; email bodies grow from their row; the toast rises from the bottom and drops back |
| Drawer: focus trap, Escape, focus return | PASS, keyboard run: first focus "Close the menu", focus stayed inside for 16 Tab presses and Shift+Tab, Escape closed it and focus returned to "Open the menu" |
| Keyboard-only sidebar | PASS: Tab order is skip link, logo, Run Monday check, the seven items in workflow order, Back to the landing page; Enter on Approvals opened `/app/approvals`. Chart weeks: one Tab stop, Left/Right/Home/End move, tooltip follows focus |
| Materials | PASS: sidebar, app top bar and the week overlay backdrop are translucent with blur; panels below are not blurred |
| `prefers-reduced-motion` | PASS, emulated on `/` and `/app`: transforms dropped (`MotionConfig reducedMotion="user"`), counts shown at once, press scale and hover lifts off |
| `prefers-reduced-transparency` | PASS, emulated: bar, sidebar and the overlay backdrop are solid (`backdrop-filter: none`), grain hidden |
| `prefers-contrast: more` | PASS, emulated: solid bar and sidebar, stronger lines, brighter muted text, outlined active item |
| 200% zoom | PASS: 640 CSS px at scale 2, no horizontal page overflow on `/`, `/app`, `/app/check`, `/approve/demo`. Text-only 200%: no page overflow |
| No em or en dashes | PASS: `grep -P "[\x{2013}\x{2014}]" src index.html scripts` finds nothing (the original "Jan-Apr" en dash became a hyphen) |
| No emoji, Phosphor only, one weight | PASS. The hand-made chart and grid mark holiday weeks with a small sky dot; the logo is the brand SVG; Google, Microsoft and Gemini products show their real logos (`BrandMark`) |
| Radius scale lock | PASS: bar 3, chip 6, cell 10, field 12, inset 16, card 20, hero 28, pill full (`@theme`) |
| Colour lock | PASS: periwinkle is the action, links, active and focus; dusty violet is structure and bars; coral only for overload (and Rejected / Declined per BRAND.md); mint for approved and within the limit; amber for waiting and sample; sky for holidays and hidden tasks |
| Contrast (WCAG AA) | PASS, computed: periwinkle button with `#0a0b15` text 7.21:1, coral on the ground 6.21:1 (5.99:1 on a panel), mint 11.00:1, muted text 5.30:1, dusty violet 5.64:1, amber 9.85:1, sky 9.89:1 |
| Forms: label above, help, inline error below | PASS on every form |
| Feedback in four kinds, skeletons, composed empty states, retry | PASS on every page |
| No login | PASS: no `/login`, no key form, no cookie code; 401 shows the locked state |
| Honesty | PASS: Sample data pill in the sidebar, top bar and link pages; "Sample data" chip in the hero; GEMINI / RULES badges; expiry times |
| Exceptions kept on purpose | The CRUNCH watermark stays as quiet ink at 8.5 percent (user-approved). The landing page has "Open the app" twice (top bar and closing strip). Small-caps labels on stat tiles follow BRAND.md. Run trigger strings from the backend may contain a middle dot |

Bundle note: `motion` and Phosphor bring the production JS to about 575 kB (about 180 kB gzip).

## Screenshots

`screenshots/` holds the final shots taken against the mock (1280 px, 375 px, the three emulated media queries and 200% zoom). `node scripts/checks.mjs` re-runs the media, zoom and contrast checks. `node scripts/shoot.mjs [baseUrl] [outDir]` re-takes every page at 1280 px and the key pages at 375 px with headless Chromium (needs `playwright-core`; set `PW_CORE` and `CHROME`) and reports console errors and horizontal overflow.
