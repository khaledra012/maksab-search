import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Instagram, Search, Hash, Users, Globe, Phone, Mail,
  Plus, CheckCircle, Loader2, Sparkles, ChevronRight,
  Building2, ExternalLink, AlertCircle
} from "lucide-react";

export default function InstagramSearch() {
  const [hashtag, setHashtag] = useState("");
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null);
  const [addLeadAccount, setAddLeadAccount] = useState<any | null>(null);
  const [leadForm, setLeadForm] = useState({ companyName: "", businessType: "", city: "", notes: "" });
  const [niche, setNiche] = useState("");

  const { data: searches, refetch: refetchSearches } = trpc.instagram.listSearches.useQuery();
  const { data: accounts, isLoading: accountsLoading } = trpc.instagram.getAccounts.useQuery(
    { searchId: selectedSearchId! },
    { enabled: !!selectedSearchId }
  );

  const startSearch = trpc.instagram.startSearch.useMutation({
    onSuccess: (data) => {
      toast.success(`تم البحث بنجاح — ${data.count} حساب`, { description: "اضغط على البحث لعرض النتائج" });
      refetchSearches();
      setSelectedSearchId(data.searchId);
      setHashtag("");
    },
    onError: (err) => {
      if (err.message.includes("INSTAGRAM_ACCESS_TOKEN")) {
        toast.error("يجب إعداد بيانات الاعتماد", { description: "أضف INSTAGRAM_ACCESS_TOKEN و INSTAGRAM_APP_ID في إعدادات المشروع" });
      } else {
        toast.error("خطأ في البحث", { description: err.message });
      }
    },
  });

  const suggestHashtags = trpc.instagram.suggestHashtags.useMutation({
    onSuccess: (hashtags) => {
      toast.success(`${hashtags.length} هاشتاق مقترح`, { description: "اضغط على أي هاشتاق لاستخدامه" });
      setSuggestedHashtags(hashtags);
    },
    onError: () => toast.error("خطأ", { description: "تعذر توليد الهاشتاقات" }),
  });

  const addAsLead = trpc.instagram.addAsLead.useMutation({
    onSuccess: () => {
      toast.success("تمت الإضافة كعميل محتمل", { description: "يمكنك الآن مراجعته في قائمة العملاء" });
      setAddLeadAccount(null);
      setLeadForm({ companyName: "", businessType: "", city: "", notes: "" });
    },
    onError: (err) => toast.error("خطأ", { description: err.message }),
  });

  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);

  const handleSearch = () => {
    if (!hashtag.trim()) return;
    startSearch.mutate({ hashtag: hashtag.trim() });
  };

  const handleAddLead = () => {
    if (!addLeadAccount || !leadForm.companyName || !leadForm.businessType) return;
    addAsLead.mutate({
      accountId: addLeadAccount.id,
      companyName: leadForm.companyName,
      businessType: leadForm.businessType,
      city: leadForm.city,
      instagramUrl: `https://instagram.com/${addLeadAccount.username}`,
      phone: addLeadAccount.phone || undefined,
      website: addLeadAccount.website || undefined,
      notes: leadForm.notes,
    });
  };

  const openAddLead = (account: any) => {
    setAddLeadAccount(account);
    setLeadForm({
      companyName: account.fullName || account.username,
      businessType: account.businessCategory || "",
      city: account.city || "",
      notes: account.bio ? `بيو: ${account.bio.substring(0, 100)}` : "",
    });
  };

  const statusColor = (status: string) => {
    if (status === "done") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (status === "running") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (status === "error") return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  const statusLabel = (status: string) => {
    if (status === "done") return "مكتمل";
    if (status === "running") return "جاري";
    if (status === "error") return "خطأ";
    return "انتظار";
  };

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
            <Instagram className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">بحث إنستغرام</h1>
            <p className="text-muted-foreground text-sm">اكتشف الأنشطة التجارية السعودية عبر الهاشتاقات</p>
          </div>
        </div>

        {/* إشعار الإعداد */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-400 mb-1">يتطلب إعداد Instagram Graph API</p>
                <p className="text-muted-foreground">
                  لاستخدام هذه الميزة تحتاج إلى: <strong>Facebook App ID</strong> + <strong>Instagram Access Token</strong> من حساب Business أو Creator.
                  {" "}<a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">اذهب إلى Meta for Developers</a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* لوحة البحث */}
          <div className="space-y-4">

            {/* بحث بالهاشتاق */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  بحث بالهاشتاق
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="مثال: مطعم_الرياض"
                    value={hashtag}
                    onChange={(e) => setHashtag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="text-right"
                  />
                  <Button onClick={handleSearch} disabled={startSearch.isPending || !hashtag.trim()} size="icon">
                    {startSearch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">بدون # — مثال: مطعم_الرياض أو صالون_جدة</p>
              </CardContent>
            </Card>

            {/* اقتراح هاشتاقات بالذكاء الاصطناعي */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  اقتراح هاشتاقات بالذكاء الاصطناعي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="مثال: مطاعم، صالونات، مقاولات"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && niche.trim() && suggestHashtags.mutate({ niche })}
                    className="text-right"
                  />
                  <Button
                    variant="outline"
                    onClick={() => niche.trim() && suggestHashtags.mutate({ niche })}
                    disabled={suggestHashtags.isPending || !niche.trim()}
                    size="icon"
                  >
                    {suggestHashtags.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
                {suggestedHashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {suggestedHashtags.map((h) => (
                      <button
                        key={h}
                        onClick={() => setHashtag(h.replace(/^#/, ""))}
                        className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        #{h.replace(/^#/, "")}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* سجل عمليات البحث */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">سجل البحث</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!searches || searches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد عمليات بحث بعد</p>
                ) : (
                  searches.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSearchId(s.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-right transition-colors ${
                        selectedSearchId === s.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${statusColor(s.status)}`}>
                          {statusLabel(s.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s.resultsCount} حساب</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">#{s.hashtag}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* نتائج البحث */}
          <div className="lg:col-span-2">
            {!selectedSearchId ? (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground space-y-3">
                  <Instagram className="w-12 h-12 mx-auto opacity-20" />
                  <p className="text-sm">ابحث بهاشتاق أو اختر بحثاً سابقاً لعرض النتائج</p>
                </div>
              </Card>
            ) : accountsLoading ? (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">جاري تحميل الحسابات...</p>
                </div>
              </Card>
            ) : !accounts || accounts.length === 0 ? (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center text-muted-foreground space-y-3">
                  <Users className="w-12 h-12 mx-auto opacity-20" />
                  <p className="text-sm">لا توجد حسابات في هذا البحث</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{accounts.length} حساب مكتشف</p>
                  <Badge variant="outline" className="text-xs">
                    {accounts.filter(a => a.isAddedAsLead).length} مضاف كعميل
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {accounts.map((account) => (
                    <Card key={account.id} className={`transition-all ${account.isAddedAsLead ? "border-green-500/30 bg-green-500/5" : ""}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          {/* صورة الملف الشخصي */}
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 overflow-hidden">
                            {account.profilePicUrl ? (
                              <img src={account.profilePicUrl} alt={account.username} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-lg">{account.username[0].toUpperCase()}</span>
                            )}
                          </div>

                          {/* بيانات الحساب */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <a
                                href={`https://instagram.com/${account.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-foreground hover:text-primary flex items-center gap-1"
                              >
                                @{account.username}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              {account.isBusinessAccount && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  تجاري
                                </Badge>
                              )}
                              {account.isAddedAsLead && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  مضاف
                                </Badge>
                              )}
                            </div>

                            {account.fullName && (
                              <p className="text-sm text-muted-foreground mb-1">{account.fullName}</p>
                            )}

                            {account.businessCategory && (
                              <p className="text-xs text-primary mb-1">{account.businessCategory}</p>
                            )}

                            {account.bio && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{account.bio}</p>
                            )}

                            {/* إحصائيات */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {(account.followersCount || 0).toLocaleString()} متابع
                              </span>
                              {account.postsCount && (
                                <span>{account.postsCount} منشور</span>
                              )}
                            </div>

                            {/* بيانات الاتصال */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {account.phone && (
                                <span className="flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                                  <Phone className="w-3 h-3" />
                                  {account.phone}
                                </span>
                              )}
                              {account.website && (
                                <a
                                  href={account.website.startsWith("http") ? account.website : `https://${account.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-500/20"
                                >
                                  <Globe className="w-3 h-3" />
                                  موقع
                                </a>
                              )}
                              {account.email && (
                                <span className="flex items-center gap-1 text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">
                                  <Mail className="w-3 h-3" />
                                  {account.email}
                                </span>
                              )}
                            </div>

                            {/* زر الإضافة */}
                            {!account.isAddedAsLead && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAddLead(account)}
                                className="text-xs h-7"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                إضافة كعميل محتمل
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog إضافة كعميل */}
      <Dialog open={!!addLeadAccount} onOpenChange={(open) => !open && setAddLeadAccount(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              إضافة @{addLeadAccount?.username} كعميل محتمل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم النشاط التجاري *</Label>
              <Input
                value={leadForm.companyName}
                onChange={(e) => setLeadForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="اسم النشاط"
                className="mt-1"
              />
            </div>
            <div>
              <Label>نوع النشاط *</Label>
              <Input
                value={leadForm.businessType}
                onChange={(e) => setLeadForm(f => ({ ...f, businessType: e.target.value }))}
                placeholder="مطعم، صالون، مقاول..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>المدينة</Label>
              <Input
                value={leadForm.city}
                onChange={(e) => setLeadForm(f => ({ ...f, city: e.target.value }))}
                placeholder="الرياض، جدة، الدمام..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input
                value={leadForm.notes}
                onChange={(e) => setLeadForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات إضافية"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddLeadAccount(null)}>إلغاء</Button>
            <Button
              onClick={handleAddLead}
              disabled={addAsLead.isPending || !leadForm.companyName || !leadForm.businessType}
            >
              {addAsLead.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              إضافة كعميل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
