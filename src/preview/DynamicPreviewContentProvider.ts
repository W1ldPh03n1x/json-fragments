import * as vscode from "vscode";
import type { Fragment } from "../scanner";
import type { CurrentLineSnapshot, Store } from "../store";
import { dynamicPreviewUri } from "./types";

export class DynamicPreviewContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly storeSubscription: vscode.Disposable;

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly store: Store<Fragment>) {
    this.storeSubscription = this.store.onDidChangeCurrentLineFragments(() => {
      this.changeEmitter.fire(dynamicPreviewUri);
    });
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    if (uri.toString() !== dynamicPreviewUri.toString()) {
      return "";
    }

    return createDynamicPreviewContent(this.store.getCurrentLineSnapshot());
  }

  public dispose(): void {
    this.storeSubscription.dispose();
    this.changeEmitter.dispose();
  }
}

export function createDynamicPreviewContent(
  snapshot: CurrentLineSnapshot<Fragment> | undefined,
): string {
  if (snapshot === undefined || snapshot.fragments.length === 0) {
    return "null";
  }

  if (snapshot.fragments.length === 1) {
    return JSON.stringify(snapshot.fragments[0].value, null, 2);
  }

  return JSON.stringify(snapshot.fragments.map((fragment) => fragment.value), null, 2);
}
