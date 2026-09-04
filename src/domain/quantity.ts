import { MAX_QUANTITY, MAX_QUANTITY_DECIMALS } from "./limits";

export interface ParsedQuantity {
  readonly scaled: bigint;
  readonly scale: bigint;
  readonly value: number;
  readonly normalized: string;
}

export type ParseQuantityResult =
  | { readonly ok: true; readonly quantity: ParsedQuantity }
  | { readonly ok: false; readonly error: string };

export function parseQuantity(input: string): ParseQuantityResult {
  const value = input.trim();
  if (value === "") return { ok: false, error: "Enter a quantity." };
  if (value.startsWith("-")) return { ok: false, error: "Quantity must be greater than zero." };
  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) return { ok: false, error: `Enter a positive quantity with no more than ${MAX_QUANTITY_DECIMALS} decimal places.` };
  const whole = match[1];
  const fraction = match[2] ?? "";
  const scale = 10n ** BigInt(fraction.length);
  const scaled = BigInt(whole) * scale + BigInt(fraction || "0");
  if (scaled === 0n) return { ok: false, error: "Quantity must be greater than zero." };
  if (scaled > BigInt(MAX_QUANTITY) * scale) return { ok: false, error: "Quantity is above the supported limit." };
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  const normalizedFraction = fraction.replace(/0+$/, "");
  return {
    ok: true,
    quantity: {
      scaled,
      scale,
      value: Number(scaled) / Number(scale),
      normalized: normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole,
    },
  };
}
