# JSON Fragments: Implementation Plan

## Goal

Build a VS Code extension that finds JSON fragments inside arbitrary text files and lets the user inspect them without manually copying text into a formatter.

The extension should support three inspection modes:

- inline editor highlighting for discovered fragments;
- hover preview with formatted JSON;
- dedicated preview tabs for static or dynamic fragment inspection.

## Core Concepts

### Fragment

A fragment is a JSON object or array found inside a text document.

The current scanner fragment model contains:

- kind, currently `"source"`;
- source range as a VS Code `Range`;
- raw text;
- parsed JSON value.

Document URI and version are added by the integration layer when fragments are stored in a per-document snapshot.

### Scanner

The scanner is responsible only for finding and validating fragments.

Current support:

- scanning a single line;
- scanning a plain string;
- formatting a parsed JSON value for display.

The tracker scans visible editor ranges by calling the scanner for each visible line. Selection scanning and multiline text scanning are still future work.

Scanning should be independent from presentation so the same result can be used by decorations, hover, and preview tabs.

### Tracking

`FragmentTracker` coordinates VS Code editor events, scanner execution, and store updates.

Current support:

- manual scan of visible ranges in the active editor;
- toggled highlighting for the active file;
- temporary highlighting for focused files;
- optional automatic visible-range highlighting;
- debounced rescans after scroll, editor, document, and configuration changes;
- cleanup when a document closes or highlighting is disabled.

Detailed notes: `doc/fragment-tracker.md`.

### Store and Presentation

`Store` keeps the latest fragment snapshot per document URI and emits `onDidChangeFragments` whenever a snapshot changes or is cleared.

`HighlightPresenter` listens to store changes and forwards ranges to `TextDecorator`.

`TextDecorator` is the only current module that calls VS Code decoration APIs.

### Feature Flags and Settings

Settings should control optional behavior:

- enable automatic visible-range highlighting;
- include primitive-only arrays if needed;
- configure debounce for automatic scanning.

Future settings should control:

- include all fragments from selected text in dynamic preview;
- enable syntax highlighting in previews;
- configurable scan limits.

Current hard-coded scanner limits live in `src/config/constants.ts`.

## Implementation Stages

### 1. Fragment Detection

Status: implemented for strings and single document lines.

Current result:

- valid JSON fragments are detected with exact source ranges;
- invalid or partial JSON text is ignored;
- scanner behavior is covered by tests;
- multiline text and selection scanning are not implemented yet.

### 2. Editor Highlighting

Status: first working implementation exists.

Detailed feature plan: `doc/feature-1-inline-highlighting.md`.

Current result:

- user can enable highlighting for the current file;
- user can temporarily enable highlighting for focused files;
- optional automatic highlighting scans visible ranges with debounce;
- highlighted ranges are updated when the editor changes, scrolls, focus changes, or settings change.

Known limitations:

- expanded visible ranges are scanned line by line;
- multiline JSON fragments are not highlighted yet;
- range hysteresis is not implemented.

### 3. Hover Preview

Status: planned.

Register a hover provider that shows formatted JSON for a fragment under the cursor.

Detailed feature plan: `doc/feature-2-hover-preview.md`.

Expected result:

- hovering over a detected fragment shows a formatted JSON preview;
- hover reuses the current store snapshot when available and falls back to scanning only the hovered line;
- hover remains fast for large files by scanning only the relevant line or cached fragment list.

### 4. Ctrl-Click Static Preview

Status: planned.

Add document-link or definition-style interaction for fragments.

Expected result:

- when the user holds `Ctrl`, VS Code indicates that a fragment is clickable;
- `Ctrl+Click` opens the clicked fragment in a new read-only tab;
- the opened tab contains formatted JSON and does not update after opening.

### 5. Dynamic Preview Command

Status: planned.

Implement a command that opens a dedicated preview tab for the active editor context.

Expected result:

- by default, the preview shows fragments from the current line;
- when text is selected and the selection feature flag is enabled, the preview can show all fragments from the selection;
- preview updates when the cursor, selection, or source document changes;
- multiple fragments are presented clearly in one view.

### 6. Inline Fragment Syntax Highlighting

Status: planned.

Add optional lightweight syntax highlighting directly inside the source file for detected JSON fragments.

Formatted JSON in hover and preview tabs should already be displayed as JSON, so it should use the native JSON highlighting of the chosen presentation layer where possible.

Expected result:

- JSON keys, strings, numbers, booleans, null, and punctuation inside inline source fragments are visually distinguishable;
- colors follow the active VS Code theme where possible;
- highlighting can be disabled by setting.

### 7. Polish and Reliability

Finalize behavior around performance, lifecycle, and edge cases.

Partially implemented:

- disposables are registered in extension context;
- caches are invalidated when documents change or close;
- core scanner behavior is covered by tests.

Remaining:

- large selections need limits after selection scanning exists;
- commands and settings need README documentation;
- scan-limit skips currently do not surface diagnostics;

## Current Module Structure

- `src/config`: settings access and scanner constants.
- `src/domain`: early shared domain exports.
- `src/scanner`: fragment detection and JSON formatting.
- `src/store`: per-document fragment snapshots and change events.
- `src/highlight`: decoration presentation and rendering.
- `src/tracking`: VS Code event orchestration for scans.
- `src/extension.ts`: activation, object construction, command registration.

## Future Module Structure

- `src/domain`: fragment types and range helpers that are not tied to scanner internals.
- `src/config`: settings schema and accessors.
- `src/store`: per-document fragment cache.
- `src/highlight`: decorations.
- `src/tracking`: scan orchestration.
- `src/hover`: hover provider and content builder.
- `src/editor`: document links and editor-specific integrations that do not fit highlight or hover.
- `src/preview`: static and dynamic preview document providers or webviews.

## Open Decisions

- Whether static preview should use a virtual text document or a webview.
- Whether dynamic preview should be a virtual document, a webview, or a custom editor.
- Whether current scanner limits should become user-facing settings.
- Whether hover should live in its own `src/hover` module or under a broader editor integration module.
- How detailed inline fragment syntax highlighting should be, given that it has to work inside arbitrary source files.
