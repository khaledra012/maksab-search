import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tag, Plus, Trash2, Edit3, RefreshCw, Palette } from "lucide-react";

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
  "#F97316", "#6366F1", "#14B8A6", "#A855F7",
];

type ConversationLabel = {
  id: number;
  name: string;
  color: string;
  description?: string | null;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function LabelForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<ConversationLabel>;
  onSave: (data: { name: string; color: string; description?: string }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3B82F6");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm mb-1.5 block">اسم التصنيف *</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="مثال: عميل مهم، متابعة، مغلق..."
          className="h-9"
        />
      </div>
      <div>
        <Label className="text-sm mb-1.5 block">اللون</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                background: c,
                borderColor: color === c ? "white" : "transparent",
                transform: color === c ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-9 h-9 rounded cursor-pointer border border-border"
          />
          <span className="text-sm text-muted-foreground font-mono">{color}</span>
          <div
            className="px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ background: color }}
          >
            معاينة
          </div>
        </div>
      </div>
      <div>
        <Label className="text-sm mb-1.5 block">وصف (اختياري)</Label>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="وصف مختصر للتصنيف..."
          className="h-9"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1 text-white"
          style={{ background: color }}
          onClick={() => onSave({ name, color, description: description || undefined })}
          disabled={!name.trim() || loading}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : null}
          حفظ التصنيف
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1">إلغاء</Button>
      </div>
    </div>
  );
}

export default function LabelsManager() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<ConversationLabel | null>(null);

  const utils = trpc.useUtils();
  const { data: labels = [], isLoading } = trpc.labels.getAll.useQuery();

  const createLabel = trpc.labels.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء التصنيف");
      setCreateOpen(false);
      utils.labels.getAll.invalidate();
    },
    onError: e => toast.error("خطأ", { description: e.message }),
  });

  const updateLabel = trpc.labels.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث التصنيف");
      setEditingLabel(null);
      utils.labels.getAll.invalidate();
    },
    onError: e => toast.error("خطأ", { description: e.message }),
  });

  const deleteLabel = trpc.labels.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف التصنيف");
      utils.labels.getAll.invalidate();
    },
    onError: e => toast.error("خطأ", { description: e.message }),
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Tag className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">إدارة التصنيفات</h1>
            <p className="text-sm text-muted-foreground">تصنيف المحادثات لتنظيم أفضل</p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 text-white" style={{ background: "#3B82F6" }}>
              <Plus className="w-4 h-4" />
              تصنيف جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-blue-400" />
                إنشاء تصنيف جديد
              </DialogTitle>
            </DialogHeader>
            <LabelForm
              onSave={data => createLabel.mutate(data)}
              onCancel={() => setCreateOpen(false)}
              loading={createLabel.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* قائمة التصنيفات */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            التصنيفات ({(labels as ConversationLabel[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (labels as ConversationLabel[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Tag className="w-12 h-12 opacity-20 mb-3" />
              <p className="text-sm mb-1">لا توجد تصنيفات بعد</p>
              <p className="text-xs opacity-60">أنشئ تصنيفات لتنظيم محادثاتك</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(labels as ConversationLabel[]).map(label => (
                <div
                  key={label.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors group"
                >
                  {/* دائرة اللون */}
                  <div
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ background: label.color }}
                  >
                    {label.name.slice(0, 1)}
                  </div>
                  {/* المعلومات */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white">{label.name}</span>
                      <Badge
                        className="text-[10px] border-0 text-white px-1.5 py-0"
                        style={{ background: label.color + "40", color: label.color }}
                      >
                        {label.color}
                      </Badge>
                    </div>
                    {label.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{label.description}</p>
                    )}
                  </div>
                  {/* أزرار */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-white"
                      onClick={() => setEditingLabel(label)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => {
                        if (confirm(`هل تريد حذف تصنيف "${label.name}"؟`)) {
                          deleteLabel.mutate({ id: label.id });
                        }
                      }}
                      disabled={deleteLabel.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal تعديل التصنيف */}
      {editingLabel && (
        <Dialog open={!!editingLabel} onOpenChange={() => setEditingLabel(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                تعديل التصنيف
              </DialogTitle>
            </DialogHeader>
            <LabelForm
              initial={editingLabel}
              onSave={data => updateLabel.mutate({ id: editingLabel.id, ...data })}
              onCancel={() => setEditingLabel(null)}
              loading={updateLabel.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* شرح الاستخدام */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            كيفية استخدام التصنيفات
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>افتح أي محادثة في صفحة الشات</li>
            <li>اضغط على قائمة الخيارات (⋮) في رأس المحادثة</li>
            <li>اختر "إضافة تصنيف" وحدد التصنيف المناسب</li>
            <li>يمكنك فلترة المحادثات حسب التصنيف من القائمة الجانبية</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
