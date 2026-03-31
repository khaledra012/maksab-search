/**
 * PHASE 3 — fillDigitalAssets.ts
 *
 * Fills social/digital platform URL fields from a DiscoveryCandidate.
 * Rule: fill-only-if-empty — never overwrites an existing value.
 *
 * Naming consistency:
 *   - schema field: twitterUrl  (NOT xUrl)
 *   - DiscoverySource value: "x" (NOT "twitter")
 *   - Mapping is explicit: source "x" → twitterUrl field
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import type { InsertLead } from "../../drizzle/schema";

export type DigitalAssetsFillResult = {
  fieldsUpdated: string[];
  patch: Partial<InsertLead>;
};

/**
 * Maps DiscoverySource values to their corresponding schema field names.
 * Explicit mapping to prevent naming drift between types and schema.
 */
const SOURCE_TO_FIELD: Record<string, keyof InsertLead> = {
  instagram: "instagramUrl",
  x: "twitterUrl",          // DiscoverySource "x" → schema field "twitterUrl"
  tiktok: "tiktokUrl",
  snapchat: "snapchatUrl",
  facebook: "facebookUrl",
  linkedin: "linkedinUrl",
  maps: "googleMapsUrl",
};

/**
 * Returns a patch object with only the digital asset fields that were empty and can now be filled.
 * Does NOT write to the database — caller is responsible for persisting.
 */
export function fillDigitalAssets(
  current: Partial<InsertLead>,
  candidate?: DiscoveryCandidate
): DigitalAssetsFillResult {
  const patch: Partial<InsertLead> = {};
  const fieldsUpdated: string[] = [];

  if (!candidate || !candidate.url) return { fieldsUpdated, patch };

  const fieldName = SOURCE_TO_FIELD[candidate.source];
  if (!fieldName) return { fieldsUpdated, patch };

  // fill-only-if-empty
  if (!current[fieldName]) {
    (patch as Record<string, unknown>)[fieldName] = candidate.url;
    fieldsUpdated.push(fieldName);
  }

  return { fieldsUpdated, patch };
}
