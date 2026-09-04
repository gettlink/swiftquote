export type ParseRateResult =
  | { readonly ok: true; readonly basisPoints: number; readonly normalized: string }
  | { readonly ok: false; readonly error: string };

export function parsePercentageInput(input: string, maximumBasisPoints: number): ParseRateResult {
  const value = input.trim().replace(/%$/, "").trim();
  if (!value) return { ok: false, error: "Enter a percentage." };
  if (value.startsWith("-")) return { ok: false, error: "Percentage cannot be negative." };
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return { ok: false, error: "Enter a percentage with no more than 2 decimal places." };
  const [whole, fraction = ""] = value.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(basisPoints) || basisPoints > maximumBasisPoints) return { ok: false, error: "Percentage is above the supported limit." };
  const normalizedFraction = fraction.padEnd(2, "0").replace(/0+$/, "");
  return { ok: true, basisPoints, normalized: normalizedFraction ? `${Number(whole)}.${normalizedFraction}` : String(Number(whole)) };
}

export function formatBasisPoints(basisPoints: number): string {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) throw new RangeError("Basis points must be a non-negative safe integer.");
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}%`;
}
