import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../domain/fixtures";
import { createDocumentExport, parseDocumentImport } from "./import-schema";

describe("document JSON import", () => {
  it("round trips a versioned document envelope", () => {
    const envelope = createDocumentExport(createSampleDocument(), new Date("2026-09-03T12:00:00.000Z"));
    expect(parseDocumentImport(JSON.stringify(envelope))).toEqual(envelope);
  });

  it("fails closed on malformed JSON", () => {
    expect(() => parseDocumentImport("{broken")).toThrow("This file does not contain valid JSON.");
  });

  it("fails closed on unsupported versions and partial records", () => {
    const envelope = createDocumentExport(createSampleDocument());
    expect(() => parseDocumentImport({ ...envelope, exportVersion: 2 })).toThrow(/not a supported SwiftQuote document/);
    expect(() => parseDocumentImport({ ...envelope, document: { id: "partial" } })).toThrow(/not a supported SwiftQuote document/);
  });

  it("does not trust imported derived totals", () => {
    const envelope = createDocumentExport(createSampleDocument());
    expect(() => parseDocumentImport({ ...envelope, document: { ...envelope.document, totalMinor: 1 } })).toThrow(/not a supported SwiftQuote document/);
  });
});
