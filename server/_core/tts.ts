import { spawn, execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface TTSOptions {
  text: string;
  voice?: TTSVoice;
  speed?: number; // 0.25 - 4.0
  lang?: string; // ar, ar-SA, en, etc.
}

export interface TTSResult {
  audioBuffer: Buffer;
  mimeType: "audio/mpeg";
}

export interface TTSError {
  error: string;
  details?: string;
}

// ===== تثبيت gTTS تلقائياً إذا لم يكن موجوداً =====
let gttsInstalled = false;

async function ensureGttsInstalled(): Promise<boolean> {
  if (gttsInstalled) return true;
  
  // فحص هل gTTS مثبت
  const pythonCmds = ["python3.11", "python3", "python"];
  let workingPython: string | null = null;
  
  for (const cmd of pythonCmds) {
    try {
      execSync(`${cmd} -c "from gtts import gTTS"`, { stdio: "pipe", timeout: 5000 });
      workingPython = cmd;
      gttsInstalled = true;
      console.log(`[TTS] gTTS متاح عبر ${cmd}`);
      return true;
    } catch {
      // جرّب الأمر التالي
    }
  }
  
  // gTTS غير مثبت - نثبته الآن
  console.log("[TTS] gTTS غير مثبت - جاري التثبيت تلقائياً...");
  const installCmds = [
    "pip3 install gtts",
    "pip install gtts",
    "python3.11 -m pip install gtts",
    "python3 -m pip install gtts",
  ];
  
  for (const cmd of installCmds) {
    try {
      execSync(cmd, { stdio: "pipe", timeout: 60000 });
      // التحقق من نجاح التثبيت
      for (const pyCmd of pythonCmds) {
        try {
          execSync(`${pyCmd} -c "from gtts import gTTS"`, { stdio: "pipe", timeout: 5000 });
          workingPython = pyCmd;
          gttsInstalled = true;
          console.log(`[TTS] ✅ gTTS تم تثبيته بنجاح عبر: ${cmd}`);
          return true;
        } catch {}
      }
    } catch (e) {
      console.log(`[TTS] فشل: ${cmd}`);
    }
  }
  
  console.error("[TTS] ❌ فشل تثبيت gTTS بجميع الطرق");
  return false;
}

// تشغيل التثبيت عند استيراد الوحدة
ensureGttsInstalled().catch(() => {});

/**
 * تحويل النص لصوت باستخدام gTTS (Google Text-to-Speech)
 * يرجع Buffer يحتوي على ملف MP3
 */
export async function textToSpeech(options: TTSOptions): Promise<TTSResult | TTSError> {
  // التأكد من تثبيت gTTS
  const installed = await ensureGttsInstalled();
  if (!installed) {
    return {
      error: "gTTS not available",
      details: "Failed to install gTTS automatically. Please run: pip3 install gtts",
    };
  }

  return new Promise((resolve) => {
    try {
      const lang = normalizeLang(options.lang || "ar");
      const slow = options.speed !== undefined && options.speed < 0.8 ? "true" : "false";

      // البحث عن gtts_helper.py في مسارات متعددة
      const possiblePaths = [
        path.join(__dirname, "gtts_helper.py"),
        path.join(process.cwd(), "server/_core/gtts_helper.py"),
        path.join(process.cwd(), "dist/gtts_helper.py"),
        "/home/ubuntu/leads_collector_saudi/server/_core/gtts_helper.py",
      ];

      let scriptPath = possiblePaths[0];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }

      // إذا لم يوجد الملف، أنشئه في الموقع الحالي
      if (!fs.existsSync(scriptPath)) {
        const fallbackPath = path.join(process.cwd(), "gtts_helper.py");
        fs.writeFileSync(fallbackPath, GTTS_HELPER_SCRIPT, "utf8");
        scriptPath = fallbackPath;
        console.log(`[TTS] أنشأت gtts_helper.py في: ${fallbackPath}`);
      }

      // تجربة python3.11 ثم python3 ثم python
      const pythonCmds = ["python3.11", "python3", "python"];
      let pythonCmd = "python3.11";
      for (const cmd of pythonCmds) {
        try {
          execSync(`${cmd} --version`, { stdio: "pipe", timeout: 3000 });
          pythonCmd = cmd;
          break;
        } catch {}
      }

      const proc = spawn(pythonCmd, [scriptPath, lang, slow], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      proc.on("close", (code) => {
        if (code !== 0) {
          const errMsg = Buffer.concat(errChunks).toString("utf8").trim();
          // إذا كان الخطأ "No module named gtts"، نعيد ضبط الحالة لإعادة التثبيت
          if (errMsg.includes("No module named")) {
            gttsInstalled = false;
          }
          resolve({
            error: "gTTS failed",
            details: errMsg || `exit code ${code}`,
          });
          return;
        }

        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length < 100) {
          resolve({
            error: "gTTS returned empty audio",
            details: `Buffer size: ${audioBuffer.length} bytes`,
          });
          return;
        }

        resolve({
          audioBuffer,
          mimeType: "audio/mpeg",
        });
      });

      proc.on("error", (err) => {
        resolve({
          error: "gTTS process error",
          details: err.message,
        });
      });

      // إرسال النص للـ stdin
      proc.stdin.write(options.text, "utf8");
      proc.stdin.end();

      // timeout بعد 30 ثانية
      const timer = setTimeout(() => {
        proc.kill();
        resolve({
          error: "gTTS timeout",
          details: "Process killed after 30s",
        });
      }, 30000);

      proc.on("close", () => clearTimeout(timer));
    } catch (err) {
      resolve({
        error: "TTS request exception",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

/**
 * تحويل كود اللهجة لكود gTTS المدعوم
 * gTTS يدعم: ar (عربي عام)، en، fr، de، إلخ
 * اللهجات العربية تُحوَّل كلها إلى "ar" لأن gTTS لا يفرق بينها
 */
function normalizeLang(lang: string): string {
  // جميع اللهجات العربية → ar
  if (lang.startsWith("ar") || lang === "saudi" || lang === "egyptian" || lang === "gulf" || lang === "fusha") {
    return "ar";
  }
  if (lang.startsWith("en")) return "en";
  return lang.split("-")[0] || "ar";
}

// نص سكريبت gtts_helper.py مضمّن كـ fallback
const GTTS_HELPER_SCRIPT = `#!/usr/bin/env python3
"""
gTTS helper: يقرأ النص من stdin ويكتب MP3 إلى stdout
الاستخدام: echo "نص" | python3 gtts_helper.py [lang] [slow]
"""
import sys
import io
import subprocess

def ensure_gtts():
    try:
        from gtts import gTTS
        return True
    except ImportError:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "gtts", "-q"], 
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            from gtts import gTTS
            return True
        except Exception as e:
            sys.stderr.write(f"ERROR: Cannot install gtts: {e}\\n")
            return False

def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else "ar"
    slow = sys.argv[2].lower() == "true" if len(sys.argv) > 2 else False
    
    text = sys.stdin.buffer.read().decode("utf-8").strip()
    if not text:
        sys.stderr.write("ERROR: No text provided\\n")
        sys.exit(1)
    
    if not ensure_gtts():
        sys.exit(1)
    
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang, slow=slow)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        sys.stdout.buffer.write(buf.read())
    except Exception as e:
        sys.stderr.write(f"ERROR: {str(e)}\\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
