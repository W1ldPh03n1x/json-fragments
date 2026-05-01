
export const section = "json-fragments";

export type SettingsSchema = {
  autoHighlightVisibleRanges: boolean;
  includePrimitiveArrays: boolean;
  autoHighlightDebounceMs: number;
  viewportLookaheadRatio: number;
};

export const settingsDefaults: SettingsSchema = {
  autoHighlightVisibleRanges: false,
  includePrimitiveArrays: false,
  autoHighlightDebounceMs: 100,
  viewportLookaheadRatio: 0,
};

export type SettingsKey = keyof SettingsSchema;

export const settingKeys = createSettingKeys(section, settingsDefaults);

export type RuntimeSettings = SettingsSchema;

function createSettingKeys<Schema extends Record<string, unknown>>(
  section: string,
  defaults: Schema,
): { readonly [Key in keyof Schema]: `${typeof section}.${Extract<Key, string>}` } {
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, `${section}.${key}`]),
  ) as { readonly [Key in keyof Schema]: `${typeof section}.${Extract<Key, string>}` };
}
