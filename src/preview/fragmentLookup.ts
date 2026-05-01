import * as vscode from "vscode";
import { scannerLimits, type Config } from "../config";
import { createScanner, type Fragment } from "../scanner";
import type { Store } from "../store";

export function findFragmentForPosition(
  config: Config,
  store: Store<Fragment>,
  document: vscode.TextDocument,
  position: vscode.Position,
): Fragment | undefined {
  const currentCachedFragment = findCurrentCachedFragment(store, document, position);

  if (currentCachedFragment !== undefined) {
    return currentCachedFragment;
  }

  const lineFragments = scanDocumentLine(config, document, position.line);

  return lineFragments.find((fragment) => containsPosition(fragment.range, position)) ??
    lineFragments[0];
}

export function findFragmentContainingPosition(
  config: Config,
  store: Store<Fragment>,
  document: vscode.TextDocument,
  position: vscode.Position,
): Fragment | undefined {
  const currentCachedFragment = findCurrentCachedFragment(store, document, position);

  if (currentCachedFragment !== undefined) {
    return currentCachedFragment;
  }

  return scanDocumentLine(config, document, position.line)
    .find((fragment) => containsPosition(fragment.range, position));
}

export function findFragmentByRange(
  config: Config,
  document: vscode.TextDocument,
  range: vscode.Range,
): Fragment | undefined {
  if (!isSingleLineRange(range)) {
    return undefined;
  }

  return scanDocumentLine(config, document, range.start.line)
    .find((fragment) => rangesEqual(fragment.range, range));
}

export function getLinkableFragments(
  config: Config,
  store: Store<Fragment>,
  document: vscode.TextDocument,
): readonly Fragment[] {
  const snapshot = store.getSnapshot(document.uri);

  if (snapshot?.version === document.version) {
    return snapshot.fragments;
  }

  return getVisibleDocumentLines(document)
    .flatMap((lineNumber) => scanDocumentLine(config, document, lineNumber));
}

export function scanDocumentLine(
  config: Config,
  document: vscode.TextDocument,
  lineNumber: number,
): Fragment[] {
  return createScanner({
    ...config.scannerOptions,
    ...scannerLimits,
  }).scanLine(document.lineAt(lineNumber)).fragments;
}

function findCurrentCachedFragment(
  store: Store<Fragment>,
  document: vscode.TextDocument,
  position: vscode.Position,
): Fragment | undefined {
  const snapshot = store.getSnapshot(document.uri);

  if (snapshot?.version !== document.version) {
    return undefined;
  }

  return store.findFragmentAt(document.uri, position);
}

function getVisibleDocumentLines(document: vscode.TextDocument): number[] {
  const lineNumbers = new Set<number>();

  for (const editor of vscode.window.visibleTextEditors) {
    if (editor.document.uri.toString() !== document.uri.toString()) {
      continue;
    }

    for (const visibleRange of editor.visibleRanges) {
      for (
        let lineNumber = visibleRange.start.line;
        lineNumber <= visibleRange.end.line;
        lineNumber += 1
      ) {
        lineNumbers.add(lineNumber);
      }
    }
  }

  return [...lineNumbers].sort((left, right) => left - right);
}

function containsPosition(range: vscode.Range, position: vscode.Position): boolean {
  return range.start.isBeforeOrEqual(position) && range.end.isAfter(position);
}

function isSingleLineRange(range: vscode.Range): boolean {
  return range.start.line === range.end.line;
}

function rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
  return left.start.isEqual(right.start) && left.end.isEqual(right.end);
}
