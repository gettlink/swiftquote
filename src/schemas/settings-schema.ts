import { z } from "zod";
import { SUPPORTED_CURRENCY_CODES } from "../domain/currency";
import { partySchema } from "./document-schema";

export const SETTINGS_SCHEMA_VERSION = 1 as const;

export const settingsSchema = z.object({
  schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
  defaultCurrency: z.enum(SUPPORTED_CURRENCY_CODES),
  defaultPageSize: z.enum(["a4", "letter"]),
  defaultPaymentTermsDays: z.number().int().min(0).max(365),
  businessProfile: partySchema.optional(),
}).strict();

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  defaultCurrency: "USD",
  defaultPageSize: "a4",
  defaultPaymentTermsDays: 14,
};
