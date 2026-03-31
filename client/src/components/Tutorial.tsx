/**
 * نظام التعليم التفاعلي - يشرح كيفية عمل التحليل الرقمي
 */
import { useState } from "react";
import {
  X, ChevronRight, ChevronLeft, Globe, Instagram, Twitter, BarChart3,
  Zap, CheckCircle, AlertTriangle, TrendingUp, Search, Phone, MessageCircle,
  FileText, Star, Target, Activity, Brain, Clock, Users
} from "lucide-react";

interface TutorialStep {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  content: React.ReactNode;
}

const steps: TutorialStep[] = [
  {
    id: 1,
    title: "كيف يعمل النظام؟",
    subtitle: "نظرة عامة على منهجية التحليل",
    icon: <Brain className="w-8 h-8" />,
    color: "oklch(0.62 0.18 285)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          يعمل نظام مكسب على <strong className="text-white">4 مراحل متكاملة</strong> لتحليل الحضور الرقمي لأي نشاط تجاري:
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { num: "1", title: "جمع البيانات", desc: "من Google Maps والسوشيال ميديا", color: "oklch(0.65 0.18 200)" },
            { num: "2", title: "تحليل الموقع", desc: "السرعة، SEO، تجربة الجوال", color: "oklch(0.65 0.18 145)" },
            { num: "3", title: "تحليل السوشيال", desc: "التفاعل، المتابعين، المحتوى", color: "oklch(0.65 0.18 25)" },
            { num: "4", title: "تقرير ذكي", desc: "توصيات مخصصة بالذكاء الاصطناعي", color: "oklch(0.62 0.18 285)" },
          ].map(item => (
            <div key={item.num} className="rounded-xl p-3" style={{ background: `color-mix(in oklch, ${item.color} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${item.color} 25%, transparent)` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: item.color }}>{item.num}</span>
                <span className="text-sm font-semibold text-white">{item.title}</span>
              </div>
              <p className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.65 0.18 60 / 0.1)", border: "1px solid oklch(0.65 0.18 60 / 0.25)", color: "oklch(0.75 0.18 60)" }}>
          💡 <strong>الهدف:</strong> تحديد أكبر فرصة تسويقية لكل عميل وتقديم زاوية دخول بيعية مخصصة
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: "تحليل الموقع الإلكتروني",
    subtitle: "كيف نقيّم أداء الموقع؟",
    icon: <Globe className="w-8 h-8" />,
    color: "oklch(0.65 0.18 200)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          نستخدم <strong className="text-white">Google PageSpeed Insights API</strong> لقياس 6 معايير رئيسية:
        </p>
        <div className="space-y-2">
          {[
            { label: "سرعة التحميل", desc: "وقت ظهور الصفحة على الجوال والكمبيوتر", score: 7, color: "oklch(0.65 0.18 145)" },
            { label: "تجربة الجوال", desc: "مدى ملاءمة الموقع للهواتف الذكية", score: 6, color: "oklch(0.65 0.18 200)" },
            { label: "تحسين محركات البحث (SEO)", desc: "قابلية الاكتشاف على Google", score: 5, color: "oklch(0.65 0.18 25)" },
            { label: "جودة المحتوى", desc: "وضوح العروض والمعلومات", score: 8, color: "oklch(0.62 0.18 285)" },
            { label: "التصميم", desc: "الجاذبية البصرية والاحترافية", score: 7, color: "oklch(0.65 0.18 60)" },
            { label: "وضوح العرض", desc: "هل يفهم الزائر ما تبيعه؟", score: 6, color: "oklch(0.65 0.18 145)" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs w-32 flex-shrink-0" style={{ color: "oklch(0.7 0.02 240)" }}>{item.label}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.2 0.02 240)" }}>
                <div className="h-full rounded-full" style={{ width: `${item.score * 10}%`, background: item.color }} />
              </div>
              <span className="text-xs font-bold w-8" style={{ color: item.color }}>{item.score}/10</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.65 0.18 200 / 0.1)", border: "1px solid oklch(0.65 0.18 200 / 0.25)", color: "oklch(0.75 0.18 200)" }}>
          📊 الدرجة الإجمالية = متوسط المعايير الستة. الدرجة &gt; 7 = ممتاز، 5-7 = جيد، &lt; 5 = يحتاج تحسين
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: "تحليل السوشيال ميديا",
    subtitle: "قياس الحضور الرقمي على المنصات",
    icon: <Instagram className="w-8 h-8" />,
    color: "oklch(0.65 0.18 25)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          نحلل كل منصة بشكل منفصل باستخدام <strong className="text-white">Bright Data API</strong> لجلب البيانات الحقيقية:
        </p>
        <div className="space-y-2">
          {[
            { platform: "إنستغرام", metrics: "المتابعون، التفاعل، تكرار النشر، جودة المحتوى", color: "oklch(0.65 0.18 25)" },
            { platform: "تيك توك", metrics: "المشاهدات، المتابعون، الفيديوهات، معدل الانتشار", color: "oklch(0.65 0.18 60)" },
            { platform: "تويتر/X", metrics: "التغريدات، المتابعون، التفاعل، التوقيت", color: "oklch(0.65 0.18 200)" },
            { platform: "سناب شات", metrics: "الحضور، المحتوى، الاستمرارية", color: "oklch(0.65 0.18 60)" },
          ].map(item => (
            <div key={item.platform} className="rounded-xl p-3" style={{ background: `color-mix(in oklch, ${item.color} 8%, transparent)`, border: `1px solid color-mix(in oklch, ${item.color} 20%, transparent)` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold" style={{ color: item.color }}>{item.platform}</span>
              </div>
              <p className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>{item.metrics}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.65 0.18 145 / 0.1)", border: "1px solid oklch(0.65 0.18 145 / 0.25)", color: "oklch(0.75 0.18 145)" }}>
          ✅ البيانات حقيقية وليست تقديرية - نجلبها مباشرة من المنصات
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: "درجة الأولوية",
    subtitle: "كيف نحدد أهمية العميل؟",
    icon: <Star className="w-8 h-8" />,
    color: "oklch(0.65 0.18 60)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          يحسب الذكاء الاصطناعي <strong className="text-white">درجة الأولوية (0-100)</strong> بناءً على عدة عوامل:
        </p>
        <div className="space-y-3">
          {[
            { factor: "الفجوة التسويقية", desc: "كلما كانت الفجوة أكبر، كانت الفرصة أعلى", weight: "30%", color: "oklch(0.65 0.18 25)" },
            { factor: "ضعف الحضور الرقمي", desc: "موقع بطيء أو سوشيال ضعيف = فرصة تحسين", weight: "25%", color: "oklch(0.65 0.18 200)" },
            { factor: "حجم النشاط", desc: "عدد المراجعات على Google وحجم العمل", weight: "20%", color: "oklch(0.65 0.18 145)" },
            { factor: "المنافسة", desc: "مدى تشبع السوق في المنطقة", weight: "15%", color: "oklch(0.62 0.18 285)" },
            { factor: "إمكانية التواصل", desc: "وجود هاتف أو واتساب", weight: "10%", color: "oklch(0.65 0.18 60)" },
          ].map(item => (
            <div key={item.factor} className="flex items-start gap-3">
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-bold" style={{ background: `color-mix(in oklch, ${item.color} 15%, transparent)`, color: item.color, border: `1px solid color-mix(in oklch, ${item.color} 30%, transparent)` }}>{item.weight}</span>
              <div>
                <p className="text-sm font-medium text-white">{item.factor}</p>
                <p className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[
            { range: "70-100", label: "أولوية عالية", color: "oklch(0.65 0.18 145)" },
            { range: "40-69", label: "أولوية متوسطة", color: "oklch(0.65 0.18 60)" },
            { range: "0-39", label: "أولوية منخفضة", color: "oklch(0.65 0.18 25)" },
          ].map(item => (
            <div key={item.range} className="rounded-xl p-2 text-center" style={{ background: `color-mix(in oklch, ${item.color} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${item.color} 25%, transparent)` }}>
              <p className="text-xs font-bold" style={{ color: item.color }}>{item.range}</p>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.02 240)" }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: "التقرير الذكي",
    subtitle: "ماذا يتضمن التقرير؟",
    icon: <FileText className="w-8 h-8" />,
    color: "oklch(0.65 0.18 145)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          يولّد الذكاء الاصطناعي <strong className="text-white">تقرير PDF احترافي</strong> يتضمن:
        </p>
        <div className="space-y-2">
          {[
            { section: "بيانات العميل", items: ["الاسم، النوع، المدينة", "روابط الحضور الرقمي", "رقم التواصل"], icon: <Users className="w-4 h-4" /> },
            { section: "تحليل الموقع", items: ["درجات الأداء الستة", "نقاط الضعف والقوة", "توصيات تقنية"], icon: <Globe className="w-4 h-4" /> },
            { section: "تحليل السوشيال", items: ["أداء كل منصة", "مقارنة مع المنافسين", "فرص التحسين"], icon: <TrendingUp className="w-4 h-4" /> },
            { section: "التوصيات الذكية", items: ["أكبر فجوة تسويقية", "زاوية الدخول البيعية", "خطة عمل مقترحة"], icon: <Brain className="w-4 h-4" /> },
          ].map(item => (
            <div key={item.section} className="rounded-xl p-3" style={{ background: "oklch(0.15 0.015 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: "oklch(0.65 0.18 145)" }}>{item.icon}</span>
                <span className="text-sm font-semibold text-white">{item.section}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.items.map(i => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.2 0.02 240)", color: "oklch(0.7 0.02 240)" }}>{i}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.65 0.18 145 / 0.1)", border: "1px solid oklch(0.65 0.18 145 / 0.25)", color: "oklch(0.75 0.18 145)" }}>
          📤 يمكن إرسال التقرير مباشرة للعميل عبر واتساب بضغطة زر واحدة
        </div>
      </div>
    ),
  },
  {
    id: 6,
    title: "الإرسال عبر واتساب",
    subtitle: "كيف تتواصل مع العملاء؟",
    icon: <MessageCircle className="w-8 h-8" />,
    color: "oklch(0.55 0.2 145)",
    content: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.02 240)" }}>
          يتيح النظام <strong className="text-white">3 طرق للتواصل</strong> مع العملاء عبر واتساب:
        </p>
        <div className="space-y-3">
          {[
            {
              method: "رسالة فردية",
              desc: "إرسال رسالة مخصصة لعميل واحد مع خيار توليد الرسالة بالذكاء الاصطناعي",
              steps: ["اختر العميل", "اضغط 'توليد رسالة'", "راجع وعدّل", "أرسل"],
              color: "oklch(0.55 0.2 145)",
            },
            {
              method: "إرسال تقرير PDF",
              desc: "توليد تقرير احترافي وإرساله مع رسالة ترحيبية",
              steps: ["اضغط زر PDF", "راجع التقرير", "أضف رسالة اختيارية", "أرسل"],
              color: "oklch(0.65 0.18 200)",
            },
            {
              method: "إرسال جماعي",
              desc: "إرسال رسائل لمجموعة من العملاء مع توقيت تلقائي",
              steps: ["اختر الشريحة", "حدد الرسالة", "ابدأ الإرسال", "تابع التقدم"],
              color: "oklch(0.62 0.18 285)",
            },
          ].map(item => (
            <div key={item.method} className="rounded-xl p-3" style={{ background: `color-mix(in oklch, ${item.color} 8%, transparent)`, border: `1px solid color-mix(in oklch, ${item.color} 20%, transparent)` }}>
              <p className="text-sm font-semibold mb-1" style={{ color: item.color }}>{item.method}</p>
              <p className="text-xs mb-2" style={{ color: "oklch(0.65 0.02 240)" }}>{item.desc}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {item.steps.map((step, i) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in oklch, ${item.color} 15%, transparent)`, color: item.color }}>{step}</span>
                    {i < item.steps.length - 1 && <ChevronRight className="w-3 h-3" style={{ color: "oklch(0.4 0.02 240)" }} />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 text-xs" style={{ background: "oklch(0.55 0.2 145 / 0.1)", border: "1px solid oklch(0.55 0.2 145 / 0.25)", color: "oklch(0.7 0.15 145)" }}>
          ⚠️ يجب توصيل حساب واتساب أولاً من صفحة الإعدادات لتفعيل الإرسال
        </div>
      </div>
    ),
  },
];

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "oklch(0.1 0.015 240)", border: "1px solid oklch(0.25 0.02 240)" }}>
        {/* Header */}
        <div className="p-5 relative" style={{ background: `color-mix(in oklch, ${step.color} 15%, oklch(0.12 0.015 240))`, borderBottom: `1px solid color-mix(in oklch, ${step.color} 25%, transparent)` }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: `color-mix(in oklch, ${step.color} 20%, transparent)`, color: step.color }}>
                {step.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{step.title}</h2>
                <p className="text-sm" style={{ color: "oklch(0.7 0.02 240)" }}>{step.subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === currentStep ? "24px" : "8px",
                  background: i === currentStep ? step.color : "oklch(0.3 0.02 240)",
                }}
              />
            ))}
            <span className="text-xs mr-auto" style={{ color: "oklch(0.5 0.02 240)" }}>
              {currentStep + 1} / {steps.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 max-h-96 overflow-y-auto">
          {step.content}
        </div>

        {/* Navigation */}
        <div className="p-4 flex items-center justify-between" style={{ borderTop: "1px solid oklch(0.2 0.02 240)" }}>
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-30"
            style={{ background: "oklch(0.15 0.015 240)", color: "oklch(0.7 0.02 240)", border: "1px solid oklch(0.25 0.02 240)" }}
          >
            <ChevronLeft className="w-4 h-4" />
            السابق
          </button>

          <span className="text-xs" style={{ color: "oklch(0.5 0.02 240)" }}>
            {steps[currentStep].title}
          </span>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: step.color, color: "white" }}
            >
              التالي
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "oklch(0.55 0.2 145)", color: "white" }}
            >
              <CheckCircle className="w-4 h-4" />
              فهمت، ابدأ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
