import * as vscode from "vscode";

import { createJsonFragmentDecorationController } from "./decorations/jsonFragmentDecorations";
import { createJsonFragmentHoverProvider } from "./hover/jsonFragmentHoverProvider";
import { createJsonFragmentsPreviewProvider, jsonFragmentsPreviewScheme } from "./preview/jsonFragmentsPreviewProvider";
import { findJsonFragmentsInLine } from "./scanner/findJsonFragmentsInLine";
import { JsonFragmentsStore, type JsonFragment } from "./store/jsonFragmentsStore";

const scanVisibleJsonFragmentsCommand = "json-fragments.scanVisibleJsonFragments";
const openLineJsonFragmentsPreviewCommand = "json-fragments.openLineJsonFragmentsPreview";
const toggleHighlightForFileCommand = "json-fragments.toggleHighlightForFile";
const toggleTemporaryHighlightForFocusedFilesCommand = "json-fragments.toggleTemporaryHighlightForFocusedFiles";
const configurationSection = "json-fragments";
const autoHighlightVisibleRangesSetting = "autoHighlightVisibleRanges";
const includePrimitiveArraysSetting = "includePrimitiveArrays";
const autoHighlightDebounceMs = 100;

export function activate(context: vscode.ExtensionContext) {
  const store = new JsonFragmentsStore();
  const decorations = createJsonFragmentDecorationController();
  const hoverProvider = createJsonFragmentHoverProvider(store);
  const previewProvider = createJsonFragmentsPreviewProvider(() => ({
    includePrimitiveArrays: shouldIncludePrimitiveArrays(),
  }));
  let lastAutoHighlightedEditor: vscode.TextEditor | undefined;
  let autoHighlightTimeout: NodeJS.Timeout | undefined;
  let temporaryHighlightForFocusedFilesEnabled = false;
  const documentHighlightOverrides = new Map<string, boolean>();

  const scanEditor = (editor: vscode.TextEditor) => {
    const uri = editor.document.uri.toString();
    const fragments = scanVisibleRanges(editor, {
      includePrimitiveArrays: shouldIncludePrimitiveArrays(),
    });

    store.setFragments(uri, fragments);
    decorations.clear(editor);
    decorations.apply(editor, fragments);
  };

  const clearAutoHighlightedEditor = () => {
    if (!lastAutoHighlightedEditor) {
      return;
    }

    decorations.clear(lastAutoHighlightedEditor);
    store.clearFragments(lastAutoHighlightedEditor.document.uri.toString());
    lastAutoHighlightedEditor = undefined;
  };

  const isAutoHighlightEnabled = () =>
    vscode.workspace.getConfiguration(configurationSection).get<boolean>(autoHighlightVisibleRangesSetting, false);

  const shouldIncludePrimitiveArrays = () =>
    vscode.workspace.getConfiguration(configurationSection).get<boolean>(includePrimitiveArraysSetting, false);

  const shouldHighlightEditor = (editor: vscode.TextEditor) => {
    const uri = editor.document.uri.toString();
    const documentOverride = documentHighlightOverrides.get(uri);

    if (documentOverride !== undefined) {
      return documentOverride;
    }

    return isAutoHighlightEnabled() || temporaryHighlightForFocusedFilesEnabled;
  };

  const cancelScheduledAutoHighlight = () => {
    if (autoHighlightTimeout) {
      clearTimeout(autoHighlightTimeout);
      autoHighlightTimeout = undefined;
    }
  };

  const scheduleAutoHighlight = (editor = vscode.window.activeTextEditor) => {
    if (!editor) {
      cancelScheduledAutoHighlight();
      clearAutoHighlightedEditor();
      return;
    }

    if (!shouldHighlightEditor(editor)) {
      cancelScheduledAutoHighlight();
      clearAutoHighlightedEditor();
      return;
    }

    if (lastAutoHighlightedEditor && lastAutoHighlightedEditor !== editor) {
      decorations.clear(lastAutoHighlightedEditor);
      store.clearFragments(lastAutoHighlightedEditor.document.uri.toString());
    }

    lastAutoHighlightedEditor = editor;

    cancelScheduledAutoHighlight();

    autoHighlightTimeout = setTimeout(() => {
      autoHighlightTimeout = undefined;
      scanEditor(editor);
    }, autoHighlightDebounceMs);
  };

  const scanCommand = vscode.commands.registerCommand(scanVisibleJsonFragmentsCommand, () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("JSON Fragments: no active editor to scan.");
      return;
    }

    scanEditor(editor);
  });

  const openLineJsonFragmentsPreview = vscode.commands.registerCommand(
    openLineJsonFragmentsPreviewCommand,
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("JSON Fragments: no active editor to preview.");
        return;
      }

      const line = editor.selection.active.line;
      if (scanLine(editor, line, { includePrimitiveArrays: shouldIncludePrimitiveArrays() }).length === 0) {
        vscode.window.showInformationMessage("JSON Fragments: no JSON fragments found on the active line.");
        return;
      }

      const previewUri = previewProvider.createPreviewUri(editor, line);

      await vscode.commands.executeCommand("markdown.showPreview", previewUri);
    },
  );

  const toggleHighlightForFile = vscode.commands.registerCommand(toggleHighlightForFileCommand, () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("JSON Fragments: no active editor to toggle.");
      return;
    }

    const uri = editor.document.uri.toString();
    const enabled = !shouldHighlightEditor(editor);

    documentHighlightOverrides.set(uri, enabled);
    vscode.window.showInformationMessage(
      `JSON Fragments: ${enabled ? "enabled" : "disabled"} highlight for this file.`,
    );
    scheduleAutoHighlight(editor);
  });

  const toggleTemporaryHighlightForFocusedFiles = vscode.commands.registerCommand(
    toggleTemporaryHighlightForFocusedFilesCommand,
    () => {
      temporaryHighlightForFocusedFilesEnabled = !temporaryHighlightForFocusedFilesEnabled;
      vscode.window.showInformationMessage(
        `JSON Fragments: temporary highlight for focused files ${
          temporaryHighlightForFocusedFilesEnabled ? "enabled" : "disabled"
        }.`,
      );
      scheduleAutoHighlight();
    },
  );

  context.subscriptions.push(
    scanCommand,
    openLineJsonFragmentsPreview,
    toggleHighlightForFile,
    toggleTemporaryHighlightForFocusedFiles,
    decorations,
    vscode.languages.registerHoverProvider({ scheme: "*" }, hoverProvider),
    previewProvider,
    vscode.workspace.registerTextDocumentContentProvider(jsonFragmentsPreviewScheme, previewProvider),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        previewProvider.refreshEditorLine(editor);
      }

      scheduleAutoHighlight(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      previewProvider.refreshEditorLine(event.textEditor);
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (event.textEditor === vscode.window.activeTextEditor) {
        scheduleAutoHighlight(event.textEditor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      previewProvider.refreshSource(event.document.uri);

      if (editor?.document === event.document) {
        scheduleAutoHighlight(editor);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${configurationSection}.${autoHighlightVisibleRangesSetting}`) ||
        event.affectsConfiguration(`${configurationSection}.${includePrimitiveArraysSetting}`)
      ) {
        previewProvider.refreshAll();
        scheduleAutoHighlight();
      }
    }),
    new vscode.Disposable(() => {
      cancelScheduledAutoHighlight();
    }),
  );

  scheduleAutoHighlight();
}

export function deactivate() {}

function scanLine(
  editor: vscode.TextEditor,
  line: number,
  options: {
    includePrimitiveArrays: boolean;
  },
): JsonFragment[] {
  const document = editor.document;
  const uri = document.uri.toString();
  const text = document.lineAt(line).text;

  return findJsonFragmentsInLine(text, options).map((fragment) => ({
    uri,
    line,
    ...fragment,
  }));
}

function scanVisibleRanges(
  editor: vscode.TextEditor,
  options: {
    includePrimitiveArrays: boolean;
  },
): JsonFragment[] {
  const document = editor.document;
  const visibleLines = new Set<number>();

  for (const range of editor.visibleRanges) {
    const startLine = Math.max(0, range.start.line);
    const endLine = Math.min(document.lineCount - 1, range.end.line);

    for (let line = startLine; line <= endLine; line += 1) {
      visibleLines.add(line);
    }
  }

  return [...visibleLines]
    .sort((left, right) => left - right)
    .flatMap((line): JsonFragment[] => {
      return scanLine(editor, line, options);
    });
}
