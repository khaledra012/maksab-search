/**
 * PHASE 4 — BusinessLead Adapter
 * Mapping صريح من BusinessLead (شكل متطور) إلى InsertLead (schema ثابت).
 * لا يسمح لـ WhatChimp أو أي module آخر بالاعتماد مباشرة على BusinessLead shape.
 *
 * القاعدة: verifiedPhone يُملأ من verifiedPhones[0] فقط — لا من candidatePhones.
 * x (socialProfiles.x) يُعيَّن إلى twitterUrl (اسم الحقل في schema).
 */
import type { InsertLead } from "../../drizzle/schema";
import type { BusinessLead } from "../../shared/types/lead-intelligence";

export type AdapterResult =
  | { success: true; insertLead: Partial<InsertLead> }
  | { success: false; reason: string };

export function adaptBusinessLeadToInsert(
  bl: BusinessLead
): AdapterResult {
  if (!bl.businessName || bl.businessName.trim() === "") {
    return { success: false, reason: "missing_business_name" };
  }

  const insertLead: Partial<InsertLead> = {
    // ─── Core fields ───────────────────────────────────────────────
    companyName: bl.businessName,
    businessType: bl.category ?? undefined,
    city: bl.city ?? undefined,
    district: bl.region ?? undefined,
    country: bl.country ?? "SA",

    // ─── Contact — verifiedPhone من verifiedPhones[0] فقط ─────────
    verifiedPhone: bl.verifiedPhones?.[0] ?? undefined,
    website: bl.verifiedWebsite ?? undefined,
    googleMapsUrl: bl.googleMapsUrl ?? undefined,

    // ─── Social — x → twitterUrl (naming consistency مع schema) ───
    instagramUrl: bl.socialProfiles?.instagram ?? undefined,
    twitterUrl: bl.socialProfiles?.x ?? undefined,       // x في BusinessLead = twitterUrl في schema
    tiktokUrl: bl.socialProfiles?.tiktok ?? undefined,
    snapchatUrl: bl.socialProfiles?.snapchat ?? undefined,
    facebookUrl: bl.socialProfiles?.facebook ?? undefined,
    linkedinUrl: bl.socialProfiles?.linkedin ?? undefined,

    // ─── Normalization ─────────────────────────────────────────────
    normalizedBusinessName: bl.normalizedBusinessName ?? undefined,
  };

  return { success: true, insertLead };
}
