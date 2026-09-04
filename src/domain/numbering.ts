import type { DocumentType } from "./document";

export const DEFAULT_DOCUMENT_NUMBER_START = 1001;

export function nextDocumentNumber(existingNumbers: readonly string[], prefix = "SQ"): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`, "i");
  const highest = existingNumbers.reduce((maximum, value) => {
    const match = pattern.exec(value.trim());
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, DEFAULT_DOCUMENT_NUMBER_START - 1);
  return `${prefix}-${Math.max(DEFAULT_DOCUMENT_NUMBER_START, highest + 1)}`;
}

export function documentTypeLabel(type: DocumentType): "Quote" | "Invoice" {
  return type === "quote" ? "Quote" : "Invoice";
}
