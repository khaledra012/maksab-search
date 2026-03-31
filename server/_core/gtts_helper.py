#!/usr/bin/env python3
"""
gTTS helper: يقرأ النص من stdin ويكتب MP3 إلى stdout
الاستخدام: echo "نص" | python3 gtts_helper.py [lang] [slow]
يثبّت gTTS تلقائياً إذا لم يكن موجوداً
"""
import sys
import io
import subprocess


def ensure_gtts():
    """تثبيت gTTS تلقائياً إذا لم يكن موجوداً"""
    try:
        from gtts import gTTS
        return True
    except ImportError:
        sys.stderr.write("[gtts_helper] gTTS غير مثبت - جاري التثبيت...\n")
        install_cmds = [
            [sys.executable, "-m", "pip", "install", "gtts", "-q"],
            ["pip3", "install", "gtts", "-q"],
            ["pip", "install", "gtts", "-q"],
        ]
        for cmd in install_cmds:
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=60, text=True)
                if result.returncode == 0:
                    try:
                        from gtts import gTTS
                        sys.stderr.write("[gtts_helper] ✅ تم تثبيت gTTS بنجاح\n")
                        return True
                    except ImportError:
                        continue
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
        sys.stderr.write("[gtts_helper] ❌ فشل تثبيت gTTS\n")
        return False


def main():
    lang = sys.argv[1] if len(sys.argv) > 1 else "ar"
    slow = sys.argv[2].lower() == "true" if len(sys.argv) > 2 else False
    
    # قراءة النص من stdin
    text = sys.stdin.buffer.read().decode("utf-8").strip()
    if not text:
        sys.stderr.write("ERROR: No text provided\n")
        sys.exit(1)
    
    # التأكد من تثبيت gTTS
    if not ensure_gtts():
        sys.stderr.write("ERROR: No module named 'gtts' and installation failed\n")
        sys.exit(1)
    
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang, slow=slow)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        # كتابة MP3 إلى stdout
        sys.stdout.buffer.write(buf.read())
    except Exception as e:
        sys.stderr.write(f"ERROR: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
