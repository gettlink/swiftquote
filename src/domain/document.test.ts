import { describe, expect, it } from "vitest";
import { convertQuoteToInvoice, createBlankDocument } from "./document";

describe("document creation", () => {
  it("creates type-specific date fields", () => {
    const now = new Date("2026-09-03T09:00:00.000Z");
    expect(createBlankDocument({ type: "quote", now })).toMatchObject({ type: "quote", issueDate: "2026-09-03", expiryDate: "2026-09-17" });
    expect(createBlankDocument({ type: "invoice", now })).toMatchObject({ type: "invoice", issueDate: "2026-09-03", dueDate: "2026-09-17" });
  });

  it("converts a quote into a separate invoice without mutating it", () => {
    const quote = createBlankDocument({ type: "quote", number: "SQ-1001", now: new Date("2026-09-03T09:00:00.000Z") });
    const invoice = convertQuoteToInvoice(quote, "SQ-1002", new Date("2026-09-04T09:00:00.000Z"));
    expect(invoice).toMatchObject({ type: "invoice", number: "SQ-1002", issueDate: "2026-09-04", dueDate: "2026-09-18" });
    expect(invoice.id).not.toBe(quote.id);
    expect(invoice.items[0].id).not.toBe(quote.items[0].id);
    expect(quote).toHaveProperty("expiryDate");
    expect(invoice).not.toHaveProperty("expiryDate");
  });
});
