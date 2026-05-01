import * as assert from "assert";
import * as vscode from "vscode";

import { createScanner, type Fragment, type ScannerOptions } from "../scanner";

const defaultOptions: ScannerOptions = {
  includePrimitiveArrays: false,
  maxInputLength: 10_000,
  maxFragmentLength: 5_000,
  maxFragments: 100,
};

suite("Scanner.scanString", () => {
  test("finds an object embedded in text", () => {
    const result = createScanner(defaultOptions).scanString('INFO response={"ok":true,"amount":100}');

    assert.strictEqual(result.truncated, false);
    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, '{"ok":true,"amount":100}');
    assert.deepStrictEqual(result.fragments[0].value, { ok: true, amount: 100 });
    assertRange(result.fragments[0], 0, 14, 0, 38);
  });

  test("finds an array of objects embedded in text", () => {
    const result = createScanner(defaultOptions).scanString('WARN payload=[{"id":1},{"id":2}]');

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, '[{"id":1},{"id":2}]');
    assert.deepStrictEqual(result.fragments[0].value, [{ id: 1 }, { id: 2 }]);
  });

  test("finds an array of arrays embedded in text", () => {
    const result = createScanner(defaultOptions).scanString("WARN payload=[[1],[2]]");

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, "[[1],[2]]");
    assert.deepStrictEqual(result.fragments[0].value, [[1], [2]]);
  });

  test("finds multiple fragments in one line", () => {
    const result = createScanner(defaultOptions).scanString('INFO first={"ok":true} second={"id":1}');

    assert.strictEqual(result.fragments.length, 2);
    assert.strictEqual(result.fragments[0].raw, '{"ok":true}');
    assert.strictEqual(result.fragments[1].raw, '{"id":1}');
  });

  test("ignores invalid JSON candidates", () => {
    const result = createScanner(defaultOptions).scanString("BAD value={not valid json}");

    assert.strictEqual(result.fragments.length, 0);
  });

  test("handles nested objects and arrays as one outer fragment", () => {
    const result = createScanner(defaultOptions).scanString('INFO response={"ok":true,"data":{"items":[{"id":1}]}} done');

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, '{"ok":true,"data":{"items":[{"id":1}]}}');
    assert.deepStrictEqual(result.fragments[0].value, {
      ok: true,
      data: {
        items: [{ id: 1 }],
      },
    });
  });

  test("does not return internal objects as separate fragments", () => {
    const result = createScanner(defaultOptions).scanString('prefix {"a":{"b":1}} suffix');

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, '{"a":{"b":1}}');
  });

  test("ignores braces and brackets inside strings", () => {
    const result = createScanner(defaultOptions).scanString('INFO payload={"message":"look at {this} and [that]"}');

    assert.strictEqual(result.fragments.length, 1);
    assert.deepStrictEqual(result.fragments[0].value, {
      message: "look at {this} and [that]",
    });
  });

  test("handles escaped quotes and backslashes inside strings", () => {
    const result = createScanner(defaultOptions).scanString('INFO payload={"message":"say \\"hello\\"","path":"C:\\\\temp"}');

    assert.strictEqual(result.fragments.length, 1);
    assert.deepStrictEqual(result.fragments[0].value, {
      message: 'say "hello"',
      path: "C:\\temp",
    });
  });

  test("keeps serialized JSON string values as strings", () => {
    const result = createScanner(defaultOptions).scanString('INFO payload={"payload":"{\\"user\\":{\\"id\\":1}}"}');

    assert.strictEqual(result.fragments.length, 1);
    assert.deepStrictEqual(result.fragments[0].value, {
      payload: "{\"user\":{\"id\":1}}",
    });
  });

  test("finds JSON object wrapped in plain quotes", () => {
    const result = createScanner(defaultOptions).scanString(
      '"{"type":"signal","payload":{"signal":"main_menu","payload":null,"searchParams":""}}"',
    );

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(
      result.fragments[0].raw,
      '{"type":"signal","payload":{"signal":"main_menu","payload":null,"searchParams":""}}',
    );
    assert.deepStrictEqual(result.fragments[0].value, {
      type: "signal",
      payload: {
        signal: "main_menu",
        payload: null,
        searchParams: "",
      },
    });
    assertRange(result.fragments[0], 0, 1, 0, 84);
  });

  test("ignores primitive arrays by default", () => {
    const result = createScanner(defaultOptions).scanString('INFO empty=[] values=[1,"two",true,false,null]');

    assert.strictEqual(result.fragments.length, 0);
  });

  test("finds primitive arrays when enabled", () => {
    const result = createScanner({
      ...defaultOptions,
      includePrimitiveArrays: true,
    }).scanString('INFO empty=[] values=[1,"two",true,false,null]');

    assert.strictEqual(result.fragments.length, 2);
    assert.strictEqual(result.fragments[0].raw, "[]");
    assert.strictEqual(result.fragments[1].raw, '[1,"two",true,false,null]');
  });

  test("reports input limit", () => {
    const result = createScanner({
      ...defaultOptions,
      maxInputLength: 3,
    }).scanString('{"ok":true}');

    assert.strictEqual(result.truncated, true);
    assert.strictEqual(result.reason, "input-too-large");
    assert.strictEqual(result.fragments.length, 0);
  });

  test("formats JSON values", () => {
    const scanner = createScanner(defaultOptions);

    assert.strictEqual(scanner.format({ ok: true }), [
      "{",
      "  \"ok\": true",
      "}",
    ].join("\n"));
  });
});

suite("Scanner.scanLine", () => {
  test("returns ranges in document line coordinates", () => {
    const result = createScanner(defaultOptions).scanLine(createTextLine(12, 'INFO {"ok":true}'));

    assert.strictEqual(result.fragments.length, 1);
    assertRange(result.fragments[0], 12, 5, 12, 16);
  });
});

function assertRange(
  fragment: Fragment,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): void {
  assert.strictEqual(fragment.range.start.line, startLine);
  assert.strictEqual(fragment.range.start.character, startCharacter);
  assert.strictEqual(fragment.range.end.line, endLine);
  assert.strictEqual(fragment.range.end.character, endCharacter);
}

function createTextLine(lineNumber: number, text: string): vscode.TextLine {
  const range = new vscode.Range(lineNumber, 0, lineNumber, text.length);

  return {
    lineNumber,
    text,
    range,
    rangeIncludingLineBreak: range,
    firstNonWhitespaceCharacterIndex: text.search(/\S/),
    isEmptyOrWhitespace: text.trim().length === 0,
  };
}
