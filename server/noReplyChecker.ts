/**
 * noReplyChecker.ts
 * Cron Job يعمل كل 30 دقيقة للتحقق من المحادثات الواردة التي لم يُرد عليها
 * بعد X ساعة (افتراضياً 24 ساعة) ويُرسل إشعاراً للأدمن والموظف المعيّن
 */

import { getDb } from "./db";
import { whatsappChats, whatsappChatMessages, users } from "../drizzle/schema";
import { and, eq, lt, isNull, or, sql, desc } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// ===== الإعدادات الافتراضية =====
let noReplyHours = 24; // عدد الساعات قبل التنبيه
let checkerInterval: ReturnType<typeof setInterval> | null = null;
let lastNotifiedChats = new Set<number>(); // لتجنب التنبيه المتكرر

export function setNoReplyHours(hours: number) {
  noReplyHours = hours;
}

export function getNoReplyHours() {
  return noReplyHours;
}

/**
 * الدالة الرئيسية: تفحص المحادثات وترسل التنبيهات
 */
export async function checkNoReplyChats(): Promise<{ notified: number; chats: { id: number; phone: string; contactName: string | null; hoursSinceLastMsg: number; assignedUserName: string | null }[] }> {
  const db = await getDb();
  if (!db) return { notified: 0, chats: [] };

  const cutoffTime = new Date(Date.now() - noReplyHours * 60 * 60 * 1000);

  try {
    // جلب المحادثات المفتوحة التي:
    // 1. آخر رسالة كانت واردة (من العميل)
    // 2. مضى عليها أكثر من X ساعة
    // 3. غير مؤرشفة
    // 4. غير مغلقة
    const chatsToCheck = await db
      .select()
      .from(whatsappChats)
      .where(
        and(
          eq(whatsappChats.isArchived, false),
          isNull(whatsappChats.closedAt),
          lt(whatsappChats.lastMessageAt, cutoffTime),
          sql`${whatsappChats.lastMessageAt} IS NOT NULL`
        )
      )
      .orderBy(desc(whatsappChats.lastMessageAt))
      .limit(100);

    const noReplyChats: { id: number; phone: string; contactName: string | null; hoursSinceLastMsg: number; assignedUserName: string | null }[] = [];

    for (const chat of chatsToCheck) {
      // تحقق أن آخر رسالة كانت واردة (من العميل) وليس صادرة
      const lastMessages = await db
        .select()
        .from(whatsappChatMessages)
        .where(eq(whatsappChatMessages.chatId, chat.id))
        .orderBy(desc(whatsappChatMessages.sentAt))
        .limit(1);

      if (lastMessages.length === 0) continue;
      const lastMsg = lastMessages[0];

      // إذا كانت آخر رسالة صادرة → لا حاجة للتنبيه
      if (lastMsg.direction === "outgoing") continue;

      // إذا كانت رسالة تلقائية AI → لا حاجة للتنبيه
      if (lastMsg.isAutoReply) continue;

      const hoursSince = Math.floor((Date.now() - new Date(lastMsg.sentAt).getTime()) / (1000 * 60 * 60));

      noReplyChats.push({
        id: chat.id,
        phone: chat.phone,
        contactName: chat.contactName,
        hoursSinceLastMsg: hoursSince,
        assignedUserName: chat.assignedUserName,
      });
    }

    // إرسال إشعار واحد مجمّع إذا وجدت محادثات بدون رد جديدة
    const newChats = noReplyChats.filter(c => !lastNotifiedChats.has(c.id));

    if (newChats.length > 0) {
      const chatList = newChats
        .slice(0, 10)
        .map(c => `• ${c.contactName || c.phone} — منذ ${c.hoursSinceLastMsg} ساعة${c.assignedUserName ? ` (معيّن لـ ${c.assignedUserName})` : ""}`)
        .join("\n");

      await notifyOwner({
        title: `⚠️ ${newChats.length} محادثة بدون رد منذ +${noReplyHours} ساعة`,
        content: `المحادثات التالية تحتاج رداً عاجلاً:\n\n${chatList}${newChats.length > 10 ? `\n\n...و${newChats.length - 10} محادثة أخرى` : ""}`,
      });

      // تسجيل المحادثات التي تم التنبيه عنها
      newChats.forEach(c => lastNotifiedChats.add(c.id));

      // تنظيف القائمة إذا كبرت
      if (lastNotifiedChats.size > 500) {
        const arr = Array.from(lastNotifiedChats);
        lastNotifiedChats = new Set(arr.slice(-200));
      }
    }

    return { notified: newChats.length, chats: noReplyChats };
  } catch (err) {
    console.error("[NoReplyChecker] خطأ:", err);
    return { notified: 0, chats: [] };
  }
}

/**
 * تشغيل الـ Cron Job كل 30 دقيقة
 */
export function startNoReplyChecker() {
  if (checkerInterval) return; // تجنب التشغيل المزدوج

  console.log(`[NoReplyChecker] بدأ التشغيل — تنبيه بعد ${noReplyHours} ساعة من عدم الرد`);

  // تشغيل فوري بعد دقيقة من بدء الخادم
  setTimeout(() => {
    checkNoReplyChats().then(r => {
      if (r.notified > 0) console.log(`[NoReplyChecker] تم التنبيه عن ${r.notified} محادثة`);
    });
  }, 60 * 1000);

  // ثم كل 30 دقيقة
  checkerInterval = setInterval(() => {
    checkNoReplyChats().then(r => {
      if (r.notified > 0) console.log(`[NoReplyChecker] تم التنبيه عن ${r.notified} محادثة`);
    });
  }, 30 * 60 * 1000);
}

export function stopNoReplyChecker() {
  if (checkerInterval) {
    clearInterval(checkerInterval);
    checkerInterval = null;
  }
}
