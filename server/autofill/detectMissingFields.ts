/**
 * PHASE 3 — detectMissingFields.ts
 *
 * Inspects a lead record and produces structured missing-field lists.
 * All flag values are defined as const — no free strings.
 *
 * Three tiers:
 *   critical  → blocks analysis entirely if missing
 *   important → weakens analysis quality if missing
 *   optional  → cosmetic / nice-to-have
 */

import type { InsertLead } from "../../drizzle/schema";

// ─── Const-defined flag values ────────────────────────────────────────────────

export const CRITICAL_FIELDS = ["verifiedPhone", "companyName", "city"] as const;
export const IMPORTANT_FIELDS = ["website", "instagramUrl", "businessType"] as const;
export const OPTIONAL_FIELDS = ["district", "tiktokUrl", "facebookUrl"] as const;

export type CriticalMissingFlag = (typeof CRITICAL_FIELDS)[number];
export type ImportantMissingFlag = (typeof IMPORTANT_FIELDS)[number];
export type OptionalMissingFlag = (typeof OPTIONAL_FIELDS)[number];
export type MissingFieldFlag = CriticalMissingFlag | ImportantMissingFlag | OptionalMissingFlag;

export type MissingFieldsResult = {
  criticalMissing: CriticalMissingFlag[];
  importantMissing: ImportantMissingFlag[];
  optionalMissing: OptionalMissingFlag[];
  /** Combined list for DB storage: criticalMissing + importantMissing */
  missingDataFlags: MissingFieldFlag[];
};

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Inspects the lead and returns structured missing-field lists.
 * Does NOT write to the database — caller is responsible for persisting.
 */
export function detectMissingFields(lead: Partial<InsertLead>): MissingFieldsResult {
  const criticalMissing: CriticalMissingFlag[] = [];
  const importantMissing: ImportantMissingFlag[] = [];
  const optionalMissing: OptionalMissingFlag[] = [];

  for (const field of CRITICAL_FIELDS) {
    if (isEmpty(lead[field as keyof InsertLead])) {
      criticalMissing.push(field);
    }
  }

  for (const field of IMPORTANT_FIELDS) {
    if (isEmpty(lead[field as keyof InsertLead])) {
      importantMissing.push(field);
    }
  }

  for (const field of OPTIONAL_FIELDS) {
    if (isEmpty(lead[field as keyof InsertLead])) {
      optionalMissing.push(field);
    }
  }

  const missingDataFlags: MissingFieldFlag[] = [...criticalMissing, ...importantMissing];

  return { criticalMissing, importantMissing, optionalMissing, missingDataFlags };
}
