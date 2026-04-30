import * as vscode from "vscode";
import { Config } from "./config";
import { Store } from "./store";

const commandRegistry = {
    scanVisibleFragments: "json-fragments.scanVisibleJsonFragments",
    openLinePreview: "json-fragments.openLineJsonFragmentsPreview",
    toggleHighlightForFile: "json-fragments.toggleHighlightForFile",
    toggleTemporaryHighlightForFocusedFiles: "json-fragments.toggleTemporaryHighlightForFocusedFiles",
} as const;

export function activate(context: vscode.ExtensionContext) {
    const config = new Config();
    const store = new Store();

    context.subscriptions.push(config);
}

export function deactivate() {}
