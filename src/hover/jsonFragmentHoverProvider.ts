import * as vscode from "vscode";

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

      const markdown = new vscode.MarkdownString(
        `\`\`\`json\n${JSON.stringify(fragment.value, null, 2)}\n\`\`\``,
      );

      return new vscode.Hover(markdown, new vscode.Range(
        fragment.line,
        fragment.start,
        fragment.line,
        fragment.end,
      ));
    },
  };
}
