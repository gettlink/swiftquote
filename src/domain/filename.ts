import type { DocumentType } from "./document";

export function sanitizeFilenamePart(value: string, fallback = "document"): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/[^a-zA-Z0-9._ -]/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .replace(/[\s._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80)
    .replace(/-+$/g, "");
  return sanitized || fallback;
}

export function createDocumentFilename(type: DocumentType, number: string, customerName: string, extension: "pdf" | "json"): string {
  return [sanitizeFilenamePart(type), sanitizeFilenamePart(number, "unnumbered"), sanitizeFilenamePart(customerName, "customer")].join("-") + `.${extension}`;
}
