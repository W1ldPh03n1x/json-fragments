import * as vscode from "vscode";
import { Config } from "./config";
import { HighlightPresenter, TextDecorator } from "./highlight";
import { FragmentHoverProvider, fragmentHoverDocumentSelector } from "./hover";
import {
    DynamicPreviewContentProvider,
    DynamicPreviewController,
    dynamicPreviewScheme,
    openDynamicPreviewCommand,
    openStaticPreviewCommand,
    StaticPreviewContentProvider,
    StaticPreviewController,
    StaticPreviewDefinitionProvider,
    StaticPreviewRegistry,
    staticPreviewDocumentSelector,
    staticPreviewScheme,
} from "./preview";
import type { Fragment } from "./scanner";
import { Store } from "./store";
import { FragmentTracker } from "./tracking";

const commandRegistry = {
    scanVisibleFragments: "json-fragments.scanVisibleJsonFragments",
    toggleHighlightForFile: "json-fragments.toggleHighlightForFile",
    toggleTemporaryHighlightForFocusedFiles: "json-fragments.toggleTemporaryHighlightForFocusedFiles",
    openStaticPreview: openStaticPreviewCommand,
    openDynamicPreview: openDynamicPreviewCommand,
} as const;

export function activate(context: vscode.ExtensionContext) {
    const config = new Config();
    const store = new Store<Fragment>();

    const decorator = new TextDecorator();
    const presenter = new HighlightPresenter(store, decorator);

    const tracker = new FragmentTracker(config, store);

    const hoverProvider = new FragmentHoverProvider(config, store);

    const previewRegistry = new StaticPreviewRegistry();
    const previewContentProvider = new StaticPreviewContentProvider(config, previewRegistry);
    const previewController = new StaticPreviewController(config, store, previewRegistry);

    const dynamicPreviewContentProvider = new DynamicPreviewContentProvider(store);
    const dynamicPreviewController = new DynamicPreviewController(tracker);

    const previewDefinitionProvider = new StaticPreviewDefinitionProvider(config, store);

    context.subscriptions.push(
        config,
        store,
        decorator,
        presenter,
        tracker,
        previewRegistry,
        previewController,
        dynamicPreviewContentProvider,
        vscode.languages.registerHoverProvider(fragmentHoverDocumentSelector, hoverProvider),
        vscode.workspace.registerTextDocumentContentProvider(staticPreviewScheme, previewContentProvider),
        vscode.workspace.registerTextDocumentContentProvider(dynamicPreviewScheme, dynamicPreviewContentProvider),
        vscode.languages.registerDefinitionProvider(staticPreviewDocumentSelector, previewDefinitionProvider),
        vscode.commands.registerCommand(commandRegistry.scanVisibleFragments, () => {
            tracker.scanActiveEditor();
        }),
        vscode.commands.registerCommand(commandRegistry.toggleHighlightForFile, () => {
            tracker.toggleActiveEditor();
        }),
        vscode.commands.registerCommand(commandRegistry.toggleTemporaryHighlightForFocusedFiles, () => {
            tracker.toggleTemporaryFocusedTracking();
        }),
        vscode.commands.registerCommand(commandRegistry.openStaticPreview, (args?: unknown) => {
            return previewController.openStaticPreview(args);
        }),
        vscode.commands.registerCommand(commandRegistry.openDynamicPreview, () => {
            return dynamicPreviewController.openDynamicPreview();
        }),
    );
}

export function deactivate() {}
