# Feature 3: Dynamic Preview

## Current Status

First implementation is in progress.

Implemented design direction:

- `Store` owns the current-line fragment snapshot.
- `FragmentTracker` updates the current-line snapshot from editor events.
- Dynamic preview is a read-only virtual document that listens to store changes.
- Dynamic preview does not own scanner, tracking, registry, session, or source context state.

## Purpose

Dynamic preview shows JSON fragments from the active source editor context in a dedicated read-only preview tab.

Static preview is range- and version-specific: it opens one fixed fragment and does not update. Dynamic preview is context-specific: it follows the current line of the active source editor and updates when that current-line store snapshot changes.

## MVP Behavior

The user can run:

```text
JSON Fragments: Open Dynamic Preview
```

Expected behavior:

- open one reusable virtual JSON document beside the source editor;
- show fragments from the current line of the active source editor;
- update when the cursor moves to another line;
- update when the active source document changes;
- update when the active source editor changes;
- keep the last source snapshot visible when the dynamic preview tab itself becomes active;
- show `null` when there is no active source context or no fragments.

Selection and multiline scanning are future work. They should be added after `scanner.scanText(text, startPosition)` exists.

## Architecture

Dynamic preview should stay a presentation layer over shared state.

```text
VS Code editor events
  -> FragmentTracker
  -> Scanner
  -> Store current-line snapshot
      -> DynamicPreviewContentProvider
      -> VS Code virtual document refresh
```

Do not add separate dynamic preview tracking or state objects.

Avoid:

- `DynamicPreviewTracker`;
- `DynamicPreviewRegistry`;
- `dynamicPreviewContext`;
- per-preview sessions for the MVP.

## Store State

`Store` exposes a current-line snapshot:

```ts
type CurrentLineSnapshot<Fragment> = {
  uri: vscode.Uri;
  version: number;
  line: number;
  range: vscode.Range;
  fragments: readonly Fragment[];
};
```

The current-line snapshot is independent from the existing per-document fragment snapshot used by visible-range highlighting.

The two store states serve different consumers:

- document snapshot: highlighting, cached hover/static lookup;
- current-line snapshot: dynamic preview, fast hover/static lookup for the active line.

## FragmentTracker Responsibility

`FragmentTracker` remains the only module that listens to editor and document lifecycle events for scanning.

It updates the current-line snapshot on:

- active editor changes;
- selection/cursor changes;
- text changes in the current source document;
- configuration changes;
- document close.

Current-line scanning must not require highlighting to be enabled. It is a cheap single-line scan and should keep dynamic preview useful even when visible-range highlighting is disabled.

Preview documents must be ignored as source documents:

- `json-fragments-preview`;
- `json-fragments-dynamic-preview`.

## Dynamic Preview Provider

`DynamicPreviewContentProvider` implements `TextDocumentContentProvider`.

Responsibilities:

- subscribe to `store.onDidChangeCurrentLineFragments`;
- emit `onDidChange(dynamicPreviewUri)` when current-line state changes;
- build virtual document content from `store.getCurrentLineSnapshot()`;
- keep no source context or registry state of its own.

The dynamic preview URI is fixed for the MVP:

```text
json-fragments-dynamic-preview:/current-line.json
```

## Dynamic Preview Controller

`DynamicPreviewController` only opens the virtual document.

Responsibilities:

- command handler for `json-fragments.openDynamicPreview`;
- refresh the tracker's current-line snapshot before opening;
- open and reveal the fixed dynamic preview URI beside the source editor.

It should not scan documents or store preview content.

## Content Shape

The virtual document should always be valid JSON so VS Code can use native JSON editor behavior.

Dynamic preview content should be optimized for inspection, not debugging extension state. Do not include source URI, document version, ranges, or fragment indexes in the displayed payload.

No active source or no current-line fragments:

```json
null
```

One current-line fragment:

```json
{
  "ok": true
}
```

Multiple current-line fragments:

```json
[
  {
    "ok": true
  },
  {
    "id": 1
  }
]
```

## Future Work

- selection mode after multiline scanner support exists;
- multiple dynamic preview modes if there is a concrete UX need;
- optional richer webview only if virtual JSON documents become too limiting;
- settings for dynamic preview debounce or selection behavior if needed.
