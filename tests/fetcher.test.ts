// Tests for the yield fetcher — validates data shape and mock fallback
// No network dependency; mocks axios for deterministic tests.

import { fetchAllYields, generateReasoning } from "../src/yield/fetcher";

// Mock axios so tests don't hit the network
jest.mock("axios", () => ({
  get: jest.fn().mockRejectedValue(new Error("Network disabled in tests")),
}));

describe("fetchAllYields", () => {
  it("returns exactly 3 yield opportunities on fallback", async () => {
    const yields = await fetchAllYields();

    expect(yields.length).toBe(3);
    for (const y of yields) {
      expect(y.protocol).toBeDefined();
      expect(y.asset).toBeDefined();
      expect(typeof y.apy).toBe("number");
      expect(y.apy).toBeGreaterThan(0);
      expect(typeof y.tvl).toBe("number");
      expect(y.tvl).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(y.riskLevel);
      expect(y.depositAddress).toBeTruthy();
      expect(y.url).toBeTruthy();
    }
  });

  it("returns yields sorted by APY descending", async () => {
    const yields = await fetchAllYields();
    for (let i = 1; i < yields.length; i++) {
      expect(yields[i - 1].apy).toBeGreaterThanOrEqual(yields[i].apy);
    }
  });

  it("includes all three target protocols", async () => {
    const yields = await fetchAllYields();
    const names = yields.map(y => y.protocol);
    expect(names).toContain("Zest Protocol");
    expect(names).toContain("Bitflow");
    expect(names).toContain("StackingDAO");
  });
});

describe("generateReasoning", () => {
  it("produces a non-empty string mentioning the top protocol", async () => {
    const yields = await fetchAllYields();
    const reasoning = generateReasoning(yields[0], yields);

    expect(reasoning.length).toBeGreaterThan(50);
    expect(reasoning).toContain(yields[0].protocol);
    expect(reasoning).toContain(yields[1].protocol);
    expect(reasoning).toContain(yields[2].protocol);
  });
});
