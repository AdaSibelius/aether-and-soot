---
trigger: model_decision
description: "Apply whenever authoring world lore, item descriptions, Markov corpora, or procedural dialogue."
---

# Lore & Procedural Narrative Standards

## 1. 1888 Gaslamp Science-Fiction Thematic Anchors
- All flavor text, blueprints, and barks must reflect late-19th-century Victorian industrialism colliding with Aetheric physics.
- Terminology anchors: Menlo Park electromagnetism, carbon-filament glow, pneumatic lathe conduits, vulcanized rubber gaskets, phosphor-bronze springs, Royal Society naturalist codices, and London syndicate politics.

## 2. Dynamic State Grounding
- Avoid generic static fantasy strings. Where possible, reference live simulation state: active district ID, stratum depth, current diurnal shift phase (`DAWN_WHISTLE`, `FOUNDRY_SHIFT`, `GASLIGHT_CURFEW`, `GRAVEYARD_WATCH`), and faction reputation standings.
- Randomized diagnostic compendiums (*Corpus Choliys* pattern) must dynamically bind treatment mixtures to seed-specific alchemy.

## 3. Zero Paid Token Content Rule
- Bulk declarative data in `data/` must be generated using local models via `npm run generate:content` or local Ollama endpoints rather than hand-authoring large JSON records in paid context tokens.
- All generated records must strictly validate against Zod schemas in `src/schemas/blueprint.schema.ts`.
