import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, Clock, MessageCircle, CalendarClock, TrendingUp, RefreshCw } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  new: "جديد", contacted: "تم التواصل", interested: "مهتم",
  price_offer: "عرض سعر", meeting: "اجتماع", won: "عميل", lost: "خسرنا",
};
const STAGE_COLORS: Record<string, string> = {
  new: "#8696a0", contacted: "#34B7F1", interested: "#f0a55a",
  price_offer: "#9B59B6", meeting: "#E67E22", won: "#25D366", lost: "#e74c3c",
};

function ChatRow({ chat, reason }: { chat: any; reason: string }) {
  const followUpDate = chat.followUpDate ? new Date(chat.followUpDate) : null;
  const isOverdue = followUpDate && followUpDate < new Date();
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/3 transition-colors">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: STAGE_COLORS[chat.stage] + "22", color: STAGE_COLORS[chat.stage] }}
      >
        {(chat.contactName || chat.phone).slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-white truncate">{chat.contactName || chat.phone}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: STAGE_COLORS[chat.stage] + "22", color: STAGE_COLORS[chat.stage] }}
          >
            {STAGE_LABELS[chat.stage]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#8696a0]">
          <span>{reason}</span>
          {followUpDate && (
            <span className={isOverdue ? "text-red-400" : "text-[#f0a55a]"}>
              <CalendarClock className="w-3 h-3 inline ml-1" />
              {followUpDate.toLocaleDateString("ar-SA")}
            </span>
          )}
          {chat.nextStep && (
            <span className="truncate max-w-[200px]">
              <TrendingUp className="w-3 h-3 inline ml-1" />
              {chat.nextStep}
            </span>
          )}
        </div>
      </div>
      <Link href={`/chats`}>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[#25D366] hover:bg-[#25D366]/10 text-xs gap-1">
          <MessageCircle className="w-3.5 h-3.5" />
          فتح
        </Button>
      </Link>
    </div>
  );
}

export default function FollowUp() {
  const { data, isLoading, refetch } = trpc.followUp.getFollowUpNeeded.useQuery(undefined, { refetchInterval: 30000 });
  const { data: stats } = trpc.followUp.getFollowUpStats.useQuery(undefined, { refetchInterval: 30000 });

  const sections = [
    {
      key: "overdueFollowUp",
      title: "موعد المتابعة تجاوز",
      icon: <Clock className="w-4 h-4 text-red-400" />,
      color: "#e74c3c",
      reason: "موعد المتابعة تجاوز",
      items: data ?? [],
    },
    {
      key: "missingNextStep",
      title: "مهتم بدون خطوة قادمة",
      icon: <AlertTriangle className="w-4 h-4 text-[#f0a55a]" />,
      color: "#f0a55a",
      reason: "لا توجد خطوة قادمة محددة",
      items: [],
    },
    {
      key: "interestedNoAction",
      title: "مهتم بدون رد 24 ساعة",
      icon: <MessageCircle className="w-4 h-4 text-[#34B7F1]" />,
      color: "#34B7F1",
      reason: "لم يُرد عليه منذ أكثر من 24 ساعة",
      items: [],
    },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#111b21" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10" style={{ background: "#1a2830" }}>
        <div>
          <h1 className="text-lg font-bold text-white">المتابعة التلقائية</h1>
          <p className="text-xs text-[#8696a0] mt-0.5">العملاء الذين يحتاجون تدخلاً فورياً</p>
        </div>
        <div className="flex items-center gap-3">
          {stats && stats.total > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8696a0]">إجمالي التنبيهات:</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">{stats.total}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-[#8696a0] hover:text-white h-8">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          <div className="rounded-xl p-3 border border-red-500/20" style={{ background: "rgba(231,76,60,0.08)" }}>
            <div className="text-2xl font-bold text-red-400">{stats.overdue}</div>
            <div className="text-xs text-[#8696a0] mt-0.5">موعد متابعة تجاوز</div>
          </div>
          <div className="rounded-xl p-3 border border-[#f0a55a]/20" style={{ background: "rgba(240,165,90,0.08)" }}>
            <div className="text-2xl font-bold text-[#f0a55a]">{stats?.upcoming ?? 0}</div>
            <div className="text-xs text-[#8696a0] mt-0.5">بدون خطوة قادمة</div>
          </div>
          <div className="rounded-xl p-3 border border-[#34B7F1]/20" style={{ background: "rgba(52,183,241,0.08)" }}>
            <div className="text-2xl font-bold text-[#34B7F1]">{stats?.total ?? 0}</div>
            <div className="text-xs text-[#8696a0] mt-0.5">بدون رد 24 ساعة</div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#8696a0]">
            <RefreshCw className="w-5 h-5 animate-spin ml-2" />
            جاري التحميل...
          </div>
        ) : (
          sections.map(section => (
            <div key={section.key} className="rounded-xl border overflow-hidden" style={{ borderColor: section.color + "33" }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: section.color + "11" }}>
                {section.icon}
                <span className="text-sm font-medium" style={{ color: section.color }}>{section.title}</span>
                <span className="mr-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: section.color + "22", color: section.color }}>
                  {section.items.length}
                </span>
              </div>
              {section.items.length === 0 ? (
                <div className="px-4 py-6 text-center text-[#8696a0] text-sm">
                  لا توجد محادثات في هذه الفئة
                </div>
              ) : (
                section.items.map((chat: any) => (
                  <ChatRow key={chat.id} chat={chat} reason={section.reason} />
                ))
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
