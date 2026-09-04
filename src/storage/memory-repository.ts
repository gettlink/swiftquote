import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DocumentCodec,
  type DocumentSummary,
  type DocumentSummaryProjector,
  type SwiftQuoteRepository,
  type VersionedDocument,
} from "./types";
import { settingsSchema } from "../schemas/settings-schema";

export class MemorySwiftQuoteRepository<TDocument extends VersionedDocument>
  implements SwiftQuoteRepository<TDocument>
{
  private readonly documents = new Map<string, TDocument>();
  private readonly summaries = new Map<string, DocumentSummary>();
  private activeDraft: TDocument | null = null;
  private settings: AppSettings = structuredClone(DEFAULT_SETTINGS);

  constructor(
    private readonly codec: DocumentCodec<TDocument>,
    private readonly summarize: DocumentSummaryProjector<TDocument>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<DocumentSummary[]> {
    return [...this.summaries.values()]
      .map((summary) => structuredClone(summary))
      .sort((left, right) => right.lastEditedAt.localeCompare(left.lastEditedAt));
  }

  async get(id: string): Promise<TDocument | null> {
    const value = this.documents.get(id);
    return value ? structuredClone(value) : null;
  }

  async save(document: TDocument): Promise<void> {
    const validated = this.codec.migrateAndParse(document);
    this.documents.set(validated.id, structuredClone(validated));
    this.summaries.set(validated.id, this.summarize(validated, this.now().toISOString()));
  }

  async remove(id: string): Promise<void> {
    this.documents.delete(id);
    this.summaries.delete(id);
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.summaries.clear();
  }

  async getActiveDraft(): Promise<TDocument | null> {
    return this.activeDraft ? structuredClone(this.activeDraft) : null;
  }

  async saveActiveDraft(document: TDocument): Promise<void> {
    this.activeDraft = structuredClone(this.codec.migrateAndParse(document));
  }

  async clearActiveDraft(): Promise<void> {
    this.activeDraft = null;
  }

  async getSettings(): Promise<AppSettings> {
    return structuredClone(this.settings);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = structuredClone(settingsSchema.parse(settings));
  }

  async clearAll(): Promise<void> {
    this.documents.clear();
    this.summaries.clear();
    this.activeDraft = null;
    this.settings = structuredClone(DEFAULT_SETTINGS);
  }
}
