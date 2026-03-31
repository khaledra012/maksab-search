/**
 * Field Validator — استخراج الحقول الحرجة من raw data
 * =====================================================
 * يأخذ DiscoveryCandidate ويُنتج IdentityProfile مع:
 *  - value + source + rawOrigin + confidence + status لكل حقل
 *
 * قواعد الاستخراج:
 *  businessName  → من nameHint / businessNameHint / raw.displayName / raw.name
 *  phone         → من verifiedPhones (direct) / candidatePhones (regex) / raw.phone
 *  websiteDomain → من verifiedWebsite (direct) / candidateWebsites (inferred)
 *  city          → من cityHint (inferred) / raw.city / raw.formatted_address
 *  category      → من categoryHint (direct) / raw.businessType / raw.category
 *  primarySocialIdentity → من usernameHint (direct) / raw.username / url
 */

import type { DiscoveryCandidate } from "../../shared/types/lead-intelligence";
import type {
  CriticalField,
  FieldEvidence,
  FieldStatus,
  IdentityProfile,
} from "../../shared/types/field-integrity";

// ─── Helper: بناء CriticalField من قائمة أدلة ────────────────────────────────

function buildCriticalField(evidences: FieldEvidence[]): CriticalField {
  if (evidences.length === 0) {
    return {
      status: "unknown",
      resolvedValue: null,
      evidence: [],
      reason: "لا توجد بيانات من أي مصدر",
    };
  }

  // ترتيب الأدلة حسب الثقة تنازلياً
  const sorted = [...evidences].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];

  // قواعد الحسم لمصدر واحد:
  // confirmed: ثقة ≥ 0.85 (direct/verified من مصدر موثوق)
  // candidate: ثقة < 0.85 (regex/inferred أو مصدر غير موثوق)
  const status: FieldStatus = best.confidence >= 0.85 ? "confirmed" : "candidate";

  return {
    status,
    resolvedValue: best.value,
    evidence: sorted,
    reason: `مصدر واحد: ${best.source} (ثقة ${Math.round(best.confidence * 100)}%) — ${status === "confirmed" ? "مؤكد" : "مرشح"}`,
  };
}

// ─── Helper: استخراج الدومين من URL ──────────────────────────────────────────

function extractDomainFromUrl(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ─── Helper: هل الـ URL سوشيال؟ ──────────────────────────────────────────────

const SOCIAL_DOMAINS = [
  "instagram.com", "tiktok.com", "twitter.com", "x.com",
  "snapchat.com", "facebook.com", "linkedin.com", "t.me", "telegram.me",
];

function isSocialUrl(url: string): boolean {
  return SOCIAL_DOMAINS.some(d => url.includes(d));
}

// ─── الدالة الرئيسية: استخراج IdentityProfile من مرشح واحد ──────────────────

export function extractIdentityProfile(candidate: DiscoveryCandidate): IdentityProfile {
  const raw = candidate.raw as Record<string, unknown> || {};
  const source = candidate.source;

  // ─── 1. businessName ────────────────────────────────────────────────────────
  const nameEvidences: FieldEvidence[] = [];

  // من businessNameHint (أعلى ثقة — مُعالَج)
  if (candidate.businessNameHint?.trim()) {
    nameEvidences.push({
      value: candidate.businessNameHint.trim(),
      source,
      rawOrigin: `businessNameHint: "${candidate.businessNameHint}"`,
      confidence: 0.80,
      extractionMethod: "direct",
    });
  }

  // من nameHint (مباشر من المصدر)
  if (candidate.nameHint?.trim() && candidate.nameHint !== candidate.businessNameHint) {
    nameEvidences.push({
      value: candidate.nameHint.trim(),
      source,
      rawOrigin: `nameHint: "${candidate.nameHint}"`,
      confidence: 0.75,
      extractionMethod: "direct",
    });
  }

  // من raw.displayName
  const rawDisplayName = String(raw.displayName || "").trim();
  if (rawDisplayName && rawDisplayName !== candidate.nameHint && rawDisplayName !== candidate.businessNameHint) {
    nameEvidences.push({
      value: rawDisplayName,
      source,
      rawOrigin: `raw.displayName: "${rawDisplayName}"`,
      confidence: 0.70,
      extractionMethod: "direct",
    });
  }

  // من raw.fullName
  const rawFullName = String(raw.fullName || "").trim();
  if (rawFullName && rawFullName !== rawDisplayName) {
    nameEvidences.push({
      value: rawFullName,
      source,
      rawOrigin: `raw.fullName: "${rawFullName}"`,
      confidence: 0.65,
      extractionMethod: "direct",
    });
  }

  const businessName = buildCriticalField(nameEvidences);

  // ─── 2. phone ───────────────────────────────────────────────────────────────
  const phoneEvidences: FieldEvidence[] = [];

  // أرقام مؤكدة (مستخرجة مباشرة من صفحة المصدر)
  for (const phone of candidate.verifiedPhones) {
    phoneEvidences.push({
      value: phone,
      source,
      rawOrigin: `verifiedPhones: "${phone}"`,
      confidence: 0.90,
      extractionMethod: "direct",
    });
  }

  // من raw.phone مباشرة
  const rawPhone = String(raw.phone || raw.formatted_phone_number || "").trim();
  if (rawPhone && !candidate.verifiedPhones.includes(rawPhone)) {
    phoneEvidences.push({
      value: rawPhone,
      source,
      rawOrigin: `raw.phone: "${rawPhone}"`,
      confidence: 0.85,
      extractionMethod: "direct",
    });
  }

  // أرقام مرشحة (مستخرجة من النص بـ regex)
  for (const phone of candidate.candidatePhones) {
    const bio = String(raw.bio || raw.description || raw.snippet || "");
    const rawOriginText = bio.includes(phone)
      ? `bio regex: "...${phone}..."`
      : `text regex: "${phone}"`;
    phoneEvidences.push({
      value: phone,
      source,
      rawOrigin: rawOriginText,
      confidence: 0.55,
      extractionMethod: "regex",
    });
  }

  const phone = buildCriticalField(phoneEvidences);

  // ─── 3. websiteDomain ───────────────────────────────────────────────────────
  const websiteEvidences: FieldEvidence[] = [];

  // الموقع المؤكد (مستخرج مباشرة)
  if (candidate.verifiedWebsite && !isSocialUrl(candidate.verifiedWebsite)) {
    const domain = extractDomainFromUrl(candidate.verifiedWebsite);
    if (domain) {
      websiteEvidences.push({
        value: domain,
        source,
        rawOrigin: `verifiedWebsite: "${candidate.verifiedWebsite}"`,
        confidence: 0.90,
        extractionMethod: "direct",
      });
    }
  }

  // من raw.website مباشرة
  const rawWebsite = String(raw.website || "").trim();
  if (rawWebsite && !isSocialUrl(rawWebsite)) {
    const domain = extractDomainFromUrl(rawWebsite);
    if (domain && !websiteEvidences.find(e => e.value === domain)) {
      websiteEvidences.push({
        value: domain,
        source,
        rawOrigin: `raw.website: "${rawWebsite}"`,
        confidence: 0.85,
        extractionMethod: "direct",
      });
    }
  }

  // مواقع مرشحة
  for (const w of candidate.candidateWebsites) {
    if (!isSocialUrl(w)) {
      const domain = extractDomainFromUrl(w);
      if (domain && !websiteEvidences.find(e => e.value === domain)) {
        websiteEvidences.push({
          value: domain,
          source,
          rawOrigin: `candidateWebsites: "${w}"`,
          confidence: 0.50,
          extractionMethod: "inferred",
        });
      }
    }
  }

  const websiteDomain = buildCriticalField(websiteEvidences);

  // ─── 4. city ────────────────────────────────────────────────────────────────
  const cityEvidences: FieldEvidence[] = [];

  // من cityHint (مستنتج من النص)
  if (candidate.cityHint?.trim()) {
    cityEvidences.push({
      value: candidate.cityHint.trim(),
      source,
      rawOrigin: `cityHint (inferred from text): "${candidate.cityHint}"`,
      confidence: 0.65,
      extractionMethod: "inferred",
    });
  }

  // من raw.city مباشرة
  const rawCity = String(raw.city || "").trim();
  if (rawCity && rawCity !== candidate.cityHint) {
    cityEvidences.push({
      value: rawCity,
      source,
      rawOrigin: `raw.city: "${rawCity}"`,
      confidence: 0.80,
      extractionMethod: "direct",
    });
  }

  // من raw.formatted_address (Google Maps)
  const rawAddress = String(raw.formatted_address || raw.address || "").trim();
  if (rawAddress) {
    // استخراج المدينة من العنوان
    const CITY_PATTERNS: Record<string, RegExp> = {
      "الرياض": /\b(الرياض|riyadh)\b/i,
      "جدة": /\b(جدة|jeddah|jidda)\b/i,
      "مكة": /\b(مكة|mecca|makkah)\b/i,
      "المدينة": /\b(المدينة|medina|madinah)\b/i,
      "الدمام": /\b(الدمام|dammam)\b/i,
      "الخبر": /\b(الخبر|khobar)\b/i,
      "الطائف": /\b(الطائف|taif)\b/i,
      "تبوك": /\b(تبوك|tabuk)\b/i,
      "أبها": /\b(أبها|abha)\b/i,
    };
    for (const [city, pattern] of Object.entries(CITY_PATTERNS)) {
      if (pattern.test(rawAddress) && !cityEvidences.find(e => e.value === city)) {
        cityEvidences.push({
          value: city,
          source,
          rawOrigin: `formatted_address regex: "${rawAddress}"`,
          confidence: 0.75,
          extractionMethod: "regex",
        });
        break;
      }
    }
  }

  const city = buildCriticalField(cityEvidences);

  // ─── 5. category ────────────────────────────────────────────────────────────
  const categoryEvidences: FieldEvidence[] = [];

  // من categoryHint (مباشر)
  if (candidate.categoryHint?.trim()) {
    categoryEvidences.push({
      value: candidate.categoryHint.trim(),
      source,
      rawOrigin: `categoryHint: "${candidate.categoryHint}"`,
      confidence: 0.80,
      extractionMethod: "direct",
    });
  }

  // من raw.businessType
  const rawBusinessType = String(raw.businessType || raw.category || raw.types || "").trim();
  if (rawBusinessType && rawBusinessType !== candidate.categoryHint) {
    categoryEvidences.push({
      value: rawBusinessType,
      source,
      rawOrigin: `raw.businessType: "${rawBusinessType}"`,
      confidence: 0.75,
      extractionMethod: "direct",
    });
  }

  const category = buildCriticalField(categoryEvidences);

  // ─── 6. primarySocialIdentity ────────────────────────────────────────────────
  const socialEvidences: FieldEvidence[] = [];

  // من usernameHint (مباشر)
  if (candidate.usernameHint?.trim()) {
    socialEvidences.push({
      value: candidate.usernameHint.trim(),
      source,
      rawOrigin: `usernameHint: "${candidate.usernameHint}"`,
      confidence: 0.90,
      extractionMethod: "direct",
    });
  }

  // من raw.username
  const rawUsername = String(raw.username || raw.id || "").trim();
  if (rawUsername && rawUsername !== candidate.usernameHint) {
    socialEvidences.push({
      value: rawUsername,
      source,
      rawOrigin: `raw.username: "${rawUsername}"`,
      confidence: 0.85,
      extractionMethod: "direct",
    });
  }

  // من URL (استخراج username)
  if (candidate.url && isSocialUrl(candidate.url)) {
    const urlUsernameMatch = candidate.url.match(
      /(?:instagram\.com|tiktok\.com\/@?|snapchat\.com\/add\/|twitter\.com\/|x\.com\/|facebook\.com\/|linkedin\.com\/(?:company|in)\/)\/?([@]?[\w.]+)/i
    );
    if (urlUsernameMatch) {
      const urlUsername = urlUsernameMatch[1].replace(/^@/, "");
      if (urlUsername && !socialEvidences.find(e => e.value === urlUsername)) {
        socialEvidences.push({
          value: urlUsername,
          source,
          rawOrigin: `url extraction: "${candidate.url}"`,
          confidence: 0.80,
          extractionMethod: "regex",
        });
      }
    }
  }

  const primarySocialIdentity = buildCriticalField(socialEvidences);

  return {
    businessName,
    phone,
    websiteDomain,
    city,
    category,
    primarySocialIdentity,
  };
}

// ─── دمج ملفات هوية متعددة (من مصادر مختلفة) ────────────────────────────────

/**
 * يدمج ملفات هوية متعددة من مرشحين مختلفين في ملف هوية واحد
 * يكتشف التعارضات ويُعيّن الحالة المناسبة لكل حقل
 */
export function mergeIdentityProfiles(profiles: IdentityProfile[]): IdentityProfile {
  if (profiles.length === 0) {
    const emptyField: CriticalField = {
      status: "unknown",
      resolvedValue: null,
      evidence: [],
      reason: "لا توجد بيانات",
    };
    return {
      businessName: emptyField,
      phone: emptyField,
      websiteDomain: emptyField,
      city: emptyField,
      category: emptyField,
      primarySocialIdentity: emptyField,
    };
  }

  if (profiles.length === 1) return profiles[0];

  const fieldNames: Array<keyof IdentityProfile> = [
    "businessName", "phone", "websiteDomain", "city", "category", "primarySocialIdentity"
  ];

  const merged: Partial<IdentityProfile> = {};

  for (const fieldName of fieldNames) {
    // جمع جميع الأدلة من جميع الملفات
    const allEvidence: FieldEvidence[] = profiles.flatMap(p => p[fieldName].evidence);

    if (allEvidence.length === 0) {
      merged[fieldName] = {
        status: "unknown",
        resolvedValue: null,
        evidence: [],
        reason: "لا توجد بيانات من أي مصدر",
      };
      continue;
    }

    // تجميع القيم الفريدة (بعد التطبيع)
    const normalizedGroups = groupByNormalizedValue(allEvidence, fieldName);
    const uniqueValues = Object.keys(normalizedGroups);

    if (uniqueValues.length === 1) {
      // جميع المصادر تتفق
      const bestEvidence = normalizedGroups[uniqueValues[0]].sort((a, b) => b.confidence - a.confidence)[0];
      const allSources = normalizedGroups[uniqueValues[0]].map(e => e.source);
      const avgConfidence = normalizedGroups[uniqueValues[0]].reduce((s, e) => s + e.confidence, 0) / normalizedGroups[uniqueValues[0]].length;

      merged[fieldName] = {
        status: avgConfidence >= 0.75 || allSources.length > 1 ? "confirmed" : "candidate",
        resolvedValue: bestEvidence.value,
        evidence: allEvidence,
        reason: allSources.length > 1
          ? `متفق عليه من ${allSources.length} مصادر: ${allSources.join(", ")}`
          : `مصدر واحد: ${bestEvidence.source} (ثقة ${Math.round(bestEvidence.confidence * 100)}%)`,
      };
    } else {
      // تعارض — قيم مختلفة من مصادر مختلفة
      const conflictDetails = uniqueValues.map(v => {
        const evidences = normalizedGroups[v];
        const best = evidences.sort((a, b) => b.confidence - a.confidence)[0];
        return `"${best.value}" (${evidences.map(e => e.source).join(", ")})`;
      });

      merged[fieldName] = {
        status: "conflicting",
        resolvedValue: null, // لا نختار قيمة عند التعارض
        evidence: allEvidence,
        reason: `تعارض بين ${uniqueValues.length} قيم مختلفة: ${conflictDetails.join(" vs ")}`,
      };
    }
  }

  return merged as IdentityProfile;
}

// ─── Helper: تجميع الأدلة حسب القيمة المُطبَّعة ─────────────────────────────

function groupByNormalizedValue(
  evidences: FieldEvidence[],
  fieldName: keyof IdentityProfile
): Record<string, FieldEvidence[]> {
  const groups: Record<string, FieldEvidence[]> = {};

  for (const ev of evidences) {
    const normalized = normalizeFieldValue(ev.value, fieldName);
    if (!normalized) continue;
    if (!groups[normalized]) groups[normalized] = [];
    groups[normalized].push(ev);
  }

  return groups;
}

// ─── Helper: تطبيع قيمة الحقل للمقارنة ──────────────────────────────────────

function normalizeFieldValue(value: string, fieldName: keyof IdentityProfile): string {
  const v = value.trim().toLowerCase();

  switch (fieldName) {
    case "phone":
      // تطبيع أرقام الهاتف: +966501234567 = 0501234567 = 966501234567
      return v
        .replace(/[\s\-().]/g, "")
        .replace(/^\+966/, "0")
        .replace(/^00966/, "0")
        .replace(/^966/, "0");

    case "websiteDomain":
      // تطبيع الدومين: www.example.com = example.com
      return v.replace(/^www\./, "").replace(/\/$/, "");

    case "businessName":
      // تطبيع الاسم: إزالة المسافات الزائدة والتشكيل
      return v
        .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
        .replace(/\s+/g, " ")
        .trim();

    case "primarySocialIdentity":
      // تطبيع username: إزالة @
      return v.replace(/^@/, "");

    default:
      return v;
  }
}
