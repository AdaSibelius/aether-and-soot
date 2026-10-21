import { z } from 'zod';
import { EntityIdSchema } from './primitives.schema.js';

export const EmitSquadCalloutCommandSchema = z.object({
  type: z.literal('EMIT_SQUAD_CALLOUT'),
  actorId: EntityIdSchema,
  targetId: EntityIdSchema,
  alertMessage: z.string().default('Intruder spotted! Rally to me!'),
});
export type EmitSquadCalloutCommand = z.infer<typeof EmitSquadCalloutCommandSchema>;

export const ReportCrimeCommandSchema = z.object({
  type: z.literal('REPORT_CRIME'),
  witnessId: EntityIdSchema,
  perpetratorId: EntityIdSchema,
  crime: z.enum(['THEFT', 'ASSAULT', 'TRESPASS']),
});
export type ReportCrimeCommand = z.infer<typeof ReportCrimeCommandSchema>;

export const WitnessCommandSchema = z.discriminatedUnion('type', [
  EmitSquadCalloutCommandSchema,
  ReportCrimeCommandSchema,
]);
export type WitnessCommand = z.infer<typeof WitnessCommandSchema>;
