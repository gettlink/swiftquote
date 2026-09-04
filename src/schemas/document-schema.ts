import { z } from "zod";
import { calculateDocumentTotals } from "../domain/calculations";
import { SUPPORTED_CURRENCY_CODES } from "../domain/currency";
import { DOCUMENT_SCHEMA_VERSION, type SwiftDocument } from "../domain/document";
import {
  MAX_DISCOUNT_BASIS_POINTS,
  MAX_LINE_ITEMS,
  MAX_LOGO_BYTES,
  MAX_LOGO_DIMENSION,
  MAX_MONEY_MINOR,
  MAX_RATE_BASIS_POINTS,
  MAX_SHORT_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
} from "../domain/limits";
import { parseQuantity } from "../domain/quantity";

const shortText = z.string().max(MAX_SHORT_TEXT_LENGTH);
const longText = z.string().max(MAX_TEXT_LENGTH);
const optionalShortText = shortText.optional();
const optionalLongText = longText.optional();
const safeInteger = z.number().int().safe();
const moneyMinor = safeInteger.min(0).max(MAX_MONEY_MINOR);

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

const isoDateSchema = z.string().refine(isIsoDate, "Use a valid date in YYYY-MM-DD format.");
const timestampSchema = z.string().refine(isIsoTimestamp, "Use a valid ISO timestamp.");
const optionalEmail = shortText.refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.").optional();
const optionalWebUrl = shortText.refine((value) => {
  if (value === "") return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Enter a complete website address beginning with http:// or https://.").optional();

export const partySchema = z.object({
  displayName: shortText,
  contactName: optionalShortText,
  email: optionalEmail,
  phone: optionalShortText,
  address: optionalLongText,
  taxId: optionalShortText,
  website: optionalWebUrl,
  reference: optionalShortText,
}).strict();

const quantitySchema = z.string().max(40).superRefine((value, context) => {
  const result = parseQuantity(value);
  if (!result.ok) context.addIssue({ code: "custom", message: result.error });
});

export const lineItemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  description: longText,
  quantity: quantitySchema,
  unitPriceMinor: moneyMinor,
  unitLabel: optionalShortText,
  taxable: z.boolean(),
}).strict();

export const adjustmentSchema = z.object({
  discountBasisPoints: safeInteger.min(0).max(MAX_DISCOUNT_BASIS_POINTS),
  taxBasisPoints: safeInteger.min(0).max(MAX_RATE_BASIS_POINTS),
  feeLabel: optionalShortText,
  feeMinor: moneyMinor,
  amountPaidMinor: moneyMinor,
}).strict();

export const storedLogoSchema = z.object({
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataUrl: z.string().max(Math.ceil(MAX_LOGO_BYTES * 1.4) + 100).refine(
    (value) => /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
    "Logo data must be a supported base64 image.",
  ),
  byteSize: safeInteger.min(1).max(MAX_LOGO_BYTES),
  width: safeInteger.min(1).max(MAX_LOGO_DIMENSION),
  height: safeInteger.min(1).max(MAX_LOGO_DIMENSION),
}).strict().superRefine((logo, context) => {
  const expectedPrefix = `data:${logo.mimeType};base64,`;
  if (!logo.dataUrl.startsWith(expectedPrefix)) {
    context.addIssue({ code: "custom", path: ["dataUrl"], message: "Logo type does not match its image data." });
    return;
  }
  const encoded = logo.dataUrl.slice(expectedPrefix.length);
  const signatures: Record<typeof logo.mimeType, RegExp> = {
    "image/png": /^iVBORw0KGgo/,
    "image/jpeg": /^\/9j\//,
    "image/webp": /^UklGR[A-Za-z0-9+/]{8}V0VCUA/,
  };
  if (!signatures[logo.mimeType].test(encoded)) {
    context.addIssue({ code: "custom", path: ["dataUrl"], message: "Logo contents do not match the selected image type." });
  }
  const paddingBytes = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor(encoded.length * 3 / 4) - paddingBytes;
  if (decodedBytes !== logo.byteSize) {
    context.addIssue({ code: "custom", path: ["byteSize"], message: "Logo size does not match its image data." });
  }
});

export const swiftDocumentSchema = z.object({
  schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  id: z.string().trim().min(1).max(200),
  type: z.enum(["quote", "invoice"]),
  number: shortText,
  currency: z.enum(SUPPORTED_CURRENCY_CODES),
  pageSize: z.enum(["a4", "letter"]),
  templateId: z.enum(["modern", "classic"]),
  issueDate: isoDateSchema,
  dueDate: isoDateSchema.optional(),
  expiryDate: isoDateSchema.optional(),
  reference: optionalShortText,
  sender: partySchema,
  customer: partySchema,
  items: z.array(lineItemSchema).max(MAX_LINE_ITEMS),
  adjustment: adjustmentSchema,
  clientNote: optionalLongText,
  paymentInstructions: optionalLongText,
  terms: optionalLongText,
  logo: storedLogoSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict().superRefine((document, context) => {
  if (document.type === "quote") {
    if (!document.expiryDate) context.addIssue({ code: "custom", path: ["expiryDate"], message: "Quote expiry date is required." });
    if (document.dueDate !== undefined) context.addIssue({ code: "custom", path: ["dueDate"], message: "A quote cannot have an invoice due date." });
    if (document.adjustment.amountPaidMinor !== 0) context.addIssue({ code: "custom", path: ["adjustment", "amountPaidMinor"], message: "A quote cannot record an amount paid." });
  } else {
    if (!document.dueDate) context.addIssue({ code: "custom", path: ["dueDate"], message: "Invoice due date is required." });
    if (document.expiryDate !== undefined) context.addIssue({ code: "custom", path: ["expiryDate"], message: "An invoice cannot have a quote expiry date." });
  }
  const relevantDate = document.type === "quote" ? document.expiryDate : document.dueDate;
  if (relevantDate && relevantDate < document.issueDate) {
    context.addIssue({ code: "custom", path: [document.type === "quote" ? "expiryDate" : "dueDate"], message: document.type === "quote" ? "Expiry date cannot be before issue date." : "Due date cannot be before issue date." });
  }
  const itemIds = new Set<string>();
  document.items.forEach((item, index) => {
    if (itemIds.has(item.id)) context.addIssue({ code: "custom", path: ["items", index, "id"], message: "Line item identifiers must be unique." });
    itemIds.add(item.id);
  });
  if (Date.parse(document.updatedAt) < Date.parse(document.createdAt)) {
    context.addIssue({ code: "custom", path: ["updatedAt"], message: "Updated time cannot be before created time." });
  }
});

export const exportReadyDocumentSchema = swiftDocumentSchema.superRefine((document, context) => {
  if (!document.number.trim()) context.addIssue({ code: "custom", path: ["number"], message: "Enter a document number before export." });
  if (!document.customer.displayName.trim()) context.addIssue({ code: "custom", path: ["customer", "displayName"], message: "Enter a customer name before export." });
  if (document.items.length === 0) context.addIssue({ code: "custom", path: ["items"], message: "Add at least one line item before export." });
  document.items.forEach((item, index) => {
    if (!item.description.trim()) context.addIssue({ code: "custom", path: ["items", index, "description"], message: "Enter a line item description." });
  });
  if (document.adjustment.feeMinor > 0 && !document.adjustment.feeLabel?.trim()) {
    context.addIssue({ code: "custom", path: ["adjustment", "feeLabel"], message: "Enter a label for the additional fee." });
  }
  try {
    calculateDocumentTotals(document);
  } catch (error) {
    const field = error instanceof Error && "field" in error && typeof error.field === "string" ? error.field : "calculation";
    context.addIssue({ code: "custom", path: field === "amountPaidMinor" ? ["adjustment", field] : [field], message: error instanceof Error ? error.message : "Document totals could not be calculated." });
  }
});

export type ExportReadyDocument = z.infer<typeof exportReadyDocumentSchema>;

export function parseSwiftDocument(input: unknown): SwiftDocument {
  return swiftDocumentSchema.parse(input) as SwiftDocument;
}

export function validateDocumentForExport(input: unknown) {
  return exportReadyDocumentSchema.safeParse(input);
}
