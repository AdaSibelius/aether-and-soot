## 2026-11-01T18:36:21Z

Act as Principal UI/UX Architect to execute an interface utility overhaul and Dear ImGui feasibility study for Aether & Soot, modifying the codebase directly to deepen the Edison-era mechanical aesthetic and authoring a clinical Architectural Decision Record (ADR).

Working directory: /Users/emmett/Desktop/Game
Integrity mode: development

## Requirements

### R1. Phase 1: Utility and Aesthetic Refinement
Analyze the current DOM/Canvas UI implementation and implement code changes directly in the repository to improve functional utility and deepen the "Edison-era mechanical" aesthetic (Caves of Qud style, zero Pip-Boy tropes). Provide implementation covering:
- Information Density: Restructure the HUD to display thermodynamic stress states, inventory, and character health using diegetic ASCII gauges and heavy block framing.
- Visual Hierarchy: Apply the oxidized iron palette to create clear depth separation between the tactical map, log window, and status readouts.
- Shader Compositing: Ensure the UI layer cleanly overlays or interacts with existing WebGL shaders (aether bloom, volumetric smoke) without degrading text readability on 4K HDR displays.

### R2. Phase 2: Dear ImGui Evaluation
Generate a clinical Architectural Decision Record (ADR) evaluating a migration from the current UI pipeline to Dear ImGui (via WebAssembly/bindings). The ADR must address:
- ECS Integration: Technical friction of mapping existing Entity Component System (ECS) data to an Immediate Mode GUI paradigm.
- Rendering Pipeline: How ImGui will bind to the existing WebGL context and handle custom post-processing shaders.
- Aesthetic Compatibility: Exact custom styling and font rendering overhead required to force ImGui to match the heavy ASCII/Victorian terminal aesthetic.
- Token/Performance Cost: Complexity of maintaining ImGui bindings in this specific AI-assisted codebase.

### R3. Output Format
Present the Phase 1 UI code changes first, followed by the Phase 2 clinical ADR, without introductory fluff.

## Acceptance Criteria

### UI Utility & Aesthetic Implementation
- [ ] Code changes for Phase 1 are implemented directly in the repository.
- [ ] HUD displays thermodynamic stress states, inventory, and character health using diegetic ASCII gauges and heavy block framing.
- [ ] Tactical map, log window, and status readouts have visual depth separation using the oxidized iron palette.
- [ ] UI overlays or interacts with WebGL shaders (aether bloom, volumetric smoke) while maintaining readable text at 4K resolution.
- [ ] Repository verification checks (`npm run verify`) pass with zero errors.

### Dear ImGui Architectural Decision Record
- [ ] ADR contains a dedicated section analyzing ECS data mapping friction to an Immediate Mode GUI paradigm.
- [ ] ADR contains a dedicated section evaluating WebGL context binding and custom shader compositing feasibility.
- [ ] ADR contains a dedicated section quantifying custom styling and font rendering overhead for the Victorian ASCII aesthetic.
- [ ] ADR contains a dedicated section evaluating maintenance complexity and token/performance costs for this AI-assisted codebase.
- [ ] Final output delivers Phase 1 code changes first followed by the Phase 2 ADR with zero introductory fluff.
