import * as vscode from "vscode";
import * as path from "path";
import {
  section,
  settingsDefaults,
  type RuntimeSettings,
  type SettingsKey,
  type SettingsValue,
} from "./settings";
import { isFileAllowed } from "./fileFilter";

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
      includeEmptyObjects: this.settings.scanner.includeEmptyObjects,
    };
  }

  public isDocumentAllowed(document: vscode.TextDocument): boolean {
    return isFileAllowed(getDocumentFilterPath(document), this.settings.files);
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
    hover: {
      enabled: readSetting(configuration, "hover.enabled"),
    },
    scanner: {
      includePrimitiveArrays: readSetting(configuration, "scanner.includePrimitiveArrays"),
      includeEmptyObjects: readSetting(configuration, "scanner.includeEmptyObjects"),
    },
    files: {
      filterMode: readSetting(configuration, "files.filterMode"),
      include: readSetting(configuration, "files.include"),
      exclude: readSetting(configuration, "files.exclude"),
    },
    preview: {
      maxOpenStaticPreviews: readSetting(
        configuration,
        "preview.maxOpenStaticPreviews",
      ),
    },
    tracker: {
      autoHighlightVisibleRanges: readSetting(
        configuration,
        "tracker.autoHighlightVisibleRanges",
      ),
      autoHighlightDebounceMs: readSetting(configuration, "tracker.autoHighlightDebounceMs"),
      viewportLookaheadRatio: readSetting(configuration, "tracker.viewportLookaheadRatio"),
    },
    inlineSyntaxHighlighting: {
      autoHighlightVisibleRanges: readSetting(
        configuration,
        "inlineSyntaxHighlighting.autoHighlightVisibleRanges",
      ),
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
    case "hover.enabled":
      return settings.hover.enabled as SettingsValue<Key>;
    case "scanner.includePrimitiveArrays":
      return settings.scanner.includePrimitiveArrays as SettingsValue<Key>;
    case "scanner.includeEmptyObjects":
      return settings.scanner.includeEmptyObjects as SettingsValue<Key>;
    case "files.filterMode":
      return settings.files.filterMode as SettingsValue<Key>;
    case "files.include":
      return settings.files.include as SettingsValue<Key>;
    case "files.exclude":
      return settings.files.exclude as SettingsValue<Key>;
    case "preview.maxOpenStaticPreviews":
      return settings.preview.maxOpenStaticPreviews as SettingsValue<Key>;
    case "tracker.autoHighlightVisibleRanges":
      return settings.tracker.autoHighlightVisibleRanges as SettingsValue<Key>;
    case "tracker.autoHighlightDebounceMs":
      return settings.tracker.autoHighlightDebounceMs as SettingsValue<Key>;
    case "tracker.viewportLookaheadRatio":
      return settings.tracker.viewportLookaheadRatio as SettingsValue<Key>;
    case "inlineSyntaxHighlighting.autoHighlightVisibleRanges":
      return settings.inlineSyntaxHighlighting.autoHighlightVisibleRanges as SettingsValue<Key>;
  }
}

function getDocumentFilterPath(document: vscode.TextDocument): string | undefined {
  if (document.uri.scheme !== "file") {
    return undefined;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (workspaceFolder === undefined) {
    return document.uri.fsPath;
  }

  return path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
}
