# JSON Fragments

JSON Fragments finds JSON objects and arrays embedded in any text file, including logs, plain text, copied API traces, and mixed-format debug output.

## Features

- Detects JSON fragments inside regular text lines.
- Shows a formatted JSON hover preview for detected fragments.
- Highlights detected fragments in visible editor ranges.
- Highlights JSON syntax tokens inside detected fragments.
- Supports manual scanning for the active editor.
- Supports temporary focused-file tracking for quick inspection sessions.

## Commands

- `JSON Fragments: Scan Visible JSON Fragments`: scan the active editor once.
- `JSON Fragments: Toggle Highlight for File`: toggle highlighting for the active file in the current VS Code session.
- `JSON Fragments: Toggle Temporary Highlight for Focused Files`: toggle automatic highlighting as you move between focused files.
- `JSON Fragments: Toggle Inline Syntax Highlight for File`: toggle JSON syntax token highlighting for the active file.
- `JSON Fragments: Toggle Temporary Inline Syntax Highlight for Focused Files`: toggle JSON syntax token highlighting as you move between focused files.
- `JSON Fragments: Open Static Preview`: open the fragment under the cursor in a read-only JSON preview tab.
- `JSON Fragments: Open Dynamic Preview`: open a preview tab that follows fragments on the current source line.

## Settings

- `json-fragments.scanner.includePrimitiveArrays`: treat empty arrays and arrays containing only primitive values as JSON fragments.
- `json-fragments.scanner.includeEmptyObjects`: treat empty objects as JSON fragments.
- `json-fragments.hover.enabled`: show formatted JSON hover previews.
- `json-fragments.files.filterMode`: choose whether include or exclude patterns control activation.
- `json-fragments.files.include`: glob patterns enabled when filter mode is `include`.
- `json-fragments.files.exclude`: glob patterns where the extension is inactive.
- `json-fragments.preview.maxOpenStaticPreviews`: maximum number of static preview tabs; `-1` means unlimited.
- `json-fragments.tracker.autoHighlightVisibleRanges`: automatically highlight JSON fragments in visible ranges of the active editor.
- `json-fragments.tracker.autoHighlightDebounceMs`: delay before rescanning after editor and document changes.
- `json-fragments.tracker.viewportLookaheadRatio`: scan extra lines around visible ranges. `0` scans only visible ranges, `1` scans one extra viewport above and below.
- `json-fragments.inlineSyntaxHighlighting.autoHighlightVisibleRanges`: automatically highlight JSON syntax tokens inside detected fragments in visible ranges.

## Requirements

VS Code `1.116.0` or newer.

## Install from VSIX

Download the release artifact and install it with:

```bash
code --install-extension json-fragments-0.0.3.vsix
```

You can also install it from VS Code with `Extensions: Install from VSIX...`.

## Known Issues

This is an initial release. Please report issues in the project repository.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
