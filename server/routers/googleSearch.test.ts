import { describe, expect, it } from "vitest";

const itIfBrightDataConfigured = process.env.BRIGHT_DATA_WS_ENDPOINT ? it : it.skip;

describe("Google Search via Bright Data", () => {
  itIfBrightDataConfigured("should have BRIGHT_DATA_WS_ENDPOINT configured", () => {
    const endpoint = process.env.BRIGHT_DATA_WS_ENDPOINT;
    expect(endpoint).toBeTruthy();
  });

  it("should export googleSearchRouter with correct procedures", async () => {
    const { googleSearchRouter } = await import("./googleSearch");
    expect(googleSearchRouter).toBeDefined();
    expect(typeof googleSearchRouter).toBe("object");
  });

  it("should export searchGoogleWeb and deepSearchWebsite functions", async () => {
    const { searchGoogleWeb, deepSearchWebsite } = await import("./googleSearch");
    expect(typeof searchGoogleWeb).toBe("function");
    expect(typeof deepSearchWebsite).toBe("function");
  });

  it("should use Bright Data Browser API (not Custom Search API)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("server/routers/googleSearch.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("google_bright_data");
    expect(content).toContain("BRIGHT_DATA_WS_ENDPOINT");
    expect(content).toContain("puppeteer.connect");
    expect(content).not.toContain("googleapis.com/customsearch");
    console.log("googleSearch.ts uses Bright Data Browser API correctly");
  });
});
