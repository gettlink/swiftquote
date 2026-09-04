import type { LineItem, SwiftDocument } from "./document";
import { MAX_DISCOUNT_BASIS_POINTS, MAX_MONEY_MINOR, MAX_RATE_BASIS_POINTS } from "./limits";
import { parseQuantity } from "./quantity";

export interface LineTotal {
  readonly itemId: string;
  readonly amountMinor: number;
  readonly taxable: boolean;
}

export interface DocumentTotals {
  readonly lineTotals: readonly LineTotal[];
  readonly subtotalMinor: number;
  readonly taxableSubtotalMinor: number;
  readonly nonTaxableSubtotalMinor: number;
  readonly discountMinor: number;
  readonly taxableDiscountMinor: number;
  readonly discountedTaxableSubtotalMinor: number;
  readonly taxMinor: number;
  readonly feeMinor: number;
  readonly totalMinor: number;
  readonly amountPaidMinor: number;
  readonly balanceDueMinor: number;
}

export class CalculationError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "CalculationError";
  }
}

function roundRatioHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("Rounding denominator must be positive.");
  return (numerator + denominator / 2n) / denominator;
}

function toBoundedMinor(value: bigint, field: string): number {
  if (value < 0n || value > BigInt(MAX_MONEY_MINOR)) {
    throw new CalculationError(`${field} is outside the supported amount range.`, field);
  }
  return Number(value);
}

export function calculateLineAmount(item: Pick<LineItem, "quantity" | "unitPriceMinor">): number {
  if (!Number.isSafeInteger(item.unitPriceMinor) || item.unitPriceMinor < 0 || item.unitPriceMinor > MAX_MONEY_MINOR) {
    throw new CalculationError("Unit price is outside the supported amount range.", "unitPriceMinor");
  }
  const result = parseQuantity(item.quantity);
  if (!result.ok) throw new CalculationError(result.error, "quantity");
  const amount = roundRatioHalfUp(BigInt(item.unitPriceMinor) * result.quantity.scaled, result.quantity.scale);
  return toBoundedMinor(amount, "Line total");
}

export function calculateDocumentTotals(
  document: Pick<SwiftDocument, "type" | "items" | "adjustment">,
): DocumentTotals {
  const { discountBasisPoints, taxBasisPoints, feeMinor } = document.adjustment;
  const amountPaidMinor = document.type === "invoice" ? document.adjustment.amountPaidMinor : 0;
  for (const [field, value] of [
    ["discountBasisPoints", discountBasisPoints],
    ["taxBasisPoints", taxBasisPoints],
    ["feeMinor", feeMinor],
    ["amountPaidMinor", amountPaidMinor],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new CalculationError(`${field} cannot be negative or fractional.`, field);
  }
  if (discountBasisPoints > MAX_DISCOUNT_BASIS_POINTS) throw new CalculationError("Discount cannot exceed 100 percent.", "discountBasisPoints");
  if (taxBasisPoints > MAX_RATE_BASIS_POINTS) throw new CalculationError("Tax rate is above the supported limit.", "taxBasisPoints");
  if (feeMinor > MAX_MONEY_MINOR) throw new CalculationError("Fee is above the supported amount range.", "feeMinor");
  if (amountPaidMinor > MAX_MONEY_MINOR) throw new CalculationError("Amount paid is above the supported amount range.", "amountPaidMinor");

  const lineTotals = document.items.map((item) => ({ itemId: item.id, amountMinor: calculateLineAmount(item), taxable: item.taxable }));
  const taxableSubtotal = lineTotals.filter((line) => line.taxable).reduce((sum, line) => sum + BigInt(line.amountMinor), 0n);
  const nonTaxableSubtotal = lineTotals.filter((line) => !line.taxable).reduce((sum, line) => sum + BigInt(line.amountMinor), 0n);
  const subtotal = taxableSubtotal + nonTaxableSubtotal;
  const discount = roundRatioHalfUp(subtotal * BigInt(discountBasisPoints), 10_000n);
  if (discount > subtotal) throw new CalculationError("Discount cannot make the document total negative.", "discountBasisPoints");
  const taxableDiscount = subtotal === 0n ? 0n : roundRatioHalfUp(discount * taxableSubtotal, subtotal);
  const discountedTaxableSubtotal = taxableSubtotal - taxableDiscount;
  const tax = roundRatioHalfUp(discountedTaxableSubtotal * BigInt(taxBasisPoints), 10_000n);
  const total = subtotal - discount + tax + BigInt(feeMinor);
  if (BigInt(amountPaidMinor) > total) throw new CalculationError("Amount paid cannot be greater than the total.", "amountPaidMinor");
  const balance = document.type === "invoice" ? total - BigInt(amountPaidMinor) : total;

  return {
    lineTotals,
    subtotalMinor: toBoundedMinor(subtotal, "Subtotal"),
    taxableSubtotalMinor: toBoundedMinor(taxableSubtotal, "Taxable subtotal"),
    nonTaxableSubtotalMinor: toBoundedMinor(nonTaxableSubtotal, "Non-taxable subtotal"),
    discountMinor: toBoundedMinor(discount, "Discount"),
    taxableDiscountMinor: toBoundedMinor(taxableDiscount, "Taxable discount allocation"),
    discountedTaxableSubtotalMinor: toBoundedMinor(discountedTaxableSubtotal, "Discounted taxable subtotal"),
    taxMinor: toBoundedMinor(tax, "Tax"),
    feeMinor: toBoundedMinor(BigInt(feeMinor), "Fee"),
    totalMinor: toBoundedMinor(total, "Total"),
    amountPaidMinor: toBoundedMinor(BigInt(amountPaidMinor), "Amount paid"),
    balanceDueMinor: toBoundedMinor(balance, "Balance due"),
  };
}
