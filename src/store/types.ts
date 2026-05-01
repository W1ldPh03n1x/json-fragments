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

export type CurrentLineSnapshot<Fragment extends StoredFragment = StoredFragment> = {
  uri: vscode.Uri;
  version: number;
  line: number;
  range: vscode.Range;
  fragments: readonly Fragment[];
};

export type CurrentLineChangeReason =
  | "cursor"
  | "document-change"
  | "active-editor"
  | "clear"
  | "document-closed"
  | "disabled";

export type CurrentLineChange<Fragment extends StoredFragment = StoredFragment> = {
  snapshot: CurrentLineSnapshot<Fragment> | undefined;
  reason: CurrentLineChangeReason;
};
