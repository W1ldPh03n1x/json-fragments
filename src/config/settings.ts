
export const section = "json-fragments";

export type FileFilterMode = "exclude" | "include";

export type SettingsSchema = {
  "hover.enabled": boolean;
  "scanner.includePrimitiveArrays": boolean;
  "scanner.includeEmptyObjects": boolean;
  "files.filterMode": FileFilterMode;
  "files.include": string[];
  "files.exclude": string[];
  "preview.maxOpenStaticPreviews": number;
  "tracker.autoHighlightVisibleRanges": boolean;
  "tracker.autoHighlightDebounceMs": number;
  "tracker.viewportLookaheadRatio": number;
};

export const settingsDefaults: SettingsSchema = {
  "hover.enabled": true,
  "scanner.includePrimitiveArrays": false,
  "scanner.includeEmptyObjects": true,
  "files.filterMode": "exclude",
  "files.include": [],
  "files.exclude": [],
  "preview.maxOpenStaticPreviews": -1,
  "tracker.autoHighlightVisibleRanges": false,
  "tracker.autoHighlightDebounceMs": 100,
  "tracker.viewportLookaheadRatio": 0,
};

export type SettingsKey = keyof SettingsSchema;
export type SettingsValue<Key extends SettingsKey> = SettingsSchema[Key];

export const settingKeys = createSettingKeys(section, settingsDefaults);

export type RuntimeSettings = {
  hover: {
    enabled: boolean;
  };
  scanner: {
    includePrimitiveArrays: boolean;
    includeEmptyObjects: boolean;
  };
  files: {
    filterMode: FileFilterMode;
    include: string[];
    exclude: string[];
  };
  preview: {
    maxOpenStaticPreviews: number;
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
