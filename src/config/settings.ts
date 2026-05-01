
export const section = "json-fragments";

export type SettingsSchema = {
  "scanner.includePrimitiveArrays": boolean;
  "tracker.autoHighlightVisibleRanges": boolean;
  "tracker.autoHighlightDebounceMs": number;
  "tracker.viewportLookaheadRatio": number;
};

export const settingsDefaults: SettingsSchema = {
  "scanner.includePrimitiveArrays": false,
  "tracker.autoHighlightVisibleRanges": false,
  "tracker.autoHighlightDebounceMs": 100,
  "tracker.viewportLookaheadRatio": 0,
};

export type SettingsKey = keyof SettingsSchema;
export type SettingsValue<Key extends SettingsKey> = SettingsSchema[Key];

export const settingKeys = createSettingKeys(section, settingsDefaults);

export type RuntimeSettings = {
  scanner: {
    includePrimitiveArrays: boolean;
  };
  tracker: {
    autoHighlightVisibleRanges: boolean;
    autoHighlightDebounceMs: number;
    viewportLookaheadRatio: number;
  };
};

function createSettingKeys<Schema extends Record<string, unknown>>(
  section: string,
  defaults: Schema,
): { readonly [Key in keyof Schema]: `${typeof section}.${Extract<Key, string>}` } {
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, `${section}.${key}`]),
  ) as { readonly [Key in keyof Schema]: `${typeof section}.${Extract<Key, string>}` };
}
