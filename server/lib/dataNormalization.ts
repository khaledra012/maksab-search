/**
 * Data Normalization & Deduplication Engine
 * طبقة تنظيف البيانات واكتشاف التكرار
 */

// ===== Phone Normalization =====
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // إزالة كل شيء عدا الأرقام
  let cleaned = phone.replace(/[^\d+]/g, "");
  // إزالة + في البداية
  cleaned = cleaned.replace(/^\+/, "");
  // تحويل 00966 إلى 966
  if (cleaned.startsWith("00966")) cleaned = "966" + cleaned.slice(5);
  // تحويل 0 في البداية إلى 966
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "966" + cleaned.slice(1);
  // إذا كانت 9 أرقام تبدأ بـ 5 أضف 966
  if (cleaned.length === 9 && cleaned.startsWith("5")) cleaned = "966" + cleaned;
  // إذا كانت 12 رقم تبدأ بـ 966 فهي صحيحة
  if (cleaned.length === 12 && cleaned.startsWith("966")) return cleaned;
  // إذا كانت 10 أرقام تبدأ بـ 05
  if (cleaned.length === 10 && cleaned.startsWith("05")) return "966" + cleaned.slice(1);
  return cleaned || null;
}

// ===== Business Name Normalization =====
export function normalizeBusinessName(name: string | null | undefined): string | null {
  if (!name) return null;
  let n = name.trim();
  // إزالة الرموز الزائدة
  n = n.replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ");
  // إزالة كلمات شائعة غير مميزة
  const stopWords = [
    "مؤسسة", "شركة", "مطعم", "مطاعم", "محل", "محلات", "متجر", "متاجر",
    "مركز", "مراكز", "عيادة", "عيادات", "مستوصف", "مستشفى", "صالون",
    "co", "company", "llc", "ltd", "corp", "inc", "group", "est",
  ];
  // تحويل إلى lowercase للمقارنة
  n = n.toLowerCase().trim();
  // إزالة كلمات التوقف من البداية
  for (const sw of stopWords) {
    if (n.startsWith(sw + " ")) n = n.slice(sw.length).trim();
  }
  // إزالة المسافات المتعددة
  n = n.replace(/\s+/g, " ").trim();
  return n || null;
}

// ===== Domain Normalization =====
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    let u = url.trim().toLowerCase();
    if (!u.startsWith("http")) u = "https://" + u;
    const parsed = new URL(u);
    let domain = parsed.hostname;
    // إزالة www.
    domain = domain.replace(/^www\./, "");
    return domain || null;
  } catch {
    return null;
  }
}

// ===== Levenshtein Distance =====
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ===== Similarity Score (0-100) =====
export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.round((1 - dist / maxLen) * 100);
}

// ===== Duplicate Candidate Detection =====
export interface DuplicateCheckInput {
  id: number;
  companyName: string;
  normalizedBusinessName?: string | null;
  normalizedPhone?: string | null;
  normalizedDomain?: string | null;
  city?: string | null;
}

export interface DuplicateResult {
  candidateId: number;
  confidenceScore: number;
  matchReasons: string[];
}

export function findDuplicateCandidates(
  lead: DuplicateCheckInput,
  existingLeads: DuplicateCheckInput[],
  threshold = 60
): DuplicateResult[] {
  const results: DuplicateResult[] = [];

  for (const existing of existingLeads) {
    if (existing.id === lead.id) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. مطابقة الهاتف (أعلى أولوية)
    if (lead.normalizedPhone && existing.normalizedPhone &&
        lead.normalizedPhone === existing.normalizedPhone) {
      score += 80;
      reasons.push("تطابق رقم الهاتف");
    }

    // 2. مطابقة النطاق
    if (lead.normalizedDomain && existing.normalizedDomain &&
        lead.normalizedDomain === existing.normalizedDomain) {
      score += 70;
      reasons.push("تطابق الموقع الإلكتروني");
    }

    // 3. تشابه اسم النشاط التجاري
    const nameA = lead.normalizedBusinessName || lead.companyName.toLowerCase();
    const nameB = existing.normalizedBusinessName || existing.companyName.toLowerCase();
    const nameSim = similarityScore(nameA, nameB);
    if (nameSim >= 85) {
      score += 60;
      reasons.push(`تشابه الاسم ${nameSim}%`);
    } else if (nameSim >= 70) {
      score += 30;
      reasons.push(`تشابه جزئي في الاسم ${nameSim}%`);
    }

    // 4. نفس المدينة يرفع الثقة
    if (lead.city && existing.city && lead.city === existing.city && score > 0) {
      score += 10;
      reasons.push("نفس المدينة");
    }

    // تحديد النتيجة النهائية (max 100)
    const finalScore = Math.min(score, 100);
    if (finalScore >= threshold) {
      results.push({
        candidateId: existing.id,
        confidenceScore: finalScore,
        matchReasons: reasons,
      });
    }
  }

  // ترتيب حسب الثقة تنازلياً
  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// ===== Data Quality Score =====
export function calculateDataQualityScore(lead: {
  companyName?: string | null;
  verifiedPhone?: string | null;
  website?: string | null;
  city?: string | null;
  businessType?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  snapchatUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  googleMapsUrl?: string | null;
  reviewCount?: number | null;
  notes?: string | null;
}): number {
  let score = 0;
  const weights = {
    companyName: 20,
    verifiedPhone: 25,
    website: 15,
    city: 10,
    businessType: 10,
    socialMedia: 10,  // أي حساب سوشيال
    googleMaps: 5,
    reviewCount: 3,
    notes: 2,
  };

  if (lead.companyName?.trim()) score += weights.companyName;
  if (lead.verifiedPhone?.trim()) score += weights.verifiedPhone;
  if (lead.website?.trim()) score += weights.website;
  if (lead.city?.trim()) score += weights.city;
  if (lead.businessType?.trim()) score += weights.businessType;
  if (lead.instagramUrl || lead.twitterUrl || lead.snapchatUrl ||
      lead.tiktokUrl || lead.facebookUrl) score += weights.socialMedia;
  if (lead.googleMapsUrl?.trim()) score += weights.googleMaps;
  if ((lead.reviewCount ?? 0) > 0) score += weights.reviewCount;
  if (lead.notes?.trim()) score += weights.notes;

  return Math.min(score, 100);
}

// ===== Auto-detect Sector =====
export function detectSector(businessType: string | null | undefined): string {
  if (!businessType) return "general";
  const bt = businessType.toLowerCase();

  const sectorMap: Record<string, string[]> = {
    restaurants: ["مطعم", "مطاعم", "كافيه", "كافيهات", "مقهى", "مقاهي", "وجبات", "أكل", "طعام", "بيتزا", "برغر", "شاورما", "حلويات", "مخبز", "restaurant", "cafe", "food", "pizza", "burger"],
    medical: ["عيادة", "عيادات", "مستوصف", "مستشفى", "طبيب", "أطباء", "صيدلية", "صيدليات", "تجميل", "أسنان", "نظارات", "بصريات", "clinic", "hospital", "pharmacy", "dental", "medical"],
    ecommerce: ["متجر", "متاجر", "تسوق", "بيع", "شراء", "إلكتروني", "أونلاين", "توصيل", "store", "shop", "ecommerce", "online"],
    digital_products: ["تقنية", "برمجة", "تطبيق", "موقع", "ديجيتال", "رقمي", "سوفت", "آب", "tech", "software", "app", "digital", "web", "it"],
  };

  for (const [sector, keywords] of Object.entries(sectorMap)) {
    if (keywords.some(kw => bt.includes(kw))) return sector;
  }

  return "general";
}

// ===== Normalize Lead Data =====
export function normalizeLeadData(lead: {
  companyName: string;
  verifiedPhone?: string | null;
  website?: string | null;
  businessType?: string | null;
}) {
  return {
    normalizedBusinessName: normalizeBusinessName(lead.companyName),
    normalizedPhone: normalizePhone(lead.verifiedPhone),
    normalizedDomain: normalizeDomain(lead.website),
    sectorMain: detectSector(lead.businessType) as "restaurants" | "medical" | "ecommerce" | "digital_products" | "general",
  };
}
