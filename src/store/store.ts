import * as vscode from "vscode";
import type {
  FragmentSnapshot,
  FragmentStoreChange,
  FragmentStoreChangeReason,
  StoredFragment,
} from "./types";

export class Store<Fragment extends StoredFragment = StoredFragment> implements vscode.Disposable {
  private readonly fragmentsChangedEmitter = new vscode.EventEmitter<FragmentStoreChange<Fragment>>();
  private readonly snapshotsByUri = new Map<string, FragmentSnapshot<Fragment>>();

  public readonly onDidChangeFragments = this.fragmentsChangedEmitter.event;

  public setSnapshot(snapshot: FragmentSnapshot<Fragment>): void {
    this.snapshotsByUri.set(createUriKey(snapshot.uri), snapshot);
    this.fragmentsChangedEmitter.fire({
      uri: snapshot.uri,
      version: snapshot.version,
      ranges: snapshot.fragments.map((fragment) => fragment.range),
      fragments: snapshot.fragments,
      reason: "scan",
    });
  }

  public clearDocument(uri: vscode.Uri, reason: FragmentStoreChangeReason = "clear"): void {
    const key = createUriKey(uri);
    const previousSnapshot = this.snapshotsByUri.get(key);

    this.snapshotsByUri.delete(key);
    this.fragmentsChangedEmitter.fire({
      uri,
      version: previousSnapshot?.version ?? 0,
      ranges: [],
      fragments: [],
      reason,
    });
  }

  public getSnapshot(uri: vscode.Uri): FragmentSnapshot<Fragment> | undefined {
    return this.snapshotsByUri.get(createUriKey(uri));
  }

  public getFragments(uri: vscode.Uri): readonly Fragment[] {
    return this.getSnapshot(uri)?.fragments ?? [];
  }

  public findFragmentAt(uri: vscode.Uri, position: vscode.Position): Fragment | undefined {
    return this.getFragments(uri).find((fragment) => containsPosition(fragment.range, position));
  }

  public dispose(): void {
    this.snapshotsByUri.clear();
    this.fragmentsChangedEmitter.dispose();
  }
}

function createUriKey(uri: vscode.Uri): string {
  return uri.toString();
}

function containsPosition(range: vscode.Range, position: vscode.Position): boolean {
  return range.start.isBeforeOrEqual(position) && range.end.isAfter(position);
}
