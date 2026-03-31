/**
 * ملف تشخيص مؤقت - Identity Linkage Engine
 * يُستخدم لاختبار الخوارزمية يدوياً
 */
import { normalizeName, normalizePhone, computeLinkageScore, explainLinkage } from "./lib/identityLinkage";
import type { DiscoveryCandidate } from "../shared/types/lead-intelligence";

// Test normalizeName
console.log("=== normalizeName ===");
console.log("مطعم البركة →", JSON.stringify(normalizeName("مطعم البركة")));
console.log("Al Baraka Restaurant →", JSON.stringify(normalizeName("Al Baraka Restaurant")));

// Test normalizePhone
console.log("\n=== normalizePhone ===");
console.log("0501234567 →", JSON.stringify(normalizePhone("0501234567")));
console.log("+966501234567 →", JSON.stringify(normalizePhone("+966501234567")));

// Test computeLinkageScore
const a: DiscoveryCandidate = {
  id: "debug-a",
  source: "instagram",
  sourceType: "profile",
  confidence: 0.7,
  raw: {},
  verifiedPhones: ["0501234567"],
  candidatePhones: [],
  verifiedEmails: [],
  candidateEmails: [],
  candidateWebsites: [],
  businessNameHint: "مطعم البركة",
  nameHint: "مطعم البركة",
};

const b: DiscoveryCandidate = {
  id: "debug-b",
  source: "maps",
  sourceType: "listing",
  confidence: 0.7,
  raw: {},
  verifiedPhones: ["+966501234567"],
  candidatePhones: [],
  verifiedEmails: [],
  candidateEmails: [],
  candidateWebsites: [],
  businessNameHint: "Al Baraka Restaurant",
  nameHint: "Al Baraka Restaurant",
};

const score = computeLinkageScore(a, b);
console.log("\n=== computeLinkageScore ===");
console.log("phoneScore:", score.breakdown.phoneScore);
console.log("nameScore:", score.breakdown.nameScore);
console.log("totalScore:", score.totalScore);
console.log("shouldMerge:", score.shouldMerge);
console.log("reason:", score.reason);

console.log("\n=== explainLinkage ===");
console.log(explainLinkage(a, b));
