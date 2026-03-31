import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Eye, EyeOff, UserPlus, Loader2, AlertCircle, CheckCircle2,
  Mail, Shield, Clock, Key
} from "lucide-react";

// تسميات الصلاحيات
const PERMISSIONS_LABELS: Record<string, string> = {
  "leads.view": "عرض العملاء",
  "leads.add": "إضافة عملاء",
  "leads.edit": "تعديل العملاء",
  "leads.delete": "حذف العملاء",
  "leads.export": "تصدير البيانات",
  "whatsapp.send": "إرسال رسائل",
  "whatsapp.bulk_send": "الإرسال الجماعي",
  "whatsapp.view_all_chats": "عرض المحادثات",
  "whatsapp.settings": "إعدادات واتساب",
  "search.use": "البحث الأساسي",
  "search.extract": "استخراج البيانات",
  "search.advanced": "البحث المتقدم",
  "followup.view": "عرض المتابعة",
  "followup.manage": "إدارة المتابعة",
  "followup.assign": "تعيين متابعات",
  "analytics.view": "عرض التحليلات",
  "analytics.export": "تصدير التقارير",
  "reports.view": "التقارير الموحدة",
  "templates.manage": "إدارة القوالب",
  "ai.settings": "إعدادات AI",
};

export default function AcceptInvitation() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  // التحقق من صحة الدعوة وجلب تفاصيلها
  const { data: invitationData, isLoading: verifying } = trpc.staffAuth.verifyInvitationToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const acceptMutation = trpc.staffAuth.acceptInvitation.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("يرجى إدخال اسمك الكامل");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتَين");
      return;
    }
    if (!token) {
      setError("رابط الدعوة غير صحيح");
      return;
    }

    acceptMutation.mutate({ token, name, password });
  };

  // شاشة النجاح
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/80 border-slate-700 shadow-2xl w-full max-w-md text-center p-8">
          <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">تم إنشاء حسابك بنجاح!</h2>
          <p className="text-slate-400">جاري تحويلك للنظام...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* الشعار */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-green-500/30">
            <UserPlus className="text-white h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">إنشاء حسابك</h1>
          <p className="text-slate-400 mt-1 text-sm">تمت دعوتك للانضمام إلى نظام مكسب</p>
        </div>

        {/* حالة التحقق من الدعوة */}
        {!token && (
          <Card className="bg-slate-800/80 border-slate-700 shadow-2xl mb-4">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-yellow-400 font-medium">رابط الدعوة غير صحيح</p>
              <p className="text-slate-400 text-sm mt-1">تأكد من فتح الرابط المُرسَل إليك بالكامل</p>
            </CardContent>
          </Card>
        )}

        {token && verifying && (
          <Card className="bg-slate-800/80 border-slate-700 shadow-2xl mb-4">
            <CardContent className="p-6 text-center">
              <Loader2 className="h-8 w-8 text-blue-400 mx-auto mb-3 animate-spin" />
              <p className="text-slate-300">جاري التحقق من رابط الدعوة...</p>
            </CardContent>
          </Card>
        )}

        {token && !verifying && invitationData && !invitationData.valid && (
          <Card className="bg-slate-800/80 border-red-500/30 shadow-2xl mb-4">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 font-medium text-lg">رابط الدعوة غير صالح</p>
              <p className="text-slate-400 text-sm mt-2">{invitationData.reason}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.location.href = "/staff-login"}
              >
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        )}

        {token && !verifying && invitationData?.valid && (
          <>
            {/* بطاقة تفاصيل الدعوة */}
            <Card className="bg-slate-800/80 border-green-500/30 shadow-xl mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                  <p className="text-green-400 font-medium text-sm">رابط دعوة صالح</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300 truncate" dir="ltr">{invitationData.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-400" />
                    <Badge variant={invitationData.role === "admin" ? "default" : "secondary"} className="text-xs">
                      {invitationData.role === "admin" ? "مدير" : "موظف"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400 text-xs">
                    تنتهي في: {invitationData.expiresAt ? new Date(invitationData.expiresAt).toLocaleDateString("ar-SA", {
                        year: "numeric", month: "long", day: "numeric"
                      }) : "غير محدد"}
                    </span>
                  </div>
                </div>

                {/* الصلاحيات */}
                {invitationData.role !== "admin" && (invitationData.permissions?.length ?? 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Key className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-400">الصلاحيات الممنوحة:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(invitationData.permissions ?? []).map(p => (
                        <Badge key={p} variant="outline" className="text-xs h-5 border-slate-600 text-slate-300">
                          {PERMISSIONS_LABELS[p] || p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {invitationData.role === "admin" && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs">
                      وصول كامل لجميع الميزات
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* نموذج إنشاء الحساب */}
            <Card className="bg-slate-800/80 border-slate-700 shadow-2xl backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-xl text-center">أكمل إنشاء حسابك</CardTitle>
                <CardDescription className="text-slate-400 text-center text-sm">
                  أدخل بياناتك لتفعيل الحساب
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">اسمك الكامل *</Label>
                    <Input
                      type="text"
                      placeholder="مثال: محمد أحمد"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20"
                      disabled={acceptMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">كلمة المرور *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="6 أحرف على الأقل"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20 pr-10"
                        disabled={acceptMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">تأكيد كلمة المرور *</Label>
                    <Input
                      type="password"
                      placeholder="أعد إدخال كلمة المرور"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-green-500 focus:ring-green-500/20"
                      disabled={acceptMutation.isPending}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-medium py-2.5 shadow-lg shadow-green-500/20 transition-all duration-200"
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        جاري إنشاء الحساب...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 ml-2" />
                        إنشاء الحساب والدخول
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                  <p className="text-slate-500 text-xs">
                    لديك حساب بالفعل؟{" "}
                    <a href="/staff-login" className="text-green-400 hover:text-green-300">تسجيل الدخول</a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
