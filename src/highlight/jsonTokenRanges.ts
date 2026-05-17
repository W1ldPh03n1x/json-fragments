import * as vscode from "vscode";
import type { Fragment } from "../scanner";

export type JsonTokenKind =
  | "key"
  | "string"
  | "number"
  | "keyword"
  | "punctuation";

export type JsonTokenRange = {
  kind: JsonTokenKind;
  range: vscode.Range;
};

export function collectJsonTokenRanges(fragments: readonly Fragment[]): JsonTokenRange[] {
  return fragments.flatMap((fragment) => collectFragmentTokenRanges(fragment));
}

function collectFragmentTokenRanges(fragment: Fragment): JsonTokenRange[] {
  const tokens: JsonTokenRange[] = [];
  let index = 0;

  while (index < fragment.raw.length) {
    const character = fragment.raw[index];

    if (isWhitespace(character)) {
      index += 1;
      continue;
    }

    if (character === "\"") {
      const endIndex = findStringEnd(fragment.raw, index);

      if (endIndex === undefined) {
        break;
      }

      tokens.push(createTokenRange(
        isObjectKey(fragment.raw, endIndex + 1) ? "key" : "string",
        fragment.raw,
        index,
        endIndex + 1,
        fragment.range.start,
      ));
      index = endIndex + 1;
      continue;
    }

    if (isNumberStart(character)) {
      const endIndex = findNumberEnd(fragment.raw, index);

      tokens.push(createTokenRange("number", fragment.raw, index, endIndex, fragment.range.start));
      index = endIndex;
      continue;
    }

    if (startsWithKeyword(fragment.raw, index, "true")) {
      tokens.push(createTokenRange("keyword", fragment.raw, index, index + 4, fragment.range.start));
      index += 4;
      continue;
    }

    if (startsWithKeyword(fragment.raw, index, "false")) {
      tokens.push(createTokenRange("keyword", fragment.raw, index, index + 5, fragment.range.start));
      index += 5;
      continue;
    }

    if (startsWithKeyword(fragment.raw, index, "null")) {
      tokens.push(createTokenRange("keyword", fragment.raw, index, index + 4, fragment.range.start));
      index += 4;
      continue;
    }

    if (isPunctuation(character)) {
      tokens.push(createTokenRange("punctuation", fragment.raw, index, index + 1, fragment.range.start));
    }

    index += 1;
  }

  return tokens;
}

function findStringEnd(value: string, startIndex: number): number | undefined {
  let isEscaped = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    const character = value[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === "\\") {
      isEscaped = true;
      continue;
    }

    if (character === "\"") {
      return index;
    }
  }

  return undefined;
}

function findNumberEnd(value: string, startIndex: number): number {
  let index = startIndex;

  while (index < value.length && /[0-9.eE+-]/.test(value[index])) {
    index += 1;
  }

  return index;
}

function isObjectKey(value: string, afterStringIndex: number): boolean {
  let index = afterStringIndex;

  while (index < value.length && isWhitespace(value[index])) {
    index += 1;
  }

  return value[index] === ":";
}

function startsWithKeyword(value: string, index: number, keyword: string): boolean {
  return value.slice(index, index + keyword.length) === keyword &&
    !isIdentifierCharacter(value[index + keyword.length]);
}

function createTokenRange(
  kind: JsonTokenKind,
  value: string,
  startOffset: number,
  endOffset: number,
  startPosition: vscode.Position,
): JsonTokenRange {
  return {
    kind,
    range: new vscode.Range(
      createPosition(value, startOffset, startPosition),
      createPosition(value, endOffset, startPosition),
    ),
  };
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

function isWhitespace(value: string | undefined): boolean {
  return value === " " || value === "\t" || value === "\n" || value === "\r";
}

function isNumberStart(value: string | undefined): boolean {
  return value === "-" || (value !== undefined && value >= "0" && value <= "9");
}

function isPunctuation(value: string | undefined): boolean {
  return value === "{" || value === "}" ||
    value === "[" || value === "]" ||
    value === ":" || value === ",";
}

function isIdentifierCharacter(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z0-9_$]/.test(value);
}
