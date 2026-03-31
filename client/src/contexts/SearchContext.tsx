/**
 * SearchContext — نظام البحث في الخلفية
 * ========================================
 * يحفظ حالة البحث عند التنقل بين الصفحات
 * ويُشعر المستخدم عند انتهاء البحث
 */
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";

// ─── أنواع البيانات ───────────────────────────────────────────────────────────

export type PlatformId = "google" | "googleWeb" | "instagram" | "tiktok" | "snapchat" | "twitter" | "linkedin" | "facebook";

export type SearchStatus = "idle" | "running" | "completed" | "partial";

export interface SearchSession {
  id: string;
  keyword: string;
  city: string;
  startedAt: number;
  completedAt?: number;
  status: SearchStatus;
  results: Record<PlatformId, any[]>;
  loading: Record<PlatformId, boolean>;
  errors: Record<PlatformId, string | null>;
  totalFound: number;
  // إعدادات البحث
  targetCount: number;         // عدد النتائج المستهدفة
  autoSave: boolean;           // حفظ تلقائي
  autoMerge: boolean;          // دمج تلقائي
  selectedPlatforms: PlatformId[];
}

// ─── الفلاتر البيعية ──────────────────────────────────────────────────────────

export interface SalesFilters {
  // فلاتر الحضور الرقمي
  noWebsite: boolean;          // بدون موقع إلكتروني
  noPhone: boolean;            // بدون رقم هاتف
  lowFollowers: boolean;       // متابعون أقل من الحد
  lowFollowersThreshold: number; // الحد الأدنى للمتابعين
  inactiveAccount: boolean;    // حساب غير نشط (آخر نشر > X يوم)
  inactiveDays: number;        // عدد أيام الخمول
  lowRating: boolean;          // تقييم Google منخفض
  lowRatingThreshold: number;  // الحد الأدنى للتقييم
  noSocialMedia: boolean;      // بدون سوشيال ميديا
  fewReviews: boolean;         // تعليقات قليلة
  fewReviewsThreshold: number; // الحد الأدنى للتعليقات
  // فلاتر الفرصة
  missingFields: boolean;      // حقول مفقودة (فرصة للإثراء)
  newAccount: boolean;         // حساب جديد (أقل من X شهر)
  newAccountMonths: number;    // عدد الأشهر
}

export const DEFAULT_SALES_FILTERS: SalesFilters = {
  noWebsite: false,
  noPhone: false,
  lowFollowers: false,
  lowFollowersThreshold: 1000,
  inactiveAccount: false,
  inactiveDays: 30,
  lowRating: false,
  lowRatingThreshold: 3.5,
  noSocialMedia: false,
  fewReviews: false,
  fewReviewsThreshold: 10,
  missingFields: false,
  newAccount: false,
  newAccountMonths: 6,
};

// ─── Context Type ─────────────────────────────────────────────────────────────

export type AutoRunCallback = (results: { platform: PlatformId; results: any[] }[]) => Promise<void>;

interface SearchContextType {
  // الجلسة الحالية
  session: SearchSession | null;
  // الإعدادات
  targetCount: number;
  setTargetCount: (n: number) => void;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;
  autoMerge: boolean;
  setAutoMerge: (v: boolean) => void;
  selectedPlatforms: PlatformId[];
  setSelectedPlatforms: (p: PlatformId[]) => void;
  // الفلاتر البيعية
  salesFilters: SalesFilters;
  setSalesFilters: (f: SalesFilters) => void;
  updateSalesFilter: <K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => void;
  activeSalesFiltersCount: number;
  // دوال التحكم
  startSearch: (keyword: string, city: string) => void;
  updateResults: (platform: PlatformId, results: any[]) => void;
  updateLoading: (platform: PlatformId, loading: boolean) => void;
  updateError: (platform: PlatformId, error: string | null) => void;
  clearSession: () => void;
  // فلترة النتائج
  getFilteredResults: (platform: PlatformId) => any[];
  getAllFilteredResults: () => { platform: PlatformId; results: any[] }[];
  // إحصائيات
  isAnyLoading: boolean;
  totalResults: number;
  totalFiltered: number;
  // التنفيذ الأوتوماتيكي
  registerAutoRunCallback: (cb: AutoRunCallback | null) => void;
  autoRunStatus: "idle" | "running" | "done" | "error";
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SearchContext = createContext<SearchContextType | null>(null);

// ─── Helper: تطبيق الفلاتر البيعية على نتيجة واحدة ──────────────────────────

function applyBusinessFilters(result: any, filters: SalesFilters): boolean {
  // فلتر: بدون موقع
  if (filters.noWebsite) {
    const hasWebsite = result.website || result.externalUrl || result.websiteUrl;
    if (hasWebsite) return false;
  }

  // فلتر: بدون هاتف
  if (filters.noPhone) {
    const hasPhone = result.phone || result.formatted_phone_number || result.phones?.length > 0;
    if (hasPhone) return false;
  }

  // فلتر: متابعون أقل من الحد
  if (filters.lowFollowers) {
    const followers = result.followers || result.followersCount || result.follower_count || 0;
    if (followers >= filters.lowFollowersThreshold) return false;
  }

  // فلتر: حساب غير نشط
  if (filters.inactiveAccount) {
    const lastPost = result.lastPostDate || result.lastActivity || result.recentPostDate;
    if (lastPost) {
      const daysSince = (Date.now() - new Date(lastPost).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < filters.inactiveDays) return false;
    }
  }

  // فلتر: تقييم منخفض
  if (filters.lowRating) {
    const rating = result.rating || result.score || 0;
    if (rating === 0) return true; // بدون تقييم → مشمول
    if (rating >= filters.lowRatingThreshold) return false;
  }

  // فلتر: تعليقات قليلة
  if (filters.fewReviews) {
    const reviews = result.user_ratings_total || result.reviewCount || result.reviews_count || 0;
    if (reviews >= filters.fewReviewsThreshold) return false;
  }

  // فلتر: بدون سوشيال ميديا
  if (filters.noSocialMedia) {
    const hasSocial = result.instagramUrl || result.tiktokUrl || result.twitterUrl ||
      result.facebookUrl || result.snapchatUrl || result.linkedinUrl;
    if (hasSocial) return false;
  }

  // فلتر: حقول مفقودة
  if (filters.missingFields) {
    const missingCount = [
      !result.phone && !result.formatted_phone_number,
      !result.website,
      !result.bio && !result.description,
      !result.city,
    ].filter(Boolean).length;
    if (missingCount < 2) return false; // يجب أن يكون هناك حقلان مفقودان على الأقل
  }

  // فلتر: حساب جديد
  if (filters.newAccount) {
    const createdAt = result.createdAt || result.joinDate || result.accountCreated;
    if (createdAt) {
      const monthsOld = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > filters.newAccountMonths) return false;
    }
  }

  return true;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SearchSession | null>(null);
  const [targetCount, setTargetCount] = useState(25);
  const [autoSave, setAutoSave] = useState(false);
  const [autoMerge, setAutoMerge] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([
    "instagram", "tiktok", "googleWeb"
  ]);
  const [salesFilters, setSalesFilters] = useState<SalesFilters>(DEFAULT_SALES_FILTERS);
  const [autoRunStatus, setAutoRunStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const notifiedRef = useRef(false);
  const autoRunCallbackRef = useRef<AutoRunCallback | null>(null);

  const registerAutoRunCallback = useCallback((cb: AutoRunCallback | null) => {
    autoRunCallbackRef.current = cb;
  }, []);

  // ─── عدد الفلاتر النشطة ───────────────────────────────────────────────────
  const activeSalesFiltersCount = Object.entries(salesFilters).filter(([key, value]) => {
    // تجاهل الحقول الرقمية (threshold values)
    if (key.includes("Threshold") || key.includes("Days") || key.includes("Months")) return false;
    return value === true;
  }).length;

  // ─── تحديث فلتر واحد ─────────────────────────────────────────────────────
  const updateSalesFilter = useCallback(<K extends keyof SalesFilters>(key: K, value: SalesFilters[K]) => {
    setSalesFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // ─── بدء جلسة بحث جديدة ──────────────────────────────────────────────────
  const startSearch = useCallback((keyword: string, city: string) => {
    const emptyResults: Record<PlatformId, any[]> = {
      google: [], googleWeb: [], instagram: [], tiktok: [],
      snapchat: [], twitter: [], linkedin: [], facebook: []
    };
    const emptyLoading: Record<PlatformId, boolean> = {
      google: false, googleWeb: false, instagram: false, tiktok: false,
      snapchat: false, twitter: false, linkedin: false, facebook: false
    };
    const emptyErrors: Record<PlatformId, string | null> = {
      google: null, googleWeb: null, instagram: null, tiktok: null,
      snapchat: null, twitter: null, linkedin: null, facebook: null
    };

    notifiedRef.current = false;
    setSession({
      id: `search-${Date.now()}`,
      keyword,
      city,
      startedAt: Date.now(),
      status: "running",
      results: emptyResults,
      loading: emptyLoading,
      errors: emptyErrors,
      totalFound: 0,
      targetCount,
      autoSave,
      autoMerge,
      selectedPlatforms,
    });
  }, [targetCount, autoSave, autoMerge, selectedPlatforms]);

  // ─── تحديث نتائج منصة ────────────────────────────────────────────────────
  const updateResults = useCallback((platform: PlatformId, results: any[]) => {
    setSession(prev => {
      if (!prev) return prev;
      const newResults = { ...prev.results, [platform]: results };
      const total = Object.values(newResults).reduce((s, r) => s + r.length, 0);
      return { ...prev, results: newResults, totalFound: total };
    });
  }, []);

  // ─── تحديث حالة التحميل ──────────────────────────────────────────────────
  const updateLoading = useCallback((platform: PlatformId, isLoading: boolean) => {
    setSession(prev => {
      if (!prev) return prev;
      const newLoading = { ...prev.loading, [platform]: isLoading };
      const anyLoading = Object.values(newLoading).some(Boolean);

      // إذا انتهى البحث كله
      if (!anyLoading && prev.status === "running" && !notifiedRef.current) {
        const total = Object.values(prev.results).reduce((s, r) => s + r.length, 0);
        if (total > 0) {
          notifiedRef.current = true;
          const sessionSnapshot = prev;
          // إشعار الانتهاء
          setTimeout(() => {
            toast.success(`اكتمل البحث عن "${sessionSnapshot.keyword}"`, {
              description: `${total} نتيجة من ${sessionSnapshot.selectedPlatforms.length} منصات`,
              duration: 6000,
              action: {
                label: "عرض النتائج",
                onClick: () => { window.location.hash = "#/search-hub"; }
              }
            });
            // تنفيذ أوتوماتيكي إذا كان مفعلاً
            if ((sessionSnapshot.autoSave || sessionSnapshot.autoMerge) && autoRunCallbackRef.current) {
              setAutoRunStatus("running");
              const allResults = (Object.keys(sessionSnapshot.results) as PlatformId[]).map(p => ({
                platform: p,
                results: sessionSnapshot.results[p],
              }));
              autoRunCallbackRef.current(allResults)
                .then(() => {
                  setAutoRunStatus("done");
                  toast.success("تم الحفظ التلقائي", { description: `${total} عميل تم حفظهم` });
                })
                .catch(() => {
                  setAutoRunStatus("error");
                  toast.error("خطأ في الحفظ التلقائي");
                });
            }
          }, 500);
        }
      }

      return {
        ...prev,
        loading: newLoading,
        status: anyLoading ? "running" : "completed",
        completedAt: anyLoading ? undefined : Date.now(),
      };
    });
  }, []);

  // ─── تحديث خطأ منصة ──────────────────────────────────────────────────────
  const updateError = useCallback((platform: PlatformId, error: string | null) => {
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, errors: { ...prev.errors, [platform]: error } };
    });
  }, []);

  // ─── مسح الجلسة ──────────────────────────────────────────────────────────
  const clearSession = useCallback(() => {
    setSession(null);
    notifiedRef.current = false;
  }, []);

  // ─── فلترة نتائج منصة واحدة ──────────────────────────────────────────────
  const getFilteredResults = useCallback((platform: PlatformId): any[] => {
    if (!session) return [];
    const results = session.results[platform];
    const filtered = results.filter(r => applyBusinessFilters(r, salesFilters));
    return filtered.slice(0, targetCount);
  }, [session, salesFilters, targetCount]);

  // ─── فلترة جميع النتائج ──────────────────────────────────────────────────
  const getAllFilteredResults = useCallback(() => {
    if (!session) return [];
    return (Object.keys(session.results) as PlatformId[]).map(platform => ({
      platform,
      results: getFilteredResults(platform),
    }));
  }, [session, getFilteredResults]);

  // ─── إحصائيات ────────────────────────────────────────────────────────────
  const isAnyLoading = session ? Object.values(session.loading).some(Boolean) : false;
  const totalResults = session ? Object.values(session.results).reduce((s, r) => s + r.length, 0) : 0;
  const totalFiltered = session
    ? (Object.keys(session.results) as PlatformId[]).reduce((s, p) => s + getFilteredResults(p).length, 0)
    : 0;

  return (
    <SearchContext.Provider value={{
      session,
      targetCount, setTargetCount,
      autoSave, setAutoSave,
      autoMerge, setAutoMerge,
      selectedPlatforms, setSelectedPlatforms,
      salesFilters, setSalesFilters,
      updateSalesFilter,
      activeSalesFiltersCount,
      startSearch,
      updateResults,
      updateLoading,
      updateError,
      clearSession,
      getFilteredResults,
      getAllFilteredResults,
      isAnyLoading,
      totalResults,
      totalFiltered,
      registerAutoRunCallback,
      autoRunStatus,
    }}>
      {children}
    </SearchContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}
