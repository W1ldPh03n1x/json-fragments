import * as assert from "assert";
import * as vscode from "vscode";

import { Config, isFileAllowed, readRuntimeSettings } from "../config";
import { createFragmentHoverMarkdown, FragmentHover, FragmentHoverProvider } from "../hover";
import {
  StaticPreviewContentProvider,
  StaticPreviewDefinitionProvider,
  StaticPreviewRegistry,
  type OpenStaticPreviewArgs,
} from "../preview";
import { createScanner, type Fragment, type ScannerOptions } from "../scanner";
import { Store } from "../store";

const defaultOptions: ScannerOptions = {
  includePrimitiveArrays: false,
  includeEmptyObjects: true,
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

  test("finds empty objects by default", () => {
    const result = createScanner(defaultOptions).scanString("INFO empty={}");

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, "{}");
    assert.deepStrictEqual(result.fragments[0].value, {});
  });

  test("ignores empty objects when disabled", () => {
    const result = createScanner({
      ...defaultOptions,
      includeEmptyObjects: false,
    }).scanString('INFO empty={} value={"ok":true}');

    assert.strictEqual(result.fragments.length, 1);
    assert.strictEqual(result.fragments[0].raw, '{"ok":true}');
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

suite("FragmentHoverProvider", () => {
  test("builds Markdown JSON code block", () => {
    const markdown = createFragmentHoverMarkdown([
      "{",
      "  \"ok\": true",
      "}",
    ].join("\n"));

    assert.strictEqual(markdown.isTrusted, false);
    assert.ok(markdown.value.includes("```json"));
    assert.ok(markdown.value.includes("\"ok\": true"));
  });

  test("renders a fragment as VS Code hover", () => {
    const fragment = createScanner(defaultOptions).scanString('INFO {"ok":true}').fragments[0];
    const hover = new FragmentHover(createScanner(defaultOptions)).render(fragment);

    assertHoverContains(hover, "\"ok\": true");
  });

  test("uses current store snapshot when available", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///cached.log", 3, 'INFO {"ok":true}');
    const fragment = createScanner(defaultOptions).scanLine(document.lineAt(0)).fragments[0];

    store.setSnapshot({
      uri: document.uri,
      version: document.version,
      scannedRanges: [document.lineAt(0).range],
      fragments: [fragment],
    });

    const hover = createProvider(store).provideHover(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assertHoverContains(hover, "\"ok\": true");
    store.dispose();
  });

  test("falls back to scanning the hovered line when cache is missing", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///fallback.log", 1, 'INFO {"ok":true}');
    const hover = createProvider(store).provideHover(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assertHoverContains(hover, "\"ok\": true");
    store.dispose();
  });

  test("does not render hover when disabled", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///hover-disabled.log", 1, 'INFO {"ok":true}');
    const hover = createProvider(store, {
      hoverEnabled: false,
    }).provideHover(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assert.strictEqual(hover, undefined);
    store.dispose();
  });

  test("does not render hover for excluded files", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///excluded.log", 1, 'INFO {"ok":true}');
    const hover = createProvider(store, {
      documentAllowed: false,
    }).provideHover(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assert.strictEqual(hover, undefined);
    store.dispose();
  });

  test("ignores stale store snapshot and scans the hovered line", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///stale.log", 2, 'INFO {"fresh":true}');
    const staleFragment = createScanner(defaultOptions).scanLine(
      createTextLine(0, 'INFO {"stale":true}'),
    ).fragments[0];

    store.setSnapshot({
      uri: document.uri,
      version: 1,
      scannedRanges: [staleFragment.range],
      fragments: [staleFragment],
    });

    const hover = createProvider(store).provideHover(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assertHoverContains(hover, "\"fresh\": true");
    store.dispose();
  });
});

suite("Config", () => {
  test("reads domain-scoped settings and builds scanner options", () => {
    const values = new Map<string, unknown>([
      ["hover.enabled", false],
      ["scanner.includePrimitiveArrays", true],
      ["scanner.includeEmptyObjects", false],
      ["files.filterMode", "include"],
      ["files.include", ["**/*.log"]],
      ["files.exclude", ["dev/examples/**"]],
      ["preview.maxOpenStaticPreviews", 3],
      ["tracker.autoHighlightVisibleRanges", true],
      ["tracker.autoHighlightDebounceMs", 250],
      ["tracker.viewportLookaheadRatio", 0.5],
    ]);

    function get<T>(section: string): T | undefined;
    function get<T>(section: string, defaultValue: T): T;
    function get<T>(section: string, defaultValue?: T): T | undefined {
      return (values.get(section) ?? defaultValue) as T | undefined;
    }

    const settings = readRuntimeSettings({ get });

    assert.deepStrictEqual(settings, {
      hover: {
        enabled: false,
      },
      scanner: {
        includePrimitiveArrays: true,
        includeEmptyObjects: false,
      },
      files: {
        filterMode: "include",
        include: ["**/*.log"],
        exclude: ["dev/examples/**"],
      },
      preview: {
        maxOpenStaticPreviews: 3,
      },
      tracker: {
        autoHighlightVisibleRanges: true,
        autoHighlightDebounceMs: 250,
        viewportLookaheadRatio: 0.5,
      },
    });
  });
});

suite("StaticPreviewRegistry", () => {
  test("reuses a preview for the same source identity", () => {
    const registry = new StaticPreviewRegistry();
    const identity = createPreviewIdentity("file:///source.log", 1, 0, 5, 0, 16);
    const first = registry.register(identity, "{\n  \"ok\": true\n}", -1);
    const second = registry.register(identity, "{\n  \"ok\": true\n}", -1);

    assert.strictEqual(first.kind, "created");
    assert.strictEqual(second.kind, "existing");

    assert.strictEqual(first.preview.uri.toString(), second.preview.uri.toString());

    assert.strictEqual(registry.size, 1);
    registry.dispose();
  });

  test("creates separate previews for the same JSON in different source ranges", () => {
    const registry = new StaticPreviewRegistry();
    const first = registry.register(
      createPreviewIdentity("file:///source.log", 1, 0, 5, 0, 16),
      "{\n  \"ok\": true\n}",
      -1,
    );
    const second = registry.register(
      createPreviewIdentity("file:///source.log", 1, 1, 5, 1, 16),
      "{\n  \"ok\": true\n}",
      -1,
    );

    assert.strictEqual(first.kind, "created");
    assert.strictEqual(second.kind, "created");
    assert.strictEqual(registry.size, 2);
    registry.dispose();
  });

  test("does not create new previews when the max is zero", () => {
    const registry = new StaticPreviewRegistry();
    const result = registry.register(
      createPreviewIdentity("file:///source.log", 1, 0, 5, 0, 16),
      "{}",
      0,
    );

    assert.strictEqual(result.kind, "blocked");
    assert.strictEqual(registry.size, 0);
    registry.dispose();
  });

  test("evicts the oldest preview when the max is reached", () => {
    const registry = new StaticPreviewRegistry();
    const first = registry.register(
      createPreviewIdentity("file:///source.log", 1, 0, 5, 0, 16),
      "{\"first\":true}",
      1,
    );
    const second = registry.register(
      createPreviewIdentity("file:///source.log", 1, 1, 5, 1, 17),
      "{\"second\":true}",
      1,
    );

    assert.strictEqual(first.kind, "created");
    assert.strictEqual(second.kind, "created");
    assert.strictEqual(second.evicted.length, 1);
    assert.strictEqual(registry.size, 1);

    assert.strictEqual(registry.getContent(first.preview.uri), undefined);

    registry.dispose();
  });

  test("content provider returns registered preview content", async () => {
    const registry = new StaticPreviewRegistry();
    const provider = new StaticPreviewContentProvider(createConfig(), registry);
    const result = registry.register(
      createPreviewIdentity("file:///source.log", 1, 0, 5, 0, 16),
      "{\n  \"ok\": true\n}",
      -1,
    );

    assert.notStrictEqual(result.kind, "blocked");

    if (result.kind !== "blocked") {
      assert.strictEqual(
        await provider.provideTextDocumentContent(result.preview.uri),
        "{\n  \"ok\": true\n}",
      );
      assert.ok(result.preview.uri.path.includes("source.log:1:6.json"));
    }

    registry.dispose();
  });
});

suite("StaticPreviewDefinitionProvider", () => {
  test("creates a definition link for a cached fragment under the position", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///links.log", 7, 'INFO {"ok":true}');
    const fragment = createScanner(defaultOptions).scanLine(document.lineAt(0)).fragments[0];

    store.setSnapshot({
      uri: document.uri,
      version: document.version,
      scannedRanges: [document.lineAt(0).range],
      fragments: [fragment],
    });

    const links = new StaticPreviewDefinitionProvider(
      createConfig(),
      store,
    ).provideDefinition(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assert.ok(Array.isArray(links));
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].targetUri.scheme, "json-fragments-preview");
    assert.ok(links[0].targetUri.path.includes("links.log:1:6.json"));
    assert.ok(links[0].originSelectionRange?.isEqual(fragment.range));

    store.dispose();
  });

  test("does not create definition links for excluded files", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///excluded.log", 1, 'INFO {"ok":true}');
    const links = new StaticPreviewDefinitionProvider(
      createConfig({
        documentAllowed: false,
      }),
      store,
    ).provideDefinition(
      document,
      new vscode.Position(0, 8),
      createCancellationToken(false),
    );

    assert.strictEqual(links, undefined);
    store.dispose();
  });

  test("does not create definition links outside a fragment", () => {
    const store = new Store<Fragment>();
    const document = createTextDocument("file:///outside.log", 1, 'INFO {"ok":true}');
    const links = new StaticPreviewDefinitionProvider(
      createConfig(),
      store,
    ).provideDefinition(
      document,
      new vscode.Position(0, 1),
      createCancellationToken(false),
    );

    assert.strictEqual(links, undefined);
    store.dispose();
  });
});

suite("File filters", () => {
  test("exclude mode allows files unless they match exclude patterns", () => {
    assert.strictEqual(isFileAllowed("src/extension.ts", {
      filterMode: "exclude",
      include: [],
      exclude: ["dev/examples/**"],
    }), true);
    assert.strictEqual(isFileAllowed("dev/examples/20260429.BigBrother", {
      filterMode: "exclude",
      include: [],
      exclude: ["dev/examples/**"],
    }), false);
  });

  test("include mode allows only matching include patterns", () => {
    assert.strictEqual(isFileAllowed("logs/app.log", {
      filterMode: "include",
      include: ["**/*.log"],
      exclude: [],
    }), true);
    assert.strictEqual(isFileAllowed("src/extension.ts", {
      filterMode: "include",
      include: ["**/*.log"],
      exclude: [],
    }), false);
  });

  test("exclude patterns take priority over include patterns", () => {
    assert.strictEqual(isFileAllowed("logs/private/app.log", {
      filterMode: "include",
      include: ["**/*.log"],
      exclude: ["logs/private/**"],
    }), false);
  });

  test("matches glob paths with slash-normalized input", () => {
    assert.strictEqual(isFileAllowed("dev\\examples\\20260429.BigBrother", {
      filterMode: "exclude",
      include: [],
      exclude: ["**/*.BigBrother"],
    }), false);
  });

  test("allows documents without a comparable file path", () => {
    assert.strictEqual(isFileAllowed(undefined, {
      filterMode: "include",
      include: [],
      exclude: [],
    }), true);
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

function createProvider(
  store: Store<Fragment>,
  options: {
    hoverEnabled?: boolean;
    documentAllowed?: boolean;
  } = {},
): FragmentHoverProvider {
  return new FragmentHoverProvider(createConfig(options), store);
}

function createConfig(options: {
  hoverEnabled?: boolean;
  documentAllowed?: boolean;
  maxOpenStaticPreviews?: number;
} = {}): Config {
  return ({
    scannerOptions: {
      includePrimitiveArrays: defaultOptions.includePrimitiveArrays,
      includeEmptyObjects: defaultOptions.includeEmptyObjects,
    },
    get: (key: string) => {
      if (key === "hover.enabled") {
        return options.hoverEnabled ?? true;
      }

      if (key === "preview.maxOpenStaticPreviews") {
        return options.maxOpenStaticPreviews ?? -1;
      }

      throw new Error(`Unexpected setting key: ${key}`);
    },
    isDocumentAllowed: () => options.documentAllowed ?? true,
  } as unknown) as Config;
}

function createPreviewIdentity(
  sourceUri: string,
  sourceVersion: number,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): OpenStaticPreviewArgs {
  return {
    sourceUri,
    sourceVersion,
    range: {
      start: { line: startLine, character: startCharacter },
      end: { line: endLine, character: endCharacter },
    },
  };
}


function createTextDocument(
  uri: string,
  version: number,
  ...lines: string[]
): vscode.TextDocument {
  return {
    uri: vscode.Uri.parse(uri),
    version,
    lineAt: (line: number) => createTextLine(line, lines[line] ?? ""),
  } as vscode.TextDocument;
}

function createCancellationToken(isCancellationRequested: boolean): vscode.CancellationToken {
  return {
    isCancellationRequested,
    onCancellationRequested: () => ({ dispose: () => {} }),
  };
}

function assertHoverContains(
  hover: vscode.ProviderResult<vscode.Hover>,
  expected: string,
): void {
  assert.ok(hover instanceof vscode.Hover);

  const [content] = hover.contents;

  assert.ok(content instanceof vscode.MarkdownString);
  assert.ok(content.value.includes(expected));
}
