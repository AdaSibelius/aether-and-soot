---
trigger: glob
globs: "src/client/**, **/*.css"
description: "Diegetic Edison UI and Caves of Qud ergonomic standards for presentation shell."
---

# UI & Presentation Guardrails (Edison Diegetic & Caves of Qud Ergonomics)

## 1. Absolute Headless Separation
- Never import from `src/sim/` directly into `src/client/` to mutate state. All mutations flow through `dispatchCommand(state, command)`.
- Never import `pixi.js`, `preact`, `window`, `document`, or DOM APIs into `src/sim/` or `src/schemas/`.

## 2. Glyph Atlas Integrity & Zero Truncation
- Every character rendered into a `UiCellBuffer` MUST be registered in `ATLAS_GLYPHS` (`src/client/renderer/glyph-atlas.ts`). Unmapped glyphs fall back to `'?'`, which violates visual standards.
- Never hardcode raw snake_case blueprint or district identifiers (`item_*`, `district_*`, `mat_*`). Always route through `resolveCatalogDisplayName(type, id)`.
- Enforce strict width limits: never allow text strings to collide with borders, spill past column 85, or overwrite navigation footers.

## 3. Caves of Qud Dual-Pane Keyboard Ergonomics
- Windows (`[I]` Satchel, `[A]` Anatomy, `[C]` Artificer Workbench) must support synchronized dual-pane keyboard navigation (`Left`/`Right`/`Up`/`Down`/`Enter`) without requiring mouse travel.
- Keep immediate tactical survival metrics (Structural Sanguine %, Boiler Pressure kPa, Governor Strain kW) persistent on the peripheral HUD.
- Critical combat state changes (`SCALD!`, `ARMOR CRACKED!`, `BREACH!`) must float directly over map tiles.

## 4. Visual Contrast & Accessibility (WCAG >= 4.5:1)
- Maintain contrast >= 4.5:1 between foreground ink and background panels.
- Do not rely solely on color for danger states: pair vital bars with distinct geometric glyphs (`♦` Sanguine, `⚙` Boiler, `▲` Thermal, `⚡` Strain).
