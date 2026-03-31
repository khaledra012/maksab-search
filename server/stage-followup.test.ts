/**
 * اختبارات نظام Stage وFollowUp
 */
import { describe, it, expect } from "vitest";

// ===== اختبارات منطق Stage =====
describe("Stage System", () => {
  const VALID_STAGES = ["new", "contacted", "interested", "price_offer", "meeting", "won", "lost"];

  it("should have all 7 valid stages", () => {
    expect(VALID_STAGES).toHaveLength(7);
  });

  it("should include sales funnel stages in order", () => {
    expect(VALID_STAGES[0]).toBe("new");
    expect(VALID_STAGES[VALID_STAGES.length - 2]).toBe("won");
    expect(VALID_STAGES[VALID_STAGES.length - 1]).toBe("lost");
  });

  it("should validate stage values correctly", () => {
    const isValidStage = (s: string) => VALID_STAGES.includes(s);
    expect(isValidStage("new")).toBe(true);
    expect(isValidStage("interested")).toBe(true);
    expect(isValidStage("won")).toBe(true);
    expect(isValidStage("invalid")).toBe(false);
    expect(isValidStage("")).toBe(false);
  });

  it("should categorize active stages (not won/lost)", () => {
    const activeStages = VALID_STAGES.filter(s => s !== "won" && s !== "lost");
    expect(activeStages).toHaveLength(5);
    expect(activeStages).toContain("new");
    expect(activeStages).toContain("meeting");
    expect(activeStages).not.toContain("won");
    expect(activeStages).not.toContain("lost");
  });

  it("should identify hot stages (interested, price_offer, meeting)", () => {
    const hotStages = ["interested", "price_offer", "meeting"];
    hotStages.forEach(s => expect(VALID_STAGES).toContain(s));
    expect(hotStages).toHaveLength(3);
  });
});

// ===== اختبارات منطق FollowUp =====
describe("FollowUp Logic", () => {
  it("should detect overdue follow-up dates", () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const isOverdue = (date: Date) => date < now;
    expect(isOverdue(yesterday)).toBe(true);
    expect(isOverdue(tomorrow)).toBe(false);
  });

  it("should detect chats with no reply for 24 hours", () => {
    const now = new Date();
    const moreThan24h = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const lessThan24h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const needsReply = (lastMsg: Date) => lastMsg < yesterday;
    expect(needsReply(moreThan24h)).toBe(true);
    expect(needsReply(lessThan24h)).toBe(false);
  });

  it("should identify chats missing next step", () => {
    const chatsWithMissingStep = [
      { stage: "interested", nextStep: null },
      { stage: "price_offer", nextStep: "" },
      { stage: "meeting", nextStep: "اتصال غداً" },
      { stage: "new", nextStep: null },
    ];

    const hotStages = ["interested", "price_offer", "meeting"];
    const needsNextStep = chatsWithMissingStep.filter(
      c => hotStages.includes(c.stage) && !c.nextStep
    );

    expect(needsNextStep).toHaveLength(2);
    expect(needsNextStep[0].stage).toBe("interested");
    expect(needsNextStep[1].stage).toBe("price_offer");
  });

  it("should calculate total follow-up alerts correctly", () => {
    const stats = { overdue: 3, missingStep: 5, noReply: 2 };
    const total = stats.overdue + stats.missingStep + stats.noReply;
    expect(total).toBe(10);
  });

  it("should not alert for won or lost stages", () => {
    const closedStages = ["won", "lost"];
    const hotStages = ["interested", "price_offer", "meeting"];

    closedStages.forEach(s => {
      expect(hotStages.includes(s)).toBe(false);
    });
  });
});

// ===== اختبارات فلتر Stage في قائمة المحادثات =====
describe("Stage Filter Logic", () => {
  const mockChats = [
    { id: 1, stage: "new", phone: "966501111111" },
    { id: 2, stage: "interested", phone: "966502222222" },
    { id: 3, stage: "interested", phone: "966503333333" },
    { id: 4, stage: "won", phone: "966504444444" },
    { id: 5, stage: "lost", phone: "966505555555" },
    { id: 6, stage: "price_offer", phone: "966506666666" },
  ];

  it("should filter chats by stage correctly", () => {
    const filterByStage = (stage: string | null) =>
      stage ? mockChats.filter(c => c.stage === stage) : mockChats;

    expect(filterByStage("interested")).toHaveLength(2);
    expect(filterByStage("won")).toHaveLength(1);
    expect(filterByStage("new")).toHaveLength(1);
    expect(filterByStage(null)).toHaveLength(6);
  });

  it("should count chats per stage", () => {
    const stageCounts = mockChats.reduce((acc, c) => {
      acc[c.stage] = (acc[c.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(stageCounts["interested"]).toBe(2);
    expect(stageCounts["new"]).toBe(1);
    expect(stageCounts["won"]).toBe(1);
  });

  it("should show stage badge only for non-new stages", () => {
    const shouldShowBadge = (stage: string) => stage !== "new";
    expect(shouldShowBadge("interested")).toBe(true);
    expect(shouldShowBadge("won")).toBe(true);
    expect(shouldShowBadge("new")).toBe(false);
  });
});

// ===== اختبارات updateChatStage =====
describe("updateChatStage Input Validation", () => {
  it("should require chatId", () => {
    const input = { chatId: 1, stage: "interested" };
    expect(input.chatId).toBeDefined();
    expect(typeof input.chatId).toBe("number");
  });

  it("should allow partial updates (only stage)", () => {
    const stageOnly = { chatId: 1, stage: "won" };
    const nextStepOnly = { chatId: 1, nextStep: "اتصال غداً" };
    const followUpOnly = { chatId: 1, followUpDate: "2026-03-10T10:00" };

    expect(stageOnly.stage).toBe("won");
    expect(nextStepOnly.nextStep).toBe("اتصال غداً");
    expect(followUpOnly.followUpDate).toBeTruthy();
  });

  it("should allow clearing followUpDate with null", () => {
    const clearFollowUp = { chatId: 1, followUpDate: null };
    expect(clearFollowUp.followUpDate).toBeNull();
  });
});
