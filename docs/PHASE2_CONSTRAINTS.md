# PHASE 2 — Architectural Constraints

> هذا الملف يوثّق القيود المعمارية المُتفَق عليها قبل البدء في PHASE 2.
> لا يُعدَّل هذا الملف إلا بموافقة صريحة.

---

## القيد 1 — WhatChimp Compatibility Adapter (إلزامي)

**النص الرسمي:**

> Any future `BusinessLead`-to-WhatChimp integration must go through a compatibility adapter layer.
> Do not let WhatChimp depend directly on the evolving `BusinessLead` shape.

**التفاصيل:**

- `BusinessLead` (المعرَّف في `shared/types/lead-intelligence.ts`) هو نوع متطور يتغير مع كل Phase.
- `whatchimpRouter` يعتمد حالياً على `LeadForWhatchimp` (نوع محلي ثابت داخل `whatchimp.ts`).
- **المطلوب في PHASE 2:** إذا احتاج WhatChimp لقراءة بيانات من `BusinessLead`، يجب إنشاء:

```ts
// server/lib/whatchimpAdapter.ts  ← الملف المطلوب إنشاؤه
export function toLeadForWhatchimp(lead: BusinessLead): LeadForWhatchimp {
  return {
    id: lead.id,
    companyName: lead.name,
    // verifiedPhone: أول رقم في verifiedPhones[] أو fallback إلى leads.verifiedPhone
    verifiedPhone: lead.verifiedPhones?.[0] ?? lead.verifiedPhone ?? null,
    // ... باقي الحقول
  };
}
```

- **ممنوع:** استيراد `BusinessLead` مباشرة داخل `whatchimp.ts` أو استخدام حقوله مباشرة.

---

## القيد 2 — الحفاظ على `leads.verifiedPhone` (إلزامي)

**النص الرسمي:**

> Preserve `leads.verifiedPhone` as a compatibility field unless explicitly migrated later.

**التفاصيل:**

- `leads.verifiedPhone` هو `varchar(20)` في قاعدة البيانات — يُستخدم حالياً من:
  - `whatchimpRouter.sendLead` / `sendBulk` / `sendTemplateMessage` / `bulkSendTemplate`
  - `whatchimpRouter.validatePhones`
  - `routers.ts` (بحث، تصدير CSV، إحصائيات)
  - `client/src/pages/Leads.tsx` (عرض الرقم في الجدول)

- **ممنوع في PHASE 2:** حذف `leads.verifiedPhone` أو إعادة تسميته في `drizzle/schema.ts`.
- **مسموح:** إضافة حقل `verifiedPhones` (JSON array) بجانبه كحقل موازٍ، مع الحفاظ على `verifiedPhone` للتوافق.
- **الترحيل الرسمي** (إن احتُيج لاحقاً) يتطلب:
  1. موافقة صريحة.
  2. migration script يملأ `verifiedPhone` من `verifiedPhones[0]`.
  3. تحديث كل استخدامات `verifiedPhone` في WhatChimp في نفس الـ PR.

---

## القيد 3 — `validateAndNormalizePhone` (تحذير)

- الدالة موجودة حالياً في `whatchimp.ts` فقط.
- إذا احتاج lead-intelligence أو أي module آخر لنفس المنطق، يجب **نقلها** إلى:
  ```
  server/lib/phoneUtils.ts
  ```
  ثم إعادة استيرادها في `whatchimp.ts` — لا تُنشئ نسخة ثالثة.

---

## ملخص القيود

| القيد | الحالة | الملف المعني |
|---|---|---|
| WhatChimp لا يعتمد مباشرة على `BusinessLead` | **إلزامي** | `server/lib/whatchimpAdapter.ts` (يُنشأ عند الحاجة) |
| `leads.verifiedPhone` يُحفظ كحقل توافق | **إلزامي** | `drizzle/schema.ts` |
| `validateAndNormalizePhone` لا تُكرَّر | **تحذير** | `server/lib/phoneUtils.ts` (يُنشأ عند الحاجة) |
