# Feature 1: Inline Fragment Highlighting

## Current Status

The first working version is implemented.

Implemented modules:

- `src/tracking/FragmentTracker.ts`: scan orchestration and command-facing behavior.
- `src/store`: per-document fragment snapshots and change events.
- `src/highlight/HighlightPresenter.ts`: translates store changes into decoration updates.
- `src/highlight/TextDecorator.ts`: owns VS Code decoration types and applies ranges.
- `src/config/constants.ts`: current scanner limits.

Current limitations:

- expanded visible ranges are scanned line by line;
- multiline fragments are not highlighted yet;
- range hysteresis is not implemented;
- scan limits are constants, not user settings;
- `openLineJsonFragmentsPreview` is contributed but not implemented.

## Purpose

Highlight JSON fragments directly inside the source editor so the user can quickly see which parts of arbitrary text are valid JSON fragments and can be inspected further.

This is the first main user-facing feature. It should feel stable while scrolling, avoid unnecessary work on large files, and produce scanner results that later features can reuse for hover and click interactions.

## User Experience

The user should be able to:

- enable highlighting for the active file through a command;
- disable highlighting for the active file through the same command;
- optionally enable temporary highlighting for focused files;
- optionally enable automatic highlighting for visible editor ranges;
- see highlighted fragments without distracting flicker while scrolling.

Highlighting should be subtle by default. It should make valid fragments discoverable without making the source file hard to read.

## Viewport Scanning

By default, automatic scanning scans exactly the visible editor ranges.

The `json-fragments.viewportLookaheadRatio` setting adds viewport scan padding. When it is greater than `0`, the extension scans additional lines above and below the visible viewport.

Current behavior:

- default padding: `0`;
- `0.5`: scan half a viewport above and half a viewport below;
- `1`: scan one viewport above and one viewport below;
- values are bounded to the `0..1` range.

This keeps the default behavior simple and predictable, while allowing smoother scrolling for users who want it.

## Why Padding Helps

If scanning happens only inside the exact visible viewport, small scroll movements can cause fragments at the viewport boundary to appear and disappear immediately.

Scanning a buffer around the viewport reduces visible flicker because fragments near the next scroll position are already detected and decorated before they enter the screen.

## Additional Ideas

### Range Hysteresis

Keep the previously scanned range until the viewport moves far enough outside it.

Example:

- scan visible range plus padding;
- do not rescan on every small scroll if the current visible range is still inside the previously scanned padded range;
- rescan only when the viewport approaches the edge of the cached scan range.

This can reduce work and further reduce flicker.

### Debounced Scanning

Debounce scanning after scroll, text change, and active editor changes.

Use the existing `autoHighlightDebounceMs` setting as the main control. Default `100ms` is reasonable for the first version.

### Versioned Results

Track the document version for every scan request.

If a scan finishes after the document has changed, ignore the stale result. This prevents old decorations from being applied over newer text.

### Per-Document Cache

Cache fragments by document URI and scanned range.

The cache should support:

- finding fragments for hover and click features later;
- clearing results when a document closes;
- invalidating results when the document version changes;
- keeping only recent or relevant ranges to avoid memory growth.

### Scan Limits

Add conservative limits before scanning:

- maximum line length;
- maximum total characters per scan;
- maximum fragment length;
- maximum fragments per scan.

When a limit is hit, skip expensive work rather than blocking the editor.

### Manual Command Should Always Work Locally

The manual command for the active file should not require automatic visible-range highlighting to be enabled.

Possible command behavior:

- if highlighting is off for the active file, turn it on and scan visible ranges;
- if highlighting is on for the active file, turn it off and clear decorations for that file.

### Decoration Separation

Use separate decoration types for:

- whole-fragment highlight;
- future inline JSON token highlighting.

This keeps the first version simple and avoids mixing range discovery with detailed syntax coloring.

### Status and Failure Feedback

Avoid noisy notifications during normal scanning.

Possible lightweight feedback:

- status bar item only when highlighting is active;
- output channel messages for debugging;
- silent skip when scan limits are exceeded.

### Language and File Filtering

Do not restrict the feature to JSON files. The main value is finding JSON inside arbitrary files.

Optional later settings:

- excluded language IDs;
- excluded glob patterns;
- maximum file size.

## Proposed Settings

Existing settings:

- `json-fragments.autoHighlightVisibleRanges`;
- `json-fragments.includePrimitiveArrays`;
- `json-fragments.autoHighlightDebounceMs`.
- `json-fragments.viewportLookaheadRatio`.

New settings to consider:

- `json-fragments.maxScanCharacters`: default to a conservative value;
- `json-fragments.maxLineLength`: default to a conservative value;
- `json-fragments.maxFragmentsPerScan`: default to a conservative value.

## Proposed Modules

- `src/scanner`: scanner and fragment range model.
- `src/domain`: shared fragment domain types.
- `src/tracking`: viewport scan orchestration.
- `src/highlight`: editor decoration presentation and rendering.
- `src/store`: per-document highlighting state and fragment cache.
- `src/config`: settings access.
- `src/extension.ts`: command registration and provider wiring.

## Architecture

Inline highlighting should be split into scanning, state, presentation, and decoration rendering.

The decoration layer must not scan documents, parse JSON, handle hover behavior, or decide when scanning should happen. It should only render text decorations for already known ranges.

Recommended flow:

```text
VS Code events
  -> FragmentTracker
  -> Scanner
  -> Store
  -> HighlightPresenter
  -> TextDecorator
  -> editor.setDecorations(...)
```

### FragmentTracker

The tracker owns editor lifecycle orchestration.

Responsibilities:

- react to active editor, visible range, document change, configuration change, and document close events;
- decide whether highlighting is enabled for a document;
- debounce scan requests;
- build scan ranges from the current visible editor ranges;
- call the scanner;
- ignore stale scan results when the document version has changed;
- write accepted fragments into `Store`;
- clear the store when highlighting is disabled or a document is closed.

It must not call `editor.setDecorations` directly.

### Store

The main fragment store is the source of truth for current fragments and their ranges.

It should store snapshots by document URI:

```ts
type FragmentSnapshot = {
  uri: vscode.Uri;
  version: number;
  scannedRanges: readonly vscode.Range[];
  fragments: readonly Fragment[];
};
```

The store should expose a change event so presentation code, hover providers, preview features, and other integrations can react when fragments change:

```ts
type FragmentStoreChangeReason =
  | "scan"
  | "clear"
  | "document-closed"
  | "disabled";

type FragmentStoreChange = {
  uri: vscode.Uri;
  version: number;
  ranges: readonly vscode.Range[];
  fragments: readonly Fragment[];
  reason: FragmentStoreChangeReason;
};
```

Expected API shape:

```ts
class Store {
  readonly onDidChangeFragments: vscode.Event<FragmentStoreChange>;

  setSnapshot(snapshot: FragmentSnapshot): void;
  clearDocument(uri: vscode.Uri, reason: FragmentStoreChangeReason): void;
  getSnapshot(uri: vscode.Uri): FragmentSnapshot | undefined;
  findFragmentAt(uri: vscode.Uri, position: vscode.Position): Fragment | undefined;
}
```

The store should keep complete fragments, not just ranges, because hover and click features will need `raw` and parsed `value` later.

### HighlightPresenter

The presenter connects range state to editor decoration rendering.

Responsibilities:

- listen to `Store.onDidChangeFragments`;
- find visible editors that show the changed document URI;
- call `TextDecorator.render(editor, ranges)` for range updates;
- call `TextDecorator.clear(editor)` for clear events.

This keeps `TextDecorator` independent from the store and keeps the store independent from VS Code decoration APIs.

### TextDecorator

`TextDecorator` is the only entity that owns VS Code text decoration types.

Responsibilities:

- create and dispose `vscode.TextEditorDecorationType`;
- render a full range snapshot into a specific `vscode.TextEditor`;
- clear decorations for a specific editor;
- recreate decoration types when decoration style settings change;
- keep the last rendered ranges for visible editors so style changes can be reapplied without rescanning.

It should be deliberately small:

```ts
class TextDecorator implements vscode.Disposable {
  setStyle(style: FragmentDecorationStyle): void;
  render(editor: vscode.TextEditor, ranges: readonly vscode.Range[]): void;
  clear(editor: vscode.TextEditor): void;
  clearDocument(uri: vscode.Uri): void;
  dispose(): void;
}
```

It should not know that the ranges represent JSON fragments. The same mechanism should be reusable for other text range decorations if needed.

### Decoration Style

Highlight appearance should be described separately from rendering and scanning.

Example shape:

```ts
type FragmentDecorationStyle = {
  borderColor: vscode.ThemeColor;
  backgroundColor?: vscode.ThemeColor;
  overviewRulerColor?: vscode.ThemeColor;
  borderRadius?: string;
};
```

The first version can hard-code a subtle default style, but the style should still flow through a dedicated style provider or factory. This keeps future settings and theme-aware changes local to decoration code.

Prefer `vscode.ThemeColor` tokens where possible so VS Code can adapt colors when the active theme changes. If extension settings change the decoration shape itself, recreate the decoration type and re-render the last known ranges.

### Redraw Strategy

For the MVP, redraw the full range snapshot for the affected editor and decoration type.

VS Code decorations are naturally applied as a replacement set:

```ts
editor.setDecorations(decorationType, ranges);
```

This means incremental add/remove logic is not required for the first version. Full snapshot rendering is simpler and avoids local diff bugs around document edits, stale ranges, and overlapping updates.

Incremental updates can be considered later only if full snapshot rendering becomes a measured performance problem.

## Implementation Plan

### 1. Scanner Foundation

Status: implemented.

Implement and test the domain scanner described in `doc/step-1-fragment-detection.md`.

The editor feature should depend on this scanner instead of parsing JSON directly in VS Code integration code.

### 2. Highlight State and Range Store

Status: implemented as `Store`.

Track per-document state:

- whether highlighting is enabled for the document;
- last scanned document version;
- last scanned ranges;
- current fragments;
- active decoration ranges.

Expose range changes through a store event so decoration rendering can update without being coupled to scanning.

### 3. Text Decorator

Status: implemented.

Create a small editor rendering integration that:

- owns `TextEditorDecorationType`;
- receives already computed `vscode.Range` values;
- applies decorations to a specific editor;
- clears decorations when highlighting is disabled or the document closes;
- recreates decoration types when style settings change.

It should not scan, parse, subscribe to scanner events, or contain hover behavior.

### 4. Viewport Range Builder

Status: partially implemented.

Current behavior expands `editor.visibleRanges` with `viewportLookaheadRatio`, clamps them to document boundaries, converts the expanded ranges into unique line numbers, and scans those lines. It does not merge overlapping padded ranges or use hysteresis yet.

Create logic that converts `editor.visibleRanges` into scan ranges.

It should:

- merge overlapping visible ranges;
- avoid rescanning when the visible range is still covered by the cached padded range.

### 5. Event Wiring and Presentation

Status: implemented for highlighting.

Use `FragmentTracker` to update range state on:

- active editor change;
- visible range change;
- text document change;
- configuration change;
- document close.

Use debouncing for scroll and document change events.

Use a presenter to listen to range store changes and forward the latest range snapshots to `TextDecorator`.

### 6. Commands

Status: partially implemented.

Implement command behavior:

- `json-fragments.toggleHighlightForFile`;
- `json-fragments.toggleTemporaryHighlightForFocusedFiles`;
- `json-fragments.scanVisibleJsonFragments`.

The scan command should be useful for debugging and for users who do not want automatic highlighting.

Current behavior:

- `toggleHighlightForFile` toggles tracking for the active editor document.
- `toggleTemporaryHighlightForFocusedFiles` toggles tracking that follows focused editors.
- `scanVisibleJsonFragments` scans the active editor once without adding it to tracked documents.

### 7. Verification

Status: scanner tests exist. Dedicated tracker/highlight tests are still missing.

Add tests for scanner and range calculation.

Manual verification in the extension host:

- highlight one fragment in a visible line;
- highlight multiple fragments in one line;
- scroll slowly around viewport boundaries with padding `0`;
- scroll slowly around viewport boundaries with padding `0.5`;
- edit a highlighted line and confirm stale decorations disappear;
- disable highlighting and confirm decorations clear.

## Open Decisions

- Exact decoration style for the whole-fragment highlight.
- Whether to keep cached fragments only for the active editor or for every highlighted document.
- Whether scan-limit skips should be completely silent or visible in a debug output channel.
