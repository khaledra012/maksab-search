/**
 * AIAgent - واجهة الوكيل الذكي
 * يعمل كموظف بشري: يبحث، يحلل، يقترح، ويتابع تلقائياً
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Bot,
  Play,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Search,
  Brain,
  MessageSquare,
  Layers,
  ChevronRight,
  Sparkles,
  User,
  Building2,
  MapPin,
  Zap,
} from "lucide-react";

const TASK_TYPES = [
  { value: "prospect_research", label: "🔍 بحث وتنقيب عن عملاء", icon: Search },
  { value: "qualify_lead", label: "⭐ تقييم وتأهيل عميل", icon: Target },
  { value: "draft_outreach", label: "✉️ كتابة رسالة تواصل", icon: MessageSquare },
  { value: "multi_step", label: "🔄 مهمة متعددة الخطوات", icon: Layers },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  running: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  completed: "text-green-400 bg-green-500/10 border-green-500/30",
  failed: "text-red-400 bg-red-500/10 border-red-500/30",
  paused: "text-slate-400 bg-slate-500/10 border-slate-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "في الانتظار",
  running: "جارٍ التنفيذ",
  completed: "مكتمل",
  failed: "فشل",
  paused: "متوقف",
};

export default function AIAgent() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"new" | "tasks">("new");
  const [taskType, setTaskType] = useState("prospect_research");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  // Form state for prospect_research
  const [prospectForm, setProspectForm] = useState({
    businessType: "",
    city: "الرياض",
    targetCount: 10,
    criteria: "",
  });

  // Form state for qualify_lead / draft_outreach
  const [leadForm, setLeadForm] = useState({
    companyName: "",
    businessType: "",
    city: "",
    website: "",
    instagramUrl: "",
    phone: "",
    notes: "",
  });

  // Form state for multi_step
  const [multiStepGoal, setMultiStepGoal] = useState("");
  const [multiStepContext, setMultiStepContext] = useState("");

  // Queries
  const tasks = trpc.aiAgent.getTasks.useQuery(
    { limit: 20 },
    { refetchInterval: 5000 }
  );

  const leads = trpc.leads.list.useQuery({});

  // Mutations
  const runTask = trpc.aiAgent.runTask.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إطلاق المهمة: ${data.taskId}`);
      setActiveTab("tasks");
      tasks.refetch();
    },
    onError: (err) => toast.error(`فشل إطلاق المهمة: ${err.message}`),
  });

  const prospectResearch = trpc.aiAgent.prospectResearch.useMutation({
    onSuccess: (data) => {
      toast.success(`تم البحث! وجدت ${data.prospects?.length || 0} عميل محتمل`);
      setActiveTab("tasks");
      tasks.refetch();
    },
    onError: (err) => toast.error(`فشل البحث: ${err.message}`),
  });

  const qualifyLead = trpc.aiAgent.qualifyLead.useMutation({
    onSuccess: () => {
      toast.success("تم التقييم!");
      setActiveTab("tasks");
      tasks.refetch();
    },
    onError: (err) => toast.error(`فشل التقييم: ${err.message}`),
  });

  const draftOutreach = trpc.aiAgent.draftOutreach.useMutation({
    onSuccess: () => {
      toast.success("تم توليد رسالة التواصل!");
      setActiveTab("tasks");
      tasks.refetch();
    },
    onError: (err) => toast.error(`فشل: ${err.message}`),
  });

  const runMultiStep = trpc.aiAgent.runMultiStep.useMutation({
    onSuccess: () => {
      toast.success("اكتملت المهمة!");
      setActiveTab("tasks");
      tasks.refetch();
    },
    onError: (err) => toast.error(`فشل: ${err.message}`),
  });

  const handleRunTask = () => {
    if (taskType === "prospect_research") {
      if (!prospectForm.businessType) {
        toast.error("أدخل نوع النشاط التجاري");
        return;
      }
      prospectResearch.mutate(prospectForm);
    } else if (taskType === "qualify_lead") {
      if (!selectedLeadId) {
        toast.error("اختر عميلاً من القائمة");
        return;
      }
      qualifyLead.mutate({ leadId: selectedLeadId });
    } else if (taskType === "draft_outreach") {
      if (!selectedLeadId) {
        toast.error("اختر عميلاً من القائمة");
        return;
      }
      draftOutreach.mutate({ leadId: selectedLeadId });
    } else if (taskType === "multi_step") {
      if (!multiStepGoal) {
        toast.error("أدخل هدف المهمة");
        return;
      }
      runMultiStep.mutate({
        taskType: "market_scan",
        context: { goal: multiStepGoal, notes: multiStepContext },
        maxSteps: 5,
      });
    }
  };

  const isLoading = runTask.isPending || prospectResearch.isPending ||
    qualifyLead.isPending || draftOutreach.isPending || runMultiStep.isPending;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">وكيل الذكاء الاصطناعي</h1>
          <p className="text-sm text-slate-400">يعمل كموظف بشري — يبحث، يحلل، يكتب، ويتابع</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">Agent نشط</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-0">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "new"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
          onClick={() => setActiveTab("new")}
        >
          <Sparkles className="w-4 h-4 inline ml-1" />
          مهمة جديدة
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "tasks"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
          onClick={() => setActiveTab("tasks")}
        >
          <Clock className="w-4 h-4 inline ml-1" />
          سجل المهام ({tasks.data?.length || 0})
        </button>
      </div>

      {/* New Task Tab */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Type Selector */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">اختر نوع المهمة</h3>
            {TASK_TYPES.map(t => (
              <button
                key={t.value}
                className={`w-full text-right p-3 rounded-xl border transition-all ${
                  taskType === t.value
                    ? "bg-purple-500/20 border-purple-500/50 text-white"
                    : "bg-slate-800/30 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
                onClick={() => setTaskType(t.value)}
              >
                <div className="flex items-center gap-2">
                  <t.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{t.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Task Form */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/30 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  {TASK_TYPES.find(t => t.value === taskType)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prospect Research Form */}
                {taskType === "prospect_research" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">
                          <Building2 className="w-3 h-3 inline ml-1" />
                          نوع النشاط التجاري *
                        </Label>
                        <Input
                          value={prospectForm.businessType}
                          onChange={e => setProspectForm(p => ({ ...p, businessType: e.target.value }))}
                          placeholder="مطعم، عيادة، متجر إلكتروني..."
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">
                          <MapPin className="w-3 h-3 inline ml-1" />
                          المدينة
                        </Label>
                        <Input
                          value={prospectForm.city}
                          onChange={e => setProspectForm(p => ({ ...p, city: e.target.value }))}
                          placeholder="الرياض"
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">عدد العملاء المطلوب</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={prospectForm.targetCount}
                        onChange={e => setProspectForm(p => ({ ...p, targetCount: parseInt(e.target.value) || 10 }))}
                        className="bg-slate-900/50 border-slate-600 text-white w-24"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">معايير إضافية (اختياري)</Label>
                      <Textarea
                        value={prospectForm.criteria}
                        onChange={e => setProspectForm(p => ({ ...p, criteria: e.target.value }))}
                        placeholder="مثال: لديهم موقع إلكتروني ضعيف، أو لا يوجد لهم حساب إنستغرام..."
                        className="bg-slate-900/50 border-slate-600 text-white resize-none"
                        rows={3}
                      />
                    </div>
                  </>
                )}

                {/* Qualify Lead / Draft Outreach Form */}
                {(taskType === "qualify_lead" || taskType === "draft_outreach") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">
                          <Building2 className="w-3 h-3 inline ml-1" />
                          اسم الشركة *
                        </Label>
                        <Input
                          value={leadForm.companyName}
                          onChange={e => setLeadForm(p => ({ ...p, companyName: e.target.value }))}
                          placeholder="مطعم الأصالة"
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">نوع النشاط</Label>
                        <Input
                          value={leadForm.businessType}
                          onChange={e => setLeadForm(p => ({ ...p, businessType: e.target.value }))}
                          placeholder="مطعم شعبي"
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">
                          <MapPin className="w-3 h-3 inline ml-1" />
                          المدينة
                        </Label>
                        <Input
                          value={leadForm.city}
                          onChange={e => setLeadForm(p => ({ ...p, city: e.target.value }))}
                          placeholder="الرياض"
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">رقم الهاتف</Label>
                        <Input
                          value={leadForm.phone}
                          onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))}
                          placeholder="05XXXXXXXX"
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">الموقع الإلكتروني</Label>
                        <Input
                          value={leadForm.website}
                          onChange={e => setLeadForm(p => ({ ...p, website: e.target.value }))}
                          placeholder="https://..."
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">حساب إنستغرام</Label>
                        <Input
                          value={leadForm.instagramUrl}
                          onChange={e => setLeadForm(p => ({ ...p, instagramUrl: e.target.value }))}
                          placeholder="https://instagram.com/..."
                          className="bg-slate-900/50 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    {taskType === "draft_outreach" && (
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-300">ملاحظات إضافية</Label>
                        <Textarea
                          value={leadForm.notes}
                          onChange={e => setLeadForm(p => ({ ...p, notes: e.target.value }))}
                          placeholder="أي معلومات إضافية تساعد في كتابة الرسالة..."
                          className="bg-slate-900/50 border-slate-600 text-white resize-none"
                          rows={3}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Multi-Step Form */}
                {taskType === "multi_step" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">هدف المهمة *</Label>
                      <Textarea
                        value={multiStepGoal}
                        onChange={e => setMultiStepGoal(e.target.value)}
                        placeholder="مثال: ابحث عن 5 مطاعم في الرياض ليس لديها موقع إلكتروني، حلّل كل منها، واكتب رسالة تواصل مخصصة لكل واحد..."
                        className="bg-slate-900/50 border-slate-600 text-white resize-none"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">سياق إضافي (اختياري)</Label>
                      <Textarea
                        value={multiStepContext}
                        onChange={e => setMultiStepContext(e.target.value)}
                        placeholder="أي معلومات تساعد الـ Agent على فهم المهمة..."
                        className="bg-slate-900/50 border-slate-600 text-white resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <p className="text-xs text-purple-300">
                        ⚡ سيُقسّم الـ Agent المهمة إلى خطوات تلقائياً (حتى 5 خطوات) وينفذها بالتسلسل
                      </p>
                    </div>
                  </>
                )}

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
                  onClick={handleRunTask}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      جارٍ التنفيذ...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      تشغيل الـ Agent
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">سجل مهام الـ Agent</h3>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 gap-1"
              onClick={() => tasks.refetch()}
            >
              <RefreshCw className="w-3 h-3" />
              تحديث
            </Button>
          </div>

          {tasks.isLoading ? (
            <div className="p-8 text-center text-slate-500">جارٍ التحميل...</div>
          ) : (tasks.data?.length || 0) === 0 ? (
            <Card className="bg-slate-800/30 border-slate-700">
              <CardContent className="p-8 text-center">
                <Bot className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">لا توجد مهام بعد. شغّل مهمة جديدة!</p>
                <Button
                  variant="outline"
                  className="border-slate-600 mt-4"
                  onClick={() => setActiveTab("new")}
                >
                  <Sparkles className="w-4 h-4 ml-2" />
                  مهمة جديدة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.data?.map((task: any) => (
                <TaskCard key={task.id} task={task} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, navigate }: { task: any; navigate: any }) {
  const [expanded, setExpanded] = useState(false);
  const taskResult = trpc.aiAgent.getTaskResult.useQuery(
    { taskId: task.id },
    { enabled: expanded && task.status === "completed" }
  );

  return (
    <Card className={`border transition-colors ${
      task.status === "running"
        ? "bg-blue-500/5 border-blue-500/30"
        : task.status === "completed"
        ? "bg-slate-800/30 border-slate-700"
        : task.status === "failed"
        ? "bg-red-500/5 border-red-500/20"
        : "bg-slate-800/30 border-slate-700"
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            task.status === "running" ? "bg-blue-500/20" :
            task.status === "completed" ? "bg-green-500/20" :
            task.status === "failed" ? "bg-red-500/20" : "bg-slate-700"
          }`}>
            {task.status === "running" ? (
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            ) : task.status === "completed" ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : task.status === "failed" ? (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white truncate">
                {task.taskType === "prospect_research" ? "🔍 بحث عن عملاء" :
                 task.taskType === "qualify_lead" ? "⭐ تقييم عميل" :
                 task.taskType === "draft_outreach" ? "✉️ رسالة تواصل" :
                 task.taskType === "multi_step" ? "🔄 مهمة متعددة" :
                 task.taskType}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${STATUS_COLORS[task.status] || ""}`}
              >
                {STATUS_LABELS[task.status] || task.status}
              </Badge>
            </div>
            {task.context && (
              <p className="text-xs text-slate-500 truncate">
                {typeof task.context === "string"
                  ? task.context
                  : JSON.stringify(task.context).slice(0, 100)}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-slate-600">
                {new Date(task.createdAt).toLocaleString("ar-SA")}
              </span>
              {task.status === "completed" && (
                <button
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "إخفاء النتيجة" : "عرض النتيجة"}
                </button>
              )}
            </div>

            {/* Expanded Result */}
            {expanded && task.status === "completed" && (
              <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                {taskResult.isLoading ? (
                  <p className="text-xs text-slate-500">جارٍ التحميل...</p>
                ) : taskResult.data?.result ? (
                  <div className="space-y-2">
                    {typeof taskResult.data.result === "string" ? (
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">
                        {taskResult.data.result}
                      </p>
                    ) : (
                      <pre className="text-xs text-slate-300 overflow-auto max-h-48">
                        {JSON.stringify(taskResult.data.result, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">لا توجد نتيجة</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
