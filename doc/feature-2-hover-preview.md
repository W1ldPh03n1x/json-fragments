# Feature 2: Hover Preview

## Current Status

Planned. No hover provider is implemented yet.

Relevant existing pieces:

- `Store.findFragmentAt(uri, position)` can find cached fragments for highlighted documents.
- `Scanner.format(value)` can produce formatted JSON.
- `Scanner.scanLine(line)` can support fallback line scanning.
- `FragmentTracker` keeps store snapshots current for tracked or auto-highlighted visible ranges.

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

Implement:

- a VS Code hover provider under the editor integration layer;
- fragment lookup for the current document and hover position;
- Markdown hover content generated from the fragment's formatted JSON;
- focused tests for the hover content builder if it is kept separate from VS Code provider wiring.

Do not implement yet:

- hover actions;
- links to static preview tabs;
- dynamic updates while the hover is open;
- custom webviews or custom hover UI;
- recursive deserialization of JSON strings;
- inline syntax coloring inside the source document.

## Data Source

Hover should reuse scanner results from highlighting when they are available and current for the document version.

If no suitable cached result exists, the MVP can scan only the hovered line. This keeps hover responsive without requiring automatic highlighting to be enabled.

Recommended lookup order:

1. Ask the per-document fragment cache for a fragment containing the hover position.
2. If no cached fragment is found, scan the current line.
3. Return the fragment whose range contains the hover position.
4. Return no hover when no fragment is found.

The hover provider should not scan the entire document for a single hover request.

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

- `src/hover`: hover provider and VS Code `MarkdownString` integration.
- `src/store`: fragment cache lookup by document URI, version, and position.
- `src/scanner`: fallback line scanning and formatting.
- `src/domain`: shared fragment type and range helpers if needed.

## Implementation Plan

### 1. Hover Content Builder

Create a small function that accepts formatted JSON text and returns Markdown hover content.

It should produce only a fenced `json` code block for the MVP.

### 2. Fragment Lookup

Add a lookup helper that checks whether a source position is inside a known fragment range.

Prefer cached fragments from highlighting when available. Fall back to scanning the current line when cache is missing or stale.

### 3. Hover Provider

Register a `vscode.HoverProvider` for the same broad document set as highlighting.

The provider should:

- receive the current document and position;
- resolve the fragment under that position;
- return `undefined` when there is no fragment;
- return `new vscode.Hover(markdown, fragment.range)` when a fragment is found.

### 4. Activation Wiring

Register the hover provider during extension activation and add its disposable to the extension context.

Hover preview should not require the user to enable highlighting first.

### 5. Verification

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
