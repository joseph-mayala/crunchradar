# CrunchRadar brand sheet

One page, so the demo page, the system screens, the deck and the video all look like the same product.

## What it is
**Name:** CrunchRadar
**One line:** Spots crunch weeks before students hit them, and fixes them with a human in the loop.
**Personality:** calm, exact, plain. It warns early and never panics. It never acts alone.

## Voice
- Plain words. Say "move the deadline", not "optimise the schedule".
- Always say who decides: "Nothing changes until you decide."
- Say what is sample: "Sample data" stays visible on every screen and slide that shows numbers.
- Numbers carry units and a source: "48 h", "limit 28 h (MQA 40 h per credit, minus two assumptions)".
- No hype words (revolutionary, seamless, AI-powered). Say what it does.

## Logo
**Concept:** a "C" for Crunch built from two radar arcs. The gap in the C is where the radar needle passes, and the needle ends in one lime dot: the overloaded week it found. Monogram plus meaning, with the construction shown in `board.png` panel 2 (outer arc R 26, inner arc R 15, gap ±32°, needle −12° on a 64-unit grid).

| File | Use |
| --- | --- |
| `docs/brand/logo.svg` | Primary mark, for dark backgrounds |
| `docs/brand/logo-light.svg` | Same mark for light backgrounds (darker violet and lime) |
| `docs/brand/icon.svg` | App icon and favicon (rounded square) |
| `docs/brand/board.png`, `board.html` | The one-page brand board (render of the HTML) |

Rules: keep clear space of one outer-ring stroke width. Do not recolour the needle or the dot. The wordmark is "CrunchRadar" in Inter Tight 800, one word, capital C and R, tight tracking. At 16 px and below use `icon.svg`; the inner arc drops out and the C, needle and dot still read.

## Colour
Near-black ground, white type, lime for "go" and for the one thing to look at, lavender for structure, red only for real overload.

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#08070e` | Page ground |
| `ink` | `#f5f5f6` | Main text |
| `ink-2` | `#c9c9cf` | Body copy |
| `mute` | `#85858f` | Captions, axis labels |
| `accent` (lime) | `#c6f432` | Primary action, "within limit", the logo dot |
| `accent-2` (lavender) | `#b3a1ff` | Chart bars, links, structure |
| `crit` | `#ff3b3b` | Over the limit. Nothing else is red |
| `warn` | `#ffc65c` | Waiting for a person, assumptions |
| `hol` | `#7cd4ff` | Holidays and hidden tasks found in briefs |

Rules: one lime element per screen area; red means overload only; amber means "a human is needed or this is an assumption". Never rely on colour alone, always add a word or an icon.

## Type
Chosen because they already ship in the demo page, are free, and stay readable on projectors and in recordings.
- Display and headings: **Inter Tight**, 700 to 800, tight tracking.
- Body: **Inter**, 400 to 600.
- Numbers, weeks and tags: **JetBrains Mono**.
- If the fonts do not load, fall back to the system sans so a recording never breaks.

## Components
- **Stat tile:** label in small caps, one big number, unit in grey.
- **Status tag:** `Completed` lime, `Needs review` amber, `Rejected` and `Declined` red, `Expired` grey.
- **Agent badge:** `GEMINI` lavender or `RULES` amber, always shown next to a run. The fallback is never hidden.
- **Approval card:** the move in one line, the reason in one sentence, two buttons. Approve is lime. Reject is outlined.

## On slides and video
Dark slides, one idea each, one number or screenshot per slide. Lime only on the one thing to look at. Show the sample-data label on any slide with numbers.

## Do not
- Add gradients to text beyond the existing hero.
- Use red for anything but overload.
- Hide that the data is a sample, or that a person approves.
