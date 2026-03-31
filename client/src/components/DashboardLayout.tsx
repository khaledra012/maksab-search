import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Users, UserPlus, Search,
  MessageSquare, Send, Smartphone, BarChart2, Globe, Bot, Database,
  MapPin, Upload, Key, ChevronDown, ChevronRight, TrendingUp,
  Activity, Shield, UserCheck, FileText, Zap, Target, PieChart,
  Settings, Heart, Phone, Star, BarChart, LineChart, Megaphone,
  Package, RefreshCw, AlertTriangle, Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

// ===== مجموعات القائمة المُعاد تصميمها =====
const menuGroups = [
  {
    group: "الرئيسية",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "لوحة التحكم", path: "/", badge: null },
    ]
  },
  {
    group: "العملاء والبيانات",
    icon: Users,
    items: [
      { icon: Users, label: "قائمة العملاء", path: "/leads", badge: null },
      { icon: UserPlus, label: "إضافة عميل", path: "/leads/add", badge: null },
      { icon: BarChart2, label: "مقارنة العملاء", path: "/compare", badge: "جديد" },
      { icon: Upload, label: "رفع جماعي", path: "/bulk-import", badge: null },
      { icon: MapPin, label: "المناطق", path: "/zones", badge: null },

    ]
  },

  {
    group: "التسويق الرقمي",
    icon: TrendingUp,
    items: [
      { icon: TrendingUp, label: "تحليل التسويق الرقمي", path: "/digital-marketing", badge: "جديد" },
      { icon: Target, label: "مركز البحث", path: "/search-hub", badge: null },
      { icon: Globe, label: "محرك البحث", path: "/engine", badge: null },
      { icon: Bot, label: "الاستكشاف الذكي", path: "/scout", badge: null },
      { icon: Search, label: "بحث سريع", path: "/search", badge: null },
    ]
  },
  {
    group: "المتابعة",
    icon: Zap,
    items: [
      { icon: FileText, label: "التقارير الأسبوعية", path: "/weekly-reports", badge: null },
      { icon: Zap, label: "تنشيط التواصل", path: "/activation", badge: "جديد" },
    ]
  },
  {
    group: "التحليلات والأداء",
    icon: BarChart,
    items: [
      { icon: BarChart2, label: "التقارير الموحدة", path: "/reports", badge: "جديد" },
      { icon: PieChart, label: "جودة البيانات", path: "/data-quality", badge: null },
      { icon: UserCheck, label: "أداء الموظفين", path: "/employee-performance", badge: null },
      { icon: Activity, label: "تحليل المحادثات", path: "/messages", badge: null },
    ]
  },
  {
    group: "الذكاء الاصطناعي",
    icon: Bot,
    items: [

      { icon: Key, label: "كلمات الاهتمام", path: "/interest-keywords", badge: null },
      { icon: FileText, label: "قاعدة المعرفة", path: "/knowledge-base", badge: null },
    ]
  },
  {
    group: "الإعدادات والإدارة",
    icon: Settings,
    items: [
      { icon: Settings, label: "الإعدادات الموحدة", path: "/settings", badge: null },
      { icon: Calendar, label: "المواسم التسويقية", path: "/seasons", badge: null },
      { icon: Shield, label: "إدارة المستخدمين", path: "/users", badge: null },
      { icon: FileText, label: "سجل التدقيق", path: "/audit-log", badge: null },
    ]
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">نظام CRM المتكامل</h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              منصة إدارة علاقات العملاء والذكاء الاصطناعي
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={() => { window.location.href = "/staff-login"; }}
              size="lg"
              className="w-full"
            >
              تسجيل الدخول كموظف
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            هل لديك رابط دعوة؟{" "}
            <a href="/accept-invitation" className="text-primary hover:underline">اضغط هنا لقبول الدعوة</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const unreadCount = 0;

  const activeItem = menuGroups.flatMap(g => g.items).find(item => {
    if (item.path === "/") return location === "/";
    return location.startsWith(item.path);
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border/50" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-14 border-b border-border/50">
            <div className="flex items-center gap-2.5 px-2 h-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors shrink-0"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img
                    src="/maksab-logo.svg"
                    alt="مكسب"
                    className="h-8 w-auto object-contain max-w-[140px]"
                  />
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Content */}
          <SidebarContent className="overflow-y-auto py-2" dir="rtl">
            {menuGroups.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.group];
              const GroupIcon = group.icon;
              return (
                <div key={group.group} className="mb-0.5">
                  {/* عنوان المجموعة */}
                  {!isCollapsed && (
                    <button
                      onClick={() => toggleGroup(group.group)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest hover:text-muted-foreground transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <GroupIcon className="w-3 h-3" />
                        <span>{group.group}</span>
                      </div>
                      {isGroupCollapsed
                        ? <ChevronRight className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                      }
                    </button>
                  )}
                  {/* عناصر المجموعة */}
                  {(!isGroupCollapsed || isCollapsed) && (
                    <SidebarMenu className="px-2 gap-0.5">
                      {group.items.map(item => {
                        const isActive = item.path === "/"
                          ? location === "/"
                          : location.startsWith(item.path);
                        const showUnread = item.badge === "unread" && unreadCount > 0;
                        const showBadge = item.badge && item.badge !== "unread";
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className={`h-8 transition-all text-sm relative ${isActive ? "font-medium" : "font-normal"}`}
                            >
                              <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                              <span className="truncate flex-1">{item.label}</span>
                              {showUnread && !isCollapsed && (
                                <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                              )}
                              {showBadge && !isCollapsed && (
                                <span className="ml-auto bg-green-500/20 text-green-400 text-[9px] font-bold rounded px-1 py-0.5">
                                  {item.badge}
                                </span>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  )}
                  {/* فاصل بين المجموعات */}
                  {!isCollapsed && <div className="mx-3 my-1 border-t border-border/30" />}
                </div>
              );
            })}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-2 border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/60 transition-colors w-full focus:outline-none">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 text-right">
                      <p className="text-xs font-semibold truncate leading-none">{user?.name || "-"}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-1">{user?.email || "-"}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize Handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="!flex !flex-col !overflow-hidden" style={{ height: '100vh' }}>
        {isMobile && (
          <div className="flex border-b h-12 items-center justify-between bg-background/95 px-3 backdrop-blur sticky top-0 z-40 flex-shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
              <span className="text-sm font-medium">{activeItem?.label ?? "القائمة"}</span>
            </div>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </div>
        )}
        <div className="flex-1 overflow-hidden min-h-0" style={{ position: 'relative' }}>{children}</div>
      </SidebarInset>
    </>
  );
}
