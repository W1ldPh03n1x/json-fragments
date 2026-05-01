import * as vscode from "vscode";

export type FragmentKind = "source";

export type Fragment = {
  kind: FragmentKind;
  range: vscode.Range;
  raw: string;
  value: unknown;
};

export type ScanLimitReason =
  | "input-too-large"
  | "fragment-too-large"
  | "too-many-fragments";

export type ScanResult = {
  fragments: Fragment[];
  truncated: boolean;
  reason?: ScanLimitReason;
};

export type ScannerOptions = {
  includePrimitiveArrays: boolean;
  maxInputLength: number;
  maxFragmentLength: number;
  maxFragments: number;
};

export type ScannerApi = {
  scanString(value: string): ScanResult;
  scanLine(line: vscode.TextLine): ScanResult;
  format(value: unknown): string;
};
