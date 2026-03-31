/**
 * PHASE 3 — autofill/index.ts
 *
 * Orchestrates the full autofill pipeline for a single lead.
 *
 * Pipeline steps:
 *   1. fetchLead(leadId)
 *   2. fillCoreFields
 *   3. fillContactFields
 *   4. fillDigitalAssets
 *   5. detectMissingFields
 *   6. computeAnalysisReadiness
 *   7. updateLead() with merged patch + readiness fields
 *
 * Observability:
 *   - Structured log on success: [AUTOFILL] lead_id=N filled=X missing=Y readiness=Z
 *   - Structured log on failure: [AUTOFILL] lead_id=N failed: <message>
 *   - NOT a silent void — caller must handle the returned promise
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import { fillCoreFields } from "./fillCoreFields";
import { fillContactFields } from "./fillContactFields";
import { fillDigitalAssets } from "./fillDigitalAssets";
import { detectMissingFields } from "./detectMissingFields";
import { computeAnalysisReadiness } from "./computeAnalysisReadiness";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type AutoFillResult = {
  leadId: number;
  fieldsUpdated: string[];
  missingCount: number;
  readinessState: string;
  confidenceScore: number;
  /** In-memory only — NOT persisted in PHASE 3 */
  candidatePhones: string[];
  candidateEmails: string[];
  candidateWebsites: string[];
};

/**
 * Runs the full autofill pipeline for a lead.
 * Returns AutoFillResult with structured observability data.
 * Throws on unrecoverable errors — caller must handle via .catch().
 */
export async function runAutofill(
  leadId: number,
  candidate?: DiscoveryCandidate
): Promise<AutoFillResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 1. Fetch current lead state
  const rows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!rows.length) throw new Error(`Lead not found: ${leadId}`);
  const current = rows[0];

  // 2–4. Fill fields
  const coreResult = fillCoreFields(current, candidate);
  const contactResult = fillContactFields({ ...current, ...coreResult.patch }, candidate);
  const assetsResult = fillDigitalAssets({ ...current, ...coreResult.patch, ...contactResult.patch }, candidate);

  // Merge all patches
  const mergedPatch = {
    ...coreResult.patch,
    ...contactResult.patch,
    ...assetsResult.patch,
  };

  // 5. Detect missing fields on the post-fill state
  const postFillState = { ...current, ...mergedPatch };
  const missingResult = detectMissingFields(postFillState);

  // 6. Compute readiness
  const readiness = computeAnalysisReadiness(missingResult);

  // 7. Build final DB patch
  const dbPatch = {
    ...mergedPatch,
    missingDataFlags: missingResult.missingDataFlags,
    analysisReadyFlag: readiness.analysisReadyFlag,
    analysisConfidenceScore: readiness.confidenceScore,
    partialAnalysisFlag: readiness.partialAnalysisFlag,
  };

  // Only write if there is something to update
  const hasChanges = Object.keys(dbPatch).length > 0;
  if (hasChanges) {
    await db.update(leads).set(dbPatch).where(eq(leads.id, leadId));
  }

  const allUpdatedFields = [
    ...coreResult.fieldsUpdated,
    ...contactResult.fieldsUpdated,
    ...assetsResult.fieldsUpdated,
    "missingDataFlags",
    "analysisReadyFlag",
    "analysisConfidenceScore",
    "partialAnalysisFlag",
  ];

  return {
    leadId,
    fieldsUpdated: allUpdatedFields,
    missingCount: missingResult.missingDataFlags.length,
    readinessState: readiness.state,
    confidenceScore: readiness.confidenceScore,
    candidatePhones: contactResult.candidatePhones,
    candidateEmails: contactResult.candidateEmails,
    candidateWebsites: contactResult.candidateWebsites,
  };
}
