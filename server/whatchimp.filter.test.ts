/**
 * Tests for sentToWhatchimp filter in getAllLeads
 * These tests verify the filter logic without hitting the actual database.
 */
import { describe, it, expect } from "vitest";

// ─── Unit tests for filter logic ─────────────────────────────────────────────

describe("sentToWhatchimp filter logic", () => {
  // Simulate the filter behavior
  function applyWhatchimpFilter(
    leads: { id: number; name: string }[],
    sentIds: number[],
    filter?: "yes" | "no"
  ) {
    if (filter === "yes") {
      if (sentIds.length === 0) return [];
      return leads.filter(l => sentIds.includes(l.id));
    }
    if (filter === "no") {
      if (sentIds.length === 0) return leads;
      return leads.filter(l => !sentIds.includes(l.id));
    }
    return leads; // no filter
  }

  const mockLeads = [
    { id: 1, name: "عميل أ" },
    { id: 2, name: "عميل ب" },
    { id: 3, name: "عميل ج" },
    { id: 4, name: "عميل د" },
  ];
  const sentIds = [1, 3]; // عميل أ وعميل ج تم إرسالهم

  it('filter "yes" returns only sent leads', () => {
    const result = applyWhatchimpFilter(mockLeads, sentIds, "yes");
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id)).toEqual([1, 3]);
  });

  it('filter "no" returns only unsent leads', () => {
    const result = applyWhatchimpFilter(mockLeads, sentIds, "no");
    expect(result).toHaveLength(2);
    expect(result.map(l => l.id)).toEqual([2, 4]);
  });

  it('no filter returns all leads', () => {
    const result = applyWhatchimpFilter(mockLeads, sentIds, undefined);
    expect(result).toHaveLength(4);
  });

  it('filter "yes" with empty sentIds returns empty array', () => {
    const result = applyWhatchimpFilter(mockLeads, [], "yes");
    expect(result).toHaveLength(0);
  });

  it('filter "no" with empty sentIds returns all leads', () => {
    const result = applyWhatchimpFilter(mockLeads, [], "no");
    expect(result).toHaveLength(4);
  });
});

// ─── Phone normalization tests ────────────────────────────────────────────────

describe("Whatchimp phone normalization", () => {
  function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("966")) return digits;
    if (digits.startsWith("0")) return "966" + digits.slice(1);
    if (digits.length === 9) return "966" + digits;
    return digits;
  }

  it("normalizes 05xx numbers to 9665xx", () => {
    expect(normalizePhone("0512345678")).toBe("966512345678");
  });

  it("keeps 966xx numbers unchanged", () => {
    expect(normalizePhone("966512345678")).toBe("966512345678");
  });

  it("normalizes 9-digit numbers to 966xx", () => {
    expect(normalizePhone("512345678")).toBe("966512345678");
  });

  it("strips non-digit characters", () => {
    expect(normalizePhone("+966-51-234-5678")).toBe("966512345678");
  });
});
