import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, settingsSchema } from "./settings-schema";

describe("settings schema", () => {
  it("accepts the versioned defaults", () => expect(settingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true));
  it("rejects unsupported defaults", () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, defaultCurrency: "BTC" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, defaultPaymentTermsDays: 366 }).success).toBe(false);
  });
});
