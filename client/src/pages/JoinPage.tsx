import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

export default function JoinPage() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const acceptInvitation = trpc.invitations.acceptInvitation.useMutation({
    onSuccess: () => {
      setStatus("success");
      toast.success("تم قبول الدعوة بنجاح!");
      setTimeout(() => navigate("/"), 2000);
    },
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message);
    },
  });

  const handleAccept = () => {
    if (!token) return;
    setStatus("loading");
    acceptInvitation.mutate({ token });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle>تسجيل الدخول مطلوب</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">يجب تسجيل الدخول أولاً لقبول الدعوة</p>
            <Button onClick={() => navigate("/")} className="w-full">
              الذهاب لتسجيل الدخول
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>رابط غير صالح</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">رابط الدعوة غير صحيح أو منتهي الصلاحية</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === "success" ? (
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
          ) : status === "error" ? (
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          ) : (
            <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
          )}
          <CardTitle>
            {status === "success"
              ? "تم قبول الدعوة!"
              : status === "error"
              ? "خطأ في الدعوة"
              : "دعوة للانضمام"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "idle" && (
            <>
              <p className="text-muted-foreground">
                أهلاً <strong>{user.name || user.email}</strong>، تمت دعوتك للانضمام إلى منصة بحثي.
              </p>
              <Button onClick={handleAccept} className="w-full" size="lg">
                قبول الدعوة والانضمام
              </Button>
            </>
          )}
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>جاري قبول الدعوة...</span>
            </div>
          )}
          {status === "success" && (
            <>
              <p className="text-muted-foreground">تم تفعيل حسابك بنجاح. سيتم تحويلك للصفحة الرئيسية...</p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </>
          )}
          {status === "error" && (
            <>
              <p className="text-destructive text-sm">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                العودة للرئيسية
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
