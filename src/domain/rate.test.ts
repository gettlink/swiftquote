import { describe, expect, it } from "vitest";
import { formatBasisPoints, parsePercentageInput } from "./rate";

describe("percentage rates", () => {
  it("parses percentages into basis points", () => {
    expect(parsePercentageInput("7.5%", 10000)).toEqual({ ok: true, basisPoints: 750, normalized: "7.5" });
    expect(parsePercentageInput("10", 10000)).toEqual({ ok: true, basisPoints: 1000, normalized: "10" });
  });

  it("enforces precision and bounds", () => {
    expect(parsePercentageInput("1.234", 10000).ok).toBe(false);
    expect(parsePercentageInput("100.01", 10000).ok).toBe(false);
    expect(parsePercentageInput("-1", 10000).ok).toBe(false);
  });

  it("formats basis points without false zeroes", () => {
    expect(formatBasisPoints(750)).toBe("7.5%");
    expect(formatBasisPoints(1000)).toBe("10%");
    expect(formatBasisPoints(755)).toBe("7.55%");
  });
});
