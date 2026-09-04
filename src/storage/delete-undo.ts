import type { DocumentRepository, VersionedDocument } from "./types";

export interface DeleteUndoToken<TDocument> {
  readonly document: TDocument;
  readonly expiresAt: number;
  undo(): Promise<"restored" | "expired" | "collision">;
  commit(): void;
}

export async function deleteWithUndo<TDocument extends VersionedDocument>(options: {
  repository: DocumentRepository<TDocument>;
  id: string;
  undoMs?: number;
  now?: () => number;
}): Promise<DeleteUndoToken<TDocument> | null> {
  const document = await options.repository.get(options.id);
  if (!document) return null;
  await options.repository.remove(options.id);
  const now = options.now ?? Date.now;
  const expiresAt = now() + (options.undoMs ?? 8_000);
  let committed = false;

  return {
    document: structuredClone(document),
    expiresAt,
    async undo() {
      if (committed || now() > expiresAt) return "expired";
      if (await options.repository.get(document.id)) return "collision";
      await options.repository.save(document);
      committed = true;
      return "restored";
    },
    commit() {
      committed = true;
    },
  };
}

