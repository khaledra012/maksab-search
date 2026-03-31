/**
 * AdminGuard - مكوّن حماية الصفحات المخصصة للمدراء فقط
 * يمنع الموظفين العاديين من الوصول لصفحات الإدارة
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 text-center p-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.55 0.22 25 / 0.15)" }}
        >
          <Shield className="w-10 h-10" style={{ color: "oklch(0.65 0.22 25)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">غير مصرح بالوصول</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            هذه الصفحة مخصصة للمدراء فقط. إذا كنت تعتقد أن هذا خطأ، تواصل مع مدير النظام.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
