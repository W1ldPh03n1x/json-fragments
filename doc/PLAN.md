# JSON Fragments: high-level implementation plan

## Goal

Build a VS Code extension that finds JSON fragments inside arbitrary text files and lets the user inspect them without manually copying text into a formatter.

The extension should support three inspection modes:

- inline editor highlighting for discovered fragments;
- hover preview with formatted JSON;
- dedicated preview tabs for static or dynamic fragment inspection.

## Core Concepts

### Fragment

A fragment is a JSON object or array found inside a text document.

The fragment model should contain:

- source document URI;
- source line and character range;
- raw text;
- parsed JSON value;
- formatted JSON text for display.

### Scanner

The scanner is responsible only for finding and validating fragments.

It should support:

- scanning a single line;
- scanning selected text;
- scanning visible editor ranges when automatic highlighting is enabled.

Scanning should be independent from presentation so the same result can be used by decorations, hover, and preview tabs.

### Feature Flags and Settings

Settings should control optional behavior:

- enable automatic visible-range highlighting;
- include primitive-only arrays if needed;
- include all fragments from selected text in dynamic preview;
- enable syntax highlighting in previews;
- configure debounce for automatic scanning.

## Implementation Stages

### 1. Fragment Detection

Create the domain logic for detecting JSON object and array fragments inside a line or text range.

Expected result:

- valid JSON fragments are detected with exact source ranges;
- invalid or partial JSON text is ignored;
- detection can be unit-tested without VS Code APIs.

### 2. Editor Highlighting

Add editor decorations for detected fragments.

Detailed feature plan: `doc/feature-1-inline-highlighting.md`.

Expected result:

- user can enable highlighting for the current file;
- user can temporarily enable highlighting for focused files;
- optional automatic highlighting scans visible ranges with debounce;
- highlighted ranges are updated when the editor changes, scrolls, or focus changes.

### 3. Hover Preview

Register a hover provider that shows formatted JSON for a fragment under the cursor.

Expected result:

- hovering over a detected fragment shows a formatted JSON preview;
- hover uses the same scanner result as highlighting where possible;
- hover remains fast for large files by scanning only the relevant line or cached fragment list.

### 4. Ctrl-Click Static Preview

Add document-link or definition-style interaction for fragments.

Expected result:

- when the user holds `Ctrl`, VS Code indicates that a fragment is clickable;
- `Ctrl+Click` opens the clicked fragment in a new read-only tab;
- the opened tab contains formatted JSON and does not update after opening.

### 5. Dynamic Preview Command

Implement a command that opens a dedicated preview tab for the active editor context.

Expected result:

- by default, the preview shows fragments from the current line;
- when text is selected and the selection feature flag is enabled, the preview can show all fragments from the selection;
- preview updates when the cursor, selection, or source document changes;
- multiple fragments are presented clearly in one view.

### 6. Inline Fragment Syntax Highlighting

Add optional lightweight syntax highlighting directly inside the source file for detected JSON fragments.

Formatted JSON in hover and preview tabs should already be displayed as JSON, so it should use the native JSON highlighting of the chosen presentation layer where possible.

Expected result:

- JSON keys, strings, numbers, booleans, null, and punctuation inside inline source fragments are visually distinguishable;
- colors follow the active VS Code theme where possible;
- highlighting can be disabled by setting.

### 7. Polish and Reliability

Finalize behavior around performance, lifecycle, and edge cases.

Expected result:

- disposables are registered in extension context;
- caches are invalidated when documents change or close;
- large lines and large selections have reasonable limits;
- commands and settings are documented in `package.json` and `README.md`;
- core scanner behavior is covered by tests.

## Suggested Module Structure

- `src/domain`: fragment types, scanner, formatting helpers.
- `src/config`: settings schema and accessors.
- `src/store`: per-document fragment cache and feature state.
- `src/editor`: decorations, hover provider, document links.
- `src/preview`: static and dynamic preview document providers or webviews.
- `src/extension.ts`: activation, command registration, provider wiring.

## Open Decisions

- Whether static preview should use a virtual text document or a webview.
- Whether dynamic preview should be a virtual document, a webview, or a custom editor.
- Exact visual style for fragment decorations.
- Maximum size limits for line scanning, selection scanning, and preview rendering.
- How detailed inline fragment syntax highlighting should be, given that it has to work inside arbitrary source files.
