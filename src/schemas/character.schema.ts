import { z } from 'zod';
import { BlueprintIdSchema, StratumIdSchema } from './primitives.schema.js';

export const ProfessionIdSchema = z.enum([
  'DISGRACED_CHIRURGEON',
  'FOUNDRY_ARTIFICER',
  'CLOCKWORK_VETERAN',
  'AETHER_SMUGGLER',
]);
export type ProfessionId = z.infer<typeof ProfessionIdSchema>;

export const TraitIdSchema = z.enum([
  'NIGHT_OPTICS',
  'BOILER_HEART',
  'PACK_MULE',
  'IRON_FISTS',
  'CARTEL_CONNECTIONS',
  'TINKER_SAVANT',
]);
export type TraitId = z.infer<typeof TraitIdSchema>;

export const ScenarioIdSchema = z.enum([
  'SPITALFIELDS_FOUNDRY_ROW',
  'BELGRAVIA_SKY_WALK',
  'FLEET_DITCH_SUMP',
]);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const CharacterCreationConfigSchema = z.object({
  name: z.string().min(1).optional(),
  professionId: ProfessionIdSchema,
  traitIds: z.array(TraitIdSchema).max(2).default([]),
  scenarioId: ScenarioIdSchema,
  seed: z.number().int().optional(),
});
export type CharacterCreationConfig = z.infer<typeof CharacterCreationConfigSchema>;

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly name: string;
  readonly description: string;
  readonly districtId: z.infer<typeof BlueprintIdSchema>;
  readonly stratum: z.infer<typeof StratumIdSchema>;
}
