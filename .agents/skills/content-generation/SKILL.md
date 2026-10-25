---
name: content-generation
description: >-
  Procedures for zero-token local content generation of materials, consumables,
  prosthetics, and districts with Zod validation and deduplication in Aether & Soot.
---

# Declarative Game Content Generation (Aether & Soot)

This skill provides guidelines and commands for expanding declarative blueprints, game items, materials, cybernetics, and districts in `data/` using local models at zero paid API token cost.

---

## 1. Zero Paid Token Invariant

- **Rule 1.3**: Do NOT use paid Gemini output context tokens to hand-write large bulk JSON records in `data/`.
- Use the local content generator (`npm run generate:content`) or local Ollama Tier 3 endpoint (`hermes3:8b` @ `http://localhost:11434/v1/chat/completions`).
- Content generator script: `tests/scripts/hermes-content-generator.ts`.
- Content normalizers & Zod coercers: `tests/scripts/hermes-content-normalizers.ts`.

---

## 2. Supported Blueprint Types & Targets

| Content Type | Flag `--type` | Target File in `data/` | Validating Zod Schema |
| :--- | :--- | :--- | :--- |
| **Materials** | `materials` | `data/items/materials.json` | `ItemBlueprintSchema` |
| **Consumables** | `consumables` | `data/items/materials.json` | `ItemBlueprintSchema` (with `useEffect`) |
| **Prosthetics** | `prosthetics` | `data/items/prosthetics.json` | `ProstheticBlueprintSchema` |
| **Districts** | `districts` | `data/districts/*.json` | `DistrictBlueprintSchema` |
| **Gases / Fluids** | `gases` | `data/hazards/gases_and_fluids.json` | `GasFluidBlueprintSchema` |
| **Crafting Recipes** | `recipes` | `data/items/recipes.json` | `CraftingRecipeBlueprintSchema` |

---

## 3. CLI Invocations

### Live Generation via Local Ollama
Requires unsandboxed permission (`BypassSandbox: true` in Antigravity) to access `localhost:11434`:
```bash
# Generate 5 new steampunk materials
npm run generate:content -- --type materials --count 5

# Generate 3 new medical consumables with alchemical effects
npm run generate:content -- --type consumables --count 3

# Generate 2 new cybernetic prosthetics
npm run generate:content -- --type prosthetics --count 2
```

### Deterministic Offline Mode (Mock / CI)
For automated testing, CI, or when the local Ollama instance is not running:
```bash
npm run generate:content:mock -- --type materials
npm run generate:content:mock -- --type prosthetics
```

---

## 4. Blueprint Deduplication & Validation Rules

1. **Unique ID Enforcing**:
   The generator reads existing JSON entries and rejects any duplicate `id` or `blueprintId`. New IDs follow standard snake_case naming conventions:
   - Items/Materials: `mat_<slug>` or `item_<slug>`
   - Prosthetics: `prosthetic_<slug>`
   - Districts: `district_<slug>`
2. **Schema Validation Gate**:
   Every generated record is validated against its Zod schema before file writes. Any schema parsing error triggers immediate rejection and local retry.
3. **Automated Verification**:
   After appending content, always run the validation gate:
   ```bash
   npm run validate:data
   ```
