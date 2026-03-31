/**
 * PHASE 3 — computeAnalysisReadiness.ts
 *
 * Computes a deterministic analysis readiness state from missing-field results.
 *
 * PHASE 3 CONSTRAINT:
 *   analysisConfidenceScore is a simple derivative of missing-field counts only.
 *   It is NOT a scoring model. Formula:
 *     score = (totalFields - criticalMissing*2 - importantMissing) / totalFields
 *   Clamped to [0, 1].
 *
 * No AI, no audit, no opportunity extraction.
 */

import type { MissingFieldsResult } from "./detectMissingFields";
import { CRITICAL_FIELDS, IMPORTANT_FIELDS, OPTIONAL_FIELDS } from "./detectMissingFields";

export type AnalysisReadinessState =
  | "ready_for_analysis"
  | "partially_analyzable"
  | "missing_critical_data"
  | "not_analyzable";

export type AnalysisReadinessResult = {
  state: AnalysisReadinessState;
  /** Simple derivative of missing-field counts — NOT a scoring model */
  confidenceScore: number;
  analysisReadyFlag: boolean;
  partialAnalysisFlag: boolean;
};

const TOTAL_FIELDS = CRITICAL_FIELDS.length + IMPORTANT_FIELDS.length + OPTIONAL_FIELDS.length;

/**
 * Computes readiness state from missing-field results.
 * Fully deterministic — no external calls, no AI.
 */
export function computeAnalysisReadiness(missing: MissingFieldsResult): AnalysisReadinessResult {
  const { criticalMissing, importantMissing } = missing;
  const criticalCount = criticalMissing.length;
  const importantCount = importantMissing.length;

  // Determine state
  let state: AnalysisReadinessState;
  if (criticalCount >= 3) {
    state = "not_analyzable";
  } else if (criticalCount >= 1) {
    state = "missing_critical_data";
  } else if (importantCount >= 2) {
    state = "partially_analyzable";
  } else {
    state = "ready_for_analysis";
  }

  // Confidence score — simple derivative of missing-field counts only
  const penalty = criticalCount * 2 + importantCount;
  const rawScore = (TOTAL_FIELDS - penalty) / TOTAL_FIELDS;
  const confidenceScore = Math.max(0, Math.min(1, rawScore));

  const analysisReadyFlag = state === "ready_for_analysis";
  const partialAnalysisFlag = state === "partially_analyzable";

  return { state, confidenceScore, analysisReadyFlag, partialAnalysisFlag };
}
