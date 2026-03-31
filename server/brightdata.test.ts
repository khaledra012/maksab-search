import { describe, expect, it } from "vitest";

const itIfBrightDataConfigured = process.env.BRIGHT_DATA_WS_ENDPOINT ? it : it.skip;

describe("Bright Data Connection", () => {
  itIfBrightDataConfigured("should have BRIGHT_DATA_WS_ENDPOINT configured", () => {
    const endpoint = process.env.BRIGHT_DATA_WS_ENDPOINT;
    expect(endpoint).toBeDefined();
    expect(endpoint).toContain("brd.superproxy.io");
    expect(endpoint).toContain("wss://");
  });

  itIfBrightDataConfigured("should have valid endpoint format", () => {
    const endpoint = process.env.BRIGHT_DATA_WS_ENDPOINT || "";
    expect(endpoint.startsWith("wss://")).toBe(true);
    expect(endpoint).toContain("@brd.superproxy.io:9222");
  });
});
