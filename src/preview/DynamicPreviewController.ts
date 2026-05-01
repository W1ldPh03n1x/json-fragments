import * as vscode from "vscode";
import type { FragmentTracker } from "../tracking";
import { dynamicPreviewUri } from "./types";

export class DynamicPreviewController {
  public constructor(private readonly tracker: FragmentTracker) {}

  public async openDynamicPreview(): Promise<void> {
    this.tracker.refreshCurrentLine();

    const document = await vscode.workspace.openTextDocument(dynamicPreviewUri);

    await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
    });
  }
}
