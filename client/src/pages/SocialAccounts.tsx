// @ts-nocheck
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Instagram, Link2, Link2Off, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, ExternalLink,
  Users, Key, Eye, EyeOff, Save, ChevronDown, ChevronUp,
  Settings2, Shield, Info
} from "lucide-react";

// ===== أيقونات المنصات =====
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
    <path d="M12.166 2c.93 0 4.369.26 5.975 3.607.522 1.1.397 2.957.298 4.42l-.008.13c-.01.148-.02.29-.027.425.3.15.878.337 1.73.18.12-.022.245-.034.37-.034.48 0 .9.2 1.07.52.22.42.06.93-.46 1.32-.07.05-.19.12-.35.2-.5.24-1.26.6-1.5 1.28-.06.17-.05.33.03.54l.01.02c.27.65 1.1 2.64-.26 3.54-.36.24-.78.35-1.26.35-.4 0-.84-.08-1.32-.24-.48-.16-.93-.24-1.35-.24-.46 0-.85.1-1.17.3-.52.32-1.03.97-1.5 1.57-.47.6-.96 1.22-1.6 1.6-.52.3-1.1.46-1.72.46-.62 0-1.2-.16-1.72-.46-.64-.38-1.13-1-1.6-1.6-.47-.6-.98-1.25-1.5-1.57-.32-.2-.71-.3-1.17-.3-.42 0-.87.08-1.35.24-.48.16-.92.24-1.32.24-.48 0-.9-.11-1.26-.35-1.36-.9-.53-2.89-.26-3.54l.01-.02c.08-.21.09-.37.03-.54-.24-.68-1-.04-1.5-1.28-.07-.18-.2-.37-.35-.47-.52-.39-.68-.9-.46-1.32.17-.32.59-.52 1.07-.52.125 0 .25.012.37.034.852.157 1.43-.03 1.73-.18-.007-.135-.017-.277-.027-.425l-.008-.13c-.099-1.463-.224-3.32.298-4.42C7.797 2.26 11.236 2 12.166 2z"/>
  </svg>
);

// ===== تعريف المنصات =====
const PLATFORMS = [
  {
    id: "instagram" as const,
    name: "إنستجرام",
    description: "ربط حساب Instagram Business لاستقبال وإرسال الرسائل المباشرة",
    icon: <Instagram className="w-6 h-6" />,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    badgeColor: "bg-purple-100 text-purple-700",
    appIdLabel: "Facebook App ID",
    appSecretLabel: "Facebook App Secret",
    appIdPlaceholder: "مثال: 123456789012345",
    appSecretPlaceholder: "أدخل App Secret",
    devLink: "https://developers.facebook.com/apps",
    devLinkText: "Meta Developers",
    setupSteps: [
      "اذهب إلى Meta Developers وأنشئ تطبيقاً جديداً",
      "أضف منتج Instagram Basic Display أو Instagram Graph API",
      "انسخ App ID وApp Secret من لوحة التحكم",
      "أضف Redirect URI: " + (import.meta.env.VITE_APP_URL || window.location.origin) + "/social-callback",
    ],
  },
  {
    id: "tiktok" as const,
    name: "تيك توك",
    description: "ربط حساب TikTok Business لعرض التعليقات والتفاعل مع الجمهور",
    icon: <TikTokIcon />,
    color: "from-gray-800 to-gray-600",
    bgColor: "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30",
    borderColor: "border-gray-200 dark:border-gray-800",
    badgeColor: "bg-gray-100 text-gray-700",
    appIdLabel: "TikTok Client Key",
    appSecretLabel: "TikTok Client Secret",
    appIdPlaceholder: "مثال: aw1234567890abcdef",
    appSecretPlaceholder: "أدخل Client Secret",
    devLink: "https://developers.tiktok.com",
    devLinkText: "TikTok Developers",
    setupSteps: [
      "اذهب إلى TikTok Developers وأنشئ تطبيقاً",
      "فعّل صلاحيات user.info.basic وvideo.list",
      "انسخ Client Key وClient Secret",
      "أضف Redirect URI: " + (import.meta.env.VITE_APP_URL || window.location.origin) + "/social-callback",
    ],
  },
  {
    id: "snapchat" as const,
    name: "سناب شات",
    description: "ربط حساب Snapchat Business لإدارة التفاعلات والرسائل",
    icon: <SnapchatIcon />,
    color: "from-yellow-400 to-yellow-500",
    bgColor: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    badgeColor: "bg-yellow-100 text-yellow-700",
    appIdLabel: "Snapchat Client ID",
    appSecretLabel: "Snapchat Client Secret",
    appIdPlaceholder: "مثال: abc123-def456-...",
    appSecretPlaceholder: "أدخل Client Secret",
    devLink: "https://kit.snapchat.com",
    devLinkText: "Snap Kit Developers",
    setupSteps: [
      "اذهب إلى Snap Kit وأنشئ تطبيقاً",
      "فعّل Login Kit وأضف الصلاحيات المطلوبة",
      "انسخ Client ID وClient Secret",
      "أضف Redirect URI: " + (import.meta.env.VITE_APP_URL || window.location.origin) + "/social-callback",
    ],
  },
];

// ===== مكوّن بطاقة إعداد المنصة =====
function PlatformCard({
  platform,
  accounts,
  credentials,
  onRefetch,
}: {
  platform: typeof PLATFORMS[0];
  accounts: Array<{ id: number; username: string; displayName?: string | null; profilePicUrl?: string | null; status: string; followersCount?: number | null }>;
  credentials: { appId?: string | null; _hasSecret?: boolean; isConfigured?: boolean } | null | undefined;
  onRefetch: () => void;
}) {
  // فتح قسم API تلقائياً إذا لم يكن مُعدّاً بعد
  const [showApiKeys, setShowApiKeys] = useState(!credentials?.isConfigured);
  const [showSecret, setShowSecret] = useState(false);
  const [appId, setAppId] = useState(credentials?.appId || "");
  const [appSecret, setAppSecret] = useState("");
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualToken, setManualToken] = useState({ accountId: "", username: "", accessToken: "" });
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const connectedAccount = accounts.find(a => a.status === "connected");
  const isConnected = !!connectedAccount;
  const isConfigured = credentials?.isConfigured || false;

  // تحديث الحقول عند تغيير credentials
  useEffect(() => {
    setAppId(credentials?.appId || "");
    // إغلاق قسم API تلقائياً بعد الإعداد
    if (credentials?.isConfigured) {
      setShowApiKeys(false);
    }
  }, [credentials?.appId, credentials?.isConfigured]);

  const saveCredentialsMutation = trpc.inbox.credentials.save.useMutation({
    onSuccess: (data) => {
      if (data.isConfigured) {
        toast.success("تم حفظ مفاتيح API", {
          description: `تم إعداد ${platform.name} بنجاح. يمكنك الآن ربط الحساب.`,
        });
      } else {
        toast.success("تم حفظ البيانات", {
          description: "يرجى إدخال App ID وApp Secret لإكمال الإعداد.",
        });
      }
      onRefetch();
    },
    onError: (err) => toast.error("فشل الحفظ", { description: err.message }),
  });

  const connectMutation = trpc.inbox.accounts.connect.useMutation({
    onSuccess: () => {
      toast.success("تم الربط بنجاح");
      onRefetch();
      setShowManualDialog(false);
      setManualToken({ accountId: "", username: "", accessToken: "" });
    },
    onError: (err) => toast.error("فشل الربط", { description: err.message }),
  });

  const disconnectMutation = trpc.inbox.accounts.disconnect.useMutation({
    onSuccess: () => { toast.success("تم قطع الاتصال"); onRefetch(); },
  });

  const deleteMutation = trpc.inbox.accounts.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الحساب"); onRefetch(); },
  });

  const { data: oauthData, refetch: refetchOAuth } = trpc.inbox.accounts.getOAuthUrl.useQuery(
    {
      platform: platform.id,
      redirectUri: `${import.meta.env.VITE_APP_URL || window.location.origin}/social-callback`,
    },
    { enabled: false }
  );

  const handleOAuthConnect = async () => {
    if (!isConfigured) {
      toast.error("يرجى حفظ مفاتيح API أولاً", {
        description: `أدخل ${platform.appIdLabel} و${platform.appSecretLabel} ثم اضغط حفظ`,
      });
      setShowApiKeys(true);
      return;
    }
    const result = await refetchOAuth();
    if (result.data?.url) {
      window.open(result.data.url, "_blank", "width=600,height=700");
    } else {
      toast.error("فشل الحصول على رابط الربط");
    }
  };

  const handleSaveCredentials = () => {
    if (!appId.trim()) {
      toast.error(`يرجى إدخال ${platform.appIdLabel}`);
      return;
    }
    saveCredentialsMutation.mutate({
      platform: platform.id,
      appId: appId.trim(),
      appSecret: appSecret.trim() || undefined,
    });
  };

  const handleManualConnect = () => {
    if (!manualToken.accountId || !manualToken.username || !manualToken.accessToken) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    connectMutation.mutate({
      platform: platform.id,
      accountId: manualToken.accountId,
      username: manualToken.username,
      accessToken: manualToken.accessToken,
    });
  };

  return (
    <>
      <Card className={`border-2 transition-all duration-200 ${isConnected ? platform.borderColor : "border-border"}`}>
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${platform.color} flex items-center justify-center text-white shadow-md`}>
              {platform.icon}
            </div>
            <div className="flex items-center gap-2">
              {isConfigured && (
                <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-300 bg-green-50">
                  <Key className="w-3 h-3" />
                  API مُعدّ
                </Badge>
              )}
              <Badge
                variant={isConnected ? "default" : "outline"}
                className={isConnected
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-green-200"
                  : "text-muted-foreground"
                }
              >
                {isConnected ? (
                  <><CheckCircle2 className="w-3 h-3 ml-1" />مربوط</>
                ) : (
                  <><XCircle className="w-3 h-3 ml-1" />غير مربوط</>
                )}
              </Badge>
            </div>
          </div>
          <CardTitle className="mt-3 text-lg">{platform.name}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{platform.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* معلومات الحساب المربوط */}
          {connectedAccount && (
            <div className={`p-3 rounded-xl ${platform.bgColor} space-y-2`}>
              <div className="flex items-center gap-2">
                {connectedAccount.profilePicUrl ? (
                  <img src={connectedAccount.profilePicUrl} alt={connectedAccount.username} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${platform.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {connectedAccount.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">@{connectedAccount.username}</p>
                  {connectedAccount.displayName && (
                    <p className="text-xs text-muted-foreground">{connectedAccount.displayName}</p>
                  )}
                </div>
              </div>
              {(connectedAccount.followersCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{connectedAccount.followersCount?.toLocaleString("ar-SA")} متابع</span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* قسم مفاتيح API */}
          <div className="space-y-2">
            <button
              className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setShowApiKeys(!showApiKeys)}
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span>إعداد مفاتيح API</span>
                {isConfigured && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                {!isConfigured && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
              </div>
              {showApiKeys ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showApiKeys && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                {/* رابط المطوّر */}
                <a
                  href={platform.devLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  احصل على المفاتيح من {platform.devLinkText}
                </a>

                {/* App ID */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{platform.appIdLabel} *</Label>
                  <Input
                    placeholder={platform.appIdPlaceholder}
                    value={appId}
                    onChange={e => setAppId(e.target.value)}
                    className="h-8 text-sm font-mono"
                    dir="ltr"
                  />
                </div>

                {/* App Secret */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {platform.appSecretLabel}
                    {credentials?._hasSecret && (
                      <span className="mr-2 text-green-600 font-normal">(محفوظ)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showSecret ? "text" : "password"}
                      placeholder={credentials?._hasSecret ? "••••••••••••" : platform.appSecretPlaceholder}
                      value={appSecret}
                      onChange={e => setAppSecret(e.target.value)}
                      className="h-8 text-sm font-mono pl-8"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {credentials?._hasSecret && (
                    <p className="text-xs text-muted-foreground">اتركه فارغاً للإبقاء على الـ Secret الحالي</p>
                  )}
                </div>

                {/* زر الحفظ */}
                <Button
                  size="sm"
                  className="w-full gap-1.5 h-8"
                  onClick={handleSaveCredentials}
                  disabled={saveCredentialsMutation.isPending}
                >
                  {saveCredentialsMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  حفظ مفاتيح API
                </Button>

                {/* دليل الإعداد */}
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                >
                  <Info className="w-3 h-3" />
                  {showSetupGuide ? "إخفاء" : "عرض"} خطوات الإعداد
                </button>
                {showSetupGuide && (
                  <div className="space-y-1.5 p-2 rounded bg-background border">
                    {platform.setupSteps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed" dir="rtl">{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* أزرار الإجراءات */}
          {isConnected ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1"
                onClick={() => disconnectMutation.mutate({ id: connectedAccount.id })}
                disabled={disconnectMutation.isPending}
              >
                <Link2Off className="w-4 h-4" />
                قطع الاتصال
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => deleteMutation.mutate({ id: connectedAccount.id })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* زر الربط عبر OAuth */}
              <Button
                className={`w-full gap-2 bg-gradient-to-r ${platform.color} text-white hover:opacity-90`}
                onClick={handleOAuthConnect}
                disabled={!isConfigured}
              >
                <Link2 className="w-4 h-4" />
                {isConfigured ? `ربط عبر ${platform.name}` : "أعدّ مفاتيح API أولاً"}
                {isConfigured && <ExternalLink className="w-3 h-3" />}
              </Button>

              {/* زر الربط اليدوي */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1 text-muted-foreground"
                onClick={() => setShowManualDialog(true)}
              >
                ربط يدوي بـ Access Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog الربط اليدوي */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ربط يدوي - {platform.name}</DialogTitle>
            <DialogDescription>أدخل بيانات الحساب يدوياً إذا كنت تملك Access Token</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>معرف الحساب (Account ID)</Label>
              <Input
                placeholder="مثال: 123456789"
                value={manualToken.accountId}
                onChange={e => setManualToken(prev => ({ ...prev, accountId: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المستخدم (Username)</Label>
              <Input
                placeholder="مثال: my_business_account"
                value={manualToken.username}
                onChange={e => setManualToken(prev => ({ ...prev, username: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input
                type="password"
                placeholder="أدخل الـ Access Token"
                value={manualToken.accessToken}
                onChange={e => setManualToken(prev => ({ ...prev, accessToken: e.target.value }))}
                dir="ltr"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleManualConnect}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <><RefreshCw className="w-4 h-4 ml-2 animate-spin" />جاري الربط...</>
              ) : (
                <><Link2 className="w-4 h-4 ml-2" />ربط الحساب</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== الصفحة الرئيسية =====
export default function SocialAccounts() {
  const { data: accounts, refetch: refetchAccounts } = trpc.inbox.accounts.list.useQuery();
  const { data: allCredentials, refetch: refetchCredentials } = trpc.inbox.credentials.getAll.useQuery();

  // معالجة OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state) {
      window.history.replaceState({}, "", window.location.pathname);
      try {
        const stateData = JSON.parse(atob(state));
        const platform = stateData.platform as "instagram" | "tiktok" | "snapchat";
        // سيتم معالجة الـ code في PlatformCard
        toast.info(`جاري ربط حساب ${platform}...`);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleRefetch = () => {
    refetchAccounts();
    refetchCredentials();
  };

  const connectedCount = accounts?.filter(a => a.status === "connected").length || 0;
  const configuredCount = allCredentials?.filter(c => c.isConfigured).length || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">حسابات التواصل الاجتماعي</h1>
            <p className="text-muted-foreground mt-1">
              اربط حساباتك على المنصات المختلفة لإدارة جميع رسائلك من مكان واحد
            </p>
          </div>
          <div className="flex items-center gap-2">
            {configuredCount > 0 && (
              <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50">
                <Key className="w-3 h-3" />
                {configuredCount} API مُعدّ
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              {connectedCount} مربوط
            </Badge>
          </div>
        </div>

        {/* تنبيه الإعداد */}
        {configuredCount === 0 && (
          <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">يلزم إعداد مفاتيح API</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                لربط أي منصة، يجب أولاً إدخال مفاتيح API الخاصة بها. انقر على "إعداد مفاتيح API" في بطاقة كل منصة.
              </p>
            </div>
          </div>
        )}

        {/* بطاقات المنصات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLATFORMS.map((platform) => {
            const platformAccounts = accounts?.filter(a => a.platform === platform.id) || [];
            const credentials = allCredentials?.find(c => c.platform === platform.id);
            return (
              <PlatformCard
                key={platform.id}
                platform={platform}
                accounts={platformAccounts}
                credentials={credentials}
                onRefetch={handleRefetch}
              />
            );
          })}
        </div>

        {/* جميع الحسابات المربوطة */}
        {(accounts?.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">جميع الحسابات المربوطة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accounts?.map((account) => {
                  const platform = PLATFORMS.find(p => p.id === account.platform);
                  return (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${platform?.color || "from-gray-400 to-gray-500"} flex items-center justify-center text-white`}>
                          {platform?.icon}
                        </div>
                        <div>
                          <p className="font-medium text-sm">@{account.username}</p>
                          <p className="text-xs text-muted-foreground">{platform?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={account.status === "connected"
                            ? "text-green-600 border-green-300 bg-green-50"
                            : "text-red-600 border-red-300 bg-red-50"
                          }
                        >
                          {account.status === "connected" ? "متصل" : "منقطع"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* معلومات الأمان */}
        <div className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">أمان البيانات</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
              يتم تخزين مفاتيح API بشكل آمن في قاعدة البيانات. لا تشارك هذه المفاتيح مع أي طرف آخر.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
