import * as vscode from "vscode";

import { createJsonFragmentDecorationController } from "./decorations/jsonFragmentDecorations";
import { createJsonFragmentHoverProvider } from "./hover/jsonFragmentHoverProvider";
import { findJsonFragmentsInLine } from "./scanner/findJsonFragmentsInLine";
import { JsonFragmentsStore, type JsonFragment } from "./store/jsonFragmentsStore";

const scanVisibleJsonFragmentsCommand = "json-fragments.scanVisibleJsonFragments";

export function activate(context: vscode.ExtensionContext) {
  const store = new JsonFragmentsStore();
  const decorations = createJsonFragmentDecorationController();
  const hoverProvider = createJsonFragmentHoverProvider(store);

  const scanCommand = vscode.commands.registerCommand(scanVisibleJsonFragmentsCommand, () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("JSON Fragments: no active editor to scan.");
      return;
    }

    const uri = editor.document.uri.toString();
    const fragments = scanVisibleRanges(editor);

    store.setFragments(uri, fragments);
    decorations.clear(editor);
    decorations.apply(editor, fragments);
  });

  context.subscriptions.push(
    scanCommand,
    decorations,
    vscode.languages.registerHoverProvider({ scheme: "*" }, hoverProvider),
  );
}

export function deactivate() {}

function scanVisibleRanges(editor: vscode.TextEditor): JsonFragment[] {
  const document = editor.document;
  const uri = document.uri.toString();
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
      const text = document.lineAt(line).text;

      return findJsonFragmentsInLine(text).map((fragment) => ({
        uri,
        line,
        ...fragment,
      }));
    });
}
