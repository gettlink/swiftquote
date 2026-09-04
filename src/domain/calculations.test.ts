import { describe, expect, it } from "vitest";
import type { LineItem, SwiftDocument } from "./document";
import { CalculationError, calculateDocumentTotals } from "./calculations";
import { createSampleDocument } from "./fixtures";
import { MAX_MONEY_MINOR } from "./limits";

function calculate(items: LineItem[], adjustment: Partial<SwiftDocument["adjustment"]> = {}, type: SwiftDocument["type"] = "invoice") {
  return calculateDocumentTotals({
    type,
    items,
    adjustment: { discountBasisPoints: 0, taxBasisPoints: 0, feeMinor: 0, amountPaidMinor: 0, ...adjustment },
  });
}

function item(id: string, quantity: string, unitPriceMinor: number, taxable = true): LineItem {
  return { id, description: id, quantity, unitPriceMinor, taxable };
}

describe("document calculations", () => {
  it("calculates one item with no adjustment", () => {
    expect(calculate([item("one", "2", 1000)])).toMatchObject({ subtotalMinor: 2000, discountMinor: 0, taxMinor: 0, totalMinor: 2000, balanceDueMinor: 2000 });
  });

  it("rounds multiple fractional line quantities at the line boundary", () => {
    const totals = calculate([item("one", "1.5", 1001), item("two", "2.25", 400)]);
    expect(totals.lineTotals.map((line) => line.amountMinor)).toEqual([1502, 900]);
    expect(totals.subtotalMinor).toBe(2402);
  });

  it("taxes only taxable items", () => {
    expect(calculate([item("taxable", "1", 10000), item("not-taxable", "1", 5000, false)], { taxBasisPoints: 1000 })).toMatchObject({
      subtotalMinor: 15000,
      taxableSubtotalMinor: 10000,
      nonTaxableSubtotalMinor: 5000,
      taxMinor: 1000,
      totalMinor: 16000,
    });
  });

  it("applies the discount before tax", () => {
    expect(calculate([item("one", "1", 10000)], { discountBasisPoints: 1000, taxBasisPoints: 2000 })).toMatchObject({
      discountMinor: 1000,
      discountedTaxableSubtotalMinor: 9000,
      taxMinor: 1800,
      totalMinor: 10800,
    });
  });

  it("rounds a fractional minor-unit discount half up", () => {
    expect(calculate([item("one", "1", 5)], { discountBasisPoints: 1000 })).toMatchObject({ discountMinor: 1, totalMinor: 4 });
  });

  it("allocates a discount proportionally for the taxable base", () => {
    expect(calculate([item("taxable", "1", 600), item("not-taxable", "1", 400, false)], { discountBasisPoints: 1000, taxBasisPoints: 1000 })).toMatchObject({
      discountMinor: 100,
      taxableDiscountMinor: 60,
      discountedTaxableSubtotalMinor: 540,
      taxMinor: 54,
      totalMinor: 954,
    });
  });

  it("excludes the additional fee from tax", () => {
    expect(calculate([item("one", "1", 10000)], { taxBasisPoints: 1000, feeMinor: 500 })).toMatchObject({ taxMinor: 1000, feeMinor: 500, totalMinor: 11500 });
  });

  it("calculates partial and full invoice payments", () => {
    expect(calculate([item("one", "1", 10000)], { amountPaidMinor: 2500 })).toMatchObject({ totalMinor: 10000, balanceDueMinor: 7500 });
    expect(calculate([item("one", "1", 10000)], { amountPaidMinor: 10000 })).toMatchObject({ balanceDueMinor: 0 });
  });

  it("rejects attempted overpayment", () => {
    expect(() => calculate([item("one", "1", 10000)], { amountPaidMinor: 10001 })).toThrowError(new CalculationError("Amount paid cannot be greater than the total.", "amountPaidMinor"));
  });

  it("ignores amount paid for quotes", () => {
    expect(calculate([item("one", "1", 10000)], { amountPaidMinor: 9000 }, "quote")).toMatchObject({ amountPaidMinor: 0, balanceDueMinor: 10000 });
  });

  it("calculates zero-decimal currencies in the same minor-unit engine", () => {
    const document = { ...createSampleDocument(), currency: "JPY" as const, items: [item("one", "1.5", 101)], adjustment: { discountBasisPoints: 0, taxBasisPoints: 1000, feeMinor: 0, amountPaidMinor: 0 } };
    expect(calculateDocumentTotals(document)).toMatchObject({ subtotalMinor: 152, taxMinor: 15, totalMinor: 167 });
  });

  it("accepts the maximum safe document value", () => {
    expect(calculate([item("max", "1", MAX_MONEY_MINOR)]).totalMinor).toBe(MAX_MONEY_MINOR);
  });

  it("rejects values immediately beyond accepted calculation limits", () => {
    expect(() => calculate([item("too-large", "1.0001", MAX_MONEY_MINOR)])).toThrow(/supported amount range/);
    expect(() => calculate([item("one", "1", 1)], { feeMinor: MAX_MONEY_MINOR })).toThrow(/Total is outside/);
    expect(() => calculate([item("one", "1", 1)], { discountBasisPoints: 10001 })).toThrow(/100 percent/);
  });
});
