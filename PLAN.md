# Plan

A searchable pocket guide to playing golf shots and situations — the leaflet you got as a kid,
rebuilt for the web and later a native app. Working name: **Shotbook**. Entries are called
**situations** ("Downhill lie", "Into the wind", "First-tee nerves"), each answering
*how do I play this?*

## Principles

- **Static first.** No database or server. Content is Markdown in git; the site is built and
  deployed to GitHub Pages on every push to `main`.
- **Content is the product.** Short, scannable, mainstream advice that works for beginners and
  low handicappers alike. No fringe theories, no swing-method wars.
- **Write once, render twice.** Content and shot visualisations live in shared packages so the
  native app reuses them instead of re-implementing them.
- **Findable in seconds.** Search by name, by symptom ("ball above my feet"), by synonym, and
  browse by category.

## Architecture

```
content/situations/*.md     Source of truth: one situation per file (schema in AGENTS.md)
packages/content            Zod schema, loader, validation, build → situations.json + search index
packages/shot-viz           Declarative ShotScene format + 2D SVG renderer
apps/web                    Astro static site (React islands for interactive viz)
apps/mobile                 Expo / React Native app (later)
```

- **Web:** Astro (static output, zero JS by default), Tailwind, React islands only where needed.
- **Search:** MiniSearch over the generated JSON, client-side. Same index and code in web and app.
- **Visualisations:** each situation can reference a `ShotScene` — a plain JSON description of
  slope, lie, stance, ball position, swing and ball flight, plus short plain-language tips. The
  renderer turns it into a 2D SVG diagram (works in React Native via `react-native-svg`) from
  camera presets (face-on, down-the-line, behind, overhead). Readers see words ("carries shorter,
  rolls out more"), not launch-monitor numbers. 3D is dropped for now (prototype in git history).
- **Hosting:** GitHub Pages via GitHub Actions. Heavy assets (images, animations) stay small
  and in-repo at first; if they outgrow that we move them to object storage (e.g. Cloudflare R2)
  — **ask before setting up any external service**.
- **App data:** the app bundles `situations.json` at build time and can later fetch a newer copy
  from the site (`/data/situations.json`) for over-the-air content updates.

## Steps

Each step is its own session and PR. PRs are merged only after the owner approves.

| # | Step | Depends on | Delivers |
|---|------|-----------|----------|
| 1 | **Web foundation & deploy** ✅ | — | pnpm monorepo, `packages/content` (schema, validation, JSON export), Astro site with home, category and situation pages, CI (lint, typecheck, test, content validation), auto-deploy to GitHub Pages |
| 2 | **Initial content library** ✅ | schema in AGENTS.md | ~30 situations across all categories, reviewed for tone and accuracy — done: 34 situations, every category covered |
| 3 | **Shot visualisation v1** ✅ | — | `packages/shot-viz` (done; see its README): ShotScene types, 2D SVG renderer (face-on & down-the-line), 3D prototype (since removed: 2D only for now); standalone demo page |
| 4 | **Search, browse & viz integration** ✅ | 1, 2, 3 | MiniSearch search with synonyms and instant results, category/tag browsing, related situations, viz embedded on situation pages, scenes for the top situations — done: prebuilt index at `/data/search-index.json` (both hands), `/search/` and `/tags/` pages, static handed diagrams with Play swing / step-through on situation pages, 23 situations with scenes |
| 5 | **Polish & reach** (PWA and SEO ✅) | 4 | PWA/offline, SEO and share images, print-friendly "leaflet" view, accessibility pass, performance budget — done so far: web manifest and icons, a build-generated service worker that precaches the whole site (pages, CSS, fonts, `/data/*.json`) so search and every situation work offline, new cache per deploy; per-page canonical, Open Graph and Twitter tags, a share image per situation plus a site default (satori, at build time), `sitemap-index.xml` and `robots.txt`. Still open: print "leaflet" view, accessibility pass, performance budget |
| 6 | **Animated golfer** (on hold: 2D only for now) | 3 | Rigged, animated golfer (glTF) driven by ShotScene (setup → swing → impact → flight), scrubbable timeline |
| 7 | **Native app** | 4 (6 optional) | Expo app (iOS/Android): offline content, search, favourites, 2D viz natively; EAS build pipeline |
| 8 | **Visual regression** ✅ | 3, 4 | Screenshot tests for pages and viz renderers in CI — done: Happo custom integration over every built page and scene, partial runs on PRs, agents flag unrelated diffs as flakes (see AGENTS.md) |

Steps 1, 2 and 3 run in parallel now. The rest start as their dependencies merge.

## Open questions

- Final product name and domain (GitHub Pages works on `*.github.io` until then).
- The repo is private: GitHub Pages from a private repo needs a paid GitHub plan. If Pages can't
  be enabled, the options are making the repo public or another static host (ask first).
- PR preview deployments need something beyond Pages (e.g. Cloudflare Pages / Netlify) — ask
  before adding.
- CI on PRs is paused for throughput; checks run locally instead. Re-enable it (restore the
  `pull_request` / `push` triggers in `.github/workflows/ci.yml`) once several people or agents
  merge in parallel or `main` breaks, and consider making the `check` job required then.
- How far to take the golfer: stylised mannequin vs. motion-captured realism.
