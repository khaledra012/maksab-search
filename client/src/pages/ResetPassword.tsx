/**
 * صفحة إعادة تعيين كلمة المرور
 * Reset Password Page
 */
import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, ArrowRight } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // استخراج الـ token من URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setError("رابط إعادة التعيين غير صحيح أو منتهي الصلاحية");
    }
  }, []);

  const resetPasswordMutation = trpc.staffAuth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError("");
      // إعادة توجيه لصفحة الدخول بعد 3 ثوانٍ
      setTimeout(() => {
        setLocation("/staff-login");
      }, 3000);
    },
    onError: (err) => {
      setError(err.message || "حدث خطأ. حاول مرة أخرى");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("رابط إعادة التعيين غير صحيح");
      return;
    }

    if (newPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    resetPasswordMutation.mutate({ token, password: newPassword });
  };

  // قوة كلمة المرور
  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { level: 1, label: "ضعيفة", color: "#ef4444" };
    if (score <= 2) return { level: 2, label: "متوسطة", color: "#f59e0b" };
    if (score <= 3) return { level: 3, label: "جيدة", color: "#3b82f6" };
    return { level: 4, label: "قوية", color: "#22c55e" };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
    >
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #2563eb, transparent)" }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* شعار */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold text-white mb-4"
            style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
          >
            م
          </div>
          <h1 className="text-2xl font-bold text-white">مكسب للمبيعات</h1>
          <p className="text-slate-400 text-sm mt-1">نظام إدارة العملاء</p>
        </div>

        <Card
          className="border-slate-700/50 shadow-2xl"
          style={{ background: "rgba(30, 41, 59, 0.9)", backdropFilter: "blur(20px)" }}
        >
          <CardHeader className="text-center pb-4">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-3"
              style={{ background: "rgba(124, 58, 237, 0.2)" }}
            >
              <Lock className="w-6 h-6 text-purple-400" />
            </div>
            <CardTitle className="text-xl text-white">إعادة تعيين كلمة المرور</CardTitle>
            <CardDescription className="text-slate-400">
              أنشئ كلمة مرور جديدة لحسابك
            </CardDescription>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="text-center py-4">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{ background: "rgba(34, 197, 94, 0.15)" }}
                >
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">تم تغيير كلمة المرور!</h3>
                <p className="text-slate-400 text-sm mb-4">
                  تم تحديث كلمة المرور بنجاح. سيتم توجيهك لصفحة تسجيل الدخول...
                </p>
                <Link href="/staff-login">
                  <Button
                    className="w-full font-semibold"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                  >
                    <ArrowRight className="w-4 h-4 ml-2" />
                    تسجيل الدخول الآن
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert className="border-red-500/30 bg-red-500/10">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <AlertDescription className="text-red-400 text-sm mr-2">{error}</AlertDescription>
                  </Alert>
                )}

                {!token && !error && (
                  <Alert className="border-yellow-500/30 bg-yellow-500/10">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-400 text-sm mr-2">
                      رابط غير صحيح. تأكد من استخدام الرابط الكامل من الإيميل.
                    </AlertDescription>
                  </Alert>
                )}

                {/* كلمة المرور الجديدة */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-300">
                    كلمة المرور الجديدة
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="8 أحرف على الأقل"
                      dir="ltr"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 pl-10"
                      disabled={resetPasswordMutation.isPending || !token}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* مؤشر القوة */}
                  {newPassword.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{
                              background: i <= strength.level ? strength.color : "#334155",
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: strength.color }}>
                        قوة كلمة المرور: {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* تأكيد كلمة المرور */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">
                    تأكيد كلمة المرور
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد إدخال كلمة المرور"
                      dir="ltr"
                      className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500 pl-10"
                      disabled={resetPasswordMutation.isPending || !token}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-400">كلمتا المرور غير متطابقتين</p>
                  )}
                  {confirmPassword.length > 0 && newPassword === confirmPassword && (
                    <p className="text-xs text-green-400">✓ كلمتا المرور متطابقتان</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                  disabled={resetPasswordMutation.isPending || !token}
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جارٍ التحديث...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 ml-2" />
                      تعيين كلمة المرور الجديدة
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <Link href="/staff-login">
                    <button
                      type="button"
                      className="text-sm text-slate-400 hover:text-purple-400 transition-colors"
                    >
                      <ArrowRight className="w-3 h-3 inline ml-1" />
                      العودة لتسجيل الدخول
                    </button>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
