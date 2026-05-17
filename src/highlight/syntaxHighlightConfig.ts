import * as vscode from "vscode";
import type { JsonTokenDecorationStyles } from "./types";

export const defaultJsonTokenDecorationStyles: JsonTokenDecorationStyles = {
  key: {
    color: new vscode.ThemeColor("editor.foreground"),
  },
  string: {
    color: new vscode.ThemeColor("charts.green"),
  },
  number: {
    color: new vscode.ThemeColor("charts.orange"),
  },
  keyword: {
    color: new vscode.ThemeColor("charts.purple"),
  },
  punctuation: {
    color: new vscode.ThemeColor("descriptionForeground"),
  },
};
