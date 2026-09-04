import { z } from "zod";
import type { DocumentExportEnvelope } from "../domain/document";
import { swiftDocumentSchema } from "./document-schema";

export const DOCUMENT_EXPORT_VERSION = 1 as const;

export const documentExportEnvelopeSchema = z.object({
  exportVersion: z.literal(DOCUMENT_EXPORT_VERSION),
  exportedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Export timestamp is invalid."),
  document: swiftDocumentSchema,
}).strict();

export function createDocumentExport(document: DocumentExportEnvelope["document"], now = new Date()): DocumentExportEnvelope {
  return { exportVersion: DOCUMENT_EXPORT_VERSION, exportedAt: now.toISOString(), document };
}

export function parseDocumentImport(input: string | unknown): DocumentExportEnvelope {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input) as unknown;
    } catch {
      throw new Error("This file does not contain valid JSON.");
    }
  }
  const result = documentExportEnvelopeSchema.safeParse(parsed);
  if (!result.success) throw new Error(`This file is not a supported SwiftQuote document. ${result.error.issues[0]?.message ?? "Validation failed."}`);
  return result.data as DocumentExportEnvelope;
}
