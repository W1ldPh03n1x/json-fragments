import * as vscode from "vscode";
import {
  section,
  settingsDefaults,
  type RuntimeSettings,
  type SettingsKey,
} from "./settings";

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

  public get<Key extends SettingsKey>(key: Key): RuntimeSettings[Key] {
    return this.currentSettings[key];
  }

  public get scannerOptions(): Pick<RuntimeSettings, "includePrimitiveArrays"> {
    return {
      includePrimitiveArrays: this.settings.includePrimitiveArrays,
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
    const configuration = vscode.workspace.getConfiguration(section);

    return Object.fromEntries(
      Object.entries(settingsDefaults).map(([key, defaultValue]) => [
        key,
        configuration.get(key, defaultValue),
      ]),
    ) as RuntimeSettings;
  }
}
