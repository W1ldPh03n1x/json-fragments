import * as vscode from "vscode";

export type TextRange = {
  range: vscode.Range;
};

export type FragmentDecorationStyle = {
  borderColor: vscode.ThemeColor;
  backgroundColor?: vscode.ThemeColor;
  overviewRulerColor?: vscode.ThemeColor;
  borderRadius?: string;
};

export const defaultFragmentDecorationStyle: FragmentDecorationStyle = {
  borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
  backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
  overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.findMatchForeground"),
  borderRadius: "2px",
};
