import * as vscode from "vscode";

import { formatJsonFragmentsAsMarkdown } from "../markdown/jsonFragmentMarkdown";
import { findJsonFragmentsInLine, type FindJsonFragmentsInLineOptions } from "../scanner/findJsonFragmentsInLine";

export const jsonFragmentsPreviewScheme = "json-fragments-preview";

type JsonFragmentsPreviewState = {
  line: number;
  sourceUri: string;
};

export function createJsonFragmentsPreviewProvider(
  getOptions: () => FindJsonFragmentsInLineOptions,
): vscode.TextDocumentContentProvider & vscode.Disposable & {
  createPreviewUri(editor: vscode.TextEditor, line: number): vscode.Uri;
  refreshEditorLine(editor: vscode.TextEditor): void;
  refreshSource(sourceUri: vscode.Uri): void;
  refreshAll(): void;
} {
  const onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  const previews = new Map<string, JsonFragmentsPreviewState>();

  const getPreviewState = (uri: vscode.Uri) => previews.get(uri.toString());

  const findSourceDocument = (sourceUri: string) => vscode.workspace.textDocuments
    .find((document) => document.uri.toString() === sourceUri);

  return {
    onDidChange: onDidChangeEmitter.event,

    createPreviewUri(editor: vscode.TextEditor, line: number): vscode.Uri {
      const sourceUri = editor.document.uri.toString();
      const previewUri = vscode.Uri.from({
        scheme: jsonFragmentsPreviewScheme,
        path: `/line-${line + 1}.md`,
        query: encodeURIComponent(`${sourceUri}:${line}`),
      });

      previews.set(previewUri.toString(), {
        line,
        sourceUri,
      });

      return previewUri;
    },

    refreshEditorLine(editor: vscode.TextEditor): void {
      const sourceUri = editor.document.uri.toString();
      const line = editor.selection.active.line;

      for (const [previewUriString, state] of previews) {
        if (state.sourceUri === sourceUri) {
          state.line = line;
          onDidChangeEmitter.fire(vscode.Uri.parse(previewUriString));
        }
      }
    },

    provideTextDocumentContent(uri: vscode.Uri): string {
      const state = getPreviewState(uri);
      if (!state) {
        return "JSON Fragments: preview is not available.";
      }

      const document = findSourceDocument(state.sourceUri);
      if (!document) {
        return "JSON Fragments: source document is not open.";
      }

      if (state.line >= document.lineCount) {
        return "JSON Fragments: source line no longer exists.";
      }

      const fragments = findJsonFragmentsInLine(
        document.lineAt(state.line).text,
        getOptions(),
      );

      if (fragments.length === 0) {
        return "JSON Fragments: no JSON fragments found on this line.";
      }

      return formatJsonFragmentsAsMarkdown(fragments);
    },

    refreshSource(sourceUri: vscode.Uri): void {
      const sourceUriString = sourceUri.toString();

      for (const [previewUriString, state] of previews) {
        if (state.sourceUri === sourceUriString) {
          onDidChangeEmitter.fire(vscode.Uri.parse(previewUriString));
        }
      }
    },

    refreshAll(): void {
      for (const previewUriString of previews.keys()) {
        onDidChangeEmitter.fire(vscode.Uri.parse(previewUriString));
      }
    },

    dispose(): void {
      previews.clear();
      onDidChangeEmitter.dispose();
    },
  };
}
