import * as vscode from "vscode";
import type { Fragment, ScannerApi } from "../scanner";

export class FragmentHover {
  public constructor(private readonly formatter: Pick<ScannerApi, "format">) {}

  public render(fragment: Fragment): vscode.Hover {
    return new vscode.Hover(
      this.renderMarkdown(fragment),
      fragment.range,
    );
  }

  public renderMarkdown(fragment: Fragment): vscode.MarkdownString {
    return createFragmentHoverMarkdown(this.formatter.format(fragment.value));
  }
}

export function createFragmentHoverMarkdown(formattedJson: string): vscode.MarkdownString {
  const markdown = new vscode.MarkdownString();

  markdown.isTrusted = false;
  markdown.appendCodeblock(formattedJson, "json");

  return markdown;
}
