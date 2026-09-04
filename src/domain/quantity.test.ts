import { describe, expect, it } from "vitest";
import { parseQuantity } from "./quantity";

describe("quantity parsing", () => {
  it("preserves exact decimal scale for calculations", () => {
    expect(parseQuantity("001.5000")).toEqual({
      ok: true,
      quantity: { scaled: 15000n, scale: 10000n, value: 1.5, normalized: "1.5" },
    });
  });

  it.each(["", "0", "-1", "1.", ".5", "1.00001", "1000000.0001"])("rejects invalid quantity %s", (value) => {
    expect(parseQuantity(value).ok).toBe(false);
  });

  it("accepts the maximum quantity", () => expect(parseQuantity("1000000").ok).toBe(true));
});
