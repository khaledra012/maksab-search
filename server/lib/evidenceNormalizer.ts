/**
 * evidenceNormalizer.ts
 * =====================
 * Layer 2 of Browser Verification Agent
 *
 * مسؤولية هذه الطبقة:
 *   - تطبيع الأدلة الخام من browserExtractor
 *   - تصنيف كل دليل: supporting / conflicting / unconfirmed
 *   - مقارنة الأدلة عبر المصادر المختلفة
 *   - إنتاج NormalizedEvidence جاهز لـ verificationLayer
 *
 * قواعد صارمة:
 *   - ممنوع التخمين أو ملء بيانات ناقصة
 *   - كل دليل يُوسم بمستوى ثقة صريح
 *   - التعارض يُسجَّل بوضوح ولا يُخفى
 */

import type { RawPageEvidence } from "./browserExtractor.js";

// ===== Types =====

export type EvidenceStrength = "strong" | "moderate" | "weak" | "unconfirmed";
export type EvidenceTag = "supporting" | "conflicting" | "unconfirmed";

export interface EvidenceItem {
  type: "phone" | "email" | "domain" | "social_link" | "city" | "category" | "name" | "cross_link";
  value: string;
  sources: string[];
  strength: EvidenceStrength;
  tag: EvidenceTag;
  /** وصف مقروء للدليل */
  description: string;
}

export interface NormalizedEvidence {
  caseId: string;
  entities: Array<{
    source: string;
    url: string;
    visibleName: string | null;
    phones: string[];
    emails: string[];
    domains: string[];
    cities: string[];
    categoryHints: string[];
    socialLinks: string[];
    contactLinks: string[];
    fetchConfidence: "high" | "medium" | "low" | "failed";
  }>;
  supportingEvidence: EvidenceItem[];
  conflictingEvidence: EvidenceItem[];
  unconfirmedEvidence: EvidenceItem[];
  /** ملخص نصي للأدلة الداعمة */
  supportingSummary: string[];
  /** ملخص نصي للأدلة المتعارضة */
  conflictingSummary: string[];
  /** عدد الأدلة القوية */
  strongEvidenceCount: number;
  /** هل يوجد تعارض واضح؟ */
  hasConflict: boolean;
  /** هل الأدلة كافية للقرار؟ */
  sufficientEvidence: boolean;
}

// ===== Normalizers =====

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-().+]/g, "");
  if (p.startsWith("00966")) p = "966" + p.slice(5);
  if (p.startsWith("0966")) p = "966" + p.slice(4);
  if (p.startsWith("966")) return p;
  if (p.startsWith("05") || p.startsWith("5")) {
    const digits = p.replace(/^0/, "");
    return "966" + digits;
  }
  return p;
}

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").split("/")[0].trim();
}

function normalizeSocialLink(link: string): string {
  try {
    const url = new URL(link.startsWith("http") ? link : `https://${link}`);
    // إزالة trailing slash وquery params
    return url.hostname.replace("www.", "") + url.pathname.replace(/\/$/, "");
  } catch {
    return link.toLowerCase().trim();
  }
}

function extractSocialUsername(link: string): string {
  try {
    const url = new URL(link.startsWith("http") ? link : `https://${link}`);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

// ===== Cross-source Comparison =====

function findSharedPhones(entities: RawPageEvidence[]): Array<{ value: string; sources: string[] }> {
  const phoneMap = new Map<string, string[]>();
  for (const e of entities) {
    for (const phone of e.phones) {
      const norm = normalizePhone(phone);
      if (!phoneMap.has(norm)) phoneMap.set(norm, []);
      phoneMap.get(norm)!.push(e.source);
    }
  }
  return Array.from(phoneMap.entries())
    .filter(([, sources]) => sources.length >= 2)
    .map(([value, sources]) => ({ value, sources }));
}

function findSharedDomains(entities: RawPageEvidence[]): Array<{ value: string; sources: string[] }> {
  const domainMap = new Map<string, string[]>();
  for (const e of entities) {
    for (const domain of e.domains) {
      const norm = normalizeDomain(domain);
      if (!domainMap.has(norm)) domainMap.set(norm, []);
      domainMap.get(norm)!.push(e.source);
    }
  }
  return Array.from(domainMap.entries())
    .filter(([, sources]) => sources.length >= 2)
    .map(([value, sources]) => ({ value, sources }));
}

function findCrossLinks(entities: RawPageEvidence[]): Array<{ from: string; to: string; link: string }> {
  const crossLinks: Array<{ from: string; to: string; link: string }> = [];
  for (const e of entities) {
    for (const link of e.socialLinks) {
      // هل هذا الرابط يشير إلى مصدر آخر في القائمة؟
      for (const other of entities) {
        if (other.source === e.source) continue;
        if (link.includes(other.source) || (other.url && link.includes(extractSocialUsername(other.url)))) {
          crossLinks.push({ from: e.source, to: other.source, link });
        }
      }
    }
  }
  return crossLinks;
}

function findConflictingPhones(entities: RawPageEvidence[]): Array<{ sources: string[]; values: string[] }> {
  // إذا كان لكل مصدر رقم هاتف مختلف تماماً
  const conflicts: Array<{ sources: string[]; values: string[] }> = [];
  const withPhones = entities.filter(e => e.phones.length > 0);
  if (withPhones.length < 2) return [];

  const allNormalized = withPhones.map(e => ({
    source: e.source,
    phones: e.phones.map(normalizePhone),
  }));

  // تحقق من وجود هاتفين مختلفين تماماً
  for (let i = 0; i < allNormalized.length; i++) {
    for (let j = i + 1; j < allNormalized.length; j++) {
      const a = allNormalized[i];
      const b = allNormalized[j];
      const shared = a.phones.filter(p => b.phones.includes(p));
      if (shared.length === 0 && a.phones.length > 0 && b.phones.length > 0) {
        conflicts.push({
          sources: [a.source, b.source],
          values: [...a.phones, ...b.phones],
        });
      }
    }
  }
  return conflicts;
}

function findConflictingDomains(entities: RawPageEvidence[]): Array<{ sources: string[]; values: string[] }> {
  const withDomains = entities.filter(e => e.domains.length > 0);
  if (withDomains.length < 2) return [];

  const conflicts: Array<{ sources: string[]; values: string[] }> = [];
  const allNorm = withDomains.map(e => ({
    source: e.source,
    domains: e.domains.map(normalizeDomain),
  }));

  for (let i = 0; i < allNorm.length; i++) {
    for (let j = i + 1; j < allNorm.length; j++) {
      const a = allNorm[i];
      const b = allNorm[j];
      const shared = a.domains.filter(d => b.domains.includes(d));
      if (shared.length === 0 && a.domains.length > 0 && b.domains.length > 0) {
        conflicts.push({
          sources: [a.source, b.source],
          values: [...a.domains, ...b.domains],
        });
      }
    }
  }
  return conflicts;
}

// ===== Main Normalizer =====

export function normalizeEvidence(
  rawEntities: RawPageEvidence[],
  caseId: string
): NormalizedEvidence {
  const supporting: EvidenceItem[] = [];
  const conflicting: EvidenceItem[] = [];
  const unconfirmed: EvidenceItem[] = [];

  // 1. أدلة الهاتف المشتركة
  const sharedPhones = findSharedPhones(rawEntities);
  for (const { value, sources } of sharedPhones) {
    supporting.push({
      type: "phone",
      value,
      sources,
      strength: "strong",
      tag: "supporting",
      description: `نفس رقم الهاتف ${value} في: ${sources.join(", ")}`,
    });
  }

  // 2. أدلة النطاق المشتركة
  const sharedDomains = findSharedDomains(rawEntities);
  for (const { value, sources } of sharedDomains) {
    supporting.push({
      type: "domain",
      value,
      sources,
      strength: "strong",
      tag: "supporting",
      description: `نفس النطاق ${value} في: ${sources.join(", ")}`,
    });
  }

  // 3. Cross-links بين المصادر
  const crossLinks = findCrossLinks(rawEntities);
  for (const { from, to, link } of crossLinks) {
    supporting.push({
      type: "cross_link",
      value: link,
      sources: [from, to],
      strength: "strong",
      tag: "supporting",
      description: `${from} يحتوي على رابط لـ ${to}: ${link}`,
    });
  }

  // 4. المدن المشتركة
  const cityMap = new Map<string, string[]>();
  for (const e of rawEntities) {
    for (const city of e.cityHints) {
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(e.source);
    }
  }
  for (const [city, sources] of Array.from(cityMap.entries())) {
    if (sources.length >= 2) {
      supporting.push({
        type: "city",
        value: city,
        sources,
        strength: "moderate",
        tag: "supporting",
        description: `نفس المدينة ${city} في: ${sources.join(", ")}`,
      });
    }
  }

  // 5. الأسماء المتشابهة
  const namesWithSources = rawEntities
    .filter(e => e.visibleName)
    .map(e => ({ name: e.visibleName!, source: e.source }));

  if (namesWithSources.length >= 2) {
    // مقارنة بسيطة: هل الاسم الأول يحتوي على كلمات من الاسم الثاني؟
    for (let i = 0; i < namesWithSources.length; i++) {
      for (let j = i + 1; j < namesWithSources.length; j++) {
        const a = namesWithSources[i].name.toLowerCase();
        const b = namesWithSources[j].name.toLowerCase();
        const wordsA = a.split(/\s+/).filter(w => w.length > 2);
        const wordsB = b.split(/\s+/).filter(w => w.length > 2);
        const shared = wordsA.filter(w => wordsB.includes(w));
        if (shared.length >= 1 && (shared.length / Math.max(wordsA.length, wordsB.length)) >= 0.5) {
          supporting.push({
            type: "name",
            value: `"${namesWithSources[i].name}" ≈ "${namesWithSources[j].name}"`,
            sources: [namesWithSources[i].source, namesWithSources[j].source],
            strength: "moderate",
            tag: "supporting",
            description: `تشابه في الاسم بين ${namesWithSources[i].source} و${namesWithSources[j].source}`,
          });
        }
      }
    }
  }

  // 6. التعارضات في الهاتف
  const phoneConflicts = findConflictingPhones(rawEntities);
  for (const { sources, values } of phoneConflicts) {
    conflicting.push({
      type: "phone",
      value: values.join(" vs "),
      sources,
      strength: "strong",
      tag: "conflicting",
      description: `أرقام هاتف مختلفة بين ${sources.join(" و")}: ${values.join(", ")}`,
    });
  }

  // 7. التعارضات في النطاق
  const domainConflicts = findConflictingDomains(rawEntities);
  for (const { sources, values } of domainConflicts) {
    conflicting.push({
      type: "domain",
      value: values.join(" vs "),
      sources,
      strength: "moderate",
      tag: "conflicting",
      description: `نطاقات مختلفة بين ${sources.join(" و")}: ${values.join(", ")}`,
    });
  }

  // 8. أدلة غير مؤكدة (مصدر واحد فقط)
  for (const e of rawEntities) {
    if (e.phones.length > 0 && !sharedPhones.some(p => e.phones.map(normalizePhone).includes(p.value))) {
      unconfirmed.push({
        type: "phone",
        value: e.phones[0],
        sources: [e.source],
        strength: "unconfirmed",
        tag: "unconfirmed",
        description: `هاتف من مصدر واحد فقط (${e.source}): ${e.phones[0]}`,
      });
    }
  }

  const strongEvidenceCount = supporting.filter(e => e.strength === "strong").length;
  const hasConflict = conflicting.length > 0;
  const sufficientEvidence = supporting.length >= 2 || strongEvidenceCount >= 1;

  return {
    caseId,
    entities: rawEntities.map(e => ({
      source: e.source,
      url: e.url,
      visibleName: e.visibleName,
      phones: e.phones,
      emails: e.emails,
      domains: e.domains,
      cities: e.cityHints,
      categoryHints: e.categoryHints,
      socialLinks: e.socialLinks,
      contactLinks: e.contactLinks,
      fetchConfidence: e.confidence,
    })),
    supportingEvidence: supporting,
    conflictingEvidence: conflicting,
    unconfirmedEvidence: unconfirmed,
    supportingSummary: supporting.map(e => e.description),
    conflictingSummary: conflicting.map(e => e.description),
    strongEvidenceCount,
    hasConflict,
    sufficientEvidence,
  };
}
