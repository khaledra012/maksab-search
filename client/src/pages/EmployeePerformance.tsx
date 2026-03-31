// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Users, TrendingUp, AlertTriangle, CheckCircle, Clock,
  MessageCircle, BarChart2, Award, Target, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EmployeeStats = {
  id: number;
  name: string;
  email: string | null;
  totalChats: number;
  closedChats: number;
  closeRate: number;
  missRate: number;
  performanceScore: number;
  missedOpportunities: number;
  positiveChats: number;
  negativeChats: number;
  avgMessages: number;
};

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof TrendingUp; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-[#8696a0]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-[#8696a0] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function EmployeePerformance() {
  const [days, setDays] = useState(7);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);

    
  const employees: EmployeeStats[] = (perfData ?? []) as EmployeeStats[];
  // إحصائيات إجمالية محسوبة من بيانات الموظفين
  const overallStats = employees.length > 0 ? {
    totalChats: employees.reduce((s, e) => s + e.totalChats, 0),
    closedChats: employees.reduce((s, e) => s + e.closedChats, 0),
    missedOpportunities: employees.reduce((s, e) => s + e.missedOpportunities, 0),
    positiveChats: employees.reduce((s, e) => s + e.positiveChats, 0),
    neutralChats: 0,
    negativeChats: employees.reduce((s, e) => s + e.negativeChats, 0),
    avgMessages: Math.round(employees.reduce((s, e) => s + e.avgMessages, 0) / employees.length),
    closeRate: Math.round(employees.reduce((s, e) => s + e.closeRate, 0) / employees.length),
  } : null;

  return (
    <div className="min-h-screen p-6" style={{ background: "#111b21", color: "white" }} dir="rtl">
      {/* الرأس */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#25D366]" />
            تحليل أداء الموظفين
          </h1>
          <p className="text-sm text-[#8696a0] mt-1">كشف نقاط الضعف والفرص المهجورة</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <Button key={d} size="sm" onClick={() => setDays(d)}
              className="text-xs"
              style={{
                background: days === d ? "#25D366" : "rgba(255,255,255,0.08)",
                color: days === d ? "white" : "#8696a0",
                border: "none",
              }}>
              {d} يوم
            </Button>
          ))}
        </div>
      </div>

      {/* إحصائيات عامة */}
      {overallStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={MessageCircle} label="إجمالي المحادثات" value={overallStats.totalChats} color="#25D366" />
          <StatCard icon={CheckCircle} label="معدل الإغلاق" value={`${overallStats.closeRate}%`} sub={`${overallStats.closedChats} محادثة`} color="#34B7F1" />
          <StatCard icon={AlertTriangle} label="فرص مهجورة" value={overallStats.missedOpportunities} sub="تحتاج مراجعة" color="#ef4444" />
          <StatCard icon={Clock} label="متوسط الرسائل" value={overallStats.avgMessages} sub="رسالة/محادثة" color="#f59e0b" />
        </div>
      )}

      {/* توزيع المشاعر */}
      {overallStats && (
        <div className="p-4 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#25D366]" />
            توزيع مشاعر المحادثات
          </h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#25D366]">إيجابي</span>
                <span className="text-[#8696a0]">{overallStats.positiveChats}</span>
              </div>
              <ScoreBar value={overallStats.positiveChats} max={overallStats.totalChats} color="#25D366" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#f59e0b]">محايد</span>
                <span className="text-[#8696a0]">{overallStats.neutralChats ?? 0}</span>
              </div>
              <ScoreBar value={overallStats.neutralChats ?? 0} max={overallStats.totalChats} color="#f59e0b" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-400">سلبي</span>
                <span className="text-[#8696a0]">{overallStats.negativeChats}</span>
              </div>
              <ScoreBar value={overallStats.negativeChats} max={overallStats.totalChats} color="#ef4444" />
            </div>
          </div>
        </div>
      )}

      {/* جدول الموظفين */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-[#25D366]" />
            أداء الموظفين التفصيلي
          </h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-[#8696a0]">جاري التحميل...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-[#8696a0] mx-auto mb-2 opacity-30" />
            <p className="text-[#8696a0] text-sm">لا توجد بيانات موظفين بعد</p>
            <p className="text-[#8696a0] text-xs mt-1">عيّن محادثات للموظفين من صفحة الشات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th className="text-right p-3 text-[#8696a0] font-medium">الموظف</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">المحادثات</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">معدل الإغلاق</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">وقت الرد</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">فرص مهجورة</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">المشاعر</th>
                  <th className="text-center p-3 text-[#8696a0] font-medium">التقييم</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const score = emp.performanceScore;
                  const scoreColor = score >= 70 ? "#25D366" : score >= 40 ? "#f59e0b" : "#ef4444";
                  const scoreLabel = score >= 70 ? "ممتاز" : score >= 40 ? "متوسط" : "يحتاج تحسين";
                  return (
                    <tr key={emp.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: "rgba(37,211,102,0.15)", color: "#25D366" }}>
                            {(emp.name || "م").slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{emp.name || "موظف"}</p>
                            {emp.email && (
                              <p className="text-[10px] text-[#8696a0]">{emp.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-white font-medium">{emp.totalChats}</span>
                        <span className="text-[#8696a0] text-xs"> / {emp.closedChats} مغلق</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold" style={{ color: emp.closeRate >= 50 ? "#25D366" : emp.closeRate >= 25 ? "#f59e0b" : "#ef4444" }}>
                          {emp.closeRate}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-white">—</span>
                      </td>
                      <td className="p-3 text-center">
                        {emp.missedOpportunities > 0 ? (
                          <Badge className="text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                            {emp.missedOpportunities} فرصة
                          </Badge>
                        ) : (
                          <span className="text-[#25D366] text-xs">لا شيء</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs">
                          <span className="text-[#25D366]">{emp.positiveChats}+</span>
                          <span className="text-[#8696a0]">/</span>
                          <span className="text-red-400">{emp.negativeChats}-</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg font-bold" style={{ color: scoreColor }}>{score}</span>
                          <span className="text-[10px]" style={{ color: scoreColor }}>{scoreLabel}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedEmployee(selectedEmployee?.id === emp.id ? null : emp)}
                          className="text-[#8696a0] hover:text-white transition-colors"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${selectedEmployee?.id === emp.id ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تفاصيل الموظف المختار */}
      {selectedEmployee && (
        <div className="p-5 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#25D366]" />
            تحليل تفصيلي: {selectedEmployee.name}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs text-[#8696a0] mb-1">معدل الإغلاق</p>
              <ScoreBar value={selectedEmployee.closeRate} color={selectedEmployee.closeRate >= 50 ? "#25D366" : "#f59e0b"} />
              <p className="text-sm font-bold text-white mt-1">{selectedEmployee.closeRate}%</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs text-[#8696a0] mb-1">نسبة المحادثات الإيجابية</p>
              <ScoreBar
                value={selectedEmployee.positiveChats}
                max={Math.max(selectedEmployee.totalChats, 1)}
                color="#25D366"
              />
              <p className="text-sm font-bold text-white mt-1">
                {Math.round(selectedEmployee.positiveChats / Math.max(selectedEmployee.totalChats, 1) * 100)}%
              </p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-xs text-[#8696a0] mb-1">الفرص المهجورة</p>
              <p className="text-2xl font-bold" style={{ color: selectedEmployee.missedOpportunities > 0 ? "#ef4444" : "#25D366" }}>
                {selectedEmployee.missedOpportunities}
              </p>
            </div>
          </div>

          {/* توصيات تلقائية */}
          <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)" }}>
            <p className="text-xs font-semibold text-[#25D366] mb-2">توصيات تحسين الأداء:</p>
            <ul className="space-y-1">
              {selectedEmployee.closeRate < 30 && (
                <li className="text-xs text-[#8696a0] flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  معدل الإغلاق منخفض — يُنصح بمراجعة أسلوب إقناع العملاء وتدريب على تقنيات الإغلاق
                </li>
              )}
              {selectedEmployee.missedOpportunities > 2 && (
                <li className="text-xs text-[#8696a0] flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  {selectedEmployee.missedOpportunities} فرص بيع مهجورة — يجب مراجعة المحادثات لفهم أسباب الإهمال
                </li>
              )}

              {selectedEmployee.negativeChats > selectedEmployee.positiveChats && (
                <li className="text-xs text-[#8696a0] flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  معظم المحادثات سلبية — يُنصح بمراجعة أسلوب التواصل مع العملاء
                </li>
              )}
              {selectedEmployee.closeRate >= 60 && selectedEmployee.missedOpportunities === 0 && selectedEmployee.totalChats > 0 && (
                <li className="text-xs text-[#8696a0] flex items-start gap-1">
                  <CheckCircle className="w-3 h-3 text-[#25D366] mt-0.5 flex-shrink-0" />
                  أداء ممتاز! يمكن الاستفادة من هذا الموظف في تدريب الفريق
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* تقرير المحادثات */}
      {convReport && (
        <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            المحادثات المهجورة (تحتاج متابعة)
          </h3>
          {(convReport.abandonedChats ?? []).length === 0 ? (
            <p className="text-xs text-[#8696a0]">لا توجد محادثات مهجورة</p>
          ) : (
            <div className="space-y-2">
              {(convReport.abandonedChats as Array<{ id: number; phone: string; contactName: string | null; lastMessageAt: string | null; accountId: string }>).map(chat => (
                <div key={chat.id} className="flex items-center justify-between p-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <div>
                    <p className="text-sm text-white">{chat.contactName || chat.phone}</p>
                    {chat.lastMessageAt && (
                      <p className="text-xs text-[#8696a0]">
                        آخر رسالة: {new Date(chat.lastMessageAt).toLocaleDateString("ar-SA")}
                      </p>
                    )}
                  </div>
                  <Badge className="text-xs" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "none" }}>
                    مهجورة
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
