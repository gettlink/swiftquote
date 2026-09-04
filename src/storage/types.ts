import type { Settings } from "../schemas/settings-schema";

export const STORAGE_SCHEMA_VERSION = 1 as const;

export const INDEXED_DB_RATIONALE = {
  representativeLogoBytes: 1_048_576,
  base64ExpansionRatio: 4 / 3,
  estimatedEncodedLogoBytes: 1_398_104,
  conservativeLocalStorageBudgetBytes: 5_000_000,
  maximumLogosWithinBudget: 3,
  decision: "IndexedDB stores blobs and larger structured records without base64 expansion or the small synchronous localStorage quota.",
} as const;

export type DocumentKind = "quote" | "invoice";

export interface VersionedDocument {
  id: string;
  schemaVersion: number;
}

export interface DocumentSummary {
  id: string;
  documentType: DocumentKind;
  number: string;
  customer: string;
  totalMinor: number;
  currency: string;
  issueDate: string;
  lastEditedAt: string;
}

export type AppSettings = Settings;

export const DEFAULT_SETTINGS: Readonly<AppSettings> = Object.freeze({
  schemaVersion: STORAGE_SCHEMA_VERSION,
  defaultCurrency: "USD",
  defaultPageSize: "a4",
  defaultPaymentTermsDays: 14,
});

export interface DocumentCodec<TDocument extends VersionedDocument> {
  readonly currentVersion: number;
  migrateAndParse(value: unknown): TDocument;
}

export type DocumentSummaryProjector<TDocument> = (
  document: TDocument,
  lastEditedAt: string,
) => DocumentSummary;

export interface DocumentRepository<TDocument extends VersionedDocument> {
  list(): Promise<DocumentSummary[]>;
  get(id: string): Promise<TDocument | null>;
  save(document: TDocument): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SwiftQuoteRepository<TDocument extends VersionedDocument>
  extends DocumentRepository<TDocument> {
  getActiveDraft(): Promise<TDocument | null>;
  saveActiveDraft(document: TDocument): Promise<void>;
  clearActiveDraft(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
  clearAll(): Promise<void>;
}

export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}
