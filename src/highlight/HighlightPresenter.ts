import * as vscode from "vscode";
import type { Fragment } from "../scanner";
import type { FragmentStoreChange, Store } from "../store";
import type { TextDecorator } from "./TextDecorator";
import type { HighlightRenderLayers } from "./types";

export type HighlightLayerProvider = {
  onDidChangeHighlightLayers: vscode.Event<vscode.Uri>;
  isFragmentHighlightEnabled(uri: vscode.Uri): boolean;
  isInlineSyntaxHighlightEnabled(uri: vscode.Uri): boolean;
};

export class HighlightPresenter implements vscode.Disposable {
  private readonly subscription: vscode.Disposable;
  private readonly layerSubscription: vscode.Disposable;

  public constructor(
    private readonly store: Store<Fragment>,
    private readonly decorator: TextDecorator,
    private readonly layers: HighlightLayerProvider,
  ) {
    this.subscription = store.onDidChangeFragments((change) => this.applyChange(change));
    this.layerSubscription = layers.onDidChangeHighlightLayers((uri) => this.applyLayerChange(uri));
  }

  public dispose(): void {
    this.subscription.dispose();
    this.layerSubscription.dispose();
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

    const layers = this.getRenderLayers(change.uri);

    for (const editor of editors) {
      this.decorator.render(editor, change.ranges, change.fragments, layers);
    }
  }

  private applyLayerChange(uri: vscode.Uri): void {
    const editors = vscode.window.visibleTextEditors.filter((editor) => (
      editor.document.uri.toString() === uri.toString()
    ));
    const snapshot = this.store.getSnapshot(uri);
    const layers = this.getRenderLayers(uri);

    for (const editor of editors) {
      if (snapshot === undefined) {
        this.decorator.render(editor, [], [], layers);
        continue;
      }

      this.decorator.render(editor, snapshot.fragments.map((fragment) => fragment.range), snapshot.fragments, layers);
    }
  }

  private getRenderLayers(uri: vscode.Uri): HighlightRenderLayers {
    return {
      fragment: this.layers.isFragmentHighlightEnabled(uri),
      inlineSyntax: this.layers.isInlineSyntaxHighlightEnabled(uri),
    };
  }
}

function isClearChange(change: FragmentStoreChange): boolean {
  return change.reason === "clear" ||
    change.reason === "document-closed" ||
    change.reason === "disabled";
}
