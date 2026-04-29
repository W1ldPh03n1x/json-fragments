import * as vscode from "vscode";

import { formatJsonFragmentValueAsMarkdown } from "../markdown/jsonFragmentMarkdown";
import type { JsonFragmentsStore } from "../store/jsonFragmentsStore";

export function createJsonFragmentHoverProvider(store: JsonFragmentsStore): vscode.HoverProvider {
  return {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
      const fragment = store.findFragmentAt(
        document.uri.toString(),
        position.line,
        position.character,
      );

      if (!fragment) {
        return undefined;
      }

      const markdown = new vscode.MarkdownString(formatJsonFragmentValueAsMarkdown(fragment.value));

      return new vscode.Hover(markdown, new vscode.Range(
        fragment.line,
        fragment.start,
        fragment.line,
        fragment.end,
      ));
    },
  };
}
