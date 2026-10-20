# 🐝 Meadowlight

A cozy voxel meadow where you plant flowers, keep bees, and learn real
pollinator ecology along the way. No fail states, no time pressure — if you
do nothing at all, the meadow quietly thrives anyway.

![Meadowlight screenshot](docs/screenshot.png)

## What it is

Meadowlight is a browser-based, fully client-side bee-farm building toy.
Plant a drift of lavender, place a skep hive, add a bee bath with safe
pebble perches, and watch the meadow come alive as bees forage between
your flowers. Everything is built from little boxes — no image assets, no
downloaded models — and every mechanic maps to a real pollinator-ecology
principle. Click anything and your field notebook shares a genuine,
warmly-phrased fact (one in three bites of food depends on pollinators;
more than 70% of bee species live alone; a single mason bee can do the
pollinating of roughly 100 honeybees).

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL. That's the whole setup — Meadowlight runs
entirely in your browser and saves your meadow to localStorage.

## Controls

| Input | Action |
|---|---|
| **Left-click** (tool selected) | place the selected flower / structure |
| **Left-click** (no tool) | inspect — opens the field notebook |
| **Right-click** (tool selected) | deselect the tool first |
| **Right-click** (no tool) | remove the flower / structure under the cursor |
| **Left-drag** | zoom |
| **Right-drag** | orbit the camera |
| **Middle-drag** | pan |
| **R** | rotate the placement ghost |
| **F** | natural placement (random rotation/tilt) on/off |

Extras in the corner: 🔊 sound toggle (off by default), 📷 postcard (saves a
PNG of your meadow), and **?** for the controls reminder. The season dial
(spring → winter) shows bloom succession — a single-species meadow visibly
runs out of food. The time row beneath it pauses the world (a ⏸ chip shows
when) or runs it at 1×–8×.

## The living meadow (v2)

- **Seasons drift by on their own** (spring → winter, ~12 minutes each).
  Leave for the afternoon and you'll come back mid-season — never
  punished, never "you missed it." The manual dial stays if you want to
  jump ahead, and a soft underline shows how far the season has come.
- **Some flowers love company.** Plant the right pair as neighbors and
  the notebook learns a garden recipe — borage beside cosmos, lavender
  with thyme. Recipes only ever reward; anything else is simply two
  flowers minding their own business.
- **The hive fills with honey** as your bees forage. When the comb glows
  full, click it for a jar — the notebook keeps the tally, and a real
  beekeeping fact comes with the harvest. The bees always keep a share:
  they're residents, not machines.
- **A day passes while you garden** — golden hour fades to dusk, fireflies
  rise, and rain sends the bees home to wait it out.

## The wild meadow (v3)

- **The meadow seeds itself.** Well-fed flowers quietly volunteer
  seedlings nearby, easing off at about 15% self-grown so your plantings
  always matter. Saves from earlier versions load exactly as they were.
- **The same world replays the same way.** What grew today grows the same
  tomorrow — the meadow keeps its own calendar.
- **Wild visitors drop by in season.** A great big queen bumble hums
  through spring, lavender moths flutter at summer dusk, fireflies crowd
  warm evenings, and dragonflies dart over the pond — each with its own
  notebook page and a real fact behind it.
- **The hive breathes with the year.** The swarm rises through spring,
  holds its gentle summer hum, and settles into a snug winter cluster
  around the queen — cozy, never in decline.
- **Habitat grows where flowers can't.** Bushes, rocks, ferns and a
  fallen log claim the stony ground beyond the plantable meadow and fade
  out toward the hills — the corners aren't empty anymore.
- **Time waits for you.** Pause and the world truly holds its breath;
  run at 1×–8× if you'd rather watch the seasons turn.
- **The sky turns.** Stars fade in with dusk — brightest in winter, when
  the nights are longest — and clouds veil softly, never blocking the light.

## Developing

```bash
npm run dev         # dev server
npm run test:smoke  # unit tests + typecheck + production build gate
npm run test:unit   # engine unit tests only
npm run build       # tsc --noEmit && vite build
npm run test:perf   # in-app perf harness (press P, then the stress button)
```

The simulation lives in pure, unit-tested modules under `src/engine/`;
rendering reads world state from `src/render/`. Tuning values (colors,
speeds, spawn rates) live in `src/data/` — never in components.
`?demo=1` (dev build only) plants a curated meadow for instant demos.

## Embedding & deploying

Meadowlight builds to a fully static `dist/` folder:

```bash
npm run build
```

- **Any host, any subpath.** Assets use relative paths (`base: './'`), so
  `dist/` works at a domain root, a subfolder, GitHub Pages, or itch.io
  ZIP hosting without rebuilding.
- **No page scroll, any aspect ratio.** The canvas fills the viewport and
  resizes with its container (already `overflow: hidden` on `html/body`);
  iframe-embed with `width: 100%; height: 100%` and it tracks the frame.
- **Saves in embeds.** Same-origin embedding (or hosting the built folder
  yourself) preserves saves normally. Third-party iframe embeds may be
  served **storage-partitioned** localStorage by modern browsers, meaning
  each embedding site gets its own save slot — saves won't follow the
  player across sites, and the meadow boots fresh there. Nothing breaks;
  nothing syncs.
- **Sharing.** The `og:image` tag is absolute-URL-ready: it points at
  `https://meadowlight.example/og-image.png` (1200×630) — swap in the real
  deployment origin at deploy time and drop a real-GPU screenshot at
  `/og-image.png`. No other og tag needs touching.
- **Embed checklist (re-run, session 6 deploy unit).** Verified headlessly in an iframe
  at 1280×300, 480×900, 600×600, and 914×391: canvas fills the frame
  exactly, zero horizontal/vertical scroll, zero console errors, fonts
  self-hosted (no runtime fetch). Known gap: the palette panel clips in
  frames narrower than ~700px (#33) — mobile/touch layout is parked until
  the world + chrome finalize.

## Deploying

The repo ships a GitHub Pages workflow (`.github/workflows/deploy-pages.yml`):
on every push to `main` it runs the smoke gate, builds `dist/`, and publishes
it to GitHub Pages. Enable it once in **Settings → Pages → Source: GitHub
Actions**; the site then serves at the default Pages URL.

**Post-deploy step (documented, not done yet):** point the portfolio
subdomain at the Pages URL (a `CNAME` file in `dist` + your DNS CNAME record),
then swap the og:image placeholder origin in `index.html` and drop the
real-GPU `/og-image.png` at the deploy origin.

## Credits

Built with [three.js](https://threejs.org), React, and a fondness for bees.
