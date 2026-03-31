/**
 * PHASE 3 — fillCoreFields.ts
 *
 * Fills basic business identity fields from a DiscoveryCandidate.
 * Rule: fill-only-if-empty — never overwrites an existing value.
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import type { InsertLead } from "../../drizzle/schema";
import { normalizeName } from "../lib/identityLinkage";

export type CoreFieldsFillResult = {
  fieldsUpdated: string[];
  patch: Partial<InsertLead>;
};

/**
 * Returns a patch object with only the fields that were empty and can now be filled.
 * Does NOT write to the database — caller is responsible for persisting.
 */
export function fillCoreFields(
  current: Partial<InsertLead>,
  candidate?: DiscoveryCandidate
): CoreFieldsFillResult {
  const patch: Partial<InsertLead> = {};
  const fieldsUpdated: string[] = [];

  if (!candidate) return { fieldsUpdated, patch };

  // companyName — from businessNameHint or nameHint
  if (!current.companyName) {
    const hint = candidate.businessNameHint || candidate.nameHint;
    if (hint) {
      patch.companyName = hint.trim();
      fieldsUpdated.push("companyName");
    }
  }

  // businessType — from categoryHint
  if (!current.businessType && candidate.categoryHint) {
    patch.businessType = candidate.categoryHint.trim();
    fieldsUpdated.push("businessType");
  }

  // city — from cityHint
  if (!current.city && candidate.cityHint) {
    patch.city = candidate.cityHint.trim();
    fieldsUpdated.push("city");
  }

  // district — from regionHint
  if (!current.district && candidate.regionHint) {
    patch.district = candidate.regionHint.trim();
    fieldsUpdated.push("district");
  }

  // normalizedBusinessName — always recompute from final companyName
  const finalName = patch.companyName ?? current.companyName;
  if (finalName) {
    const normalized = normalizeName(finalName);
    if (normalized !== current.normalizedBusinessName) {
      patch.normalizedBusinessName = normalized;
      if (!fieldsUpdated.includes("normalizedBusinessName")) {
        fieldsUpdated.push("normalizedBusinessName");
      }
    }
  }

  return { fieldsUpdated, patch };
}
