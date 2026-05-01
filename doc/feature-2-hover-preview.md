# Feature 2: Hover Preview

## Current Status

First working implementation exists.

Implemented pieces:

- `src/hover/FragmentHoverProvider.ts` registers the VS Code hover behavior.
- `src/hover/FragmentHover.ts` renders formatted JSON as Markdown.
- `src/extension.ts` wires the hover provider during activation.
- `json-fragments.hover.enabled` controls whether hover preview is active.
- `Store.getSnapshot(uri)` exposes the latest tracked fragment snapshot for a document.
- `Store.findFragmentAt(uri, position)` can find a fragment in the current cached snapshot.
- `Scanner.format(value)` can produce formatted JSON.
- `Scanner.scanLine(line)` can support fallback line scanning.
- `FragmentTracker` keeps store snapshots current for tracked or auto-highlighted visible ranges.

Current limitations:

- fallback lookup scans only the hovered line;
- multiline fragments are not supported yet;
- hover content contains no commands, links, source metadata, or custom controls;
- scanner limits are still configured through hard-coded constants.

## Purpose

Show the JSON fragment under the cursor in a VS Code hover so the user can inspect the fragment without copying it into a separate formatter.

For the MVP, hover preview is read-only and intentionally minimal. It should display only the formatted fragment content. Extra actions, links, metadata, commands, and preview controls are out of scope.

## User Experience

When the user hovers over a detected JSON fragment, VS Code should show a hover popup with the formatted JSON.

Expected MVP behavior:

- hover appears only when the cursor position is inside a detected fragment range;
- hover content is Markdown-compatible;
- the displayed content is the formatted JSON text;
- the JSON should be wrapped in a fenced `json` code block so VS Code can apply Markdown code rendering;
- no buttons, command links, source metadata, or additional descriptions are shown.

Example hover body:

````markdown
```json
{
  "kind": "signal",
  "payload": {
    "id": 1
  }
}
```
````

## Scope

Implemented:

- a VS Code hover provider under the editor integration layer;
- fragment lookup for the current document and hover position;
- Markdown hover content generated from the fragment's formatted JSON;
- focused tests for the hover content builder and provider lookup behavior;
- configuration support for disabling hover;
- file filter support for disabling hover in excluded files.

Do not implement yet:

- hover actions;
- links to static preview tabs;
- dynamic updates while the hover is open;
- custom webviews or custom hover UI;
- recursive deserialization of JSON strings;
- inline syntax coloring inside the source document.

## Data Source

Hover should treat `Store` as a read-through cache of the current fragment model.

If the store has a snapshot for the document and the snapshot version matches the current document version, hover can reuse that snapshot. If no suitable cached snapshot exists, the MVP can scan only the hovered line. This keeps hover responsive without requiring automatic highlighting to be enabled.

Current lookup order:

1. Ask `Store.getSnapshot(document.uri)` for the current document snapshot.
2. If `snapshot.version === document.version`, ask the store for a fragment containing the hover position.
3. If no current cached fragment is found, scan only `document.lineAt(position.line)`.
4. Return the fragment whose range contains the hover position.
5. Return no hover when no fragment is found.

The hover provider should not scan the entire document for a single hover request.

The hover provider should not write fallback line-scan results back into the store for the MVP. The store remains owned by `FragmentTracker`; hover only reads from it.

## Mental Model

`FragmentHoverProvider` answers a single VS Code question:

```text
The user is hovering at position X in document Y. Is there a JSON fragment here?
```

It is a lightweight projection of the fragment model into VS Code's hover API.

It should:

- receive a document and position from VS Code;
- resolve a fragment under that position from the current store snapshot or a local line scan;
- pass the resolved fragment to `FragmentHover` for rendering;
- return a `vscode.Hover` or `undefined`.

It should not:

- enable or disable tracking;
- trigger visible-range scans through `FragmentTracker`;
- manage highlight decorations;
- own document lifecycle state;
- show notifications when no hover can be produced.

The ownership boundaries are:

```text
FragmentTracker
  owns scanner scheduling, visible-range scans, and store snapshots

Store
  owns the latest known fragments per document

HighlightPresenter
  owns rendering tracked fragments as editor decorations

FragmentHoverProvider
  owns answering VS Code hover requests

FragmentHover
  owns converting a Fragment into hover presentation
```

## Markdown Rendering

VS Code hover content accepts `MarkdownString`, so the MVP should build Markdown directly.

Recommended rendering:

- use `new vscode.MarkdownString()`;
- append a fenced `json` code block containing the formatted JSON;
- keep `isTrusted` disabled unless command links are added later;
- avoid raw HTML.

The formatter should come from the scanner/domain layer so hover, static preview, and dynamic preview display JSON consistently.

## Performance and Limits

Hover is latency-sensitive. It should avoid expensive work on every mouse movement.

Use the same conservative limits as scanner/highlighting where possible:

- skip very long lines;
- skip fragments above the configured maximum fragment length;
- avoid full-document scans;
- ignore stale cached fragments when the document version has changed.

If a limit is hit, the hover provider should return no hover instead of showing an error notification.

## Proposed Modules

- `src/hover`: hover provider and fragment-to-hover presentation.
- `src/store`: current snapshot lookup and cached fragment lookup by document URI and position.
- `src/tracking`: background snapshot production through `FragmentTracker`.
- `src/scanner`: fallback line scanning and formatting.
- `src/domain`: shared fragment type and range helpers if needed.

## Implemented Shape

### 1. Hover Content Builder

`FragmentHover` accepts a `Fragment` and returns its VS Code hover presentation.

It produces only a fenced `json` code block for the MVP. Presentation changes should happen in this class without changing fragment lookup or VS Code request handling.

### 2. Fragment Lookup

`FragmentHoverProvider` resolves whether a source position is inside a known fragment range.

Prefer a current store snapshot when available. A snapshot is current only when its stored document version matches the current VS Code document version.

Fall back to scanning the current line when the cache is missing, stale, or does not contain a fragment at the hover position.

### 3. Hover Provider

The extension registers a `vscode.HoverProvider` for file and untitled documents.

The provider should:

- receive the current document and position;
- resolve the fragment under that position;
- delegate presentation to `FragmentHover`;
- avoid writing fallback scan results into the store;
- return `undefined` when there is no fragment;
- return `new vscode.Hover(markdown, fragment.range)` when a fragment is found.

### 4. Activation Wiring

The hover provider is registered during extension activation and its disposable is added to the extension context.

Hover preview should not require the user to enable highlighting first.

## Verification

Manual verification in the extension host:

- hover over a valid JSON object in arbitrary text;
- hover over a valid JSON array in arbitrary text;
- hover outside a fragment and confirm no hover appears;
- hover over a line with multiple fragments and confirm the correct fragment is displayed;
- edit a fragment and confirm stale cached content is not shown;
- confirm the hover contains only formatted JSON.

## Open Decisions

- Whether hover should use every document selector or only known text-like documents.
- Whether line-scan fallback should be controlled by a setting.
- Exact maximum line and fragment sizes for hover fallback scanning.
