import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SocialCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [platformName, setPlatformName] = useState("");

  const exchangeCodeMutation = trpc.inbox.oauth.exchangeCode.useMutation({
    onSuccess: () => {
      setStatus("success");
      toast.success(`تم ربط حساب ${platformName} بنجاح!`);
      setTimeout(() => navigate("/social-accounts"), 2000);
    },
    onError: (err: { message: string }) => {
      setStatus("error");
      setErrorMessage(err.message);
      toast.error("فشل ربط الحساب: " + err.message);
      setTimeout(() => navigate("/social-accounts"), 3000);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const errorCode = params.get("error_code");
    const errorMessage = params.get("error_message");

    // حالة خطأ من Facebook/TikTok/Snapchat
    if (errorCode || errorMessage) {
      const msg = errorMessage
        ? decodeURIComponent(errorMessage.replace(/\+/g, " "))
        : `Error code: ${errorCode}`;
      setStatus("error");
      setErrorMessage(msg);
      toast.error("فشل تسجيل الدخول: " + msg);
      setTimeout(() => navigate("/social-accounts"), 4000);
      return;
    }

    // حالة نجاح - تبادل الـ code
    if (code && state) {
      try {
        const stateData = JSON.parse(atob(state));
        const platform = stateData.platform as "instagram" | "tiktok" | "snapchat";
        setPlatformName(platform);
        const redirectUri = `${import.meta.env.VITE_APP_URL || window.location.origin}/social-callback`;
        exchangeCodeMutation.mutate({ code, platform, redirectUri });
      } catch {
        setStatus("error");
        setErrorMessage("بيانات الـ state غير صالحة");
        setTimeout(() => navigate("/social-accounts"), 3000);
      }
      return;
    }

    // لا يوجد code ولا error - إعادة توجيه مباشرة
    navigate("/social-accounts");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      dir="rtl"
    >
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-semibold">جاري ربط الحساب...</h2>
            <p className="text-muted-foreground">يرجى الانتظار</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-600">تم الربط بنجاح!</h2>
            <p className="text-muted-foreground">سيتم تحويلك تلقائياً...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-600">فشل الربط</h2>
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            <p className="text-muted-foreground text-xs">سيتم تحويلك تلقائياً...</p>
          </>
        )}
      </div>
    </div>
  );
}
