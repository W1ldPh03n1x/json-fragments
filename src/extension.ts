import * as vscode from "vscode";
import { Config } from "./config";
import { HighlightPresenter, TextDecorator } from "./highlight";
import { FragmentHoverProvider, fragmentHoverDocumentSelector } from "./hover";
import type { Fragment } from "./scanner";
import { Store } from "./store";
import { FragmentTracker } from "./tracking";

const commandRegistry = {
    scanVisibleFragments: "json-fragments.scanVisibleJsonFragments",
    openLinePreview: "json-fragments.openLineJsonFragmentsPreview",
    toggleHighlightForFile: "json-fragments.toggleHighlightForFile",
    toggleTemporaryHighlightForFocusedFiles: "json-fragments.toggleTemporaryHighlightForFocusedFiles",
} as const;

export function activate(context: vscode.ExtensionContext) {
    const config = new Config();
    const store = new Store<Fragment>();
    const decorator = new TextDecorator();
    const presenter = new HighlightPresenter(store, decorator);
    const tracker = new FragmentTracker(config, store);
    const hoverProvider = new FragmentHoverProvider(config, store);

    context.subscriptions.push(
        config,
        store,
        decorator,
        presenter,
        tracker,
        vscode.languages.registerHoverProvider(fragmentHoverDocumentSelector, hoverProvider),
        vscode.commands.registerCommand(commandRegistry.scanVisibleFragments, () => {
            tracker.scanActiveEditor();
        }),
        vscode.commands.registerCommand(commandRegistry.toggleHighlightForFile, () => {
            tracker.toggleActiveEditor();
        }),
        vscode.commands.registerCommand(commandRegistry.toggleTemporaryHighlightForFocusedFiles, () => {
            tracker.toggleTemporaryFocusedTracking();
        }),
    );
}

export function deactivate() {}
