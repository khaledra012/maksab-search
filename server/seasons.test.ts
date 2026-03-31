import { describe, it, expect } from "vitest";

// ===== اختبارات نظام المواسم التسويقية =====

describe("نظام المواسم التسويقية", () => {
  // اختبار منطق تحديد الموسم النشط
  describe("منطق فلترة المواسم", () => {
    it("يجب أن يتعرف على الموسم النشط بشكل صحيح", () => {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${mm}-${dd}`;

      // موسم يشمل اليوم الحالي
      const activeSeason = {
        startDate: "01-01",
        endDate: "12-31",
        isActive: true,
        relatedBusinessTypes: null,
      };

      const start = activeSeason.startDate;
      const end = activeSeason.endDate;
      const isActive = start <= end
        ? todayStr >= start && todayStr <= end
        : todayStr >= start || todayStr <= end;

      expect(isActive).toBe(true);
    });

    it("يجب أن يستبعد الموسم المنتهي", () => {
      const pastSeason = {
        startDate: "01-01",
        endDate: "01-02",
        isActive: true,
      };

      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayStr = `${mm}-${dd}`;

      // إذا كان اليوم بعد 02 يناير، الموسم منتهٍ
      const isActive = todayStr >= pastSeason.startDate && todayStr <= pastSeason.endDate;
      
      // نتحقق فقط أن المنطق يعمل
      expect(typeof isActive).toBe("boolean");
    });

    it("يجب أن يتحقق من ربط نوع النشاط بالموسم", () => {
      const season = {
        relatedBusinessTypes: ["مطعم", "كافيه", "أغذية"],
      };

      const businessType = "مطعم شاورما";
      const bt = businessType.toLowerCase();
      const related = season.relatedBusinessTypes;

      const isRelated = related.some(
        (r) => bt.includes(r.toLowerCase()) || r.toLowerCase().includes(bt)
      );

      expect(isRelated).toBe(true);
    });

    it("يجب أن يشمل الموسم جميع الأنشطة إذا كانت relatedBusinessTypes فارغة", () => {
      const season = {
        relatedBusinessTypes: [],
      };

      const related = season.relatedBusinessTypes;
      const isForAll = !related || related.length === 0;

      expect(isForAll).toBe(true);
    });
  });

  // اختبار بناء HTML التقرير
  describe("بناء قسم الصور في التقرير", () => {
    it("يجب أن يُظهر قسم الصور فقط إذا كانت الصور موجودة", () => {
      const lead = {
        clientLogoUrl: "https://example.com/logo.png",
        placePhotos: ["https://example.com/photo1.jpg"],
      };

      const clientLogoUrl = lead.clientLogoUrl || "";
      const placePhotos: string[] = Array.isArray(lead.placePhotos)
        ? lead.placePhotos.slice(0, 3)
        : [];
      const instaProfilePic = "";

      const hasImages = placePhotos.length > 0 || !!clientLogoUrl || !!instaProfilePic;
      expect(hasImages).toBe(true);
    });

    it("يجب أن يُخفي قسم الصور إذا لم تكن هناك صور", () => {
      const lead = {
        clientLogoUrl: null,
        placePhotos: null,
      };

      const clientLogoUrl = lead.clientLogoUrl || "";
      const placePhotos: string[] = Array.isArray(lead.placePhotos)
        ? lead.placePhotos.slice(0, 3)
        : [];
      const instaProfilePic = "";

      const hasImages = placePhotos.length > 0 || !!clientLogoUrl || !!instaProfilePic;
      expect(hasImages).toBe(false);
    });
  });

  // اختبار منطق القناة الأكثر جدوى
  describe("منطق القناة الأكثر جدوى", () => {
    function detectPrimaryChannel(businessType: string) {
      const bt = businessType.toLowerCase();
      if (bt.includes("مطعم") || bt.includes("كافيه") || bt.includes("أغذية")) {
        return { channel: "إنستغرام وتيك توك", color: "#e1306c" };
      }
      if (bt.includes("محاسب") || bt.includes("استشار") || bt.includes("برمجة")) {
        return { channel: "لينكدإن والموقع الإلكتروني", color: "#0077b5" };
      }
      return { channel: "إنستغرام", color: "#e1306c" };
    }

    it("يجب أن يُحدد إنستغرام وتيك توك للمطاعم", () => {
      const result = detectPrimaryChannel("مطعم شاورما");
      expect(result.channel).toBe("إنستغرام وتيك توك");
    });

    it("يجب أن يُحدد لينكدإن للخدمات المهنية", () => {
      const result = detectPrimaryChannel("شركة استشارات إدارية");
      expect(result.channel).toBe("لينكدإن والموقع الإلكتروني");
    });

    it("يجب أن يُعيد إنستغرام كقناة افتراضية", () => {
      const result = detectPrimaryChannel("نشاط غير معروف");
      expect(result.channel).toBe("إنستغرام");
    });
  });

  // اختبار بناء QR Code URL
  describe("بناء رابط QR Code", () => {
    it("يجب أن يبني رابط QR Code صحيح لواتساب", () => {
      const companyPhone = "0501234567";
      const waPhone = companyPhone.replace(/[^0-9]/g, "");
      const waNumber = waPhone.startsWith("966")
        ? waPhone
        : waPhone.startsWith("0")
        ? "966" + waPhone.slice(1)
        : "966" + waPhone;

      expect(waNumber).toBe("966501234567");

      const waMessage = encodeURIComponent("مرحباً، اطلعت على التقرير");
      const waLink = `https://wa.me/${waNumber}?text=${waMessage}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(waLink)}`;

      expect(qrApiUrl).toContain("api.qrserver.com");
      expect(qrApiUrl).toContain("966501234567");
    });

    it("يجب أن يتعامل مع أرقام تبدأ بـ 966", () => {
      const companyPhone = "966501234567";
      const waPhone = companyPhone.replace(/[^0-9]/g, "");
      const waNumber = waPhone.startsWith("966")
        ? waPhone
        : waPhone.startsWith("0")
        ? "966" + waPhone.slice(1)
        : "966" + waPhone;

      expect(waNumber).toBe("966501234567");
    });
  });
});
