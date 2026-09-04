import { describe, expect, it } from "vitest";
import { createBlankDocument } from "../domain/document";
import { createSampleDocument } from "../domain/fixtures";
import { MAX_MONEY_MINOR } from "../domain/limits";
import { exportReadyDocumentSchema, swiftDocumentSchema, validateDocumentForExport } from "./document-schema";

describe("document schema", () => {
  it("accepts a structurally valid draft with incomplete export fields", () => {
    const draft = createBlankDocument({ now: new Date("2026-09-03T09:00:00.000Z") });
    expect(swiftDocumentSchema.safeParse(draft).success).toBe(true);
    expect(exportReadyDocumentSchema.safeParse(draft).success).toBe(false);
  });

  it("accepts the sample as export ready", () => {
    expect(validateDocumentForExport(createSampleDocument()).success).toBe(true);
  });

  it("requires number, customer, item description, and at least one item for export", () => {
    const invalid = { ...createSampleDocument(), number: " ", customer: { displayName: "" }, items: [] };
    const result = exportReadyDocumentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining(["number", "customer.displayName", "items"]));
  });

  it("rejects overpayment before export", () => {
    const invalid = createSampleDocument();
    invalid.adjustment.amountPaidMinor = MAX_MONEY_MINOR;
    const result = exportReadyDocumentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.join(".") === "adjustment.amountPaidMinor")).toBe(true);
  });

  it("rejects unsupported currency, schema versions, unknown fields, and unsafe bounds", () => {
    const sample = createSampleDocument();
    expect(swiftDocumentSchema.safeParse({ ...sample, currency: "BTC" }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, schemaVersion: 2 }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, unexpected: true }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, items: [{ ...sample.items[0], unitPriceMinor: MAX_MONEY_MINOR + 1 }] }).success).toBe(false);
  });

  it("enforces quote and invoice date semantics", () => {
    const sample = createSampleDocument();
    expect(swiftDocumentSchema.safeParse({ ...sample, type: "quote", dueDate: sample.dueDate, expiryDate: "2026-09-17" }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, dueDate: undefined }).success).toBe(false);
  });

  it("rejects duplicate line item identifiers", () => {
    const sample = createSampleDocument();
    const duplicate = { ...sample.items[0] };
    expect(swiftDocumentSchema.safeParse({ ...sample, items: [sample.items[0], duplicate] }).success).toBe(false);
  });

  it("allows only safe complete website URLs", () => {
    const sample = createSampleDocument();
    expect(swiftDocumentSchema.safeParse({ ...sample, sender: { ...sample.sender, website: "javascript:alert(1)" } }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, sender: { ...sample.sender, website: "https://swiftquote.example" } }).success).toBe(true);
  });

  it("checks logo type, content signature, and declared size", () => {
    const sample = createSampleDocument();
    const logo = { mimeType: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgo=", byteSize: 8, width: 100, height: 50 } as const;
    expect(swiftDocumentSchema.safeParse({ ...sample, logo }).success).toBe(true);
    expect(swiftDocumentSchema.safeParse({ ...sample, logo: { ...logo, mimeType: "image/jpeg" } }).success).toBe(false);
    expect(swiftDocumentSchema.safeParse({ ...sample, logo: { ...logo, byteSize: 7 } }).success).toBe(false);
  });
});
