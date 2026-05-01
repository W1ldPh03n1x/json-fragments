import * as vscode from "vscode";
import type { FragmentStoreChange, Store, StoredFragment } from "../store";
import type { TextDecorator } from "./TextDecorator";

export class HighlightPresenter<Fragment extends StoredFragment = StoredFragment> implements vscode.Disposable {
  private readonly subscription: vscode.Disposable;

  public constructor(
    store: Store<Fragment>,
    private readonly decorator: TextDecorator,
  ) {
    this.subscription = store.onDidChangeFragments((change) => this.applyChange(change));
  }

  public dispose(): void {
    this.subscription.dispose();
  }

  private applyChange(change: FragmentStoreChange<Fragment>): void {
    const editors = vscode.window.visibleTextEditors.filter((editor) => (
      editor.document.uri.toString() === change.uri.toString()
    ));

    if (isClearChange(change)) {
      for (const editor of editors) {
        this.decorator.clear(editor);
      }

      return;
    }

    for (const editor of editors) {
      this.decorator.render(editor, change.ranges);
    }
  }
}

function isClearChange(change: FragmentStoreChange): boolean {
  return change.reason === "clear" ||
    change.reason === "document-closed" ||
    change.reason === "disabled";
}
