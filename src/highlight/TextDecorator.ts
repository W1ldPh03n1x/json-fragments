import * as vscode from "vscode";
import {
  defaultFragmentDecorationStyle,
  type FragmentDecorationStyle,
} from "./types";

export class TextDecorator implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;
  private readonly themeSubscription: vscode.Disposable;
  private readonly renderedRangesByEditor = new Map<string, readonly vscode.Range[]>();

  public constructor(style: FragmentDecorationStyle = defaultFragmentDecorationStyle) {
    this.decorationType = createDecorationType(style);
    this.themeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
      this.renderKnownVisibleEditors();
    });
  }

  public setStyle(style: FragmentDecorationStyle): void {
    this.decorationType.dispose();
    this.decorationType = createDecorationType(style);
    this.renderKnownVisibleEditors();
  }

  public render(editor: vscode.TextEditor, ranges: readonly vscode.Range[]): void {
    this.renderedRangesByEditor.set(createEditorKey(editor), [...ranges]);
    editor.setDecorations(this.decorationType, ranges);
  }

  public clear(editor: vscode.TextEditor): void {
    this.renderedRangesByEditor.delete(createEditorKey(editor));
    editor.setDecorations(this.decorationType, []);
  }

  public clearDocument(uri: vscode.Uri): void {
    const uriKey = createUriKey(uri);

    for (const editorKey of this.renderedRangesByEditor.keys()) {
      if (editorKey.startsWith(uriKey)) {
        this.renderedRangesByEditor.delete(editorKey);
      }
    }

    for (const editor of vscode.window.visibleTextEditors) {
      if (createUriKey(editor.document.uri) === uriKey) {
        editor.setDecorations(this.decorationType, []);
      }
    }
  }

  public dispose(): void {
    this.renderedRangesByEditor.clear();
    this.themeSubscription.dispose();
    this.decorationType.dispose();
  }

  private renderKnownVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const ranges = this.renderedRangesByEditor.get(createEditorKey(editor));

      if (ranges !== undefined) {
        editor.setDecorations(this.decorationType, ranges);
      }
    }
  }
}

function createDecorationType(style: FragmentDecorationStyle): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    border: "1px solid",
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    overviewRulerColor: style.overviewRulerColor,
    overviewRulerLane: style.overviewRulerColor === undefined
      ? undefined
      : vscode.OverviewRulerLane.Right,
  });
}

function createEditorKey(editor: vscode.TextEditor): string {
  return `${createUriKey(editor.document.uri)}#${editor.viewColumn ?? "unknown"}`;
}

function createUriKey(uri: vscode.Uri): string {
  return uri.toString();
}
