import { describe, expect, it } from "vitest";
import { fromDomainDocument, sampleDocument, toDomainDocument, validate } from "./model";

describe("editor domain adapter", () => {
  it("preserves customer references, logo metadata, and timestamps", () => {
    const source = sampleDocument();
    source.customer.reference = "CLIENT-42";
    source.logo = {
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      byteSize: 8,
      width: 120,
      height: 60,
    };
    const restored = fromDomainDocument(toDomainDocument(source));
    expect(restored.customer.reference).toBe("CLIENT-42");
    expect(restored.logo).toEqual(source.logo);
    expect(restored.createdAt).toBe(source.createdAt);
  });

  it("blocks invalid adjustment input before export", () => {
    const source = sampleDocument();
    source.discountRate = "101";
    source.feeAmount = "not an amount";
    expect(validate(source)).toMatchObject({
      discountRate: "Enter a discount from 0 to 100 percent.",
      feeAmount: "Enter a valid additional fee.",
    });
  });
});
