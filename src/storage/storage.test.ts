import { describe, expect, it, vi } from "vitest";
import type { SwiftDocument } from "../domain/document";
import { createBlankDocument } from "../domain/document";
import { parseSwiftDocument } from "../schemas/document-schema";
import { SerializedAutosave } from "./autosave";
import { deleteWithUndo } from "./delete-undo";
import { MemorySwiftQuoteRepository } from "./memory-repository";
import { createDocumentCodec, MigrationError } from "./migrations";
import { summarizeSwiftDocument, swiftDocumentCodec } from "./swiftquote-repository";
import { DEFAULT_SETTINGS } from "./types";

function validDocument(overrides: Partial<SwiftDocument> = {}): SwiftDocument {
  return {
    ...createBlankDocument({ now: new Date("2026-09-03T08:00:00.000Z"), number: "SQ-1001" }),
    customer: { displayName: "Acme Workshop" },
    items: [{ id: "item_1", description: "Design", quantity: "2", unitPriceMinor: 25_000, taxable: true }],
    ...overrides,
  };
}

describe("versioned migrations", () => {
  it("runs each pure migration and validates the final result", () => {
    const codec = createDocumentCodec<SwiftDocument>({
      currentVersion: 2,
      migrations: {
        1: (document) => ({ ...document, schemaVersion: 2, marker: "migrated" }),
      },
      parseCurrent: (input) => input as SwiftDocument,
    });
    const original = { ...validDocument(), schemaVersion: 1 };
    const migrated = codec.migrateAndParse(original);
    expect(migrated).toMatchObject({ schemaVersion: 2, marker: "migrated" });
    expect(original.schemaVersion).toBe(1);
    expect(original).not.toHaveProperty("marker");
  });

  it("rejects missing migration steps without changing the source", () => {
    const original = { id: "old", schemaVersion: 1, content: "preserve me" };
    const codec = createDocumentCodec({ currentVersion: 2, parseCurrent: (value) => value as never });
    expect(() => codec.migrateAndParse(original)).toThrow(MigrationError);
    expect(original).toEqual({ id: "old", schemaVersion: 1, content: "preserve me" });
  });
});

describe("serialized autosave", () => {
  it("debounces edits and never overlaps writes", async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    let releaseFirst!: () => void;
    const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let active = 0;
    let maximumActive = 0;
    const autosave = new SerializedAutosave<string>({
      debounceMs: 100,
      write: async (value) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        writes.push(value);
        if (writes.length === 1) await firstWrite;
        active -= 1;
      },
    });

    autosave.schedule("one");
    await vi.advanceTimersByTimeAsync(100);
    autosave.schedule("two");
    await vi.advanceTimersByTimeAsync(100);
    releaseFirst();
    await autosave.flush();

    expect(writes).toEqual(["one", "two"]);
    expect(maximumActive).toBe(1);
    vi.useRealTimers();
  });

  it("reports a failure and can save a later edit", async () => {
    const states: string[] = [];
    const write = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const autosave = new SerializedAutosave<string>({ write, onStateChange: (state) => states.push(state.status) });
    autosave.schedule("kept in memory");
    await expect(autosave.flush()).rejects.toThrow("quota");
    autosave.schedule("retry");
    await expect(autosave.flush()).resolves.toBeUndefined();
    expect(states).toContain("error");
    expect(states.at(-1)).toBe("saved");
  });
});

describe("repository recovery and deletion", () => {
  it("recovers a draft, lists stable summaries, and clears all local data", async () => {
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument, () => new Date("2026-09-03T09:00:00.000Z"));
    const document = validDocument();
    await repository.saveActiveDraft(document);
    await repository.save(document);
    expect(await repository.getActiveDraft()).toEqual(document);
    expect(await repository.list()).toEqual([
      expect.objectContaining({ number: "SQ-1001", customer: "Acme Workshop", totalMinor: 50_000, lastEditedAt: "2026-09-03T09:00:00.000Z" }),
    ]);
    expect(await repository.getSettings()).toEqual(DEFAULT_SETTINGS);
    await repository.clearAll();
    expect(await repository.list()).toEqual([]);
    expect(await repository.getActiveDraft()).toBeNull();
  });

  it("supports safe undo and refuses to overwrite a collision", async () => {
    let now = 100;
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument);
    const document = validDocument();
    await repository.save(document);
    const deletion = await deleteWithUndo({ repository, id: document.id, undoMs: 1000, now: () => now });
    expect(await repository.get(document.id)).toBeNull();
    expect(await deletion?.undo()).toBe("restored");

    const secondDeletion = await deleteWithUndo({ repository, id: document.id, undoMs: 1000, now: () => now });
    await repository.save(document);
    expect(await secondDeletion?.undo()).toBe("collision");
    now = 1200;
    await repository.remove(document.id);
    expect(await secondDeletion?.undo()).toBe("expired");
  });

  it("validates persisted documents on every write", async () => {
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument);
    await expect(repository.save({ ...validDocument(), currency: "XYZ" } as unknown as SwiftDocument)).rejects.toThrow();
    expect(await repository.list()).toEqual([]);
    expect(() => parseSwiftDocument(validDocument())).not.toThrow();
  });

  it("validates settings before changing the saved value", async () => {
    const repository = new MemorySwiftQuoteRepository(swiftDocumentCodec, summarizeSwiftDocument);
    const original = await repository.getSettings();
    await expect(
      repository.saveSettings({ ...original, defaultCurrency: "XYZ" } as never),
    ).rejects.toThrow();
    expect(await repository.getSettings()).toEqual(original);
  });
});
