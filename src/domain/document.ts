import type { CurrencyCode } from "./currency";

export const DOCUMENT_SCHEMA_VERSION = 1 as const;
export type DocumentSchemaVersion = typeof DOCUMENT_SCHEMA_VERSION;
export type DocumentType = "quote" | "invoice";
export type PageSize = "a4" | "letter";
export type TemplateId = "modern" | "classic";

export interface Party {
  displayName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  website?: string;
  reference?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  unitLabel?: string;
  taxable: boolean;
}

export interface Adjustment {
  discountBasisPoints: number;
  taxBasisPoints: number;
  feeLabel?: string;
  feeMinor: number;
  amountPaidMinor: number;
}

export interface StoredLogo {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataUrl: string;
  byteSize: number;
  width: number;
  height: number;
}

export interface SwiftDocument {
  schemaVersion: DocumentSchemaVersion;
  id: string;
  type: DocumentType;
  number: string;
  currency: CurrencyCode;
  pageSize: PageSize;
  templateId: TemplateId;
  issueDate: string;
  dueDate?: string;
  expiryDate?: string;
  reference?: string;
  sender: Party;
  customer: Party;
  items: LineItem[];
  adjustment: Adjustment;
  clientNote?: string;
  paymentInstructions?: string;
  terms?: string;
  logo?: StoredLogo;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentExportEnvelope {
  exportVersion: 1;
  exportedAt: string;
  document: SwiftDocument;
}

export function createId(prefix = "doc"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}_${uuid}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export interface CreateDocumentOptions {
  type?: DocumentType;
  currency?: CurrencyCode;
  pageSize?: PageSize;
  templateId?: TemplateId;
  number?: string;
  now?: Date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return isoDate(result);
}

export function createBlankDocument(options: CreateDocumentOptions = {}): SwiftDocument {
  const now = options.now ?? new Date();
  const type = options.type ?? "invoice";
  const timestamp = now.toISOString();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: createId(),
    type,
    number: options.number ?? "",
    currency: options.currency ?? "USD",
    pageSize: options.pageSize ?? "a4",
    templateId: options.templateId ?? "modern",
    issueDate: isoDate(now),
    ...(type === "invoice" ? { dueDate: addDays(now, 14) } : { expiryDate: addDays(now, 14) }),
    sender: { displayName: "" },
    customer: { displayName: "" },
    items: [{ id: createId("item"), description: "", quantity: "1", unitPriceMinor: 0, taxable: true }],
    adjustment: { discountBasisPoints: 0, taxBasisPoints: 0, feeMinor: 0, amountPaidMinor: 0 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function convertQuoteToInvoice(quote: SwiftDocument, number: string, now = new Date()): SwiftDocument {
  if (quote.type !== "quote") throw new Error("Only a quote can be converted to an invoice.");
  const timestamp = now.toISOString();
  const { expiryDate: _expiryDate, ...shared } = quote;
  return {
    ...shared,
    id: createId(),
    type: "invoice",
    number,
    issueDate: isoDate(now),
    dueDate: addDays(now, 14),
    adjustment: { ...quote.adjustment, amountPaidMinor: 0 },
    items: quote.items.map((item) => ({ ...item, id: createId("item") })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
