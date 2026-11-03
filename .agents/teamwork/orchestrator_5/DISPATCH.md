## 2026-11-02T22:56:27Z

Evolve the Aether & Soot world into a continuous, cohesive world by updating district dimensions, building layouts, and visual representation, implement a visual testing and spatial self-correction system inspired by Fallout: New York survey sheets, and re-evaluate the 4-step testing process and local model token efficiency.

Working directory: /Users/emmett/Desktop/Game
Integrity mode: development

Context & Reference Material:
- Repository: https://github.com/AdaSibelius/aether-and-soot
- Previous Milestone Implementation (commits `ecea285`, `0a9c9bb`, `b430cfc`, `75f668a`): building templates, 48x36 urban district generation, multi-layer projection, and strata portals.
- Fallout: New York Reference: Spatial survey sheets combining top-down layout maps with multi-layer/perspective comparisons to detect and self-correct layout placement errors (overlapping structures, doors opening into walls, or disconnected paths).
- Existing test scripts: `npm run verify` (`tsc --noEmit`, `check-boundaries.ts`, `validate-data.ts`, `vitest run`).

## Requirements

### R1. Continuous World Evolution: Districts, Layouts, and Visual Representation
Evolve procedural generation, district boundaries, and building character so the world forms a continuous environment rather than disconnected discrete zones. Update district sizing, inter-district connectivity or streaming, building templates, and visual representation to reflect seamless transitions and consistent Victorian Steampunk spatial character.

### R2. Visual Testing and Spatial Survey Sheet Self-Correction
Implement a visual testing system based on spatial survey sheets (inspired by the Fallout: New York methodology). The system must capture top-down spatial layouts and layer views to programmatically detect and self-correct placement errors, including building overlaps, blocked doorways, wall collisions, and disconnected pathways.

### R3. 4-Step Testing Process & Local Model Token Audit
Re-evaluate the project's 4-step verification and testing pipeline to verify that test and critic feedback is actionable. Conduct a token efficiency audit comparing local Ollama model usage against operation without local models, and provide concrete recommendations or adjustments based on the findings.

## Acceptance Criteria

### Continuous World & District Evolution
- [ ] Procedural world generation supports expanded or interconnected district layouts that eliminate isolated map boundaries and provide continuous spatial navigation.
- [ ] Building templates and architectural character maintain consistent Victorian Steampunk fixtures, zoning, and multi-stratum transitions across districts.
- [ ] All spatial changes preserve headless determinism and pass navigation/walkability validation across multiple seeds.

### Visual Testing & Survey Sheet Self-Correction
- [ ] Visual survey-sheet testing utility generates top-down layout and projection snapshots from simulation state.
- [ ] Automated spatial self-correction or assertion checks detect and flag or resolve building-road collisions, doors facing walls, and disconnected pathways.
- [ ] Headless test suite includes automated visual/spatial regression checks for generated districts.

### Testing Pipeline & Local Model Efficiency
- [ ] Re-evaluation report or audit document analyzes the 4-step verification workflow and provides objective token usage metrics comparing local model runs against alternatives.
- [ ] Any modifications to verification scripts or model workflows maintain strict test coverage and zero regression in `npm run verify`.
- [ ] Full verification suite (`npm run verify`) passes with zero errors (typecheck, boundary checks, data validation, and simulation tests).
