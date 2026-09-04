import type { DocumentCodec, VersionedDocument } from "./types";

export type Migration = (value: Readonly<Record<string, unknown>>) => Record<string, unknown>;
export type CurrentParser<T> = (value: unknown) => T;

export class MigrationError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MigrationError";
    this.cause = cause;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MigrationError("Stored document is not an object.");
  }
  return value as Record<string, unknown>;
}

function readVersion(value: Readonly<Record<string, unknown>>): number {
  const version = value.schemaVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new MigrationError("Stored document has an invalid schema version.");
  }
  return version as number;
}

export function createDocumentCodec<TDocument extends VersionedDocument>(options: {
  currentVersion: number;
  migrations?: Readonly<Record<number, Migration>>;
  parseCurrent: CurrentParser<TDocument>;
}): DocumentCodec<TDocument> {
  const migrations = options.migrations ?? {};

  return {
    currentVersion: options.currentVersion,
    migrateAndParse(value: unknown): TDocument {
      const original = asRecord(value);
      let candidate = structuredClone(original);
      let version = readVersion(candidate);

      if (version > options.currentVersion) {
        throw new MigrationError(
          `Document schema version ${version} is newer than supported version ${options.currentVersion}.`,
        );
      }

      try {
        while (version < options.currentVersion) {
          const migrate = migrations[version];
          if (!migrate) {
            throw new MigrationError(`No migration exists for schema version ${version}.`);
          }
          candidate = migrate(Object.freeze(structuredClone(candidate)));
          const nextVersion = readVersion(candidate);
          if (nextVersion !== version + 1) {
            throw new MigrationError(
              `Migration ${version} must produce schema version ${version + 1}.`,
            );
          }
          version = nextVersion;
        }
        return options.parseCurrent(candidate);
      } catch (error) {
        if (error instanceof MigrationError) throw error;
        throw new MigrationError("Document migration or validation failed.", error);
      }
    },
  };
}

