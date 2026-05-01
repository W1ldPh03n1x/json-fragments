# Feature 1: Inline Fragment Highlighting

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

By default, automatic scanning should scan exactly the visible editor ranges.

Add a separate setting for viewport scan padding. When enabled, the extension scans additional lines above and below the visible viewport.

Proposed behavior:

- default padding: `0`;
- optional padding mode: scan half a viewport above and half a viewport below;
- future-compatible setting shape: either boolean feature flag or numeric ratio.

Recommended setting:

- `json-fragments.viewportLookaheadRatio`;
- default: `0`;
- suggested non-default value: `0.5`.

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

New settings to consider:

- `json-fragments.viewportLookaheadRatio`: number from `0` to `1`, default `0`;
- `json-fragments.maxScanCharacters`: default to a conservative value;
- `json-fragments.maxLineLength`: default to a conservative value;
- `json-fragments.maxFragmentsPerScan`: default to a conservative value.

## Proposed Modules

- `src/scanner`: scanner and fragment range model.
- `src/domain`: shared fragment domain types.
- `src/editor`: editor decorations and viewport scan orchestration.
- `src/store`: per-document highlighting state and fragment cache.
- `src/config`: settings access.
- `src/extension.ts`: command registration and provider wiring.

## Implementation Plan

### 1. Scanner Foundation

Implement and test the domain scanner described in `doc/step-1-fragment-detection.md`.

The editor feature should depend on this scanner instead of parsing JSON directly in VS Code integration code.

### 2. Highlight State

Track per-document state:

- whether highlighting is enabled for the document;
- last scanned document version;
- last scanned ranges;
- current fragments;
- active decoration ranges.

### 3. Decoration Manager

Create a small editor integration that:

- owns `TextEditorDecorationType`;
- converts fragments to `vscode.Range`;
- applies decorations to the active editor;
- clears decorations when highlighting is disabled or the document closes.

### 4. Viewport Range Builder

Create logic that converts `editor.visibleRanges` into scan ranges.

It should:

- merge overlapping visible ranges;
- apply `viewportLookaheadRatio`;
- clamp ranges to document boundaries;
- avoid rescanning when the visible range is still covered by the cached padded range.

### 5. Event Wiring

Update highlights on:

- active editor change;
- visible range change;
- text document change;
- configuration change;
- document close.

Use debouncing for scroll and document change events.

### 6. Commands

Implement command behavior:

- `json-fragments.toggleHighlightForFile`;
- `json-fragments.toggleTemporaryHighlightForFocusedFiles`;
- `json-fragments.scanVisibleJsonFragments`.

The scan command should be useful for debugging and for users who do not want automatic highlighting.

### 7. Verification

Add tests for scanner and range calculation.

Manual verification in the extension host:

- highlight one fragment in a visible line;
- highlight multiple fragments in one line;
- scroll slowly around viewport boundaries with padding `0`;
- scroll slowly around viewport boundaries with padding `0.5`;
- edit a highlighted line and confirm stale decorations disappear;
- disable highlighting and confirm decorations clear.

## Open Decisions

- Whether `viewportLookaheadRatio` should be a number setting from the start or a boolean feature flag first.
- Exact decoration style for the whole-fragment highlight.
- Whether to keep cached fragments only for the active editor or for every highlighted document.
- Whether scan-limit skips should be completely silent or visible in a debug output channel.
