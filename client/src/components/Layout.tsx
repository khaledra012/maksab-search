import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  LogOut,
  Users,
  Menu,
  X,
  Search,
  Shield,
  Zap,
  Globe,
  DatabaseZap,
  Brain,
  Bot,
  Settings2,
  ClipboardList,
  CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import Tutorial from "./Tutorial";

// ─────────────────────────────────────────────
// تعريف الأقسام الأربعة للقائمة الجانبية
// ─────────────────────────────────────────────

/** القسم الرئيسي — متاح لجميع المستخدمين (مع فلترة الصلاحيات) */
const MAIN_NAV = [
  { path: "/",              label: "لوحة التحكم",      icon: BarChart3,     permission: null },
  { path: "/leads",         label: "قائمة العملاء",    icon: Users,         permission: "leads.view" },
  { path: "/compare",       label: "مقارنة العملاء",   icon: BarChart3,     permission: "leads.view" },
  { path: "/search-hub",    label: "مركز البحث",       icon: Search,        permission: "search.use" },
  { path: "/serp-queue",    label: "محرك البحث المتقدم", icon: DatabaseZap,   permission: "search.use" },
];

/** قسم المتابعة — متاح لجميع المستخدمين */
const FOLLOWUP_NAV = [
  { path: "/ai-agent",       label: "وكيل الذكاء الاصطناعي", icon: Bot },
];

/** قسم الإعدادات — للأدمن فقط */
const SETTINGS_NAV = [
  { path: "/settings",          label: "الإعدادات",           icon: Settings2 },
  { path: "/seasons",           label: "المواسم التسويقية",  icon: CalendarDays },
  { path: "/reports",           label: "التقارير",           icon: BarChart3 },
  { path: "/users",             label: "إدارة المستخدمين", icon: Shield },
  { path: "/audit-log",         label: "سجل التدقيق",      icon: ClipboardList },
];

// ─────────────────────────────────────────────
// مكوّن NavItem — لتفادي تكرار الكود
// ─────────────────────────────────────────────
function NavItem({
  path,
  label,
  icon: Icon,
  isActive,
  badge,
  onClick,
}: {
  path: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link href={path} onClick={onClick}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
        }`}
        style={
          isActive
            ? {
                background: "oklch(0.65 0.18 200 / 0.12)",
                border: "1px solid oklch(0.65 0.18 200 / 0.2)",
                color: "var(--brand-cyan)",
              }
            : {}
        }
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: "oklch(0.55 0.22 25)" }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// مكوّن SectionLabel — عنوان القسم
// ─────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <p className="text-xs text-muted-foreground/50 font-semibold uppercase tracking-widest">
        {label}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// المكوّن الرئيسي Layout
// ─────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/staff-login",
  });
  const logout = trpc.auth.logout.useMutation();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // صلاحيات المستخدم
  const { data: myPerms } = trpc.invitations.myPermissions.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const userPermissionsList = myPerms?.permissions ?? [];
  const isAdmin = user?.role === "admin";

  // فلترة القسم الرئيسي حسب الصلاحيات
  const visibleMain = MAIN_NAV.filter((item) => {
    if (isAdmin) return true;
    if (!item.permission) return true;
    return userPermissionsList.includes(item.permission);
  });

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ─── Not authenticated ───
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">جارٍ تحويلك إلى صفحة الدخول...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout.mutateAsync();
    window.location.href = "/";
  };

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location === path || location.startsWith(path + "/");

  // ─── Layout ───
  return (
    <>
    <div className="min-h-screen flex bg-background" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ══════════════ Sidebar ══════════════ */}
      <aside
        className={`fixed top-0 right-0 h-full z-50 flex flex-col border-l border-border transition-all duration-300 lg:static lg:translate-x-0 w-64 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
        style={{ background: "oklch(0.11 0.012 240)" }}
      >
        {/* ── Logo ── */}
        <div className="border-b border-border flex items-center justify-between flex-shrink-0 p-4">
          <div className="flex items-center gap-3">
            <img
              src="/maksab-logo.svg"
              alt="مكسب"
              className="h-10 w-auto object-contain max-w-[160px]"
            />
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">

          {/* ── القسم الرئيسي ── */}
          {visibleMain.map((item) => (
            <NavItem
              key={item.path}
              path={item.path}
              label={item.label}
              icon={item.icon}
              isActive={isActive(item.path)}
              onClick={closeSidebar}
            />
          ))}

          {/* ── قسم المتابعة ── */}
          <SectionLabel label="متابعة" />
          {FOLLOWUP_NAV.map((item) => (
            <NavItem
              key={item.path}
              path={item.path}
              label={item.label}
              icon={item.icon}
              isActive={isActive(item.path)}
              badge={undefined}
              onClick={closeSidebar}
            />
          ))}

          {/* ── قسم الإعدادات (أدمن فقط) ── */}
          {isAdmin && (
            <>
              <SectionLabel label="إعدادات" />
              {SETTINGS_NAV.map((item) => (
                <NavItem
                  key={item.path}
                  path={item.path}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive(item.path)}
                  onClick={closeSidebar}
                />
              ))}
            </>
          )}
        </nav>

        {/* ── User section ── */}
        <div className="p-3 border-t border-border flex-shrink-0">
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2"
            style={{ background: "oklch(0.15 0.015 240)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: "oklch(0.65 0.18 200 / 0.2)",
                color: "var(--brand-cyan)",
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name || "المستخدم"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
            </div>
          </div>
          <button
            onClick={() => setShowTutorial(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all mb-1"
          >
            <Brain className="w-4 h-4" />
            كيف يعمل النظام؟
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* ══════════════ Main content ══════════════ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="h-14 border-b border-border flex items-center px-4 gap-3 flex-shrink-0"
          style={{ background: "oklch(0.11 0.012 240)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            <span>مجمع بيانات الأعمال</span>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">النظام يعمل</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
      </main>
    </div>
    {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </>
  );
}
