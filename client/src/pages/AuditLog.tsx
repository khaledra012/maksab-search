// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Shield, Search, Filter, Clock, User, Activity, ChevronDown } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "تسجيل دخول", color: "bg-green-500/20 text-green-400" },
  logout: { label: "تسجيل خروج", color: "bg-gray-500/20 text-gray-400" },
  message_sent: { label: "إرسال رسالة", color: "bg-blue-500/20 text-blue-400" },
  lead_created: { label: "إضافة عميل", color: "bg-purple-500/20 text-purple-400" },
  lead_updated: { label: "تعديل عميل", color: "bg-yellow-500/20 text-yellow-400" },
  lead_deleted: { label: "حذف عميل", color: "bg-red-500/20 text-red-400" },
  chat_assigned: { label: "تعيين محادثة", color: "bg-cyan-500/20 text-cyan-400" },
  chat_closed: { label: "إغلاق محادثة", color: "bg-orange-500/20 text-orange-400" },
  user_invited: { label: "دعوة مستخدم", color: "bg-indigo-500/20 text-indigo-400" },
  permissions_updated: { label: "تحديث صلاحيات", color: "bg-pink-500/20 text-pink-400" },
  bulk_send: { label: "إرسال جماعي", color: "bg-teal-500/20 text-teal-400" },
  export_data: { label: "تصدير بيانات", color: "bg-amber-500/20 text-amber-400" },
};

const ENTITY_LABELS: Record<string, string> = {
  chat: "محادثة",
  lead: "عميل",
  user: "مستخدم",
  message: "رسالة",
  campaign: "حملة",
  template: "قالب",
};

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getActionConfig(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: "bg-white/10 text-white/60" };
}

export default function AuditLog() {
  const [limit, setLimit] = useState(50);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [searchUser, setSearchUser] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logsData, isLoading, refetch } = trpc.auditLog.getAll.useQuery({
    limit,
    action: filterAction !== "all" ? filterAction : undefined,
    // entityType: filterEntity !== "all" ? filterEntity : undefined,
  });
  const logs = Array.isArray(logsData) ? logsData : (logsData?.logs ?? []);

  const { data: stats } = trpc.auditLog.getStats.useQuery();

  const filteredLogs = (logs as Array<{
    id: number;
    userId: number | null;
    userName: string | null;
    action: string;
    // entityType: string | null;
    entityId: string | null;
    details: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: Date | string;
  }>).filter(log => {
    if (!searchUser) return true;
    return (log.userName || "").toLowerCase().includes(searchUser.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">سجل التدقيق</h1>
            <p className="text-sm text-muted-foreground">تتبع جميع العمليات والأنشطة في النظام</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* إحصائيات اليوم */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-400 opacity-80" />
                <div>
                  <p className="text-2xl font-bold text-white">{stats.today}</p>
                  <p className="text-xs text-muted-foreground">عملية اليوم</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {Object.entries(stats.byAction).slice(0, 3).map(([action, count]) => {
            const cfg = getActionConfig(action);
            return (
              <Card key={action} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cfg.color}`}>
                      {String(count)}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{String(count)}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* فلاتر */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                placeholder="بحث باسم المستخدم..."
                className="pr-9 h-9 text-sm"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <Filter className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
                <SelectValue placeholder="نوع العملية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العمليات</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="نوع الكيان" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الكيانات</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
              <SelectTrigger className="w-[100px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 سجل</SelectItem>
                <SelectItem value="50">50 سجل</SelectItem>
                <SelectItem value="100">100 سجل</SelectItem>
                <SelectItem value="200">200 سجل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول السجلات */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            السجلات ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-12 h-12 opacity-20 mb-3" />
              <p className="text-sm">لا توجد سجلات</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredLogs.map(log => {
                const actionCfg = getActionConfig(log.action);
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} className="hover:bg-white/2 transition-colors">
                    <div
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      {/* الوقت */}
                      <div className="w-36 flex-shrink-0">
                        <p className="text-xs text-muted-foreground font-mono">{formatDate(log.createdAt)}</p>
                      </div>
                      {/* المستخدم */}
                      <div className="w-32 flex-shrink-0 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {(log.userName || "?").slice(0, 2)}
                        </div>
                        <span className="text-sm text-white truncate">{log.userName || "نظام"}</span>
                      </div>
                      {/* العملية */}
                      <div className="flex-1">
                        <Badge className={`text-xs border-0 ${actionCfg.color}`}>
                          {actionCfg.label}
                        </Badge>
                      </div>
                      {/* الكيان */}
                      {(log as any).entityType && (
                        <div className="w-24 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {ENTITY_LABELS[(log as any).entityType] ?? (log as any).entityType}
                            {log.entityId ? ` #${log.entityId}` : ""}
                          </span>
                        </div>
                      )}
                      {/* IP */}
                      {log.ipAddress && (
                        <div className="w-28 flex-shrink-0 hidden md:block">
                          <span className="text-xs text-muted-foreground font-mono">{log.ipAddress}</span>
                        </div>
                      )}
                      {/* توسيع */}
                      {log.details && (
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      )}
                    </div>
                    {/* التفاصيل الموسّعة */}
                    {isExpanded && log.details && (
                      <div className="px-4 pb-3 pt-1 bg-white/2">
                        <div className="rounded-lg p-3 bg-black/20 text-xs font-mono text-muted-foreground overflow-x-auto">
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
