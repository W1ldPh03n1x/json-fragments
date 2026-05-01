import * as vscode from "vscode";
import { scannerLimits, type Config } from "../config";
import { createScanner } from "../scanner";
import type { StaticPreviewRegistry } from "./StaticPreviewRegistry";
import { findFragmentByRange } from "./fragmentLookup";
import { closePreviewTabs } from "./tabUtils";
import {
  deserializeRange,
  parseStaticPreviewIdentity,
} from "./types";

export class StaticPreviewContentProvider implements vscode.TextDocumentContentProvider {
  public constructor(
    private readonly config: Config,
    private readonly registry: StaticPreviewRegistry,
  ) {}

  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const existingContent = this.registry.getContent(uri);

    if (existingContent !== undefined) {
      return existingContent;
    }

    const identity = parseStaticPreviewIdentity(uri);

    if (identity === undefined || this.config.get("preview.maxOpenStaticPreviews") === 0) {
      return "";
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(identity.sourceUri));

    if (document.version !== identity.sourceVersion || !this.config.isDocumentAllowed(document)) {
      return "";
    }

    const fragment = findFragmentByRange(this.config, document, deserializeRange(identity.range));

    if (fragment === undefined) {
      return "";
    }

    const content = createScanner({
      ...this.config.scannerOptions,
      ...scannerLimits,
    }).format(fragment.value);
    const registration = this.registry.register(
      identity,
      content,
      this.config.get("preview.maxOpenStaticPreviews"),
    );

    for (const preview of registration.evicted) {
      await closePreviewTabs(preview);
    }

    if (registration.kind === "blocked") {
      return "";
    }

    return registration.preview.content;
  }
}
