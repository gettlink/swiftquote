import { describe, expect, it, vi } from "vitest";
import { createBlankDocument, type SwiftDocument } from "../../domain/document";
import { MemorySwiftQuoteRepository } from "../../storage/memory-repository";
import { summarizeSwiftDocument, swiftDocumentCodec } from "../../storage/swiftquote-repository";
import { commitDocumentImport, prepareDocumentImport } from "./import-document";
import {
  DocumentImportError,
  downloadDocumentJson,
  getDocumentExportFilename,
  MAX_IMPORT_FILE_BYTES,
  readDocumentImportFile,
  serializeDocumentExport,
} from "./json-document";

function validDocument(overrides: Partial<SwiftDocument> = {}): SwiftDocument {
  return {
    ...createBlankDocument({ now: new Date("2026-09-03T08:00:00.000Z"), number: "SQ/1001" }),
    customer: { displayName: "Acme & Sons" },
    items: [{ id: "item_1", description: "Design", quantity: "1", unitPriceMinor: 10_000, taxable: true }],
    ...overrides,
  };
}

describe("JSON document export", () => {
  it("creates a versioned, parseable export and a safe filename", async () => {
    const document = validDocument();
    const json = serializeDocumentExport(document, new Date("2026-09-03T10:00:00.000Z"));
    expect(JSON.parse(json)).toMatchObject({ exportVersion: 1, exportedAt: "2026-09-03T10:00:00.000Z", document: { id: document.id } });
    expect(await readDocumentImportFile(new Blob([json]))).toEqual(document);
    expect(getDocumentExportFilename(document)).toBe("invoice-sq-1001-acme-sons.json");
  });

  it("downloads and always releases the object URL", () => {
    const click = vi.fn();
    const revokeObjectURL = vi.fn();
    const anchor = { href: "", download: "", click };
    downloadDocumentJson(validDocument(), {
      createObjectURL: () => "blob:document",
      revokeObjectURL,
      createAnchor: () => anchor,
    });
    expect(click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("invoice-sq-1001-acme-sons.json");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:document");
  });
});

describe("validated atomic import", () => {
  it("rejects malformed, unsupported, and oversized files", async () => {
    await expect(readDocumentImportFile(new Blob(["not json"]))).rejects.toBeInstanceOf(DocumentImportError);
    await expect(readDocumentImportFile(new Blob([JSON.stringify({ exportVersion: 99 })]))).rejects.toThrow("not a supported SwiftQuote document");
    const oversized = new Blob([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)]);
    await expect(readDocumentImportFile(oversized)).rejects.toThrow("too large");
  });

  it("never mutates the repository before validation succeeds", async () => {
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument);
    const original = validDocument();
    await repository.save(original);
    const invalid = JSON.stringify({
      exportVersion: 1,
      exportedAt: "2026-09-03T10:00:00.000Z",
      document: { ...original, customer: { displayName: 42 } },
    });
    await expect(readDocumentImportFile(new Blob([invalid]))).rejects.toThrow();
    expect(await repository.get(original.id)).toEqual(original);
  });

  it("detects collisions and requires an explicit replace or copy decision", async () => {
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument);
    const original = validDocument();
    const imported = { ...original, number: "SQ-2002" };
    await repository.save(original);
    expect(await prepareDocumentImport(repository, imported)).toMatchObject({ status: "collision", existing: { number: "SQ/1001" } });
    expect(await commitDocumentImport({ repository, document: imported })).toMatchObject({ status: "collision" });
    expect((await repository.get(original.id))?.number).toBe("SQ/1001");
    expect(await commitDocumentImport({ repository, document: imported, collision: "cancel" })).toEqual({ status: "cancelled" });

    const copied = await commitDocumentImport({ repository, document: imported, collision: "copy", createDocumentId: () => "doc_copy", now: () => new Date("2026-09-03T11:00:00.000Z") });
    expect(copied).toMatchObject({ status: "imported", document: { id: "doc_copy", number: "SQ-2002" } });
    expect(await repository.get(original.id)).toEqual(original);
    expect(await repository.get("doc_copy")).not.toBeNull();
  });
});
