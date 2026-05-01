import * as vscode from "vscode";
import { type Config } from "../config";
import { type Fragment } from "../scanner";
import type { Store } from "../store";
import { StaticPreviewRegistry } from "./StaticPreviewRegistry";
import {
  createStaticPreviewIdentity,
  createStaticPreviewUri,
  deserializeRange,
  staticPreviewScheme,
  type OpenStaticPreviewArgs,
} from "./types";
import { findFragmentByRange, findFragmentForPosition } from "./fragmentLookup";
import { getTextTabUri } from "./tabUtils";

export class StaticPreviewController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly config: Config,
    private readonly store: Store<Fragment>,
    private readonly registry: StaticPreviewRegistry,
  ) {
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (document.uri.scheme === staticPreviewScheme) {
          this.registry.removeByUri(document.uri);
        }
      }),
      vscode.window.tabGroups.onDidChangeTabs((event) => {
        for (const tab of event.closed) {
          const uri = getTextTabUri(tab);

          if (uri?.scheme === staticPreviewScheme) {
            this.registry.removeByUri(uri);
          }
        }
      }),
    );
  }

  public async openStaticPreview(args?: unknown): Promise<void> {
    const match = await this.resolveFragmentMatch(args);

    if (match === undefined) {
      await vscode.window.showInformationMessage("No JSON fragment found for static preview.");
      return;
    }

    const identity = createStaticPreviewIdentity(match.document, match.fragment.range);

    if (this.config.get("preview.maxOpenStaticPreviews") === 0) {
      await vscode.window.showInformationMessage("Static preview limit prevents opening a new preview.");
      return;
    }

    const document = await vscode.workspace.openTextDocument(createStaticPreviewUri(identity));
    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private async resolveFragmentMatch(args: unknown): Promise<{
    document: vscode.TextDocument;
    fragment: Fragment;
  } | undefined> {
    const commandArgs = parseOpenStaticPreviewArgs(args);

    if (commandArgs !== undefined) {
      return this.resolveFragmentFromArgs(commandArgs);
    }

    return this.resolveFragmentFromCursor();
  }

  private async resolveFragmentFromArgs(args: OpenStaticPreviewArgs): Promise<{
    document: vscode.TextDocument;
    fragment: Fragment;
  } | undefined> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(args.sourceUri));

    if (document.version !== args.sourceVersion || !this.config.isDocumentAllowed(document)) {
      return undefined;
    }

    const fragment = findFragmentByRange(this.config, document, deserializeRange(args.range));

    if (fragment === undefined) {
      return undefined;
    }

    return {
      document,
      fragment,
    };
  }

  private resolveFragmentFromCursor(): {
    document: vscode.TextDocument;
    fragment: Fragment;
  } | undefined {
    const editor = vscode.window.activeTextEditor;

    if (editor === undefined || !this.config.isDocumentAllowed(editor.document)) {
      return undefined;
    }

    const fragment = findFragmentForPosition(
      this.config,
      this.store,
      editor.document,
      editor.selection.active,
    );

    if (fragment === undefined) {
      return undefined;
    }

    return {
      document: editor.document,
      fragment,
    };
  }
}

function parseOpenStaticPreviewArgs(args: unknown): OpenStaticPreviewArgs | undefined {
  if (!isOpenStaticPreviewArgs(args)) {
    return undefined;
  }

  return args;
}

function isOpenStaticPreviewArgs(value: unknown): value is OpenStaticPreviewArgs {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OpenStaticPreviewArgs>;

  return typeof candidate.sourceUri === "string" &&
    typeof candidate.sourceVersion === "number" &&
    isSerializableRange(candidate.range);
}

function isSerializableRange(value: unknown): value is OpenStaticPreviewArgs["range"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OpenStaticPreviewArgs["range"]>;

  return isSerializablePosition(candidate.start) && isSerializablePosition(candidate.end);
}

function isSerializablePosition(value: unknown): value is OpenStaticPreviewArgs["range"]["start"] {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OpenStaticPreviewArgs["range"]["start"]>;

  return typeof candidate.line === "number" && typeof candidate.character === "number";
}
