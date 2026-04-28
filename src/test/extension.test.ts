import * as assert from "assert";

import { findJsonFragmentsInLine } from "../scanner/findJsonFragmentsInLine";

suite("findJsonFragmentsInLine", () => {
  test("finds an object embedded in text", () => {
    const fragments = findJsonFragmentsInLine('INFO response={"ok":true,"amount":100}');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '{"ok":true,"amount":100}');
    assert.deepStrictEqual(fragments[0].value, { ok: true, amount: 100 });
  });

  test("finds an array embedded in text", () => {
    const fragments = findJsonFragmentsInLine('WARN payload=[{"id":1},{"id":2}]');

    assert.strictEqual(fragments.length, 1);
    assert.strictEqual(fragments[0].raw, '[{"id":1},{"id":2}]');
    assert.deepStrictEqual(fragments[0].value, [{ id: 1 }, { id: 2 }]);
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

  test("finds multiple fragments in one line", () => {
    const fragments = findJsonFragmentsInLine('INFO first={"ok":true} second=[1,2]');

    assert.strictEqual(fragments.length, 2);
    assert.strictEqual(fragments[0].raw, '{"ok":true}');
    assert.strictEqual(fragments[1].raw, "[1,2]");
  });
});
