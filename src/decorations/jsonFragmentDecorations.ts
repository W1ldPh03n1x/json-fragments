import * as vscode from "vscode";

import type { JsonFragment } from "../store/jsonFragmentsStore";

export function createJsonFragmentDecorationController(): vscode.Disposable & {
  apply(editor: vscode.TextEditor, fragments: JsonFragment[]): void;
  clear(editor: vscode.TextEditor): void;
} {
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
    border: "1px solid",
    borderColor: new vscode.ThemeColor("editorOverviewRuler.findMatchForeground"),
    borderRadius: "3px",
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.findMatchForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  return {
    apply(editor: vscode.TextEditor, fragments: JsonFragment[]): void {
      const ranges = fragments.map((fragment) => new vscode.Range(
        fragment.line,
        fragment.start,
        fragment.line,
        fragment.end,
      ));

      editor.setDecorations(decorationType, ranges);
    },

    clear(editor: vscode.TextEditor): void {
      editor.setDecorations(decorationType, []);
    },

    dispose(): void {
      decorationType.dispose();
    },
  };
}
