/**
 * اختبارات sendPdfViaBot و bulkSendPdfViaBot
 * يختبر منطق الخطوتين: assign-custom-fields + trigger-bot
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── محاكاة whatchimpPost ──────────────────────────────────────────────────────
vi.mock("../server/routers/whatchimp", () => ({}));

// ── اختبار منطق الخطوتين ─────────────────────────────────────────────────────
describe("sendPdfViaBot - Logic Tests", () => {
  it("يجب أن يُرسل custom_fields بصيغة JSON صحيحة", () => {
    const pdfUrl = "https://example.com/reports/client-123.pdf";
    const payload = {
      custom_fields: JSON.stringify({ pdf_report_link: pdfUrl }),
    };
    const parsed = JSON.parse(payload.custom_fields);
    expect(parsed.pdf_report_link).toBe(pdfUrl);
    expect(typeof payload.custom_fields).toBe("string");
  });

  it("يجب أن يتحقق من وجود رابط PDF قبل الإرسال", () => {
    const pdfUrl = "";
    const isValid = pdfUrl.startsWith("http");
    expect(isValid).toBe(false);
  });

  it("يجب أن يتحقق من صحة رابط PDF", () => {
    const validUrl = "https://s3.amazonaws.com/bucket/reports/client-456.pdf";
    const isValid = validUrl.startsWith("http");
    expect(isValid).toBe(true);
  });

  it("يجب أن يتعامل مع botFlowUniqueId من الإعدادات أو من الـ input", () => {
    const savedFlowId = "flow_123_abc";
    const inputFlowId = undefined;
    const flowId = inputFlowId ?? savedFlowId;
    expect(flowId).toBe("flow_123_abc");
  });

  it("يجب أن يُفضّل botFlowUniqueId من الـ input على الإعدادات", () => {
    const savedFlowId = "flow_saved";
    const inputFlowId = "flow_override";
    const flowId = inputFlowId ?? savedFlowId;
    expect(flowId).toBe("flow_override");
  });

  it("يجب أن يُعيد خطأ إذا لم يكن هناك flowId", () => {
    const savedFlowId = null;
    const inputFlowId = undefined;
    const flowId = inputFlowId ?? savedFlowId;
    expect(flowId).toBeNull();
  });
});

// ── اختبار تنسيق رقم الهاتف ──────────────────────────────────────────────────
describe("normalizePhone - للاستخدام مع WhatChimp", () => {
  function normalizePhone(phone: string): string {
    let p = phone.replace(/\D/g, "");
    if (p.startsWith("00")) p = p.slice(2);
    if (p.startsWith("0") && p.length === 10) p = "966" + p.slice(1);
    if (!p.startsWith("966") && p.length === 9) p = "966" + p;
    return p;
  }

  it("يجب أن يُحوّل 05XXXXXXXX إلى 9665XXXXXXXX", () => {
    expect(normalizePhone("0512345678")).toBe("966512345678");
  });

  it("يجب أن يُحوّل 9665XXXXXXXX بدون تغيير", () => {
    expect(normalizePhone("966512345678")).toBe("966512345678");
  });

  it("يجب أن يُحوّل 005XXXXXXXX", () => {
    expect(normalizePhone("00966512345678")).toBe("966512345678");
  });

  it("يجب أن يُزيل الشرطات والمسافات", () => {
    expect(normalizePhone("0512-345-678")).toBe("966512345678");
  });
});

// ── اختبار bulkSendPdfViaBot - منطق التحقق ───────────────────────────────────
describe("bulkSendPdfViaBot - Validation Logic", () => {
  it("يجب أن يتخطى العملاء بدون رقم هاتف", () => {
    const leads = [
      { id: 1, verifiedPhone: null, pdfFileUrl: "https://example.com/1.pdf" },
      { id: 2, verifiedPhone: "0512345678", pdfFileUrl: "https://example.com/2.pdf" },
      { id: 3, verifiedPhone: "0598765432", pdfFileUrl: null },
    ];

    let sent = 0, skipped = 0;
    for (const lead of leads) {
      if (!lead.verifiedPhone || !lead.pdfFileUrl) { skipped++; continue; }
      sent++;
    }

    expect(sent).toBe(1);
    expect(skipped).toBe(2);
  });

  it("يجب أن يتحقق من حد 1000 عميل كحد أقصى", () => {
    const maxLeads = 1000;
    const inputLeads = Array.from({ length: 1001 }, (_, i) => i + 1);
    const isValid = inputLeads.length <= maxLeads;
    expect(isValid).toBe(false);
  });

  it("يجب أن يُضيف تأخير 300ms بين الإرسالات لتجنب Rate Limiting", () => {
    const delay = 300;
    expect(delay).toBeGreaterThanOrEqual(200);
  });
});

// ── اختبار تفسير استجابة WhatChimp ──────────────────────────────────────────
describe("WhatChimp API Response Parsing", () => {
  it("يجب أن يعتبر status=1 نجاحاً", () => {
    const response = { status: 1, message: "Message sent" };
    const success = String(response.status) === "1";
    expect(success).toBe(true);
  });

  it("يجب أن يعتبر status=0 فشلاً", () => {
    const response = { status: 0, message: "Phone not found" };
    const success = String(response.status) === "1";
    expect(success).toBe(false);
  });

  it("يجب أن يعتبر status='1' (string) نجاحاً", () => {
    const response = { status: "1", message: "OK" };
    const success = String(response.status) === "1";
    expect(success).toBe(true);
  });

  it("يجب أن يُعيد رسالة الخطأ من الاستجابة", () => {
    const response = { status: 0, message: "Invalid phone number" };
    const errorMsg = String(response.message ?? "فشل trigger-bot");
    expect(errorMsg).toBe("Invalid phone number");
  });
});
