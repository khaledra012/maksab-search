import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

console.log("SMTP_HOST:", SMTP_HOST);
console.log("SMTP_PORT:", SMTP_PORT);
console.log("SMTP_USER:", SMTP_USER);
console.log("SMTP_PASS length:", SMTP_PASS.length);
console.log("SMTP_PASS:", SMTP_PASS.substring(0, 4) + "****");

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

try {
  await transporter.verify();
  console.log("✅ SMTP اتصال ناجح!");
} catch (err) {
  console.error("❌ فشل الاتصال:", err.message);
  if (err.message.includes("Invalid login") || err.message.includes("Username and Password not accepted")) {
    console.log("\n⚠️  كلمة المرور غير صحيحة. تحتاج App Password من Gmail.");
    console.log("رابط: https://myaccount.google.com/apppasswords");
  }
}
