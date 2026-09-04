import { createId, type SwiftDocument } from "../../domain/document";
import type { DocumentRepository } from "../../storage/types";

export type ImportCollisionChoice = "replace" | "copy" | "cancel";

export type ImportPreparation =
  | { status: "ready"; document: SwiftDocument }
  | { status: "collision"; document: SwiftDocument; existing: SwiftDocument };

export async function prepareDocumentImport(
  repository: DocumentRepository<SwiftDocument>,
  document: SwiftDocument,
): Promise<ImportPreparation> {
  const existing = await repository.get(document.id);
  return existing
    ? { status: "collision", document: structuredClone(document), existing }
    : { status: "ready", document: structuredClone(document) };
}

export type ImportResult =
  | { status: "imported"; document: SwiftDocument }
  | { status: "cancelled" }
  | { status: "collision"; existing: SwiftDocument };

export async function commitDocumentImport(options: {
  repository: DocumentRepository<SwiftDocument>;
  document: SwiftDocument;
  collision?: ImportCollisionChoice;
  createDocumentId?: () => string;
  now?: () => Date;
}): Promise<ImportResult> {
  const existing = await options.repository.get(options.document.id);
  const choice = options.collision;
  if (existing && choice === undefined) return { status: "collision", existing };
  if (existing && choice === "cancel") return { status: "cancelled" };

  let document = structuredClone(options.document);
  if (existing && choice === "copy") {
    const now = (options.now ?? (() => new Date()))().toISOString();
    document = {
      ...document,
      id: (options.createDocumentId ?? (() => createId()))(),
      createdAt: now,
      updatedAt: now,
      items: document.items.map((item) => ({ ...item, id: createId("item") })),
    };
    if (await options.repository.get(document.id)) {
      throw new Error("SwiftQuote could not create a unique identifier for the imported copy.");
    }
  }

  await options.repository.save(document);
  return { status: "imported", document };
}

