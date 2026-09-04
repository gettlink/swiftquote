import {
  DEFAULT_SETTINGS,
  StorageError,
  type AppSettings,
  type DocumentCodec,
  type DocumentSummary,
  type DocumentSummaryProjector,
  type SwiftQuoteRepository,
  type VersionedDocument,
} from "./types";
import { settingsSchema } from "../schemas/settings-schema";

const DATABASE_VERSION = 1;
const DOCUMENTS_STORE = "documents";
const METADATA_STORE = "metadata";
const ACTIVE_DRAFT_KEY = "active-draft";
const SETTINGS_KEY = "settings";

interface StoredDocumentRecord {
  id: string;
  document: unknown;
  summary: DocumentSummary;
}

interface MetadataRecord {
  key: string;
  value: unknown;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error ?? new DOMException("Transaction aborted", "AbortError")),
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => reject(transaction.error ?? new DOMException("Transaction failed", "UnknownError")),
      { once: true },
    );
  });
}

function validateSettings(value: unknown): AppSettings {
  return structuredClone(settingsSchema.parse(value));
}

export interface IndexedDbRepositoryOptions<TDocument extends VersionedDocument> {
  codec: DocumentCodec<TDocument>;
  summarize: DocumentSummaryProjector<TDocument>;
  databaseName?: string;
  indexedDB?: IDBFactory;
  now?: () => Date;
}

export class IndexedDbSwiftQuoteRepository<TDocument extends VersionedDocument>
  implements SwiftQuoteRepository<TDocument>
{
  private readonly factory: IDBFactory;
  private readonly databaseName: string;
  private readonly codec: DocumentCodec<TDocument>;
  private readonly summarize: DocumentSummaryProjector<TDocument>;
  private readonly now: () => Date;
  private databasePromise?: Promise<IDBDatabase>;

  constructor(options: IndexedDbRepositoryOptions<TDocument>) {
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) throw new StorageError("Local storage is unavailable in this browser.");
    this.factory = factory;
    this.databaseName = options.databaseName ?? "swiftquote";
    this.codec = options.codec;
    this.summarize = options.summarize;
    this.now = options.now ?? (() => new Date());
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.databaseName, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
          database.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          database.createObjectStore(METADATA_STORE, { keyPath: "key" });
        }
      });
      request.addEventListener("success", () => {
        const database = request.result;
        database.addEventListener("versionchange", () => database.close());
        resolve(database);
      });
      request.addEventListener("error", () => reject(request.error), { once: true });
      request.addEventListener(
        "blocked",
        () => reject(new DOMException("Database upgrade is blocked", "InvalidStateError")),
        { once: true },
      );
    }).catch((error): never => {
      this.databasePromise = undefined;
      throw new StorageError("SwiftQuote could not open local storage. Your current work remains in memory.", error);
    });
    this.databasePromise = opening;
    return opening;
  }

  private async readMetadata(key: string): Promise<unknown> {
    try {
      const database = await this.open();
      const transaction = database.transaction(METADATA_STORE, "readonly");
      const record = await requestResult<MetadataRecord | undefined>(
        transaction.objectStore(METADATA_STORE).get(key),
      );
      await transactionDone(transaction);
      return record?.value;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not read local data. Your current work remains in memory.", error);
    }
  }

  private async writeMetadata(key: string, value: unknown): Promise<void> {
    try {
      const database = await this.open();
      const transaction = database.transaction(METADATA_STORE, "readwrite");
      transaction.objectStore(METADATA_STORE).put({ key, value } satisfies MetadataRecord);
      await transactionDone(transaction);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not save to this device. Your current work remains in memory.", error);
    }
  }

  async list(): Promise<DocumentSummary[]> {
    try {
      const database = await this.open();
      const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
      const records = await requestResult<StoredDocumentRecord[]>(
        transaction.objectStore(DOCUMENTS_STORE).getAll(),
      );
      await transactionDone(transaction);
      return records
        .map((record) => {
          if (
            typeof record !== "object" ||
            record === null ||
            typeof record.id !== "string" ||
            typeof record.summary?.lastEditedAt !== "string" ||
            !Number.isFinite(Date.parse(record.summary.lastEditedAt))
          ) {
            throw new Error("A saved document index is invalid.");
          }
          const document = this.codec.migrateAndParse(record.document);
          if (document.id !== record.id) throw new Error("A saved document identifier is inconsistent.");
          return this.summarize(document, record.summary.lastEditedAt);
        })
        .sort((left, right) => right.lastEditedAt.localeCompare(left.lastEditedAt));
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not list documents stored on this device.", error);
    }
  }

  async get(id: string): Promise<TDocument | null> {
    try {
      const database = await this.open();
      const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
      const record = await requestResult<StoredDocumentRecord | undefined>(
        transaction.objectStore(DOCUMENTS_STORE).get(id),
      );
      await transactionDone(transaction);
      if (!record) return null;
      const document = this.codec.migrateAndParse(record.document);
      if (document.id !== record.id || document.id !== id) {
        throw new Error("A saved document identifier is inconsistent.");
      }
      return document;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not open this saved document.", error);
    }
  }

  async save(document: TDocument): Promise<void> {
    const validated = this.codec.migrateAndParse(document);
    const editedAt = this.now().toISOString();
    const record: StoredDocumentRecord = {
      id: validated.id,
      document: structuredClone(validated),
      summary: this.summarize(validated, editedAt),
    };
    try {
      const database = await this.open();
      const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
      transaction.objectStore(DOCUMENTS_STORE).put(record);
      await transactionDone(transaction);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not save this document. Your current work remains in memory.", error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const database = await this.open();
      const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
      transaction.objectStore(DOCUMENTS_STORE).delete(id);
      await transactionDone(transaction);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not delete this document.", error);
    }
  }

  async clear(): Promise<void> {
    try {
      const database = await this.open();
      const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
      transaction.objectStore(DOCUMENTS_STORE).clear();
      await transactionDone(transaction);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError("SwiftQuote could not clear saved documents.", error);
    }
  }

  async getActiveDraft(): Promise<TDocument | null> {
    const value = await this.readMetadata(ACTIVE_DRAFT_KEY);
    return value === undefined ? null : this.codec.migrateAndParse(value);
  }

  async saveActiveDraft(document: TDocument): Promise<void> {
    const validated = this.codec.migrateAndParse(document);
    await this.writeMetadata(ACTIVE_DRAFT_KEY, structuredClone(validated));
  }

  async clearActiveDraft(): Promise<void> {
    try {
      const database = await this.open();
      const transaction = database.transaction(METADATA_STORE, "readwrite");
      transaction.objectStore(METADATA_STORE).delete(ACTIVE_DRAFT_KEY);
      await transactionDone(transaction);
    } catch (error) {
      throw new StorageError("SwiftQuote could not clear the recovered draft.", error);
    }
  }

  async getSettings(): Promise<AppSettings> {
    const value = await this.readMetadata(SETTINGS_KEY);
    return value === undefined ? structuredClone(DEFAULT_SETTINGS) : validateSettings(value);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await this.writeMetadata(SETTINGS_KEY, validateSettings(settings));
  }

  async clearAll(): Promise<void> {
    try {
      const database = await this.open();
      const transaction = database.transaction([DOCUMENTS_STORE, METADATA_STORE], "readwrite");
      transaction.objectStore(DOCUMENTS_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();
      await transactionDone(transaction);
    } catch (error) {
      throw new StorageError("SwiftQuote could not clear local data.", error);
    }
  }
}
