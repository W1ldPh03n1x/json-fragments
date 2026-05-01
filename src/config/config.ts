import * as vscode from "vscode";
import {
  section,
  settingsDefaults,
  type RuntimeSettings,
  type SettingsKey,
  type SettingsValue,
} from "./settings";

type ConfigurationReader = Pick<vscode.WorkspaceConfiguration, "get">;

export class Config implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<RuntimeSettings>();
  private currentSettings = this.readSettings();

  public readonly onDidChange = this.onDidChangeEmitter.event;

  public constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(section)) {
          return;
        }

        this.currentSettings = this.readSettings();
        this.onDidChangeEmitter.fire(this.currentSettings);
      }),
    );
  }

  public get settings(): RuntimeSettings {
    return this.currentSettings;
  }

  public get<Key extends SettingsKey>(key: Key): SettingsValue<Key> {
    return getRuntimeSetting(this.currentSettings, key);
  }

  public get scannerOptions(): RuntimeSettings["scanner"] {
    return {
      includePrimitiveArrays: this.settings.scanner.includePrimitiveArrays,
    };
  }

  public refresh(): RuntimeSettings {
    this.currentSettings = this.readSettings();
    this.onDidChangeEmitter.fire(this.currentSettings);

    return this.currentSettings;
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables, this.onDidChangeEmitter).dispose();
  }

  private readSettings(): RuntimeSettings {
    return readRuntimeSettings(vscode.workspace.getConfiguration(section));
  }
}

export function readRuntimeSettings(configuration: ConfigurationReader): RuntimeSettings {
  return {
    scanner: {
      includePrimitiveArrays: readSetting(configuration, "scanner.includePrimitiveArrays"),
    },
    tracker: {
      autoHighlightVisibleRanges: readSetting(
        configuration,
        "tracker.autoHighlightVisibleRanges",
      ),
      autoHighlightDebounceMs: readSetting(configuration, "tracker.autoHighlightDebounceMs"),
      viewportLookaheadRatio: readSetting(configuration, "tracker.viewportLookaheadRatio"),
    },
  };
}

function readSetting<Key extends SettingsKey>(
  configuration: ConfigurationReader,
  key: Key,
): SettingsValue<Key> {
  return configuration.get(key, settingsDefaults[key]);
}

function getRuntimeSetting<Key extends SettingsKey>(
  settings: RuntimeSettings,
  key: Key,
): SettingsValue<Key> {
  switch (key) {
    case "scanner.includePrimitiveArrays":
      return settings.scanner.includePrimitiveArrays as SettingsValue<Key>;
    case "tracker.autoHighlightVisibleRanges":
      return settings.tracker.autoHighlightVisibleRanges as SettingsValue<Key>;
    case "tracker.autoHighlightDebounceMs":
      return settings.tracker.autoHighlightDebounceMs as SettingsValue<Key>;
    case "tracker.viewportLookaheadRatio":
      return settings.tracker.viewportLookaheadRatio as SettingsValue<Key>;
  }
}
