import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "بحثي";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

try {
  const info = await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
    to: SMTP_USER, // إرسال لنفس الحساب كاختبار
    subject: "✅ اختبار نظام الدعوات - بحثي",
    html: `
      <div dir="rtl" style="font-family: Arial; padding: 20px;">
        <h2>🎉 نظام الإيميل يعمل بنجاح!</h2>
        <p>هذا إيميل اختبار للتأكد من أن نظام الدعوات يعمل.</p>
        <p>سيتلقى المدعوون رابط دعوة مثل هذا:</p>
        <a href="https://maksab-sales.xyz/accept-invitation?token=TEST_TOKEN" 
           style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;margin:10px 0">
          قبول الدعوة
        </a>
        <p style="color:#666;font-size:12px;">صالح لمدة 7 أيام</p>
      </div>
    `,
  });
  console.log("✅ إيميل الاختبار أُرسل بنجاح!");
  console.log("Message ID:", info.messageId);
} catch (err) {
  console.error("❌ فشل الإرسال:", err.message);
}
