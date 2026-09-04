import { describe, expect, it } from "vitest";
import { createDocumentFilename, sanitizeFilenamePart } from "./filename";
import { nextDocumentNumber } from "./numbering";

describe("document numbering and filenames", () => {
  it("starts at SQ-1001 and advances matching numbers", () => {
    expect(nextDocumentNumber([])).toBe("SQ-1001");
    expect(nextDocumentNumber(["SQ-1001", "other-9999", "sq-1042"])).toBe("SQ-1043");
  });

  it("sanitizes unsafe filename content", () => {
    expect(sanitizeFilenamePart("  Hárbor / Field: Co.  ")).toBe("harbor-field-co");
    expect(createDocumentFilename("invoice", "SQ/1001", "Harbor & Field", "pdf")).toBe("invoice-sq-1001-harbor-field.pdf");
    expect(sanitizeFilenamePart("<>:*?", "fallback")).toBe("fallback");
  });
});
