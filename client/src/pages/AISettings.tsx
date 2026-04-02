// @ts-nocheck
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  TestTube2,
  Zap,
  Users,
  ToggleLeft,
  ToggleRight,
  Info,
  Eye,
  EyeOff,
  RefreshCw,
  MessageSquare,
  Brain,
  Settings2,
  Globe,
  BarChart2,
  Pencil,
  AlertTriangle,
  Phone,
  Plus,
  Trash2,
  Hash,
  Volume2,
  Mic,
  BarChart3,
  TrendingUp,
  Activity,
  ArrowRight,
} from "lucide-react";

// ===== مكون بطاقة القسم =====
function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ===== مكون صف عميل =====
function ChatRow({
  chat,
  onToggle,
}: {
  chat: {
    id: number;
    phone: string;
    contactName: string | null;
    aiAutoReplyEnabled: boolean;
    unreadCount: number;
    lastMessage: string | null;
  };
  onToggle: (chatId: number, enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {(chat.contactName || chat.phone).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{chat.contactName || chat.phone}</p>
          <p className="text-xs text-muted-foreground truncate" dir="ltr">
            {chat.phone}
          </p>
        </div>
        {chat.unreadCount > 0 && (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">
            {chat.unreadCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs ${chat.aiAutoReplyEnabled ? "text-green-400" : "text-muted-foreground"}`}>
          {chat.aiAutoReplyEnabled ? "مفعّل" : "موقوف"}
        </span>
        <Switch
          checked={chat.aiAutoReplyEnabled}
          onCheckedChange={(v) => onToggle(chat.id, v)}
        />
      </div>
    </div>
  );
}

// ===== الصفحة الرئيسية =====
export default function AISettings() {
  // ===== State =====
  const [provider, setProvider] = useState<"openai" | "gemini">("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [assistantId, setAssistantId] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  // تحكم في التحليل والرسائل
  const [analysisStyle, setAnalysisStyle] = useState<"balanced" | "aggressive" | "conservative" | "detailed">("balanced");
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [brandTone, setBrandTone] = useState<"professional" | "friendly" | "formal" | "casual">("professional");
  const [countryContext, setCountryContext] = useState<"saudi" | "gulf" | "arabic" | "international">("saudi");
  const [dialect, setDialect] = useState<"gulf" | "egyptian" | "levantine" | "msa">("gulf");
  // ===== إعدادات الصوت =====
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<"alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer">("nova");
  const [voiceDialect, setVoiceDialect] = useState("ar-SA");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [transcribeIncoming, setTranscribeIncoming] = useState(true);
  const [voiceReplyScope, setVoiceReplyScope] = useState<"voice_only" | "all_messages">("voice_only");
  // ===== إعدادات التصعيد البشري =====
  const [escalationEnabled, setEscalationEnabled] = useState(false);
  const [escalationPhone, setEscalationPhone] = useState("");
  const [escalationMessage, setEscalationMessage] = useState("يرجى الانتظار، سيتواصل معك أحد ممثلينا قريباً.");
  const [escalationKeywords, setEscalationKeywords] = useState<string[]>([]);
  const [newEscalationKw, setNewEscalationKw] = useState("");
  // ===== الكلمات المفتاحية للمحادثة =====
  const [conversationKeywords, setConversationKeywords] = useState<{keyword: string, response: string, isActive: boolean}[]>([]);
  const [newKwKeyword, setNewKwKeyword] = useState("");
  const [newKwResponse, setNewKwResponse] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    reply?: string;
    error?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "knowledge">("settings");

  // ===== Queries =====
  const { data: settings, refetch: refetchSettings } = trpc.aiConfig.getSettings.useQuery();
  const { data: chats = [], refetch: refetchChats } = trpc.aiConfig.listChatsWithAIStatus.useQuery({
    accountId: "default",
  });
  const { data: ttsStats, refetch: refetchTtsStats } = trpc.aiConfig.getTtsStats.useQuery({ days: 7 });

  // ===== تحميل الإعدادات =====
  useEffect(() => {
    if (settings) {
      setProvider((settings.provider === "builtin" ? "gemini" : settings.provider) as "openai" | "gemini");
      setAssistantId(settings.openaiAssistantId || "");
      setModel(settings.openaiModel || "gpt-4o-mini");
      setSystemPrompt(settings.systemPrompt || "");
      setBusinessContext(settings.businessContext || "");
      setTemperature(settings.temperature ?? 0.7);
      setMaxTokens(settings.maxTokens ?? 500);
      setAnalysisStyle((settings as any).analysisStyle || "balanced");
      setAnalysisPrompt((settings as any).analysisPrompt || "");
      setMessageTemplate((settings as any).messageTemplate || "");
      setBrandTone((settings as any).brandTone || "professional");
      setCountryContext((settings as any).countryContext || "saudi");
      setDialect((settings as any).dialect || "gulf");
      // تحميل إعدادات التصعيد
      setEscalationEnabled((settings as any).escalationEnabled ?? false);
      setEscalationPhone((settings as any).escalationPhone || "");
      setEscalationMessage((settings as any).escalationMessage || "يرجى الانتظار، سيتواصل معك أحد ممثلينا قريباً.");
      const rawEscKws = (settings as any).escalationKeywords;
      setEscalationKeywords(Array.isArray(rawEscKws) ? rawEscKws : (typeof rawEscKws === "string" ? JSON.parse(rawEscKws || "[]") : []));
      const rawConvKws = (settings as any).conversationKeywords;
      setConversationKeywords(Array.isArray(rawConvKws) ? rawConvKws : (typeof rawConvKws === "string" ? JSON.parse(rawConvKws || "[]") : []));
      // تحميل إعدادات الصوت
      setVoiceReplyEnabled((settings as any).voiceReplyEnabled ?? false);
      setTtsVoice((settings as any).ttsVoice || "nova");
      setVoiceDialect((settings as any).voiceDialect || "ar-SA");
      setVoiceGender((settings as any).voiceGender || "female");
      setVoiceSpeed((settings as any).voiceSpeed ?? 1.0);
      setTranscribeIncoming((settings as any).transcribeIncoming ?? true);
      setVoiceReplyScope((settings as any).voiceReplyScope || "voice_only");
    }
  }, [settings]);

  // ===== Mutations =====
  const saveSettings = trpc.aiConfig.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات بنجاح");
      refetchSettings();
    },
    onError: (e: any) => toast.error("فشل الحفظ", { description: e.message }),
  });

  const testConnection = trpc.aiConfig.testConnection.useMutation({
    onSuccess: (data) => {
      setTestResult({ success: true, reply: data.reply });
      toast.success(`اتصال ناجح (${data?.mode === "assistant" ? "Assistant" : "Chat API"})`);
    },
    onError: (e: any) => {
      setTestResult({ success: false, error: e.message });
      toast.error("فشل الاتصال", { description: e.message });
    },
  });

  const setGlobalAutoReply = trpc.aiConfig.setGlobalAutoReply.useMutation({ onSuccess: (_: any, vars: any) => {
      toast.success(vars.enabled ? "تم تفعيل الرد التلقائي للكل" : "تم إيقاف الرد التلقائي للكل");
      refetchSettings();
    },
  });

  const setBulkChatAutoReply = trpc.aiConfig.setBulkChatAutoReply.useMutation({ onSuccess: (data: any, vars: any) => {
      toast.success(
        vars.enabled
          ? `تم تفعيل الرد لـ ${data.updatedCount} محادثة`
          : `تم إيقاف الرد لـ ${data.updatedCount} محادثة`
      );
      refetchChats();
    },
  });

  const setChatAutoReply = trpc.aiConfig.setChatAutoReply.useMutation({
    onSuccess: () => refetchChats(),
    onError: (e: any) => toast.error("فشل التحديث", { description: e.message }),
  });

  const handleSave = () => {
    saveSettings.mutate({
      provider,
      openaiApiKey: apiKey || undefined,
      openaiModel: model,
      systemPrompt: systemPrompt || undefined,
      businessContext: businessContext || undefined,
      temperature,
      maxTokens,
      analysisStyle,
      analysisPrompt: analysisPrompt || undefined,
      messageTemplate: messageTemplate || undefined,
      brandTone,
      countryContext,
      dialect,
      escalationEnabled,
      escalationPhone: escalationPhone || undefined,
      escalationMessage: escalationMessage || undefined,
      escalationKeywords,
      conversationKeywords,
      voiceReplyEnabled,
      ttsVoice,
      voiceDialect,
      voiceGender,
      voiceSpeed,
      voiceReplyScope,
      transcribeIncoming,
    });
  };

  const handleTest = () => {
    setTestResult(null);
    testConnection.mutate({
      provider,
      apiKey: provider === "openai" && apiKey.startsWith("sk-") ? apiKey : undefined,
    });
  };

  const enabledCount = (chats as any[]).filter((c) => c.aiAutoReplyEnabled).length;
  const totalCount = (chats as any[]).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            ذكاء اصطناعي AI
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إعدادات النموذج وقاعدة المعرفة والردود التلقائية
          </p>
        </div>
        {activeTab === "settings" && (
          <Button onClick={handleSave} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 ml-2" />
            )}
            حفظ الإعدادات
          </Button>
        )}
      </div>

      {/* تبويبات الصفحة */}
      <div className="flex gap-1 p-1 rounded-xl border border-border" style={{ background: "oklch(0.13 0.012 240)" }}>
        {[
          { id: "settings", label: "إعدادات AI", icon: Settings2 },
          { id: "knowledge", label: "قاعدة المعرفة", icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "settings" | "knowledge")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id ? {
              background: "oklch(0.65 0.18 200 / 0.15)",
              border: "1px solid oklch(0.65 0.18 200 / 0.3)",
              color: "var(--brand-cyan)",
            } : { color: "var(--muted-foreground)" }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== تبويب قاعدة المعرفة ===== */}
      {activeTab === "knowledge" && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-2">قاعدة معرفة AI</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            أدرب الذكاء الاصطناعي على معلومات شركتك ومنتجاتك وأسلوب ردودك ليرد بشكل احترافي على عملائك
          </p>
          <div className="grid grid-cols-3 gap-4 mb-6 text-right">
            {[
              { icon: Globe, title: "معلومات الشركة", desc: "أضف نصوصاً عن شركتك وخدماتك" },
              { icon: MessageSquare, title: "أمثلة محادثات", desc: "درب AI على محادثات حقيقية ناجحة" },
              { icon: Brain, title: "شخصية AI", desc: "حدد أسلوب ولغة ونبرة الرد" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-4 rounded-xl border border-border bg-background/50">
                <Icon className="w-6 h-6 text-primary mb-2" />
                <p className="font-medium text-sm mb-1">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <a
            href="/knowledge-base"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "oklch(0.65 0.18 200)" }}
          >
            <MessageSquare className="w-4 h-4" />
            فتح صفحة قاعدة المعرفة
          </a>
        </div>
      )}

      {/* ===== تبويب إعدادات AI ===== */}
      {activeTab === "settings" && <>
      {/* ===== القسم 1: مزود الذكاء الاصطناعي ===== */}
      <Section icon={Zap} title="مزود الذكاء الاصطناعي" subtitle="اختر بين OpenAI الخاص أو Gemini المباشر من السيرفر">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setProvider("gemini")}
            className={`p-4 rounded-lg border-2 text-right transition-all ${
              provider === "gemini"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-primary" />
              <span className="font-medium">Gemini من السيرفر</span>
              {provider === "gemini" && (
                <Badge className="bg-primary/20 text-primary text-xs mr-auto">مفعّل</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              يستخدم Gemini مباشرة من السيرفر عبر المفتاح الموجود في البيئة — لا يحتاج API Key داخل الواجهة
            </p>
          </button>

          <button
            onClick={() => setProvider("openai")}
            className={`p-4 rounded-lg border-2 text-right transition-all ${
              provider === "openai"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-5 h-5 text-green-400" />
              <span className="font-medium">OpenAI الخاص</span>
              {provider === "openai" && (
                <Badge className="bg-green-500/20 text-green-400 text-xs mr-auto">مفعّل</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              استخدم API Key الخاص بك للتحكم الكامل في النموذج والتكاليف
            </p>
          </button>
        </div>
      </Section>

      {/* ===== القسم 2: إعدادات OpenAI (تظهر فقط عند اختيار openai) ===== */}
      {provider === "openai" && (
        <Section
          icon={Key}
          title="بيانات OpenAI"
          subtitle="أدخل API Key ومعرف الـ Assistant (اختياري)"
        >
          <div className="space-y-4">
            {/* API Key */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                OpenAI API Key <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settings?.hasApiKey ? "sk-...محفوظ (اتركه فارغاً للإبقاء)" : "sk-..."}
                  dir="ltr"
                  className="pl-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {settings?.hasApiKey && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  API Key محفوظ ({settings.openaiApiKey})
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                احصل على مفتاحك من{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>

            {/* Assistant ID */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                OpenAI Assistant ID{" "}
                <span className="text-muted-foreground font-normal">(اختياري)</span>
              </label>
              <Input
                value={assistantId}
                onChange={(e) => setAssistantId(e.target.value)}
                placeholder="asst_..."
                dir="ltr"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                إذا أدخلت معرف Assistant سيتم استخدامه بدلاً من Chat Completion. أنشئ Assistant من{" "}
                <a
                  href="https://platform.openai.com/assistants"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com/assistants
                </a>
              </p>
            </div>

            {/* النموذج */}
            {!assistantId && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">النموذج</label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (موصى به - سريع وقليل التكلفة)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (أقوى)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (الأرخص)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* اختبار الاتصال */}
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testConnection.isPending || (!apiKey && !settings?.hasApiKey)}
                className="w-full"
              >
                {testConnection.isPending ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <TestTube2 className="w-4 h-4 ml-2" />
                )}
                اختبار الاتصال بـ OpenAI
              </Button>

              {testResult && (
                <div
                  className={`mt-3 p-3 rounded-lg border text-sm ${
                    testResult.success
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span className="font-medium">
                      {testResult.success ? "الاتصال ناجح" : "فشل الاتصال"}
                    </span>
                  </div>
                  {testResult.reply && (
                    <p className="text-xs mt-1 opacity-80">رد الـ AI: {testResult.reply}</p>
                  )}
                  {testResult.error && (
                    <p className="text-xs mt-1 opacity-80">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ===== القسم 3: توجيه الردود ===== */}
      <Section
        icon={MessageSquare}
        title="توجيه الردود"
        subtitle="حدد كيف يتصرف الذكاء الاصطناعي عند الرد على العملاء"
      >
        <div className="space-y-4">
          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              System Prompt (توجيهات الذكاء الاصطناعي)
            </label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="مثال: أنت مساعد تجاري سعودي محترف متخصص في مجال اللحوم والمواد الغذائية. ردودك باللغة العربية، مختصرة ومفيدة. لا تعطِ أسعاراً دون التحقق. كن ودوداً ومهنياً."
              rows={5}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              هذا النص يُرسَل للـ AI قبل كل رسالة ليحدد شخصيته وأسلوبه
            </p>
          </div>

          {/* Business Context */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              معلومات النشاط التجاري{" "}
              <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <Textarea
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="مثال: نحن شركة توزيع لحوم ومواد غذائية في الرياض. نخدم المطاعم والفنادق والتجزئة. ساعات العمل 8ص-10م. التوصيل متاح داخل الرياض."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* إعدادات متقدمة */}
          {provider === "openai" && !assistantId && (
            <div className="grid grid-cols-2 gap-6 pt-2">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  درجة الإبداع (Temperature): {temperature.toFixed(1)}
                </label>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>محافظ (0)</span>
                  <span>إبداعي (2)</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  الحد الأقصى للكلمات: {maxTokens}
                </label>
                <Slider
                  value={[maxTokens]}
                  onValueChange={([v]) => setMaxTokens(v)}
                  min={50}
                  max={2000}
                  step={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>50</span>
                  <span>2000</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ===== قسم جديد: أسلوب التحليل ===== */}
      <Section
        icon={BarChart2}
        title="أسلوب تحليل العملاء"
        subtitle="تحديد كيف يحلل الذكاء الاصطناعي بيانات كل عميل"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">نمط التحليل</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "balanced", label: "متوازن", desc: "تحليل شامل ومتوازن" },
                { value: "aggressive", label: "تنافسي", desc: "ركز على الفرص والثغرات" },
                { value: "conservative", label: "محافظ", desc: "تحليل دقيق ومتحفظ" },
                { value: "detailed", label: "تفصيلي", desc: "تقرير شامل ومفصل" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAnalysisStyle(opt.value)}
                  className={`p-3 rounded-lg border-2 text-right transition-all ${
                    analysisStyle === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              برومبت تحليل مخصص{" "}
              <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <Textarea
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              placeholder="مثال: ركز على تحليل الموقع الإلكتروني ووجود المتجر الإلكتروني وخدمة التوصيل. أعطِ أهمية للنشاطات ذات الإيرادات المرتفعة."
              rows={4}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              إذا تركته فارغاً سيستخدم النظام البرومبت الافتراضي حسب نمط التحليل المختار
            </p>
          </div>
        </div>
      </Section>

      {/* ===== قسم جديد: صيغة الرسائل وهوية البلد ===== */}
      <Section
        icon={Globe}
        title="هوية البلد وصيغة الرسائل"
        subtitle="تدريب الذكاء الاصطناعي على لغة وأسلوب يناسب سوقك المستهدف"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">السياق الجغرافي</label>
              <Select value={countryContext} onValueChange={(v: any) => setCountryContext(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saudi">السوق السعودي</SelectItem>
                  <SelectItem value="gulf">دول الخليج</SelectItem>
                  <SelectItem value="arabic">العالم العربي</SelectItem>
                  <SelectItem value="international">دولي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">اللهجة</label>
              <Select value={dialect} onValueChange={(v: any) => setDialect(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gulf">خليجي سعودي</SelectItem>
                  <SelectItem value="msa">عربي فصيح</SelectItem>
                  <SelectItem value="egyptian">مصري</SelectItem>
                  <SelectItem value="levantine">شامي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">نبرة العلامة</label>
              <Select value={brandTone} onValueChange={(v: any) => setBrandTone(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">احترافي</SelectItem>
                  <SelectItem value="friendly">ودي</SelectItem>
                  <SelectItem value="formal">رسمي</SelectItem>
                  <SelectItem value="casual">عادي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              <Pencil className="w-4 h-4 inline ml-1" />
              قالب الرسالة الافتراضي{" "}
              <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="مثال: السلام عليكم {{name}}\n\nأتواصل معكم بخصوص خدماتنا في {{business_type}}.\n\nهل تودون معرفة المزيد?"
              rows={5}
              className="text-sm resize-none font-mono"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {["{{name}}", "{{business_type}}", "{{city}}", "{{phone}}", "{{website}}"].map((v) => (
                <button
                  key={v}
                  onClick={() => setMessageTemplate((prev) => prev + v)}
                  className="text-xs px-2 py-1 bg-primary/10 text-primary rounded border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              اضغط على المتغيرات أعلاه لإدراجها في القالب — سيتم استبدالها تلقائياً ببيانات كل عميل
            </p>
          </div>
        </div>
      </Section>

      {/* ===== القسم 4: التحكم الجماعي ===== */}
      <Section
        icon={Settings2}
        title="التحكم الجماعي في الرد التلقائي"
        subtitle="تفعيل أو إيقاف الرد التلقائي لجميع العملاء دفعة واحدة"
      >
        <div className="space-y-4">
          {/* مفتاح رئيسي */}
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  settings?.globalAutoReplyEnabled
                    ? "bg-green-500/20"
                    : "bg-muted"
                }`}
              >
                <Bot
                  className={`w-5 h-5 ${
                    settings?.globalAutoReplyEnabled ? "text-green-400" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div>
                <p className="font-medium text-sm">المفتاح الرئيسي</p>
                <p className="text-xs text-muted-foreground">
                  {settings?.globalAutoReplyEnabled
                    ? "الرد التلقائي مفعّل لجميع العملاء"
                    : "الرد التلقائي موقوف لجميع العملاء"}
                </p>
              </div>
            </div>
            <Switch
              checked={settings?.globalAutoReplyEnabled ?? false}
              onCheckedChange={(v) => setGlobalAutoReply.mutate({ enabled: v })}
              disabled={setGlobalAutoReply.isPending}
            />
          </div>

          {/* أزرار التحكم الجماعي */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={() => setBulkChatAutoReply.mutate({ enabled: true, accountId: "default" })}
              disabled={setBulkChatAutoReply.isPending}
            >
              {setBulkChatAutoReply.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <ToggleRight className="w-4 h-4 ml-2" />
              )}
              تفعيل الكل ({totalCount})
            </Button>
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => setBulkChatAutoReply.mutate({ enabled: false, accountId: "default" })}
              disabled={setBulkChatAutoReply.isPending}
            >
              {setBulkChatAutoReply.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <ToggleLeft className="w-4 h-4 ml-2" />
              )}
              إيقاف الكل ({totalCount})
            </Button>
          </div>

          {/* إحصائية */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              {enabledCount} من {totalCount} محادثة مفعّل فيها الرد التلقائي
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 mr-auto"
              onClick={() => refetchChats()}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </Section>

      {/* ===== القسم 5: التحكم الفردي ===== */}
      <Section
        icon={Users}
        title="التحكم الفردي لكل عميل"
        subtitle={`${totalCount} محادثة — ${enabledCount} مفعّل`}
      >
        {(chats as any[]).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">لا توجد محادثات بعد</p>
            <p className="text-xs mt-1">ستظهر هنا بعد بدء أول محادثة</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="pr-1">
              {(chats as any[]).map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  onToggle={(chatId, enabled) =>
                    setChatAutoReply.mutate({ chatId, enabled })
                  }
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </Section>

      {/* ===== القسم 6: التصعيد عند عجز AI ===== */}
      <Section
        icon={AlertTriangle}
        title="التصعيد عند عجز AI"
        subtitle="عند عجز AI عن الرد أو عند كلمات مفتاحية معينة، يُرسل إشعار لرقم واتساب محدد"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
            <div>
              <p className="font-medium text-sm">تفعيل نظام التصعيد</p>
              <p className="text-xs text-muted-foreground">عند تفعيله، يُرسل إشعار لرقم واتساب عند عجز AI</p>
            </div>
            <Switch checked={escalationEnabled} onCheckedChange={setEscalationEnabled} />
          </div>
          {escalationEnabled && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
                  <Phone className="w-4 h-4 text-primary" />
                  رقم واتساب للتصعيد
                </label>
                <Input
                  value={escalationPhone}
                  onChange={e => setEscalationPhone(e.target.value)}
                  placeholder="+966501234567"
                  dir="ltr"
                  className="text-left"
                />
                <p className="text-xs text-muted-foreground mt-1">الرقم الذي سيستقبل إشعارات التصعيد</p>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  رسالة للعميل عند التصعيد
                </label>
                <Textarea
                  value={escalationMessage}
                  onChange={e => setEscalationMessage(e.target.value)}
                  placeholder="يرجى الانتظار، سيتواصل معك أحد ممثلينا قريباً."
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2 mb-1.5">
                  <Hash className="w-4 h-4 text-primary" />
                  كلمات تُفعّل التصعيد الفوري
                </label>
                <p className="text-xs text-muted-foreground mb-2">عند وجود هذه الكلمات في رسالة العميل، يُصعَّد فوراً دون انتظار AI</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newEscalationKw}
                    onChange={e => setNewEscalationKw(e.target.value)}
                    placeholder="مثال: مدير، شكوى، إلغاء"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newEscalationKw.trim()) {
                        setEscalationKeywords(prev => [...prev, newEscalationKw.trim()]);
                        setNewEscalationKw("");
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => {
                    if (newEscalationKw.trim()) {
                      setEscalationKeywords(prev => [...prev, newEscalationKw.trim()]);
                      setNewEscalationKw("");
                    }
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {escalationKeywords.map((kw, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      {kw}
                      <button onClick={() => setEscalationKeywords(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {escalationKeywords.length === 0 && <p className="text-xs text-muted-foreground">لا توجد كلمات مفتاحية للتصعيد</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>
      {/* ===== القسم 7: الكلمات المفتاحية لبناء المحادثة ===== */}
      <Section
        icon={Hash}
        title="الكلمات المفتاحية لبناء المحادثة"
        subtitle="عند وجود كلمة مفتاحية في رسالة العميل، يُرسل رد محدد مسبقاً تلقائياً"
      >
        <div className="space-y-4">
          <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
            <p className="text-sm font-medium">إضافة كلمة مفتاحية جديدة</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الكلمة المفتاحية</label>
                <Input value={newKwKeyword} onChange={e => setNewKwKeyword(e.target.value)} placeholder="مثال: سعر، توصيل، ضمان" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الرد التلقائي</label>
                <Input value={newKwResponse} onChange={e => setNewKwResponse(e.target.value)} placeholder="الرد الذي سيُرسل للعميل" />
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              if (newKwKeyword.trim() && newKwResponse.trim()) {
                setConversationKeywords(prev => [...prev, { keyword: newKwKeyword.trim(), response: newKwResponse.trim(), isActive: true }]);
                setNewKwKeyword("");
                setNewKwResponse("");
              }
            }}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة كلمة مفتاحية
            </Button>
          </div>
          {conversationKeywords.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Hash className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد كلمات مفتاحية بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversationKeywords.map((kw, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/10">
                  <Switch
                    checked={kw.isActive}
                    onCheckedChange={v => setConversationKeywords(prev => prev.map((k, j) => j === i ? {...k, isActive: v} : k))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{kw.keyword}</p>
                    <p className="text-xs text-muted-foreground truncate">{kw.response}</p>
                  </div>
                  <button onClick={() => setConversationKeywords(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
      {/* ===== قسم الرد الصوتي ===== */}
      <Section icon={Volume2} title="الرد الصوتي باللهجة" subtitle="رد تلقائي برسائل صوتية بلهجة محددة">
        <div className="space-y-5">
          {/* تفعيل الرد الصوتي */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">الرد الصوتي التلقائي</p>
                <p className="text-xs text-muted-foreground">يرد AI برسائل صوتية بدلاً من نصية</p>
              </div>
            </div>
            <Switch checked={voiceReplyEnabled} onCheckedChange={setVoiceReplyEnabled} />
          </div>

          {voiceReplyEnabled && (
            <div className="space-y-4 p-4 rounded-xl border border-border bg-background/30">
              {/* صوت TTS */}
              <div>
                <label className="text-sm font-medium mb-2 block">صوت الذكاء الاصطناعي</label>
                <Select value={ttsVoice} onValueChange={(v) => setTtsVoice(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova">👩 Nova — أنثى طبيعي</SelectItem>
                    <SelectItem value="shimmer">👩 Shimmer — أنثى ناعم</SelectItem>
                    <SelectItem value="alloy">🧑 Alloy — محايد</SelectItem>
                    <SelectItem value="echo">👨 Echo — ذكر عميق</SelectItem>
                    <SelectItem value="fable">👨 Fable — ذكر بريطاني</SelectItem>
                    <SelectItem value="onyx">👨 Onyx — ذكر قوي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* اللهجة */}
              <div>
                <label className="text-sm font-medium mb-2 block">اللهجة</label>
                <Select value={voiceDialect} onValueChange={setVoiceDialect}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar-SA">سعودية</SelectItem>
                    <SelectItem value="ar-EG">مصرية</SelectItem>
                    <SelectItem value="ar-AE">إماراتية</SelectItem>
                    <SelectItem value="ar-KW">كويتية</SelectItem>
                    <SelectItem value="ar-QA">قطرية</SelectItem>
                    <SelectItem value="ar-MA">مغربية</SelectItem>
                    <SelectItem value="ar">عربي فصيح</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* الجنس */}
              <div>
                <label className="text-sm font-medium mb-2 block">جنس الصوت</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVoiceGender("female")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      voiceGender === "female" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    أنثى
                  </button>
                  <button
                    onClick={() => setVoiceGender("male")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      voiceGender === "male" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    ذكر
                  </button>
                </div>
              </div>

              {/* نطاق الرد الصوتي */}
              <div>
                <label className="text-sm font-medium mb-2 block">نطاق الرد الصوتي</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVoiceReplyScope("voice_only")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-right ${
                      voiceReplyScope === "voice_only" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>🎤</span>
                      <span className="font-semibold">الرسائل الصوتية فقط</span>
                    </div>
                    <p className="text-xs opacity-70">يرد بصوت فقط عندما يرسل العميل رسالة صوتية</p>
                  </button>
                  <button
                    onClick={() => setVoiceReplyScope("all_messages")}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-right ${
                      voiceReplyScope === "all_messages" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>💬</span>
                      <span className="font-semibold">جميع الرسائل</span>
                    </div>
                    <p className="text-xs opacity-70">يرد بصوت على كل رسالة سواء كانت نصية أو صوتية</p>
                  </button>
                </div>
              </div>
              {/* سرعة الصوت */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  سرعة الصوت: <span className="text-primary">{voiceSpeed}x</span>
                </label>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={[voiceSpeed]}
                  onValueChange={([v]) => setVoiceSpeed(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5x بطيء</span>
                  <span>1x طبيعي</span>
                  <span>2x سريع</span>
                </div>
              </div>
            </div>
          )}

          {/* تحويل الصوت لنص */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/50">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-medium text-sm">تحويل الرسائل الصوتية لنص</p>
                <p className="text-xs text-muted-foreground">تحويل رسائل العميل الصوتية تلقائياً ليفهمها AI</p>
              </div>
            </div>
            <Switch checked={transcribeIncoming} onCheckedChange={setTranscribeIncoming} />
          </div>
        </div>
      </Section>

      {/* ===== قسم إحصائيات TTS ===== */}
      {voiceReplyEnabled && (
        <Section icon={BarChart3} title="مؤشر حالة الرد الصوتي" subtitle="إحصائيات آخر 7 أيام لمحرك تحويل النص لصوت">
          <div className="space-y-4">
            {/* بطاقات الإحصائيات */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-border bg-background/50 text-center">
                <p className="text-2xl font-bold text-foreground">{ttsStats?.total ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي المحاولات</p>
              </div>
              <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 text-center">
                <p className="text-2xl font-bold text-green-400">{ttsStats?.success ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">ناجحة</p>
              </div>
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-center">
                <p className="text-2xl font-bold text-red-400">{ttsStats?.failed ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">فاشلة</p>
              </div>
              <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center">
                <p className="text-2xl font-bold text-yellow-400">{ttsStats?.fallback ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">نصي بديل</p>
              </div>
            </div>
            {/* نسبة النجاح */}
            <div className="p-4 rounded-xl border border-border bg-background/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">نسبة النجاح</span>
                <span className={`text-sm font-bold ${
                  (ttsStats?.successRate ?? 0) >= 80 ? 'text-green-400' :
                  (ttsStats?.successRate ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>{ttsStats?.successRate ?? 0}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (ttsStats?.successRate ?? 0) >= 80 ? 'bg-green-500' :
                    (ttsStats?.successRate ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${ttsStats?.successRate ?? 0}%` }}
                />
              </div>
              {(ttsStats?.avgDurationMs ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  متوسط وقت التحويل: <span className="text-foreground font-medium">{ttsStats?.avgDurationMs}ms</span>
                </p>
              )}
            </div>
            {/* آخر السجلات */}
            {(ttsStats?.recentLogs?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">آخر الردود الصوتية</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(ttsStats?.recentLogs ?? []).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/30 text-xs">
                      <div className="flex items-center gap-2">
                        {log.status === 'success' ? (
                          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        ) : log.status === 'fallback' ? (
                          <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                        <span className="text-muted-foreground" dir="ltr">{log.phone?.replace('@c.us', '')}</span>
                        {log.status === 'fallback' && <span className="text-yellow-400">(نصي بديل)</span>}
                        {log.status === 'failed' && <span className="text-red-400 truncate max-w-32">{log.errorMessage}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
                        {log.audioSizeBytes > 0 && <span>{Math.round(log.audioSizeBytes / 1024)}KB</span>}
                        {log.durationMs > 0 && <span>{log.durationMs}ms</span>}
                        <span>{new Date(log.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* حالة المحرك */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/30">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm">محرك TTS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400">gTTS (Google TTS) — جاهز</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* زر الحفظ في الأسفل */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={saveSettings.isPending} size="lg">
          {saveSettings.isPending ? (
            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 ml-2" />
          )}
          حفظ جميع الإعدادات
        </Button>
      </div>
      </>}
    </div>
  );
}
