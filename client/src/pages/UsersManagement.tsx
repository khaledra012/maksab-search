import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Users, UserPlus, Mail, Shield, Trash2, Copy, CheckCircle, Clock,
  XCircle, RefreshCw, Smartphone, MessageSquare, Activity, BarChart2,
  Ban, CheckSquare, Search, TrendingUp, Zap, Settings, Star,
  UserCheck, ChevronDown, ChevronRight,
} from "lucide-react";

// ===== تعريف الصلاحيات مع التصنيف =====
const PERMISSION_GROUPS = [
  {
    id: "leads",
    label: "إدارة العملاء",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    permissions: [
      { key: "leads.view", label: "عرض قائمة العملاء", desc: "يمكنه رؤية بيانات العملاء" },
      { key: "leads.add", label: "إضافة عملاء جدد", desc: "يمكنه إضافة عملاء للنظام" },
      { key: "leads.edit", label: "تعديل بيانات العملاء", desc: "يمكنه تعديل معلومات العميل" },
      { key: "leads.delete", label: "حذف العملاء", desc: "يمكنه حذف العملاء نهائياً" },
      { key: "leads.export", label: "تصدير البيانات", desc: "يمكنه تصدير قائمة العملاء CSV" },
    ],
  },
  {
    id: "whatsapp",
    label: "واتساب والتواصل",
    icon: MessageSquare,
    color: "text-green-400",
    bg: "bg-green-500/10",
    permissions: [
      { key: "whatsapp.send", label: "إرسال رسائل فردية", desc: "يمكنه إرسال رسائل لعملاء محددين" },
      { key: "whatsapp.bulk_send", label: "الإرسال الجماعي", desc: "يمكنه إرسال رسائل لقائمة عملاء" },
      { key: "whatsapp.view_all_chats", label: "عرض جميع المحادثات", desc: "يرى محادثات كل الموظفين" },
      { key: "whatsapp.settings", label: "إعدادات واتساب", desc: "يمكنه تعديل إعدادات الحسابات" },
    ],
  },
  {
    id: "search",
    label: "البحث والاستخراج",
    icon: Search,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    permissions: [
      { key: "search.use", label: "استخدام البحث الأساسي", desc: "يمكنه البحث في Google Maps وغيره" },
      { key: "search.extract", label: "استخراج البيانات", desc: "يمكنه استخراج بيانات من المواقع" },
      { key: "search.advanced", label: "البحث المتقدم", desc: "يمكنه استخدام محرك البحث الذكي" },
    ],
  },
  {
    id: "followup",
    label: "المتابعة مع العملاء",
    icon: UserCheck,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    permissions: [
      { key: "followup.view", label: "عرض قائمة المتابعة", desc: "يرى العملاء المطلوب متابعتهم" },
      { key: "followup.manage", label: "إدارة مواعيد المتابعة", desc: "يمكنه تعديل مواعيد المتابعة" },
      { key: "followup.assign", label: "تعيين متابعات للموظفين", desc: "يمكنه توزيع المتابعات على الفريق" },
    ],
  },
  {
    id: "analytics",
    label: "التحليل والتقارير",
    icon: BarChart2,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    permissions: [
      { key: "analytics.view", label: "عرض التحليلات", desc: "يرى الإحصائيات والرسوم البيانية" },
      { key: "analytics.export", label: "تصدير التقارير", desc: "يمكنه تصدير التقارير" },
      { key: "reports.view", label: "التقارير الموحدة", desc: "يرى صفحة التقارير الشاملة" },
    ],
  },
  {
    id: "settings",
    label: "الإعدادات",
    icon: Settings,
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    permissions: [
      { key: "templates.manage", label: "إدارة قوالب الرسائل", desc: "يمكنه إنشاء وتعديل القوالب" },
      { key: "ai.settings", label: "إعدادات الذكاء الاصطناعي", desc: "يمكنه تعديل إعدادات AI" },
    ],
  },
];

// ===== مجموعات الأدوار الجاهزة =====
const ROLE_PRESETS = [
  {
    id: "searcher",
    label: "باحث بيانات",
    desc: "يبحث ويستخرج بيانات العملاء من المنصات",
    icon: Search,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    permissions: ["leads.view", "leads.add", "search.use", "search.extract", "search.advanced"],
  },
  {
    id: "sender",
    label: "مسؤول إرسال",
    desc: "يرسل رسائل واتساب فردية وجماعية",
    icon: MessageSquare,
    color: "text-green-400",
    bg: "bg-green-500/10",
    permissions: ["leads.view", "whatsapp.send", "whatsapp.bulk_send", "whatsapp.view_all_chats"],
  },
  {
    id: "lead_manager",
    label: "مدير عملاء",
    desc: "يضيف ويعدل ويصدر بيانات العملاء",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    permissions: ["leads.view", "leads.add", "leads.edit", "leads.export"],
  },
  {
    id: "followup_agent",
    label: "موظف متابعة",
    desc: "يتابع مع العملاء ويرسل رسائل",
    icon: UserCheck,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    permissions: ["leads.view", "leads.edit", "followup.view", "followup.manage", "whatsapp.send"],
  },
  {
    id: "analyst",
    label: "محلل بيانات",
    desc: "يعرض التحليلات والتقارير فقط",
    icon: BarChart2,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    permissions: ["leads.view", "analytics.view", "analytics.export", "reports.view"],
  },
  {
    id: "full_access",
    label: "وصول كامل",
    desc: "جميع الصلاحيات ما عدا الإعدادات الحساسة",
    icon: Star,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    permissions: [
      "leads.view", "leads.add", "leads.edit", "leads.export",
      "whatsapp.send", "whatsapp.bulk_send", "whatsapp.view_all_chats",
      "search.use", "search.extract", "search.advanced",
      "followup.view", "followup.manage",
      "analytics.view", "reports.view",
      "templates.manage",
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
const PERMISSIONS_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => [p.key, p.label]))
);

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "في الانتظار", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="h-3 w-3" /> },
  accepted: { label: "مقبولة", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle className="h-3 w-3" /> },
  expired: { label: "منتهية", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: <XCircle className="h-3 w-3" /> },
  revoked: { label: "ملغاة", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="h-3 w-3" /> },
};

// ===== مكوّن اختيار الصلاحيات المتقدم =====
function PermissionsSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (perms: string[]) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(["leads", "whatsapp"]));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const prevArr = Array.from(prev);
      if (prev.has(groupId)) return new Set(prevArr.filter(x => x !== groupId));
      return new Set([...prevArr, groupId]);
    });
  };

  const togglePerm = (perm: string) => {
    if (selected.includes(perm)) onChange(selected.filter(p => p !== perm));
    else onChange([...selected, perm]);
  };

  const toggleGroupAll = (group: typeof PERMISSION_GROUPS[0]) => {
    const groupPerms = group.permissions.map(p => p.key);
    const allSelected = groupPerms.every(p => selected.includes(p));
    if (allSelected) onChange(selected.filter(p => !groupPerms.includes(p)));
    else onChange(Array.from(new Set([...selected, ...groupPerms])));
  };

  return (
    <div className="space-y-2">
      {/* أدوار جاهزة */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-2 font-medium">اختر دوراً جاهزاً أو خصص يدوياً:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ROLE_PRESETS.map(preset => {
            const Icon = preset.icon;
            const isActive = preset.permissions.every(p => selected.includes(p)) &&
              selected.length === preset.permissions.length;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange([...preset.permissions])}
                className={`flex items-center gap-2 p-2 rounded-lg border text-right transition-all text-xs ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${preset.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${preset.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{preset.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* صلاحيات مفصلة */}
      <div className="border rounded-lg overflow-hidden">
        {PERMISSION_GROUPS.map(group => {
          const Icon = group.icon;
          const isExpanded = expandedGroups.has(group.id);
          const groupPerms = group.permissions.map(p => p.key);
          const selectedCount = groupPerms.filter(p => selected.includes(p)).length;
          const allSelected = selectedCount === groupPerms.length;

          return (
            <div key={group.id} className="border-b last:border-b-0">
              <div
                className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleGroup(group.id)}
              >
                <div className={`w-7 h-7 rounded flex items-center justify-center ${group.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${group.color}`} />
                </div>
                <span className="flex-1 text-sm font-medium">{group.label}</span>
                <Badge variant="outline" className="text-xs h-5">
                  {selectedCount}/{groupPerms.length}
                </Badge>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); toggleGroupAll(group); }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    allSelected
                      ? "border-primary/50 text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                </button>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
              {isExpanded && (
                <div className="bg-muted/20 px-3 pb-2 space-y-1.5">
                  {group.permissions.map(perm => (
                    <div key={perm.key} className="flex items-start gap-2 py-1">
                      <Checkbox
                        id={`perm-${perm.key}`}
                        checked={selected.includes(perm.key)}
                        onCheckedChange={() => togglePerm(perm.key)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`perm-${perm.key}`} className="cursor-pointer flex-1">
                        <div className="text-sm">{perm.label}</div>
                        <div className="text-xs text-muted-foreground">{perm.desc}</div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UsersManagement() {
  const { user } = useAuth();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [invitePermissions, setInvitePermissions] = useState<string[]>(["leads.view", "search.use"]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    permissions: string[];
    defaultWhatsappAccountId?: string | null;
    dailyMessageLimit?: number;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const { data: invitations, isLoading: loadingInvitations } = trpc.invitations.listInvitations.useQuery();
  const { data: allUsers, isLoading: loadingUsers } = trpc.invitations.listUsers.useQuery();

  const utils = trpc.useUtils();

  const sendInvitation = trpc.invitations.sendInvitation.useMutation({
    onSuccess: (data) => {
      toast.success("تم إرسال الدعوة", { description: `رابط الدعوة: ${data.inviteUrl}` });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInvitePermissions(["leads.view", "search.use"]);
      void utils.invitations.listInvitations.invalidate();
      navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
      setCopiedLink(data.inviteUrl);
    },
    onError: (e) => toast.error("خطأ في إرسال الدعوة", { description: e.message }),
  });

  const revokeInvitation = trpc.invitations.revokeInvitation.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء الدعوة");
      void utils.invitations.listInvitations.invalidate();
    },
  });

  const updatePermissions = trpc.invitations.updateUserPermissions.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الصلاحيات");
      setEditingUser(null);
      void utils.invitations.listUsers.invalidate();
    },
    onError: (e) => toast.error("خطأ في الحفظ", { description: e.message }),
  });

  const setDefaultWa = trpc.invitations.setDefaultWhatsappAccount.useMutation({
    onSuccess: () => { void utils.invitations.listUsers.invalidate(); },
  });

  const toggleUserActive = trpc.invitations.toggleUserActive.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الحساب");
      void utils.invitations.listUsers.invalidate();
    },
  });

  const setUserDailyLimit = trpc.invitations.setUserDailyLimit.useMutation({
    onSuccess: () => { void utils.invitations.listUsers.invalidate(); },
  });

  const handleSendInvite = () => {
    if (!inviteEmail) return;
    sendInvitation.mutate({
      email: inviteEmail,
      role: inviteRole,
      permissions: invitePermissions,
      origin: window.location.origin,
    });
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">هذه الصفحة للمدير فقط</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            إدارة الفريق والصلاحيات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            دعوة الموظفين وتخصيص صلاحياتهم حسب دورهم في الفريق
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              دعوة موظف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                دعوة موظف جديد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>البريد الإلكتروني *</Label>
                  <Input
                    type="email"
                    placeholder="employee@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="mt-1"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>مستوى الوصول</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "user" | "admin")}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">موظف عادي</SelectItem>
                      <SelectItem value="admin">مدير (وصول كامل)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {inviteRole === "user" && (
                <div>
                  <Label className="mb-2 block">الصلاحيات المخصصة</Label>
                  <PermissionsSelector
                    selected={invitePermissions}
                    onChange={setInvitePermissions}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {invitePermissions.length} صلاحية محددة من {ALL_PERMISSIONS.length}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSendInvite}
                  disabled={sendInvitation.isPending || !inviteEmail}
                  className="flex-1"
                >
                  {sendInvitation.isPending ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : <Mail className="h-4 w-4 ml-2" />}
                  إرسال الدعوة
                </Button>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>إلغاء</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* رابط الدعوة المنسوخ */}
      {copiedLink && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-400">تم إرسال الدعوة ونسخ الرابط!</p>
                <p className="text-xs text-muted-foreground mt-1 truncate" dir="ltr">{copiedLink}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(copiedLink); toast.success("تم نسخ الرابط"); }}
                className="shrink-0"
              >
                <Copy className="h-3.5 w-3.5 ml-1" />
                نسخ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCopiedLink(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            الموظفون ({allUsers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            الدعوات ({invitations?.filter(i => i.status === "pending").length || 0})
          </TabsTrigger>
        </TabsList>

        {/* تبويب الموظفين */}
        <TabsContent value="users" className="mt-4">
          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {allUsers?.map((u) => {
                const userPerms = (u as { permissions?: string[] }).permissions || [];
                const isActive = (u as { isActive?: boolean }).isActive !== false;
                return (
                  <Card key={u.id} className={`transition-all ${!isActive ? "opacity-60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* أفاتار */}
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {(u.name || u.email || "?")[0].toUpperCase()}
                        </div>

                        {/* معلومات المستخدم */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{u.name || "بدون اسم"}</span>
                            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                              {u.role === "admin" ? "مدير" : "موظف"}
                            </Badge>
                            {!isActive && (
                              <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">معطّل</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" dir="ltr">{u.email}</p>

                          {/* الصلاحيات */}
                          {u.role !== "admin" && userPerms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {userPerms.slice(0, 5).map(p => (
                                <Badge key={p} variant="outline" className="text-xs h-5">
                                  {PERMISSIONS_LABELS[p] || p}
                                </Badge>
                              ))}
                              {userPerms.length > 5 && (
                                <Badge variant="outline" className="text-xs h-5 text-muted-foreground">
                                  +{userPerms.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}


                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => toggleUserActive.mutate({ userId: u.id, isActive: checked })}
                            title={isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingUser({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              permissions: userPerms,
                              defaultWhatsappAccountId: (u as { defaultWhatsappAccountId?: string | null }).defaultWhatsappAccountId,
                              dailyMessageLimit: (u as { dailyMessageLimit?: number }).dailyMessageLimit ?? 0,
                            })}
                          >
                            <Settings className="h-3.5 w-3.5 ml-1" />
                            تعديل
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!allUsers?.length && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>لا يوجد موظفون بعد. ابدأ بإرسال دعوة.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* تبويب الدعوات */}
        <TabsContent value="invitations" className="mt-4">
          {loadingInvitations ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {invitations?.map((inv) => {
                const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                const invPerms = (inv.permissions as string[]) || [];
                return (
                  <Card key={inv.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm" dir="ltr">{inv.email}</span>
                            <Badge className={`text-xs border ${statusCfg.color}`}>
                              <span className="flex items-center gap-1">{statusCfg.icon}{statusCfg.label}</span>
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {inv.role === "admin" ? "مدير" : "موظف"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            تنتهي: {new Date(inv.expiresAt).toLocaleDateString("ar-SA")}
                          </p>
                          {invPerms.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {invPerms.slice(0, 4).map(p => (
                                <Badge key={p} variant="outline" className="text-xs h-5">
                                  {PERMISSIONS_LABELS[p] || p}
                                </Badge>
                              ))}
                              {invPerms.length > 4 && (
                                <Badge variant="outline" className="text-xs h-5 text-muted-foreground">
                                  +{invPerms.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        {inv.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const url = `${window.location.origin}/accept-invitation?token=${inv.token}`;
                                navigator.clipboard.writeText(url);
                                toast.success("تم نسخ رابط الدعوة");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                              onClick={() => revokeInvitation.mutate({ id: inv.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!invitations?.length && (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>لا توجد دعوات. أرسل دعوة لموظف جديد.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* نافذة تعديل صلاحيات المستخدم */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                تعديل صلاحيات: {editingUser.name || editingUser.email}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* الدور */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>الدور</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(v) => setEditingUser({ ...editingUser, role: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">موظف عادي</SelectItem>
                      <SelectItem value="admin">مدير</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>حد الرسائل اليومية (0 = بلا حد)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={editingUser.dailyMessageLimit ?? 0}
                    onChange={e => setEditingUser({ ...editingUser, dailyMessageLimit: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>



              {/* الصلاحيات */}
              {editingUser.role !== "admin" && (
                <div>
                  <Label className="mb-2 block">الصلاحيات المخصصة</Label>
                  <PermissionsSelector
                    selected={editingUser.permissions}
                    onChange={(perms) => setEditingUser({ ...editingUser, permissions: perms })}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {editingUser.permissions.length} صلاحية محددة من {ALL_PERMISSIONS.length}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    updatePermissions.mutate({
                      userId: editingUser.id,
                      permissions: editingUser.permissions,
                      role: editingUser.role as "user" | "admin",
                    });
                    setDefaultWa.mutate({
                      userId: editingUser.id,
                      accountId: editingUser.defaultWhatsappAccountId || null,
                    });
                    if (editingUser.dailyMessageLimit !== undefined) {
                      setUserDailyLimit.mutate({
                        userId: editingUser.id,
                        limit: editingUser.dailyMessageLimit,
                      });
                    }
                  }}
                  disabled={updatePermissions.isPending}
                  className="flex-1"
                >
                  {updatePermissions.isPending ? <RefreshCw className="h-4 w-4 animate-spin ml-2" /> : null}
                  حفظ التغييرات
                </Button>
                <Button variant="outline" onClick={() => setEditingUser(null)}>إلغاء</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
