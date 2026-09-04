import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./money";

describe("money input", () => {
  it("parses two-decimal currencies into integer minor units", () => {
    expect(parseMoneyInput("0012.5", "USD")).toEqual({ ok: true, minor: 1250, normalized: "12.50" });
    expect(parseMoneyInput("12.345", "USD")).toEqual({ ok: false, error: "Enter an amount with no more than 2 decimal places." });
  });

  it("enforces zero-decimal currency precision", () => {
    expect(parseMoneyInput("1250", "JPY")).toEqual({ ok: true, minor: 1250, normalized: "1250" });
    expect(parseMoneyInput("1250.00", "JPY")).toEqual({ ok: false, error: "Enter a whole amount for this currency." });
    expect(formatMoney(1250, "JPY", "ja-JP")).not.toMatch(/[.,]00/);
  });

  it("rejects negatives, empty values, and values beyond the limit", () => {
    expect(parseMoneyInput("-1", "KES").ok).toBe(false);
    expect(parseMoneyInput("", "KES").ok).toBe(false);
    expect(parseMoneyInput("10000000000.00", "USD").ok).toBe(false);
  });

  it.each(["USD", "KES", "EUR", "GBP", "NGN", "ZAR", "CAD", "AUD", "INR", "AED"] as const)(
    "formats %s with two fractional digits",
    (currency) => expect(formatMoney(123456, currency, "en")).toMatch(/1[,.]234\.56|1,234\.56/),
  );
});
