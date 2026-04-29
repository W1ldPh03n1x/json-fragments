import * as assert from "assert";

import { formatJsonFragmentsAsMarkdown } from "../markdown/jsonFragmentMarkdown";
import { findJsonFragmentsInLine } from "../scanner/findJsonFragmentsInLine";

suite("findJsonFragmentsInLine", () => {
  test("finds an object embedded in text", () => {
    const fragments = findJsonFragmentsInLine('INFO response={"ok":true,"amount":100}');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '{"ok":true,"amount":100}');
    assert.deepStrictEqual(fragments[0].value, { ok: true, amount: 100 });
  });

  test("finds an array of objects embedded in text", () => {
    const fragments = findJsonFragmentsInLine('WARN payload=[{"id":1},{"id":2}]');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '[{"id":1},{"id":2}]');
    assert.deepStrictEqual(fragments[0].value, [{ id: 1 }, { id: 2 }]);
  });

  test("finds an array of arrays embedded in text", () => {
    const fragments = findJsonFragmentsInLine("WARN payload=[[1],[2]]");

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, "[[1],[2]]");
    assert.deepStrictEqual(fragments[0].value, [[1], [2]]);
  });

  test("ignores invalid JSON candidates", () => {
    const fragments = findJsonFragmentsInLine("BAD value={not valid json}");

    assert.strictEqual(fragments.length, 0);
  });

  test("handles nested objects and arrays", () => {
    const fragments = findJsonFragmentsInLine('INFO response={"ok":true,"data":{"items":[{"id":1}]}} done');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '{"ok":true,"data":{"items":[{"id":1}]}}');
    assert.deepStrictEqual(fragments[0].value, {
      ok: true,
      data: {
        items: [{ id: 1 }],
      },
    });
  });

  test("ignores braces and brackets inside strings", () => {
    const fragments = findJsonFragmentsInLine('INFO payload={"message":"look at {this} and [that]"}');

    assert.strictEqual(fragments.length, 1);
    assert.deepStrictEqual(fragments[0].value, {
      message: "look at {this} and [that]",
    });
  });

  test("handles escaped quotes and backslashes inside strings", () => {
    const fragments = findJsonFragmentsInLine('INFO payload={"message":"say \\"hello\\"","path":"C:\\\\temp"}');

    assert.strictEqual(fragments.length, 1);
    assert.deepStrictEqual(fragments[0].value, {
      message: 'say "hello"',
      path: "C:\\temp",
    });
  });

  test("recovers quoted nested json values in log payloads", () => {
    const fragments = findJsonFragmentsInLine(
      `[20251128:141700.117][main][9]SetScrResult::eval: current_screen.call('on_timeout', '{"buttonName": "","input": {"qrOnboarding": "", "popUpRefInfo": "", "fpsCounter": "60&59.8&60"},"list": {},"modalMessageSelected": "-1","clientActivityTimeout": true,"ext": "","error": "{"exist": false, "message": ""}"}')`,
    );

    assert.strictEqual(fragments.length, 1);
    assert.deepStrictEqual(fragments[0].value, {
      buttonName: "",
      input: {
        qrOnboarding: "",
        popUpRefInfo: "",
        fpsCounter: "60&59.8&60",
      },
      list: {},
      modalMessageSelected: "-1",
      clientActivityTimeout: true,
      ext: "",
      error: {
        exist: false,
        message: "",
      },
    });
  });

  test("ignores primitive arrays by default", () => {
    const fragments = findJsonFragmentsInLine('INFO empty=[] values=[1,"two",true,false,null]');

    assert.strictEqual(fragments.length, 0);
  });

  test("ignores empty objects", () => {
    const fragments = findJsonFragmentsInLine("INFO empty={} nested={\"data\":{}}");

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '{"data":{}}');
  });

  test("finds primitive arrays when enabled", () => {
    const fragments = findJsonFragmentsInLine('INFO empty=[] values=[1,"two",true,false,null]', {
      includePrimitiveArrays: true,
    });

    assert.strictEqual(fragments.length, 2);
    assert.strictEqual(fragments[0].raw, "[]");
    assert.strictEqual(fragments[1].raw, '[1,"two",true,false,null]');
  });

  test("finds multiple non-primitive fragments in one line", () => {
    const fragments = findJsonFragmentsInLine('INFO first={"ok":true} second=[1,2]');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '{"ok":true}');
  });
});

suite("jsonFragmentMarkdown", () => {
  test("formats fragments as json markdown code fences", () => {
    const markdown = formatJsonFragmentsAsMarkdown([
      { value: { ok: true } },
      { value: [{ id: 1 }] },
    ]);

    assert.strictEqual(markdown, [
      "```json",
      "{",
      "  \"ok\": true",
      "}",
      "```",
      "",
      "```json",
      "[",
      "  {",
      "    \"id\": 1",
      "  }",
      "]",
      "```",
    ].join("\n"));
  });
});
