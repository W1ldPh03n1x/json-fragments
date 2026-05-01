import * as vscode from "vscode";
import type { StaticPreview } from "./types";

export async function closePreviewTabs(preview: StaticPreview): Promise<void> {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => isTabForUri(tab, preview.uri));

  if (tabs.length === 0) {
    return;
  }

  await vscode.window.tabGroups.close(tabs, true);
}

export function getTextTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  if (tab.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }

  return undefined;
}

function isTabForUri(tab: vscode.Tab, uri: vscode.Uri): boolean {
  return getTextTabUri(tab)?.toString() === uri.toString();
}
