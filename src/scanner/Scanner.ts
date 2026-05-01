import * as vscode from "vscode";
import type { Fragment, ScanLimitReason, ScanResult, ScannerApi, ScannerOptions } from "./types";

export class Scanner implements ScannerApi {
  public constructor(private readonly options: ScannerOptions) {}

  public scanString(value: string): ScanResult {
    return this.scanValue(value, new vscode.Position(0, 0));
  }

  public scanLine(line: vscode.TextLine): ScanResult {
    return this.scanValue(line.text, new vscode.Position(line.lineNumber, 0));
  }

  public format(value: unknown): string {
    return JSON.stringify(value, null, 2) ?? "undefined";
  }

  private scanValue(value: string, startPosition: vscode.Position): ScanResult {
    if (value.length > this.options.maxInputLength) {
      return createTruncatedScanResult("input-too-large");
    }

    const fragments: Fragment[] = [];
    let index = 0;

    while (index < value.length) {
      const character = value[index];

      if (!isOpeningBracket(character)) {
        index += 1;
        continue;
      }

      const endIndex = findBalancedEnd(value, index);

      if (endIndex === undefined) {
        index += 1;
        continue;
      }

      const raw = value.slice(index, endIndex + 1);

      if (raw.length > this.options.maxFragmentLength) {
        return createTruncatedScanResult("fragment-too-large", fragments);
      }

      const parsed = parseJson(raw);

      if (parsed.ok && this.acceptsValue(parsed.value)) {
        if (fragments.length >= this.options.maxFragments) {
          return createTruncatedScanResult("too-many-fragments", fragments);
        }

        fragments.push({
          kind: "source",
          range: createRange(value, index, endIndex + 1, startPosition),
          raw,
          value: parsed.value,
        });

        index = endIndex + 1;
        continue;
      }

      index += 1;
    }

    return {
      fragments,
      truncated: false,
    };
  }

  private acceptsValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return this.options.includePrimitiveArrays || hasNonPrimitiveItem(value);
    }

    return isJsonObject(value);
  }
}

export function createScanner(options: ScannerOptions): Scanner {
  return new Scanner(options);
}

function createTruncatedScanResult(
  reason: ScanLimitReason,
  fragments: Fragment[] = [],
): ScanResult {
  return {
    fragments,
    truncated: true,
    reason,
  };
}

function isOpeningBracket(value: string): value is "{" | "[" {
  return value === "{" || value === "[";
}

function findBalancedEnd(value: string, startIndex: number): number | undefined {
  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      stack.push("}");
      continue;
    }

    if (character === "[") {
      stack.push("]");
      continue;
    }

    if (character !== "}" && character !== "]") {
      continue;
    }

    if (stack.pop() !== character) {
      return undefined;
    }

    if (stack.length === 0) {
      return index;
    }
  }

  return undefined;
}

type ParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    };

function parseJson(value: string): ParseResult {
  try {
    return {
      ok: true,
      value: JSON.parse(value) as unknown,
    };
  } catch {
    return {
      ok: false,
    };
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasNonPrimitiveItem(value: unknown[]): boolean {
  return value.some((item) => typeof item === "object" && item !== null);
}

function createRange(
  value: string,
  startOffset: number,
  endOffset: number,
  startPosition: vscode.Position,
): vscode.Range {
  return new vscode.Range(
    createPosition(value, startOffset, startPosition),
    createPosition(value, endOffset, startPosition),
  );
}

function createPosition(
  value: string,
  offset: number,
  startPosition: vscode.Position,
): vscode.Position {
  let line = startPosition.line;
  let character = startPosition.character;

  for (let index = 0; index < offset; index += 1) {
    if (value[index] === "\n") {
      line += 1;
      character = 0;
      continue;
    }

    character += 1;
  }

  return new vscode.Position(line, character);
}
