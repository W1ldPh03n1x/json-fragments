# JSON Fragments

JSON Fragments finds JSON objects and arrays embedded in any text file, including logs, plain text, copied API traces, and mixed-format debug output.

## Features

- Detects JSON fragments inside regular text lines.
- Shows a formatted JSON hover preview for detected fragments.
- Highlights detected fragments in visible editor ranges.
- Supports manual scanning for the active editor.
- Supports temporary focused-file tracking for quick inspection sessions.

## Commands

- `JSON Fragments: Scan Visible JSON Fragments`: scan the active editor once.
- `JSON Fragments: Toggle Highlight for File`: toggle highlighting for the active file in the current VS Code session.
- `JSON Fragments: Toggle Temporary Highlight for Focused Files`: toggle automatic highlighting as you move between focused files.

## Settings

- `json-fragments.scanner.includePrimitiveArrays`: treat empty arrays and arrays containing only primitive values as JSON fragments.
- `json-fragments.tracker.autoHighlightVisibleRanges`: automatically highlight JSON fragments in visible ranges of the active editor.
- `json-fragments.tracker.autoHighlightDebounceMs`: delay before rescanning after editor and document changes.
- `json-fragments.tracker.viewportLookaheadRatio`: scan extra lines around visible ranges. `0` scans only visible ranges, `1` scans one extra viewport above and below.

## Requirements

VS Code `1.116.0` or newer.

## Install from VSIX

Download the release artifact and install it with:

```bash
code --install-extension json-fragments-0.0.2.vsix
```

You can also install it from VS Code with `Extensions: Install from VSIX...`.

## Known Issues

This is an initial release. Please report issues in the project repository.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md).
