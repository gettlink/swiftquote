export type DocumentKind = "quote" | "invoice";
export type TemplateKind = "modern" | "classic";
export type PageSize = "A4" | "LETTER";

export interface Party {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  taxId?: string;
  website?: string;
  reference?: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unit: string;
  taxable: boolean;
}

export interface SwiftDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  issueDate: string;
  endDate: string;
  reference: string;
  currency: string;
  sender: Party;
  customer: Party;
  items: LineItem[];
  discountRate: string;
  taxRate: string;
  feeLabel: string;
  feeAmount: string;
  amountPaid: string;
  note: string;
  paymentInstructions: string;
  terms: string;
  template: TemplateKind;
  pageSize: PageSize;
  logo?: StoredLogo;
  createdAt: string;
  updatedAt: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const later = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function sampleDocument(): SwiftDocument {
  return {
    id: uid(), kind: "quote", number: "SQ-1001", issueDate: today(), endDate: later(14), reference: "Website refresh",
    currency: "USD",
    sender: { name: "Northline Studio", contact: "Jordan Lee", email: "hello@example.com", phone: "+1 555 0142", address: "21 Market Street\nPortland, OR 97205", taxId: "", website: "https://northline.example" },
    customer: { name: "Acme Workshop", contact: "Maya Chen", email: "maya@example.com", phone: "", address: "88 Foundry Lane\nPortland, OR 97209", reference: "" },
    items: [
      { id: uid(), description: "Discovery and content planning", quantity: "4", unitPrice: "125", unit: "hours", taxable: true },
      { id: uid(), description: "Responsive website design", quantity: "1", unitPrice: "2400", unit: "project", taxable: true },
    ],
    discountRate: "0", taxRate: "0", feeLabel: "", feeAmount: "0", amountPaid: "0",
    note: "Thank you for the opportunity to work together.", paymentInstructions: "Payment details will be provided on the invoice.", terms: "This quote is valid until the expiry date shown above.",
    template: "modern", pageSize: "A4", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export const blankDocument = (): SwiftDocument => ({ ...sampleDocument(), id: uid(), number: `SQ-${Math.floor(1000 + Math.random() * 8999)}`, sender: { name: "", contact: "", email: "", phone: "", address: "", taxId: "", website: "" }, customer: { name: "", contact: "", email: "", phone: "", address: "", reference: "" }, items: [{ id: uid(), description: "", quantity: "1", unitPrice: "0", unit: "", taxable: true }], reference: "", note: "", paymentInstructions: "", terms: "" });

const n = (value: string) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const toMinor = (value: string, currency: string) => {
  const result = parseMoneyInput(value || "0", currency as CurrencyCode);
  return result.ok ? result.minor : 0;
};
export function totals(document: SwiftDocument) {
  const canonical = {
    type: document.kind,
    items: document.items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unitPriceMinor: toMinor(item.unitPrice, document.currency), unitLabel: item.unit, taxable: item.taxable })),
    adjustment: { discountBasisPoints: Math.round(n(document.discountRate) * 100), taxBasisPoints: Math.round(n(document.taxRate) * 100), feeMinor: toMinor(document.feeAmount, document.currency), amountPaidMinor: toMinor(document.amountPaid, document.currency) },
  };
  try {
    const result = calculateDocumentTotals(canonical);
    const divisor = 10 ** (document.currency === "JPY" ? 0 : 2);
    const lines = document.items.map((item, index) => ({ ...item, total: result.lineTotals[index].amountMinor / divisor }));
    return { lines, subtotal: result.subtotalMinor / divisor, discount: result.discountMinor / divisor, tax: result.taxMinor / divisor, total: result.totalMinor / divisor, balance: result.balanceDueMinor / divisor };
  } catch {
    return { lines: document.items.map((item) => ({ ...item, total: 0 })), subtotal: 0, discount: 0, tax: 0, total: 0, balance: 0 };
  }
}

export function money(value: number, currency: string) {
  const divisor = 10 ** (currency === "JPY" ? 0 : 2);
  return formatMoney(Math.round(value * divisor), currency as CurrencyCode);
}

export function validate(document: SwiftDocument) {
  const errors: Record<string, string> = {};
  if (!document.number.trim()) errors.number = "Enter a document number before downloading.";
  if (!document.customer.name.trim()) errors.customerName = "Enter a customer name before downloading.";
  document.items.forEach((item, index) => {
    if (!item.description.trim()) errors[`item-${item.id}-description`] = `Add a description to item ${index + 1}.`;
    if (!(Number(item.quantity) > 0)) errors[`item-${item.id}-quantity`] = `Enter a quantity greater than zero for item ${index + 1}.`;
    if (!(Number(item.unitPrice) >= 0)) errors[`item-${item.id}-price`] = `Enter a valid price for item ${index + 1}.`;
  });
  for (const [key, label, value] of [
    ["feeAmount", "additional fee", document.feeAmount],
    ["amountPaid", "amount paid", document.amountPaid],
  ] as const) {
    if (!parseMoneyInput(value || "0", document.currency as CurrencyCode).ok) errors[key] = `Enter a valid ${label}.`;
  }
  if (!parsePercentageInput(document.discountRate || "0", 10_000).ok) errors.discountRate = "Enter a discount from 0 to 100 percent.";
  if (!parsePercentageInput(document.taxRate || "0", MAX_RATE_BASIS_POINTS).ok) errors.taxRate = "Enter a valid non-negative tax rate.";
  const canonical = validateDocumentForExport(toDomainDocument(document));
  if (!canonical.success) {
    canonical.error.issues.forEach((issue, index) => {
      const message = issue.message.endsWith(".") ? issue.message : `${issue.message}.`;
      errors[`document-${index}`] ??= message;
    });
  }
  return errors;
}
import { calculateDocumentTotals } from "../../domain/calculations";
import { formatMoney, parseMoneyInput } from "../../domain/money";
import type { CurrencyCode } from "../../domain/currency";
import { DOCUMENT_SCHEMA_VERSION, type SwiftDocument as DomainDocument } from "../../domain/document";
import type { StoredLogo } from "../../domain/document";
import { parsePercentageInput } from "../../domain/rate";
import { MAX_RATE_BASIS_POINTS } from "../../domain/limits";
import { validateDocumentForExport } from "../../schemas/document-schema";

export function toDomainDocument(document: SwiftDocument): DomainDocument {
  const now = document.updatedAt || new Date().toISOString();
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, id: document.id, type: document.kind, number: document.number, currency: document.currency as CurrencyCode, pageSize: document.pageSize === "A4" ? "a4" : "letter", templateId: document.template, issueDate: document.issueDate,
    ...(document.kind === "quote" ? { expiryDate: document.endDate } : { dueDate: document.endDate }), reference: document.reference || undefined,
    sender: { displayName: document.sender.name, contactName: document.sender.contact || undefined, email: document.sender.email || undefined, phone: document.sender.phone || undefined, address: document.sender.address || undefined, taxId: document.sender.taxId || undefined, website: document.sender.website || undefined },
    customer: { displayName: document.customer.name, contactName: document.customer.contact || undefined, email: document.customer.email || undefined, phone: document.customer.phone || undefined, address: document.customer.address || undefined, reference: document.customer.reference || undefined },
    items: document.items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unitPriceMinor: toMinor(item.unitPrice, document.currency), unitLabel: item.unit || undefined, taxable: item.taxable })),
    adjustment: { discountBasisPoints: Math.round(n(document.discountRate) * 100), taxBasisPoints: Math.round(n(document.taxRate) * 100), feeLabel: document.feeLabel || undefined, feeMinor: toMinor(document.feeAmount, document.currency), amountPaidMinor: document.kind === "invoice" ? toMinor(document.amountPaid, document.currency) : 0 },
    clientNote: document.note || undefined, paymentInstructions: document.paymentInstructions || undefined, terms: document.terms || undefined, logo: document.logo, createdAt: document.createdAt || now, updatedAt: now };
}

export function fromDomainDocument(document: DomainDocument): SwiftDocument {
  const divisor = 10 ** (document.currency === "JPY" ? 0 : 2); const decimal = (minor: number) => String(minor / divisor);
  return { id: document.id, kind: document.type, number: document.number, issueDate: document.issueDate, endDate: document.type === "quote" ? document.expiryDate || document.issueDate : document.dueDate || document.issueDate, reference: document.reference || "", currency: document.currency,
    sender: { name: document.sender.displayName, contact: document.sender.contactName || "", email: document.sender.email || "", phone: document.sender.phone || "", address: document.sender.address || "", taxId: document.sender.taxId || "", website: document.sender.website || "" },
    customer: { name: document.customer.displayName, contact: document.customer.contactName || "", email: document.customer.email || "", phone: document.customer.phone || "", address: document.customer.address || "", reference: document.customer.reference || "" },
    items: document.items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity, unitPrice: decimal(item.unitPriceMinor), unit: item.unitLabel || "", taxable: item.taxable })),
    discountRate: String(document.adjustment.discountBasisPoints / 100), taxRate: String(document.adjustment.taxBasisPoints / 100), feeLabel: document.adjustment.feeLabel || "", feeAmount: decimal(document.adjustment.feeMinor), amountPaid: decimal(document.adjustment.amountPaidMinor), note: document.clientNote || "", paymentInstructions: document.paymentInstructions || "", terms: document.terms || "", template: document.templateId, pageSize: document.pageSize === "a4" ? "A4" : "LETTER", logo: document.logo, createdAt: document.createdAt, updatedAt: document.updatedAt };
}
