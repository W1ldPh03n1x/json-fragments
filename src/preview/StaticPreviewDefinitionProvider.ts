import * as vscode from "vscode";
import { type Config } from "../config";
import { type Fragment } from "../scanner";
import type { Store } from "../store";
import { findFragmentContainingPosition } from "./fragmentLookup";
import { createStaticPreviewIdentity, createStaticPreviewUri } from "./types";

export const staticPreviewDocumentSelector: vscode.DocumentSelector = [
  { scheme: "file" },
  { scheme: "untitled" },
];

export class StaticPreviewDefinitionProvider implements vscode.DefinitionProvider {
  public constructor(
    private readonly config: Config,
    private readonly store: Store<Fragment>,
  ) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DefinitionLink[]> {
    if (
      token.isCancellationRequested ||
      !this.config.isDocumentAllowed(document) ||
      this.config.get("preview.maxOpenStaticPreviews") === 0
    ) {
      return undefined;
    }

    const fragment = findFragmentContainingPosition(
      this.config,
      this.store,
      document,
      position,
    );

    if (fragment === undefined) {
      return undefined;
    }

    const targetRange = new vscode.Range(0, 0, 0, 0);

    return [{
      originSelectionRange: fragment.range,
      targetUri: createStaticPreviewUri(createStaticPreviewIdentity(document, fragment.range)),
      targetRange,
      targetSelectionRange: targetRange,
    }];
  }
}
