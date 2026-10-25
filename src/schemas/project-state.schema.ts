import { z } from 'zod';

export const PhaseStatusSchema = z.enum([
  'COMPLETED',
  'IN_PROGRESS',
  'SCOPED_AND_PREPPED',
  'PLANNED',
  'DEFERRED',
  'BACKLOG',
]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const RoadmapPhaseSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  status: PhaseStatusSchema,
  tier: z.string().min(1),
  summary: z.string().min(1),
  details: z.array(z.string()).default([]),
  targetFiles: z.array(z.string()).default([]),
  verificationTest: z.string().optional(),
});
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;

export const ModularityHotspotSchema = z.object({
  file: z.string().min(1),
  lines: z.number().int().nonnegative(),
  threshold: z.number().int().positive().default(230),
  status: z.enum(['SAFE', 'NEAR_CAP', 'EXCEEDED']).default('SAFE'),
});
export type ModularityHotspot = z.infer<typeof ModularityHotspotSchema>;

export const GovernancePrescriptionSchema = z.object({
  id: z.string().min(1),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  category: z.string().min(1),
  title: z.string().min(1),
  directive: z.string().min(1),
  targetFiles: z.array(z.string()).min(1),
  verification: z.string().min(1),
  citedMetricKey: z.string().optional(),
});
export type GovernancePrescription = z.infer<typeof GovernancePrescriptionSchema>;

export const CommitRecordSchema = z.object({
  hash: z.string().min(1),
  message: z.string().min(1),
});
export type CommitRecord = z.infer<typeof CommitRecordSchema>;

export const ProjectStateSchema = z.object({
  version: z.literal(1).default(1),
  lastUpdated: z.string().min(1),
  activePhase: z.number().int().positive(),
  immediateNextPriority: z.string().min(1),
  recentCommits: z.array(CommitRecordSchema).default([]),
  phases: z.array(RoadmapPhaseSchema).min(1),
  hotspots: z.array(ModularityHotspotSchema).default([]),
  prescriptions: z.array(GovernancePrescriptionSchema).default([]),
  criticScore: z.number().int().min(0).max(100).optional(),
});
export type ProjectState = z.infer<typeof ProjectStateSchema>;
