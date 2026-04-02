import { eq, desc, asc, and, or, like, sql, inArray } from "drizzle-orm";
import { normalizeName, normalizePhone, extractDomain } from "./lib/identityLinkage";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  leads, InsertLead, Lead,
  zones, InsertZone, Zone,
  websiteAnalyses, InsertWebsiteAnalysis,
  socialAnalyses, InsertSocialAnalysis,
  searchJobs, InsertSearchJob, SearchJob,
  campaigns, InsertCampaign, Campaign,
  reminders, InsertReminder, Reminder,
  weeklyReports, InsertWeeklyReport, WeeklyReport,
  reportSchedules, InsertReportSchedule, ReportSchedule,
  whatchimpSendLog,
  seoAdvancedAnalysis, InsertSeoAdvancedAnalysis,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _lastConnectTime: number = 0;
let _warnedMissingDatabaseUrl = false;

export async function getDb() {
  const now = Date.now();
  // إعادة الاتصال إذا مر أكثر من 30 دقيقة على آخر اتصال
  if (_db && (now - _lastConnectTime) > 30 * 60 * 1000) {
    _db = null;
  }
  if (!process.env.DATABASE_URL) {
    if (!_warnedMissingDatabaseUrl) {
      console.warn("[Database] DATABASE_URL is not set. Check your .env file and restart the server.");
      _warnedMissingDatabaseUrl = true;
    }
    return null;
  }
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      _lastConnectTime = now;
      console.log("[Database] Client initialized from DATABASE_URL");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// إعادة ضبط الاتصال عند خطأ ECONNRESET
export function resetDbConnection() {
  _db = null;
  _lastConnectTime = 0;
  console.log("[Database] Connection reset requested");
}

// ===== USER HELPERS =====
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== ZONES HELPERS =====
export async function getAllZones(): Promise<Zone[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(zones).orderBy(asc(zones.region), asc(zones.name));
}

export async function getZoneById(id: number): Promise<Zone | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
  return result[0];
}

export async function createZone(data: InsertZone): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(zones).values(data);
  return (result[0] as any).insertId;
}

export async function updateZone(id: number, data: Partial<InsertZone>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(zones).set(data).where(eq(zones.id, id));
}

export async function deleteZone(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(zones).where(eq(zones.id, id));
}

export async function updateZoneLeadsCount(zoneId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const result = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.zoneId, zoneId));
  const count = result[0]?.count ?? 0;
  await db.update(zones).set({ leadsCount: count }).where(eq(zones.id, zoneId));
}

async function updateZoneLeadsCounts(zoneIds: Array<number | null | undefined>): Promise<void> {
  const uniqueZoneIds = Array.from(
    new Set(zoneIds.filter((zoneId): zoneId is number => typeof zoneId === "number"))
  );
  await Promise.all(uniqueZoneIds.map(zoneId => updateZoneLeadsCount(zoneId)));
}

// ===== LEADS HELPERS =====
export async function getAllLeads(filters?: {
  zoneId?: number;
  city?: string;
  businessType?: string;
  analysisStatus?: string;
  search?: string;
  hasWhatsapp?: "yes" | "no" | "unknown";
  hasPhone?: boolean;
  stage?: string;
  priority?: string;
  ownerUserId?: number;
  sentToWhatchimp?: "yes" | "no";
}): Promise<(Lead & { sentToWhatchimp: boolean })[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.zoneId) conditions.push(eq(leads.zoneId, filters.zoneId));
  if (filters?.city) conditions.push(eq(leads.city, filters.city));
  if (filters?.businessType) conditions.push(like(leads.businessType, `%${filters.businessType}%`));
  if (filters?.analysisStatus) conditions.push(eq(leads.analysisStatus, filters.analysisStatus as any));
  if (filters?.search) conditions.push(like(leads.companyName, `%${filters.search}%`));
  if (filters?.hasWhatsapp) conditions.push(eq(leads.hasWhatsapp, filters.hasWhatsapp));
  if (filters?.hasPhone === true) conditions.push(sql`${leads.verifiedPhone} IS NOT NULL AND ${leads.verifiedPhone} != ''`);
  if (filters?.stage) conditions.push(eq(leads.stage, filters.stage as any));
  if (filters?.priority) conditions.push(eq(leads.priority, filters.priority as any));
  if (filters?.ownerUserId) conditions.push(eq(leads.ownerUserId, filters.ownerUserId));
  // فلتر Whatchimp: جلب معرّفات العملاء المُرسَلة بنجاح
  if (filters?.sentToWhatchimp === "yes") {
    const sentRows = await db
      .selectDistinct({ leadId: whatchimpSendLog.leadId })
      .from(whatchimpSendLog)
      .where(eq(whatchimpSendLog.status, "success"));
    const ids = sentRows.map(r => r.leadId);
    if (ids.length === 0) return [];
    conditions.push(inArray(leads.id, ids));
  } else if (filters?.sentToWhatchimp === "no") {
    const sentRows = await db
      .selectDistinct({ leadId: whatchimpSendLog.leadId })
      .from(whatchimpSendLog)
      .where(eq(whatchimpSendLog.status, "success"));
    const ids = sentRows.map(r => r.leadId);
    if (ids.length > 0) {
      conditions.push(sql`${leads.id} NOT IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
    }
  }
  const baseLeads = conditions.length > 0
    ? await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt))
    : await db.select().from(leads).orderBy(desc(leads.createdAt));

  // جلب معرّفات العملاء المُرسَلين لـ Whatchimp
  const sentRows = await db
    .selectDistinct({ leadId: whatchimpSendLog.leadId })
    .from(whatchimpSendLog)
    .where(eq(whatchimpSendLog.status, "success"));
  const sentSet = new Set(sentRows.map(r => r.leadId));

  return baseLeads.map(lead => ({ ...lead, sentToWhatchimp: sentSet.has(lead.id) }));
}

export async function getLeadById(id: number): Promise<Lead | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function createLead(data: InsertLead): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(leads).values(data);
  const insertId = (result[0] as any).insertId;
  await updateZoneLeadsCounts([data.zoneId]);
  return insertId;
}

export async function updateLead(id: number, data: Partial<InsertLead>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const previousLead = await getLeadById(id);
  await db.update(leads).set(data).where(eq(leads.id, id));
  const updatedLead = await getLeadById(id);
  await updateZoneLeadsCounts([previousLead?.zoneId, updatedLead?.zoneId]);
}

export async function deleteLead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const lead = await getLeadById(id);
  await db.delete(leads).where(eq(leads.id, id));
  await updateZoneLeadsCounts([lead?.zoneId]);
}

export async function bulkDeleteLeads(ids: number[]): Promise<{ deleted: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (ids.length === 0) return { deleted: 0 };
  const leadsToDelete = await db
    .select({ zoneId: leads.zoneId })
    .from(leads)
    .where(inArray(leads.id, ids));
  // حذف العملاء المحددين
  await db.delete(leads).where(inArray(leads.id, ids));
  await updateZoneLeadsCounts(leadsToDelete.map(lead => lead.zoneId));
  return { deleted: ids.length };
}

export async function getLeadsStats() {
  const db = await getDb();
  if (!db) return { total: 0, analyzed: 0, pending: 0, byCity: [], byZone: [] };
  const total = await db.select({ count: sql<number>`count(*)` }).from(leads);
  const analyzed = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.analysisStatus, 'completed'));
  const pending = await db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.analysisStatus, 'pending'));
  const byCity = await db.select({ city: leads.city, count: sql<number>`count(*)` }).from(leads).groupBy(leads.city).orderBy(desc(sql`count(*)`)).limit(10);
  const byZone = await db.select({ zoneName: leads.zoneName, count: sql<number>`count(*)` }).from(leads).groupBy(leads.zoneName).orderBy(desc(sql`count(*)`)).limit(10);
  return {
    total: total[0]?.count ?? 0,
    analyzed: analyzed[0]?.count ?? 0,
    pending: pending[0]?.count ?? 0,
    byCity,
    byZone,
  };
}

// ===== WEBSITE ANALYSIS HELPERS =====
export async function getWebsiteAnalysisByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(websiteAnalyses).where(eq(websiteAnalyses.leadId, leadId)).orderBy(desc(websiteAnalyses.analyzedAt)).limit(1);
  return result[0];
}

export async function createWebsiteAnalysis(data: InsertWebsiteAnalysis): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(websiteAnalyses).values(data);
  return (result[0] as any).insertId;
}

// ===== SOCIAL ANALYSIS HELPERS =====
export async function getSocialAnalysesByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(socialAnalyses).where(eq(socialAnalyses.leadId, leadId)).orderBy(desc(socialAnalyses.analyzedAt));

  // لكل منصة: نجمع أفضل سجل لكل نوع من البيانات
  // aiMap: أحدث سجل يحتوي على overallScore (تحليل AI)
  // realDataMap: السجل الذي يحتوي على أعلى followersCount (بيانات حقيقية)
  const aiMap = new Map<string, typeof all[0]>();
  const realDataMap = new Map<string, typeof all[0]>();

  for (const sa of all) {
    // سجل بيانات حقيقية: نأخذ الأعلى followersCount (وليس الأحدث)
    const followers = sa.followersCount ?? 0;
    const posts = sa.postsCount ?? 0;
    if (followers > 0 || posts > 0) {
      const existing = realDataMap.get(sa.platform);
      const existingFollowers = existing?.followersCount ?? 0;
      // نفضل السجل الذي يحتوي على أعلى عدد متابعين
      if (!existing || followers > existingFollowers) {
        realDataMap.set(sa.platform, sa);
      }
    }
    // سجل تحليل AI: نأخذ الأحدث (أعلى id)
    if (sa.overallScore !== null && sa.overallScore !== undefined) {
      const existing = aiMap.get(sa.platform);
      if (!existing || sa.id > existing.id) aiMap.set(sa.platform, sa);
    }
  }

  // اجمع كل المنصات المعروفة
  const allPlatformsSet = new Set<string>([
    ...Array.from(aiMap.keys()),
    ...Array.from(realDataMap.keys()),
  ]);

  // إضافة المنصات التي ليس لديها أي نوع من البيانات (فقط أحدث سجل)
  for (const sa of all) {
    if (!allPlatformsSet.has(sa.platform)) {
      allPlatformsSet.add(sa.platform);
      aiMap.set(sa.platform, sa);
    }
  }

  const merged: typeof all = [];
  for (const platform of Array.from(allPlatformsSet)) {
    const aiRecord = aiMap.get(platform);
    const realRecord = realDataMap.get(platform);

    if (aiRecord && realRecord) {
      // دمج: خذ الدرجات من AI + البيانات الحقيقية من Bright Data
      merged.push({
        ...aiRecord,
        followersCount: (realRecord.followersCount ?? 0) > 0 ? realRecord.followersCount : aiRecord.followersCount,
        postsCount: (realRecord.postsCount ?? 0) > 0 ? realRecord.postsCount : aiRecord.postsCount,
        engagementRate: realRecord.engagementRate ?? aiRecord.engagementRate,
        avgLikes: realRecord.avgLikes ?? aiRecord.avgLikes,
        avgViews: realRecord.avgViews ?? aiRecord.avgViews,
      });
    } else {
      merged.push(aiRecord || realRecord!);
    }
  }
  return merged;
}

export async function createSocialAnalysis(data: InsertSocialAnalysis): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(socialAnalyses).values(data);
  return (result[0] as any).insertId;
}

// ===== SEO ADVANCED ANALYSIS HELPERS =====
export async function createSeoAdvancedAnalysis(data: InsertSeoAdvancedAnalysis): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(seoAdvancedAnalysis).values(data);
  return (result[0] as any).insertId;
}

export async function getLatestSeoAdvancedAnalysis(leadId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(seoAdvancedAnalysis)
    .where(eq(seoAdvancedAnalysis.leadId, leadId))
    .orderBy(desc(seoAdvancedAnalysis.analyzedAt))
    .limit(1);
  return rows[0] || null;
}

export async function getTopGaps() {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({ gaps: websiteAnalyses.technicalGaps }).from(websiteAnalyses).limit(100);
  const gapCounts: Record<string, number> = {};
  for (const row of results) {
    if (Array.isArray(row.gaps)) {
      for (const gap of row.gaps) {
        gapCounts[gap] = (gapCounts[gap] || 0) + 1;
      }
    }
  }
  return Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([gap, count]) => ({ gap, count }));
}

// ===== SEARCH JOBS HELPERS =====

export async function createSearchJob(data: InsertSearchJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(searchJobs).values(data);
  return (result[0] as any).insertId;
}

export async function getSearchJobById(id: number): Promise<SearchJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(searchJobs).where(eq(searchJobs.id, id)).limit(1);
  return result[0];
}

export async function getAllSearchJobs(): Promise<SearchJob[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(searchJobs).orderBy(desc(searchJobs.createdAt));
}

export async function updateSearchJob(id: number, data: Partial<InsertSearchJob>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(searchJobs).set(data).where(eq(searchJobs.id, id));
}

export async function deleteSearchJob(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(searchJobs).where(eq(searchJobs.id, id));
}

/**
 * checkLeadDuplicate — PHASE 2 conservative duplicate detection
 *
 * Signal priority:
 *  1. exact normalizedPhone match → sufficient alone
 *  2. exact normalizedDomain + name overlap ≥ 0.6 → strong signal
 *  3. normalizedBusinessName alone → insufficient (reserved for manual review)
 */
export async function checkLeadDuplicate(
  phone: string,
  companyName: string,
  website?: string
): Promise<{ isDuplicate: boolean; candidateId: number | null; reason: string }> {
  const db = await getDb();
  if (!db) return { isDuplicate: false, candidateId: null, reason: "db_unavailable" };

  const normPhone = phone ? normalizePhone(phone) : "";
  const normName = companyName ? normalizeName(companyName) : "";
  const normDomain = website ? extractDomain(website) : "";

  // ── Signal 1: exact normalizedPhone match — sufficient alone ──────────────
  if (normPhone) {
    const byPhone = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.normalizedPhone, normPhone))
      .limit(1);
    if (byPhone.length > 0) {
      return { isDuplicate: true, candidateId: byPhone[0].id, reason: "exact_phone_match" };
    }
    // fallback: exact verifiedPhone (pre-PHASE2 records without normalizedPhone)
    const byVerifiedPhone = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.verifiedPhone, phone))
      .limit(1);
    if (byVerifiedPhone.length > 0) {
      return { isDuplicate: true, candidateId: byVerifiedPhone[0].id, reason: "exact_verified_phone_match" };
    }
  }

  // ── Signal 2: exact normalizedDomain + name overlap ≥ 0.6 ─────────────────
  if (normDomain && normName) {
    const byDomain = await db
      .select({ id: leads.id, normalizedBusinessName: leads.normalizedBusinessName })
      .from(leads)
      .where(eq(leads.normalizedDomain, normDomain))
      .limit(5);
    for (const candidate of byDomain) {
      const candName = candidate.normalizedBusinessName || "";
      if (candName && nameOverlapScore(normName, candName) >= 0.6) {
        return { isDuplicate: true, candidateId: candidate.id, reason: "domain_and_name_match" };
      }
    }
  }

  return { isDuplicate: false, candidateId: null, reason: "no_duplicate" };
}

/** nameOverlapScore — token overlap ratio (0-1) */
function nameOverlapScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) shared++; });
  return shared / Math.max(tokensA.size, tokensB.size);
}

// ===== PHASE 2: createLeadWithResolution =====
/**
 * createLeadWithResolution — safe wrapper around createLead()
 *
 * 1. Fills normalizedBusinessName, normalizedPhone, normalizedDomain
 * 2. Runs conservative duplicate detection
 * 3. إذا كان مكرراً → يُرجع null ولا يُنشئ سجلاً جديداً
 * 4. إذا لم يكن مكرراً → يُدرج عبر createLead()
 * 5. On any error → falls back to createLead() directly
 *
 * Returns: new lead id, or null if duplicate detected.
 */
export async function createLeadWithResolution(data: InsertLead): Promise<number | null> {
  try {
    const normalizedBusinessName = data.companyName ? normalizeName(data.companyName) : undefined;
    const normalizedPhone = data.verifiedPhone ? normalizePhone(data.verifiedPhone) : undefined;
    const normalizedDomain = data.website ? extractDomain(data.website) : undefined;

    const dupResult = await checkLeadDuplicate(
      data.verifiedPhone || "",
      data.companyName || "",
      data.website ?? undefined
    );

    // ── منع إدراج التكرار ──────────────────────────────────────────────────────
    if (dupResult.isDuplicate) {
      console.log(`[PHASE2] duplicate_blocked company="${data.companyName}" reason=${dupResult.reason} existing_id=${dupResult.candidateId}`);
      return null;
    }

    const enrichedData: InsertLead = {
      ...data,
      normalizedBusinessName: normalizedBusinessName ?? data.normalizedBusinessName,
      normalizedPhone: normalizedPhone ?? data.normalizedPhone,
      normalizedDomain: normalizedDomain ?? data.normalizedDomain,
      deduplicationStatus: "no_duplicate",
      duplicateCandidateIds: data.duplicateCandidateIds ?? [],
    };

    const id = await createLead(enrichedData);
    console.log(`[PHASE2] lead_created lead_id=${id} company="${data.companyName}"`);
    // PHASE 3 — autofill pipeline (non-blocking, structured observability)
    import("./autofill/index.js").then(({ runAutofill }) => {
      runAutofill(id).then(result => {
        console.log(`[AUTOFILL] lead_id=${id} filled=${result.fieldsUpdated.length} missing=${result.missingCount} readiness=${result.readinessState} confidence=${result.confidenceScore.toFixed(2)}`);
      }).catch((autofillErr: unknown) => {
        console.error(`[AUTOFILL] lead_id=${id} failed: ${autofillErr instanceof Error ? autofillErr.message : String(autofillErr)}`);
      });
    }).catch((importErr: unknown) => {
      console.error(`[AUTOFILL] import_failed lead_id=${id}: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
    });
    // PHASE 4 — enrichment pipeline (gated, non-blocking)
    import("./enrichment/index.js").then(({ runEnrichmentPipeline }) => {
      getLeadById(id).then(lead => {
        if (!lead) return;
        runEnrichmentPipeline(lead).then(r => {
          console.log(`[ENRICHMENT] lead_id=${id} gate=${r.gateResult} website=${r.websiteEnriched} social=${r.socialEnriched} errors=${r.errors.length}`);
        }).catch((e: unknown) => {
          console.error(`[ENRICHMENT] lead_id=${id} failed: ${e instanceof Error ? e.message : String(e)}`);
        });
      });
    }).catch((importErr: unknown) => {
      console.error(`[ENRICHMENT] import_failed lead_id=${id}: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
    });
    return id;
  } catch (err) {
    console.error(`[PHASE2] resolution_failed — fallback to createLead. Error: ${err instanceof Error ? err.message : String(err)}`);
    const id = await createLead(data);
    console.log(`[PHASE2] fallback_used lead_id=${id}`);
    // PHASE 3 — autofill on fallback path
    import("./autofill/index.js").then(({ runAutofill }) => {
      runAutofill(id).then(result => {
        console.log(`[AUTOFILL] fallback_path lead_id=${id} filled=${result.fieldsUpdated.length} missing=${result.missingCount} readiness=${result.readinessState}`);
      }).catch((autofillErr: unknown) => {
        console.error(`[AUTOFILL] fallback_path lead_id=${id} failed: ${autofillErr instanceof Error ? autofillErr.message : String(autofillErr)}`);
      });
    }).catch((importErr: unknown) => {
      console.error(`[AUTOFILL] import_failed fallback lead_id=${id}: ${importErr instanceof Error ? importErr.message : String(importErr)}`);
    });
    return id;
  }
}
// PHASE 3 — asset persistence deferred: linkAssetsToLead(leadId, assets: LeadAsset[])

// ===== CAMPAIGNS HELPERS =====
export async function getCampaigns(): Promise<Campaign[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}
export async function getCampaignById(id: number): Promise<Campaign | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0] || null;
}
export async function createCampaign(data: InsertCampaign): Promise<Campaign> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(campaigns).values(data);
  const id = (result as any).insertId as number;
  return (await getCampaignById(id))!;
}
export async function updateCampaign(id: number, data: Partial<InsertCampaign>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}
export async function deleteCampaign(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ===== REMINDERS HELPERS =====
export async function getReminders(filters?: { status?: string; leadId?: number }): Promise<Reminder[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(reminders.status, filters.status as any));
  if (filters?.leadId) conditions.push(eq(reminders.leadId, filters.leadId));
  const query = db.select().from(reminders);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(asc(reminders.dueDate));
  }
  return query.orderBy(asc(reminders.dueDate));
}
export async function getReminderById(id: number): Promise<Reminder | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  return result[0] || null;
}
export async function createReminder(data: InsertReminder): Promise<Reminder> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(reminders).values(data);
  const id = (result as any).insertId as number;
  return (await getReminderById(id))!;
}
export async function updateReminder(id: number, data: Partial<InsertReminder>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(reminders).set(data).where(eq(reminders.id, id));
}
export async function deleteReminder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(reminders).where(eq(reminders.id, id));
}
export async function getOverdueReminders(): Promise<Reminder[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(reminders)
    .where(and(
      eq(reminders.status, "pending"),
      sql`${reminders.dueDate} <= ${now}`
    ))
    .orderBy(asc(reminders.dueDate));
}
export async function getUpcomingReminders(daysAhead = 3): Promise<Reminder[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db.select().from(reminders)
    .where(and(
      eq(reminders.status, "pending"),
      sql`${reminders.dueDate} BETWEEN ${now} AND ${future}`
    ))
    .orderBy(asc(reminders.dueDate));
}

// ===== WEEKLY REPORTS HELPERS =====
export async function getWeeklyReports(): Promise<WeeklyReport[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyReports).orderBy(desc(weeklyReports.createdAt)).limit(20);
}
export async function getWeeklyReportById(id: number): Promise<WeeklyReport | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(weeklyReports).where(eq(weeklyReports.id, id)).limit(1);
  return result[0] || null;
}
export async function createWeeklyReport(data: InsertWeeklyReport): Promise<WeeklyReport> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(weeklyReports).values(data);
  const id = (result as any).insertId as number;
  return (await getWeeklyReportById(id))!;
}
export async function updateWeeklyReport(id: number, data: Partial<InsertWeeklyReport>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(weeklyReports).set(data).where(eq(weeklyReports.id, id));
}

// ===== helpers جدولة التقارير =====
export async function getReportSchedule(): Promise<ReportSchedule | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(reportSchedules).limit(1);
  return result[0] || null;
}

export async function upsertReportSchedule(data: Partial<InsertReportSchedule>): Promise<ReportSchedule> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getReportSchedule();
  if (existing) {
    await db.update(reportSchedules).set({ ...data, updatedAt: new Date() }).where(eq(reportSchedules.id, existing.id));
    return (await getReportSchedule())!;
  } else {
    const result = await db.insert(reportSchedules).values(data as InsertReportSchedule);
    const id = (result as any).insertId as number;
    const row = await db.select().from(reportSchedules).where(eq(reportSchedules.id, id)).limit(1);
    return row[0];
  }
}
