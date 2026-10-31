# AGENTS.md

Guidance for anyone (human or agent) working in this repo. Read [PLAN.md](PLAN.md) for the
roadmap and the reasoning behind it.

## What this is

**Shotbook** (working name): a searchable guide to playing golf shots and situations — uphill
lies, wind, thick rough, first-tee nerves, chip vs. putt. Static website first, native app later,
both fed from the same Markdown content and shared TypeScript packages.

## Repo layout

```
content/situations/*.md   One situation per file — the source of truth
packages/content          Schema (zod), loader, validator, JSON + search-index export
packages/shot-viz         ShotScene format and renderers (2D SVG, 3D three.js)
apps/web                  Astro static site, deployed to GitHub Pages
apps/mobile               Expo app (not yet created)
```

- Package manager: **pnpm** workspaces (`apps/*`, `packages/*`). Node 24.
- TypeScript everywhere, `strict: true`. ES modules.
- Shared packages must stay platform-neutral: no DOM or Node-only APIs in core code, so the
  native app can import them. Platform-specific code goes in clearly separated entry points
  (e.g. `@shotbook/shot-viz/web`, `@shotbook/shot-viz/native`).
- Package scope: `@shotbook/*`.

## Commands

Run from the repo root (defined in step 1 of the plan; keep this list current):

```
pnpm install
pnpm dev          # web dev server
pnpm build        # validate content, then build the site to apps/web/dist
pnpm test         # unit tests (vitest; each packages/* dir is a vitest project)
pnpm lint         # eslint + prettier check (Markdown is not formatted)
pnpm format       # prettier --write
pnpm typecheck    # tsc / astro check in every package that has a typecheck script
pnpm validate     # content schema + cross-reference validation only
```

Shared packages are consumed as TypeScript source (no build step) and use `.ts` import
extensions, so Node 24 can run their scripts directly. To preview the site with another content
folder, set `SHOTBOOK_CONTENT_DIR=/abs/path pnpm dev`.

## Workflow

- Never commit to `main` directly. Branch, open a PR, and **ask the owner before merging**.
- CI must pass: lint, typecheck, test, content validation, build.
- Merges to `main` deploy automatically to GitHub Pages. Don't add manual deploy steps.
- **Ask before** adding any paid or external service (hosting, storage, analytics, CMS, etc.).
- Keep PRs focused on one plan step. Update PLAN.md when a step is done or the plan changes.
- Prefer few, well-known dependencies. No database.

## Content

### Voice and substance

- Mainstream, widely agreed advice — what most good teaching professionals would say. Avoid
  controversial methods, named swing systems, and absolutes ("always", "never") unless truly
  universal.
- Works for a beginner and a scratch player. Lead with the fundamental; put refinements under
  `advanced` notes rather than in the main steps.
- Short and scannable. Imperative voice ("Play the ball slightly back"). Each bullet ≤ ~20 words.
  It should fit on a card you could read between shots.
- Handedness-neutral: say **lead/trail** (lead foot, trail shoulder) instead of left/right. When
  direction matters, state it for right-handers and add "(left-handers: mirror this)" once.
- Explain the *why* in one line where it helps ("the slope delofts the club, so the ball comes
  out lower").
- Include safety where relevant (e.g. lightning in storms, slippery stances).
- Write original text. Never copy from books, magazines or websites.
- British or American spelling is fine; be consistent within a file (default: American).

### File format

`content/situations/<id>.md` — the filename (without `.md`) is the `id`. IDs are stable forever
(the app deep-links to them); never rename without adding a redirect.

```markdown
---
title: Downhill lie
summary: Ball on a slope running down toward the target — expect a lower, running shot.
category: lies
tags: [slope, ball-position, balance]
aliases: [hitting down a slope, ball on a downslope, downhill stance]
level: all                # all | beginner | advanced
clubs: [irons, hybrids]   # optional: driver, woods, hybrids, irons, wedges, putter
setup:
  - Tilt your shoulders to match the slope.
  - Play the ball a little back of normal, toward the higher foot.
  - Put more weight on your lead foot and keep it there.
swing:
  - Swing along the slope — chase the ball down the hill.
  - Make a controlled, slightly shorter swing to stay balanced.
expect:
  - Lower flight and more roll than normal.
  - Tendency to miss toward the trail side — aim a little to compensate.
mistakes:
  - Leaning back to "help" the ball up, which causes thin or fat shots.
club_choice: Take one club less; the slope adds loft-reducing effect and roll.
drill: Optional — one short practice drill.
advanced: Optional — refinements for better players.
related: [uphill-lie, ball-above-feet, ball-below-feet]
viz: downhill-lie         # optional ShotScene id in packages/shot-viz
updated: 2026-10-31
---

Optional short body (1–3 short paragraphs) for context that doesn't fit the lists.
```

Required: `title`, `summary` (≤ 140 chars), `category`, `tags`, `setup` or `swing` (at least
one), `expect`, `updated`. Everything else is optional. `related` must reference existing ids.

Categories (fixed list — add new ones only via a PR that updates this file and the schema):

| id | covers |
|----|--------|
| `lies` | slopes, ball above/below feet, divots, hardpan, tight lies |
| `trajectory` | high, low, draw, fade, punch, stinger |
| `short-game` | chips, pitches, lobs, bump-and-run, chip vs. putt |
| `bunkers` | greenside, fairway, plugged, wet sand |
| `rough-and-trouble` | thick grass, trees, recovery shots, hazards |
| `putting` | reading greens, lag, short putts, speed |
| `conditions` | wind, rain, cold, heat, firm/soft ground |
| `mental` | nerves, routine, focus, recovering from a bad hole |
| `strategy` | course management, club selection, aiming |

Tags are lowercase kebab-case. Reuse existing tags before inventing new ones.

## Shot visualisations

A situation can reference a **ShotScene**: a declarative, serialisable description that any
renderer can draw. Owned by `packages/shot-viz`; the types there are the contract. It covers:

- **terrain**: slope along and across the target line (degrees), lie type (fairway, rough,
  bunker, fringe, green), grass length
- **golfer**: handedness, stance width, alignment, weight distribution, shoulder tilt, ball
  position
- **club & swing**: club, swing length, path, face, attack angle
- **ball flight**: launch, curve, apex, landing and roll; wind vector
- **annotations**: labelled arrows/lines (aim line, slope line, ball flight)
- **cameras**: named presets — `face-on`, `down-the-line`, `behind`, `overhead`

Rules: scenes are data, not code. Core geometry/flight maths is pure TypeScript with tests.
Renderers are thin. 2D must work without WebGL; 3D is progressive enhancement and must not block
page load (lazy-load it). Respect `prefers-reduced-motion`.

## Web app

- Astro static output; React islands only for interactive parts (search, 3D viz).
- Pages must work and be readable without JavaScript.
- Mobile-first: most readers are on a phone on the course. Large tap targets, high contrast in
  sunlight, works offline once PWA lands.
- Accessibility: semantic HTML, alt text / `aria` descriptions for diagrams, keyboard support.
- The build emits `/data/situations.json` for the native app; treat its shape as a public API
  (additive changes only, version field bumps on breaking changes).

## Native app (later)

Expo + expo-router. Imports `@shotbook/content` data and `@shotbook/shot-viz`. Bundles content for
offline use. Don't design shared packages in ways that block this.
