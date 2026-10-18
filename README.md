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
runs out of food.

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

## Credits

Built with [three.js](https://threejs.org), React, and a fondness for bees.
