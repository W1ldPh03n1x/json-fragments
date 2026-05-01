import * as vscode from "vscode";

export type StoredFragment = {
  range: vscode.Range;
};

export type FragmentSnapshot<Fragment extends StoredFragment = StoredFragment> = {
  uri: vscode.Uri;
  version: number;
  scannedRanges: readonly vscode.Range[];
  fragments: readonly Fragment[];
};

export type FragmentStoreChangeReason =
  | "scan"
  | "clear"
  | "document-closed"
  | "disabled";

export type FragmentStoreChange<Fragment extends StoredFragment = StoredFragment> = {
  uri: vscode.Uri;
  version: number;
  ranges: readonly vscode.Range[];
  fragments: readonly Fragment[];
  reason: FragmentStoreChangeReason;
};
