import { getCurrencyMetadata, type CurrencyCode } from "./currency";
import { MAX_MONEY_MINOR } from "./limits";

export interface Money {
  readonly currency: CurrencyCode;
  readonly minor: number;
}

export type ParseMoneyResult =
  | { readonly ok: true; readonly minor: number; readonly normalized: string }
  | { readonly ok: false; readonly error: string };

export function parseMoneyInput(input: string, currency: CurrencyCode): ParseMoneyResult {
  const value = input.trim();
  const precision = getCurrencyMetadata(currency).minorUnit;
  if (value === "") return { ok: false, error: "Enter an amount." };
  if (value.startsWith("-")) return { ok: false, error: "Amount cannot be negative." };
  const pattern = precision === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${precision}})?$`);
  if (!pattern.test(value)) {
    return {
      ok: false,
      error: precision === 0 ? "Enter a whole amount for this currency." : `Enter an amount with no more than ${precision} decimal places.`,
    };
  }
  const [whole, fraction = ""] = value.split(".");
  const minorBigInt = BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, "0") || "0");
  if (minorBigInt > BigInt(MAX_MONEY_MINOR)) return { ok: false, error: "Amount is above the supported limit." };
  const minor = Number(minorBigInt);
  const normalized = precision === 0
    ? whole.replace(/^0+(?=\d)/, "")
    : `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(precision, "0")}`;
  return { ok: true, minor, normalized };
}

export function formatMoney(minor: number, currency: CurrencyCode, locale?: string): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError("Money must use a safe integer minor-unit value.");
  const metadata = getCurrencyMetadata(currency);
  return new Intl.NumberFormat(locale ?? metadata.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: metadata.minorUnit,
    maximumFractionDigits: metadata.minorUnit,
  }).format(minor / 10 ** metadata.minorUnit);
}

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_MONEY_MINOR) {
    throw new RangeError("Money is outside the supported range.");
  }
  return { minor, currency };
}
