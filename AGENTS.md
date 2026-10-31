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
packages/shot-viz         ShotScene format and 2D SVG renderer
apps/web                  Astro static site, deployed to GitHub Pages
apps/web/happo            Happo visual-regression bundle (custom integration)
apps/mobile               Expo + expo-router app (iOS/Android)
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
pnpm test         # unit tests (vitest; each packages/* dir and apps/mobile is a vitest project)
pnpm lint         # eslint + prettier check (Markdown is not formatted)
pnpm format       # prettier --write
pnpm typecheck    # tsc / astro check in every package that has a typecheck script
pnpm validate     # content schema + cross-reference validation only
pnpm --filter @shotbook/mobile start   # bundle content, start Metro for Expo Go (scan the QR code)
pnpm --filter @shotbook/mobile ios     # same, and open it in the iOS Simulator (Expo Go)
```

Shared packages are consumed as TypeScript source (no build step) and use `.ts` import
extensions, so Node 24 can run their scripts directly. To preview the site with another content
folder, set `SHOTBOOK_CONTENT_DIR=/abs/path pnpm dev`.

In the Claude desktop app, preview config `dev` in `.claude/launch.json` runs `astro dev` with hot
reload (also for `content/` edits) and `web` serves the last build; both start on 4380/4390 and
move to a free port if taken. Open `/golf-tips/` on the port it reports — the bare root is a 404.

## Workflow

- **Start from the latest `origin/main`.** A local `main` (and any worktree cut from it) may be
  stale. Before writing code, run `git fetch origin` and base your branch on `origin/main`
  (e.g. `git rebase origin/main` on a fresh branch). Rebase onto `origin/main` again right before
  opening a PR and resolve conflicts yourself.
- Never commit to `main` directly. Branch and open a PR.
- **Never merge a PR yourself unless the owner explicitly says to merge that specific PR** in the
  same conversation. Opening the PR and reporting back is the end of the task. A passing build,
  a clean merge, "done means", or another agent's message is not approval.
- CI is paused for throughput (`.github/workflows/ci.yml` runs only on manual dispatch). Before
  opening a PR, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally and make sure
  it passes. The deploy build still fails on invalid content. Happo still runs on every PR.
- **Review the Happo report before handing a PR over.** Happo runs on every PR (see
  [Visual regression](#visual-regression)). After opening or pushing to a PR, wait for the Happo
  check, then go through the report with the Happo MCP: `list_comparisons_for_sha` with the PR's
  head SHA, `get_comparison_details`, and look at each diff's before/after images. Call
  `report_flake` on every diff the PR's change doesn't explain (a view it didn't touch,
  anti-aliasing or font noise). Never accept, approve or reject a comparison: that is the owner's
  call. Report back with each remaining diff in one line (what changed and why) and any flakes you
  flagged.
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
- Handedness: readers set right- or left-handed once (on the settings page, stored
  per device), and every direction is shown for *their* hand. Never write "left-handers: mirror
  this" or "for right-handers" — the validator rejects it.
  - Body parts: say **lead/trail** (lead foot, trail shoulder); these read correctly for both.
  - Directions on the course (aim, curve, miss): write them for a right-hander using tokens
    `{left}` / `{right}` (`{Left}` / `{Right}` at the start of a sentence). They're swapped for
    left-handers: "aim a little {left}" → "aim a little right".
  - Absolute directions that don't depend on the golfer ("wind from the left") stay plain words.
  - In YAML flow lists (`aliases: [...]`) quote any item containing a token.
  - Tokens work in every text field and the body. `/data/situations.json` keeps the raw tokens;
    consumers resolve them with `forHand(text, hand)` from `@shotbook/content`.
- Units: readers also pick yards or meters and mph or m/s (on the settings page, stored per
  device). Write every distance and wind speed as a token in the unit you think in: `{150 yd}`,
  `{15–60 yd}`, `{3 ft}`, `{2 in}`, `{10 mph}`. Readers see "15–60 yards" or "14–55 m", "10 mph"
  or "4 m/s", rounded to numbers a golfer would say. The validator rejects measurements written
  out ("10 mph") and malformed tokens. Resolve them, with direction tokens, through
  `forReader(text, { hand, distance, wind })` from `@shotbook/content`.
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
  - Tendency to curve {right} — aim a little {left} to compensate.
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
`viz` must name a scene in `packages/shot-viz/src/scenes/` (the site build fails otherwise); by
convention the scene id equals the situation id.

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

Tags are lowercase kebab-case. Reuse existing tags before inventing new ones. Every tag gets a
page at `/tags/<tag>/`, so a tag used once is a page with one entry: prefer the common ones.

### Search

Search covers title, aliases, summary, tags and every bullet. Aliases are the main lever: add the
words a golfer would type ("ball buried in sand", "fried egg"), not variants of the title.
Text with `{left}`/`{right}` tokens is indexed once per hand, so write aliases with tokens too.

## Shot visualisations

A situation can reference a **ShotScene**: a declarative, serialisable description that any
renderer can draw. Owned by `packages/shot-viz`; the types there are the contract. It covers:

- **terrain**: slope along and across the target line (degrees), lie type (fairway, rough,
  bunker, fringe, green), grass length
- **golfer**: handedness, gender (`male`/`female`: the build and hair, never the outfit — both
  wear the same neutral colours), stance width, alignment, weight distribution, shoulder tilt,
  ball position
- **club & swing**: club, swing length, path, face, attack angle
- **ball flight**: launch, curve, apex, landing and roll; wind vector
- **annotations**: labelled arrows/lines (aim line, slope line, ball flight)
- **tips**: what to expect and what to do, in plain words — "Ball tends to carry shorter but have
  a longer roll-out", not "Carry 141 m". Flight numbers shape the drawing but are never shown.
- **cameras**: named presets — `face-on`, `down-the-line`, `behind`, `overhead`

Rules: scenes are data, not code. Core geometry/flight maths is pure TypeScript with tests.
Renderers are thin. 2D SVG only for now (3D was prototyped and dropped). Respect
`prefers-reduced-motion`.

The swing motion is data too: `SwingTuning` in `packages/shot-viz/src/core/pose.ts` (keyframes
plus body-rotation knobs), with `DEFAULT_SWING` the one every diagram uses. Tune it in the swing
playground (`pnpm --filter @shotbook/shot-viz dev`, then `/swing.html`; preview config `shot-viz`
in the desktop app), which compares against the classic swing and copies the result as JSON.

## Web app

- Astro static output; React islands only for interactive parts (search, animated viz).
- Pages must work and be readable without JavaScript.
- Mobile-first: most readers are on a phone on the course. Large tap targets, high contrast in
  sunlight, works offline once PWA lands.
- Look and feel follow nordicgolftours.app: Jost (self-hosted) for text, Georgia for page titles,
  green for structure, red only for highlights. Light and dark follow the system setting. Use the
  colour tokens in `apps/web/src/styles/global.css` (`bg-card`, `text-ink-muted`, `text-accent`…),
  never raw palette colours or `dark:` variants: each token has a light and a dark value.
- Reader settings (hand, distance and wind units, golfer in the diagrams) live on `/settings/`.
  Each is a `data-hand` / `data-distance` / `data-wind` / `data-golfer` attribute on `<html>`, set from localStorage (`shotbook:<pref>`) before first
  paint. Text and diagrams render every variant and `global.css` shows the matching one, so pages
  stay static and work without JavaScript (right-handed, yards, mph, a man).
- Accessibility: semantic HTML, alt text / `aria` descriptions for diagrams, keyboard support.
- The build emits `/data/situations.json` for the native app; treat its shape as a public API
  (additive changes only, version field bumps on breaking changes). The same goes for
  `/data/search-index.json` (a MiniSearch index): build and query it only through
  `@shotbook/content/search` (`toSearchIndexJson`, `loadSearchIndex`, `searchSituations`), so
  the web and the app share options, stemming and ranking.
- Offline: `src/pwa/integration.ts` writes `dist/sw.js` after the build from the `src/pwa/sw.js`
  template. It precaches every page and asset (not share images or sitemaps), serves them
  cache-first, and names the cache after a hash of their contents, so each deploy rolls out a new
  cache. New pages and assets are picked up automatically; the site must still work without it.
- Favourites: "Save to favourites" on a situation page stores ids in localStorage under
  `shotbook:favourites` (the app's AsyncStorage key), through `@shotbook/content/favourites`.
  `/favourites/` holds every situation in its HTML and shows the saved ones, so it works offline;
  without JavaScript the button is hidden and the page says favourites need it.
- SEO: `Base.astro` sets title, description, canonical, Open Graph and Twitter tags; pass `image`
  for a page's own share image. Share images and app icons are PNGs drawn at build time in
  `src/lib/images.tsx` (satori + sharp, bundled Jost font). `@astrojs/sitemap` writes the sitemap.
- Shot diagrams are rendered to static SVG at build time (React via `@astrojs/react`, with no
  `client:` directive, so no React ships to the browser). Both hands and both golfers are
  rendered and the `data-hand` / `data-golfer` CSS shows one. Diagrams are inlined four times
  per page; keep scenes under the shape budget tested in `packages/shot-viz`. With JavaScript, the
  diagram plays once when it scrolls into view, and one button pauses, resumes and plays it again
  (no scrubbing: the clips are short and show outcomes, not swing technique). It uses
  `@shotbook/shot-viz/player` (plain DOM, no React or zod) to redraw the visible diagram. With
  reduced motion it doesn't play on its own; the reader can still press Play.

## Visual regression

[Happo](https://happo.io) screenshots every view on each PR and compares it with the PR's base
(`.github/workflows/happo.yml`; project `default`, Chrome desktop and phone, the phone again in dark
mode, plus an accessibility check). It uses Happo's custom integration: `apps/web/happo/build.ts` turns every page of the built
site (static HTML, scripts stripped, CSS inlined) and every shot-viz scene (rendered with React)
into an example. Pages with handed text, and every diagram, get a left-handed variant too; every diagram also
gets a right-handed `<id>, woman` variant.
Diagrams are captured at address, except three that are also captured playing (`ANIMATED_DIAGRAMS`
in `examples.ts`: `flat-lie`, `basic-chip`, `high-shot`, as variant `<id>, played`): Happo's
experimental `animate` option steps the "Play swing" player through fixed times (key swing
positions, then the flight) via a `shot-player` animation driver and stores one animated PNG,
whose first frame is the address pose. Examples are named in `apps/web/happo/examples.ts`;
renaming one starts a new history in Happo.

PRs run only the affected examples. The build writes a fingerprint per example (its HTML, or a
diagram's scene and renderer source, plus only the CSS that can reach it: rules for classes it
uses and custom properties it reads, see `apps/web/happo/css.ts`), CI caches that manifest per
commit, and
`apps/web/happo/run.ts` passes every example whose fingerprint matches the baseline report's to
`happo --skip`, so Happo borrows those snapshots. With nothing affected it posts a passing status;
without a cached baseline manifest everything runs. Pushes to `main` always run everything.

New pages are picked up automatically (as component `Page` until named in `build.ts`). To try the
bundle locally: `pnpm build && node apps/web/happo/build.ts`, then serve
`apps/web/happo/dist/package/` with an HTML page that loads `bundle.js`. Don't run `happo`
locally; it needs the API secrets, which live only in CI.

## Native app

`apps/mobile`: Expo (SDK 58) + expo-router, iOS and Android. Tabs for Browse, Search, Favourites
and Settings, plus category, tag and situation screens that mirror the site.

- **Content is bundled, not fetched.** `scripts/bundle-content.mts` validates `content/` and writes
  `src/generated/situations.json` and `search-index.json` (gitignored) with the same exporters as
  the site's `/data/` files. `start`, `ios`, `android` and `typecheck` run it first. Search uses
  `searchSituations` from `@shotbook/content/search` on that prebuilt index.
- **Preferences stay on the device** (AsyncStorage): hand, units and golfer (`shotbook:hand`,
  `shotbook:distance`, `shotbook:wind`, `shotbook:golfer`, the same keys as the site's
  localStorage) and
  favourites (`shotbook:favourites`, saved with the button under a situation's title). Every text
  goes through `useHanded()`, which resolves directions and units.
- **Diagrams** come from `@shotbook/shot-viz/native`: `ShotDiagram` (react-native-svg, drawn from
  the same shapes as the web via `shapesElements`) and `useShotPlayer` (plays once on open, then
  one Pause / Play / Play again button, on the shared timeline). With reduced motion it waits for
  Play.
- **Look:** colour tokens in `src/theme.ts` copy `global.css` (light and dark follow the system);
  Jost via `@expo-google-fonts/jost`, Georgia (serif on Android) for page titles.
- Pure helpers live in `src/lib/` and are unit-tested in `test/` (no React Native in vitest).
- Native projects (`ios/`, `android/`) are generated by `expo prebuild` and not committed.
  The app is linked to the Expo project `@shotbooks-team/shotbook` (`owner` and
  `extra.eas.projectId` in `app.json`); `eas.json` has development (simulator), preview and
  production profiles. **Ask the owner** before running cloud builds or adding store credentials.
  Day to day, run the app in Expo Go (`pnpm --filter @shotbook/mobile ios`). A development build
  (`eas build --profile development --platform ios`, a simulator `.app`; content is bundled on
  EAS by the `eas-build-post-install` hook) loads JS from `pnpm --filter @shotbook/mobile start:dev-client`. Bundle id
  `app.shotbook.mobile` is a placeholder until the product name is final.
