export const SUPPORTED_CURRENCY_CODES = [
  "USD",
  "KES",
  "EUR",
  "GBP",
  "NGN",
  "ZAR",
  "CAD",
  "AUD",
  "INR",
  "JPY",
  "AED",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly name: string;
  readonly minorUnit: 0 | 2;
  readonly locale: string;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyMetadata>> = {
  USD: { code: "USD", name: "US dollar", minorUnit: 2, locale: "en-US" },
  KES: { code: "KES", name: "Kenyan shilling", minorUnit: 2, locale: "en-KE" },
  EUR: { code: "EUR", name: "Euro", minorUnit: 2, locale: "en-IE" },
  GBP: { code: "GBP", name: "Pound sterling", minorUnit: 2, locale: "en-GB" },
  NGN: { code: "NGN", name: "Nigerian naira", minorUnit: 2, locale: "en-NG" },
  ZAR: { code: "ZAR", name: "South African rand", minorUnit: 2, locale: "en-ZA" },
  CAD: { code: "CAD", name: "Canadian dollar", minorUnit: 2, locale: "en-CA" },
  AUD: { code: "AUD", name: "Australian dollar", minorUnit: 2, locale: "en-AU" },
  INR: { code: "INR", name: "Indian rupee", minorUnit: 2, locale: "en-IN" },
  JPY: { code: "JPY", name: "Japanese yen", minorUnit: 0, locale: "ja-JP" },
  AED: { code: "AED", name: "UAE dirham", minorUnit: 2, locale: "en-AE" },
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, value);
}

export function getCurrencyMetadata(currency: CurrencyCode): CurrencyMetadata {
  return CURRENCIES[currency];
}
