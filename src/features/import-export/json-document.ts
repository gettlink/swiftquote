import type { SwiftDocument } from "../../domain/document";
import { createDocumentFilename } from "../../domain/filename";
import { createDocumentExport, parseDocumentImport } from "../../schemas/import-schema";
import { parseSwiftDocument } from "../../schemas/document-schema";

export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;

export class DocumentImportError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DocumentImportError";
    this.cause = cause;
  }
}

export function serializeDocumentExport(document: SwiftDocument, now = new Date()): string {
  return JSON.stringify(createDocumentExport(parseSwiftDocument(document), now), null, 2);
}

export function getDocumentExportFilename(document: SwiftDocument): string {
  return createDocumentFilename(document.type, document.number, document.customer.displayName, "json");
}

async function readBlobText(file: Blob): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsText(file);
  });
}

export async function readDocumentImportFile(file: Blob): Promise<SwiftDocument> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new DocumentImportError("This file is too large. Select a SwiftQuote JSON file smaller than 8 MB.");
  }
  let text: string;
  try {
    text = await readBlobText(file);
  } catch (error) {
    throw new DocumentImportError("SwiftQuote could not read this file. Select it again and retry.", error);
  }
  try {
    return parseDocumentImport(text).document;
  } catch (error) {
    throw new DocumentImportError(
      error instanceof Error ? error.message : "This file is not a supported SwiftQuote document.",
      error,
    );
  }
}

export interface DownloadEnvironment {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): Pick<HTMLAnchorElement, "href" | "download" | "click">;
}

function browserDownloadEnvironment(): DownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
  };
}

export function downloadDocumentJson(
  document: SwiftDocument,
  environment: DownloadEnvironment = browserDownloadEnvironment(),
): void {
  const blob = new Blob([serializeDocumentExport(document)], { type: "application/json;charset=utf-8" });
  const url = environment.createObjectURL(blob);
  try {
    const anchor = environment.createAnchor();
    anchor.href = url;
    anchor.download = getDocumentExportFilename(document);
    anchor.click();
  } finally {
    environment.revokeObjectURL(url);
  }
}
