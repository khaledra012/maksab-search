/**
 * PHASE 3 — fillContactFields.ts
 *
 * Fills contact fields (phone, website) from a DiscoveryCandidate.
 *
 * CRITICAL RULE for verifiedPhone:
 *   Only fill from sources classified as "verified-capable":
 *   source === "maps" | "google" | "website"
 *   NEVER fill from social-only sources (instagram, x, tiktok, snapchat, facebook, linkedin).
 *   NEVER promote candidatePhones to verifiedPhone.
 *
 * candidatePhones / candidateEmails / candidateWebsites are returned in AutoFillResult
 * for in-memory use only — NOT persisted to DB in PHASE 3.
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import type { InsertLead } from "../../drizzle/schema";
import { normalizePhone } from "../lib/identityLinkage";

/** Sources that are considered verified-capable for phone numbers */
const VERIFIED_PHONE_ALLOWED_SOURCES: ReadonlyArray<string> = ["maps", "google", "website"];

export type ContactFieldsFillResult = {
  fieldsUpdated: string[];
  patch: Partial<InsertLead>;
  /** In-memory only — NOT persisted in PHASE 3 */
  candidatePhones: string[];
  candidateEmails: string[];
  candidateWebsites: string[];
};

/**
 * Returns a patch object with only the contact fields that were empty and can now be filled.
 * Does NOT write to the database — caller is responsible for persisting.
 */
export function fillContactFields(
  current: Partial<InsertLead>,
  candidate?: DiscoveryCandidate
): ContactFieldsFillResult {
  const patch: Partial<InsertLead> = {};
  const fieldsUpdated: string[] = [];

  // Pass through candidate data for in-memory use
  const candidatePhones = candidate?.candidatePhones ?? [];
  const candidateEmails = candidate?.candidateEmails ?? [];
  const candidateWebsites = candidate?.candidateWebsites ?? [];

  if (!candidate) return { fieldsUpdated, patch, candidatePhones, candidateEmails, candidateWebsites };

  // verifiedPhone — only from verified-capable sources, only if empty
  if (!current.verifiedPhone) {
    const sourceIsVerifiedCapable = VERIFIED_PHONE_ALLOWED_SOURCES.includes(candidate.source);
    if (sourceIsVerifiedCapable && candidate.verifiedPhones.length > 0) {
      patch.verifiedPhone = candidate.verifiedPhones[0];
      fieldsUpdated.push("verifiedPhone");
    }
    // candidatePhones are NOT promoted to verifiedPhone — they stay in-memory only
  }

  // normalizedPhone — always recompute from final verifiedPhone
  const finalPhone = patch.verifiedPhone ?? current.verifiedPhone;
  if (finalPhone) {
    const normalized = normalizePhone(finalPhone);
    if (normalized !== current.normalizedPhone) {
      patch.normalizedPhone = normalized;
      fieldsUpdated.push("normalizedPhone");
    }
  }

  // website — from verifiedWebsite only, only if empty
  if (!current.website && candidate.verifiedWebsite) {
    patch.website = candidate.verifiedWebsite;
    fieldsUpdated.push("website");
  }

  // normalizedDomain — always recompute from final website
  const finalWebsite = patch.website ?? current.website;
  if (finalWebsite) {
    try {
      const url = new URL(finalWebsite.startsWith("http") ? finalWebsite : `https://${finalWebsite}`);
      const domain = url.hostname.replace(/^www\./, "");
      if (domain && domain !== current.normalizedDomain) {
        patch.normalizedDomain = domain;
        fieldsUpdated.push("normalizedDomain");
      }
    } catch {
      // invalid URL — skip
    }
  }

  return { fieldsUpdated, patch, candidatePhones, candidateEmails, candidateWebsites };
}
