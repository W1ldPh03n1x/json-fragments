import * as vscode from "vscode";
import { scannerLimits, type Config } from "../config";
import { createScanner, type Fragment, type ScannerApi } from "../scanner";
import type { Store } from "../store";
import { FragmentHover } from "./FragmentHover";

export const fragmentHoverDocumentSelector: vscode.DocumentSelector = [
  { scheme: "file" },
  { scheme: "untitled" },
];

export class FragmentHoverProvider implements vscode.HoverProvider {
  public constructor(
    private readonly config: Config,
    private readonly store: Store<Fragment>,
  ) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    const scanner = createScanner({
      ...this.config.scannerOptions,
      ...scannerLimits,
    });
    const fragment = this.resolveFragment(document, position, scanner);

    if (fragment === undefined) {
      return undefined;
    }

    return new FragmentHover(scanner).render(fragment);
  }

  private resolveFragment(
    document: vscode.TextDocument,
    position: vscode.Position,
    scanner: ScannerApi,
  ): Fragment | undefined {
    const snapshot = this.store.getSnapshot(document.uri);

    if (snapshot?.version === document.version) {
      const cachedFragment = this.store.findFragmentAt(document.uri, position);

      if (cachedFragment !== undefined) {
        return cachedFragment;
      }
    }

    return scanner
      .scanLine(document.lineAt(position.line))
      .fragments
      .find((fragment) => containsPosition(fragment.range, position));
  }
}

function containsPosition(range: vscode.Range, position: vscode.Position): boolean {
  return range.start.isBeforeOrEqual(position) && range.end.isAfter(position);
}
