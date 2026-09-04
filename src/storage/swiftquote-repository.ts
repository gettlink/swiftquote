import { calculateDocumentTotals } from "../domain/calculations";
import { DOCUMENT_SCHEMA_VERSION, type SwiftDocument } from "../domain/document";
import { parseSwiftDocument } from "../schemas/document-schema";
import { createDocumentCodec } from "./migrations";
import { IndexedDbSwiftQuoteRepository, type IndexedDbRepositoryOptions } from "./indexed-db-repository";
import type { DocumentSummary } from "./types";

export const swiftDocumentCodec = createDocumentCodec<SwiftDocument>({
  currentVersion: DOCUMENT_SCHEMA_VERSION,
  parseCurrent: parseSwiftDocument,
});

export function summarizeSwiftDocument(document: SwiftDocument, lastEditedAt: string): DocumentSummary {
  return {
    id: document.id,
    documentType: document.type,
    number: document.number,
    customer: document.customer.displayName,
    totalMinor: calculateDocumentTotals(document).totalMinor,
    currency: document.currency,
    issueDate: document.issueDate,
    lastEditedAt,
  };
}

export function createSwiftQuoteRepository(
  options: Omit<IndexedDbRepositoryOptions<SwiftDocument>, "codec" | "summarize"> = {},
): IndexedDbSwiftQuoteRepository<SwiftDocument> {
  return new IndexedDbSwiftQuoteRepository({
    ...options,
    codec: swiftDocumentCodec,
    summarize: summarizeSwiftDocument,
  });
}

