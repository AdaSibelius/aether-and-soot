import { z } from 'zod';
import { Point2D, Point2DSchema, StratumIdSchema } from '../../schemas/primitives.schema.js';
import { Box } from './block-geometry.js';

export const SpatialAnomalyTypeSchema = z.enum([
  'BUILDING_OVERLAP',
  'BLOCKED_DOORWAY',
  'WALL_COLLISION',
  'DISCONNECTED_PATHWAY',
  'BUILDING_ROAD_COLLISION',
  'ORPHAN_DOOR',
  'SEALED_DISTRICT_EDGE',
  'UNRECIPROCATED_SEAM',
]);
export type SpatialAnomalyType = z.infer<typeof SpatialAnomalyTypeSchema>;

export const AnomalySeveritySchema = z.enum(['FATAL', 'ERROR', 'WARNING']);
export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;

export const SpatialAnomalySchema = z.object({
  id: z.string().min(1),
  type: SpatialAnomalyTypeSchema,
  severity: AnomalySeveritySchema,
  position: Point2DSchema,
  targetId: z.string().optional(),
  description: z.string().min(1),
});
export type SpatialAnomaly = z.infer<typeof SpatialAnomalySchema>;

export const SpatialCorrectionActionSchema = z.enum([
  'CLEAR_DOORWAY',
  'FLIP_DOORWAY',
  'STITCH_PATHWAY',
  'RESTORE_ROAD',
  'NUDGE_BUILDING',
  'SEAL_POCKET',
]);
export type SpatialCorrectionAction = z.infer<typeof SpatialCorrectionActionSchema>;

export const SpatialCorrectionLogSchema = z.object({
  action: SpatialCorrectionActionSchema,
  position: Point2DSchema,
  targetId: z.string().optional(),
  details: z.string().min(1),
});
export type SpatialCorrectionLog = z.infer<typeof SpatialCorrectionLogSchema>;

export const BoundingBoxSchema = z.object({
  x1: z.number().int(),
  y1: z.number().int(),
  x2: z.number().int(),
  y2: z.number().int(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const PlacedBuildingSurveySchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  archetypeId: z.string().min(1),
  bounds: BoundingBoxSchema,
  entrancePoints: z.array(Point2DSchema),
  outwardPoints: z.array(Point2DSchema),
  doors: z.record(z.string(), Point2DSchema),
  keyPositions: z.record(z.string(), Point2DSchema).default({}).optional(),
});
export type PlacedBuildingSurvey = z.infer<typeof PlacedBuildingSurveySchema>;

export const SurveyLayersSchema = z.object({
  terrain: z.array(z.string()),
  architecture: z.array(z.string()),
  fixtures: z.array(z.string()),
  zoning: z.array(z.string()),
  circulation: z.array(z.string()),
  anomalyHeatmap: z.array(z.string()),
});
export type SurveyLayers = z.infer<typeof SurveyLayersSchema>;

export const SpatialSurveySheetSchema = z.object({
  districtId: z.string().min(1),
  stratum: StratumIdSchema,
  seed: z.number().int(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  layers: SurveyLayersSchema,
  anomalies: z.array(SpatialAnomalySchema),
  corrections: z.array(SpatialCorrectionLogSchema),
});
export type SpatialSurveySheet = z.infer<typeof SpatialSurveySheetSchema>;

export interface AnomalyAuditSummary {
  readonly totalAnomalies: number;
  readonly fatalCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly isClean: boolean;
}

export function createPlacedBuildingSurvey(
  id: string,
  templateId: string,
  archetypeId: string,
  bounds: Box,
  entrancePoints: readonly Point2D[],
  outwardPoints: readonly Point2D[],
  doors: Readonly<Record<string, Point2D>>,
  keyPositions?: Readonly<Record<string, Point2D>>,
): PlacedBuildingSurvey {
  return {
    id,
    templateId,
    archetypeId,
    bounds: { x1: bounds.x1, y1: bounds.y1, x2: bounds.x2, y2: bounds.y2 },
    entrancePoints: [...entrancePoints],
    outwardPoints: [...outwardPoints],
    doors: { ...doors },
    keyPositions: keyPositions ? { ...keyPositions } : {},
  };
}

export function summarizeAnomalies(anomalies: readonly SpatialAnomaly[]): AnomalyAuditSummary {
  let fatalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  for (const a of anomalies) {
    if (a.severity === 'FATAL') fatalCount++;
    else if (a.severity === 'ERROR') errorCount++;
    else if (a.severity === 'WARNING') warningCount++;
  }
  return {
    totalAnomalies: anomalies.length,
    fatalCount,
    errorCount,
    warningCount,
    isClean: anomalies.length === 0,
  };
}
