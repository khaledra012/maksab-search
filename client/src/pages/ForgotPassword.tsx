/**
 * صفحة نسيت كلمة المرور
 * Forgot Password Page
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const forgotPasswordMutation = trpc.staffAuth.forgotPassword.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setError("");
    },
    onError: (err) => {
      setError(err.message || "حدث خطأ. حاول مرة أخرى");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }
    setError("");
    forgotPasswordMutation.mutate({
      email: email.trim().toLowerCase(),
    });
  };

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
              <Mail className="w-6 h-6 text-purple-400" />
            </div>
            <CardTitle className="text-xl text-white">نسيت كلمة المرور؟</CardTitle>
            <CardDescription className="text-slate-400">
              أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="text-center py-4">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                  style={{ background: "rgba(34, 197, 94, 0.15)" }}
                >
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">تم إرسال الرابط!</h3>
                <p className="text-slate-400 text-sm mb-6">
                  إذا كان البريد الإلكتروني <strong className="text-purple-400">{email}</strong> مسجلاً في النظام،
                  ستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور خلال دقائق.
                </p>
                <p className="text-slate-500 text-xs mb-6">
                  تحقق من مجلد الرسائل غير المرغوب فيها (Spam) إذا لم تجد الرسالة.
                </p>
                <Link href="/staff-login">
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <ArrowRight className="w-4 h-4 ml-2" />
                    العودة لتسجيل الدخول
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert className="border-red-500/30 bg-red-500/10">
                    <AlertDescription className="text-red-400 text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@company.com"
                    dir="ltr"
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-purple-500"
                    disabled={forgotPasswordMutation.isPending}
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جارٍ الإرسال...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 ml-2" />
                      إرسال رابط إعادة التعيين
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
