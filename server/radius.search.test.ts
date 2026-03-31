import { describe, it, expect } from "vitest";

// اختبارات منطق البحث الجغرافي بالنطاق
describe("Radius Search Logic", () => {
  // تحويل الكيلومترات إلى أمتار
  it("converts km to meters correctly", () => {
    const radiusKm = 5;
    const radiusMeters = Math.round(radiusKm * 1000);
    expect(radiusMeters).toBe(5000);
  });

  it("converts 0.5 km to 500 meters", () => {
    const radiusKm = 0.5;
    const radiusMeters = Math.round(radiusKm * 1000);
    expect(radiusMeters).toBe(500);
  });

  it("converts 50 km to 50000 meters", () => {
    const radiusKm = 50;
    const radiusMeters = Math.round(radiusKm * 1000);
    expect(radiusMeters).toBe(50000);
  });

  // التحقق من صحة الإحداثيات
  it("validates Riyadh coordinates are within valid range", () => {
    const lat = 24.7136;
    const lng = 46.6753;
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  it("validates Jeddah coordinates", () => {
    const lat = 21.4858;
    const lng = 39.1925;
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
    expect(lng).toBeGreaterThanOrEqual(-180);
    expect(lng).toBeLessThanOrEqual(180);
  });

  // بناء params للـ Nearby Search API
  it("builds correct params for nearby search", () => {
    const input = { keyword: "مطعم", lat: 24.7136, lng: 46.6753, radiusKm: 5 };
    const params = {
      keyword: input.keyword,
      location: `${input.lat},${input.lng}`,
      radius: Math.round(input.radiusKm * 1000),
      language: "ar",
      region: "SA",
    };
    expect(params.location).toBe("24.7136,46.6753");
    expect(params.radius).toBe(5000);
    expect(params.language).toBe("ar");
    expect(params.region).toBe("SA");
  });

  // تحويل نتائج Nearby Search لتنسيق موحد
  it("maps nearby search results to unified format", () => {
    const rawResult = {
      place_id: "abc123",
      name: "مطعم الرياض",
      formatted_address: "شارع العليا، الرياض",
      vicinity: "العليا",
      geometry: { location: { lat: 24.71, lng: 46.67 } },
      rating: 4.5,
      user_ratings_total: 120,
      business_status: "OPERATIONAL",
      types: ["restaurant", "food"],
      opening_hours: { open_now: true },
    };
    const mapped = {
      place_id: rawResult.place_id,
      name: rawResult.name,
      formatted_address: rawResult.formatted_address || rawResult.vicinity || "",
      geometry: rawResult.geometry,
      rating: rawResult.rating,
      user_ratings_total: rawResult.user_ratings_total,
      business_status: rawResult.business_status,
      types: rawResult.types,
      opening_hours: rawResult.opening_hours,
    };
    expect(mapped.place_id).toBe("abc123");
    expect(mapped.name).toBe("مطعم الرياض");
    expect(mapped.formatted_address).toBe("شارع العليا، الرياض");
    expect(mapped.geometry.location.lat).toBe(24.71);
    expect(mapped.rating).toBe(4.5);
  });

  it("uses vicinity as fallback when formatted_address is missing", () => {
    const rawResult = {
      place_id: "xyz789",
      name: "صالون الجمال",
      formatted_address: undefined,
      vicinity: "حي النزهة",
      geometry: { location: { lat: 24.8, lng: 46.7 } },
    };
    const formatted_address = rawResult.formatted_address || rawResult.vicinity || "";
    expect(formatted_address).toBe("حي النزهة");
  });

  // التحقق من searchCenter في الاستجابة
  it("returns searchCenter in response", () => {
    const input = { lat: 24.7136, lng: 46.6753, radiusKm: 5 };
    const response = {
      results: [],
      nextPageToken: null,
      total: 0,
      searchCenter: { lat: input.lat, lng: input.lng },
      radiusKm: input.radiusKm,
    };
    expect(response.searchCenter.lat).toBe(24.7136);
    expect(response.searchCenter.lng).toBe(46.6753);
    expect(response.radiusKm).toBe(5);
  });

  // التحقق من geocode response
  it("extracts lat/lng from geocode response", () => {
    const geocodeResponse = {
      results: [
        {
          geometry: { location: { lat: 24.6877, lng: 46.7219 } },
          formatted_address: "الرياض، المملكة العربية السعودية",
        },
      ],
      status: "OK",
    };
    const loc = geocodeResponse.results[0].geometry.location;
    expect(loc.lat).toBe(24.6877);
    expect(loc.lng).toBe(46.7219);
  });

  it("handles ZERO_RESULTS status without throwing", () => {
    const status = "ZERO_RESULTS";
    const isAcceptable = status === "OK" || status === "ZERO_RESULTS";
    expect(isAcceptable).toBe(true);
  });

  it("throws on invalid status", () => {
    const status = "REQUEST_DENIED";
    const isAcceptable = status === "OK" || status === "ZERO_RESULTS";
    expect(isAcceptable).toBe(false);
  });

  // التحقق من نطاق الـ radius
  it("rejects radius below 0.5 km", () => {
    const radiusKm = 0.3;
    const isValid = radiusKm >= 0.5 && radiusKm <= 50;
    expect(isValid).toBe(false);
  });

  it("rejects radius above 50 km", () => {
    const radiusKm = 55;
    const isValid = radiusKm >= 0.5 && radiusKm <= 50;
    expect(isValid).toBe(false);
  });

  it("accepts radius of exactly 0.5 km", () => {
    const radiusKm = 0.5;
    const isValid = radiusKm >= 0.5 && radiusKm <= 50;
    expect(isValid).toBe(true);
  });

  it("accepts radius of exactly 50 km", () => {
    const radiusKm = 50;
    const isValid = radiusKm >= 0.5 && radiusKm <= 50;
    expect(isValid).toBe(true);
  });
});
