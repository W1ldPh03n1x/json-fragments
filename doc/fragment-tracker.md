# FragmentTracker

## Responsibility

`FragmentTracker` coordinates fragment state for source documents.

It owns the flow between:

- VS Code document and editor events;
- scanner execution;
- fragment store updates;
- cleanup when documents are closed or tracking is disabled.

It does not render highlights directly. Rendering stays in `HighlightPresenter`, which reacts to store changes.

## Inputs

- active editor changes;
- visible editor range changes;
- text document changes;
- text document close events;
- commands that enable or disable tracking for a document;
- configuration changes that affect scanning or highlighting.

## Outputs

- `store.setSnapshot(...)` after a successful scan;
- `store.clearDocument(...)` when a document should no longer have tracked fragments;
- disposables for event subscriptions and scheduled work.

## Collaborators

- `Scanner`: finds fragments in requested source ranges.
- `Store`: keeps the latest fragment snapshot per document.
- `Config`: provides scanning and highlighting settings.
- `HighlightPresenter`: subscribes to `Store` and updates decorations.

## State

`FragmentTracker` should keep only coordination state:

- tracked document URIs;
- temporary tracking mode state;
- pending debounce timers per document;
- latest scheduled scan version per document;
- disposable event subscriptions.

The canonical fragment list remains in `Store`.

## Scan Scope

For inline highlighting, the first implementation should scan visible ranges only.

Future scan scopes:

- current line for hover;
- current selection for preview;
- whole document when explicitly requested;
- changed ranges after document edits.

## Lifecycle

### Activate

1. Create `FragmentTracker` in extension activation.
2. Pass `Scanner`, `Store`, and `Config` to it.
3. Register it in `context.subscriptions`.
4. Register commands that call tracker methods.

### Enable Document Tracking

1. Add the document URI to tracked state.
2. Schedule a scan for visible ranges.
3. Store the scan result as a snapshot.
4. Let `HighlightPresenter` render through the store change event.

### Disable Document Tracking

1. Remove the document URI from tracked state.
2. Cancel pending scans for that URI.
3. Clear the document snapshot with reason `"disabled"`.

### Document Change

1. Check whether the changed document is tracked.
2. Cancel any pending scan for the document.
3. Schedule a new scan with debounce.
4. Ignore stale scan results if the document version changed before commit.

### Visible Range Change

1. Check whether the editor document is tracked or auto-highlight is enabled.
2. Schedule a scan for the visible ranges.
3. Replace the document snapshot with the new visible-range result.

### Document Close

1. Remove the document URI from tracked state.
2. Cancel pending scans for that URI.
3. Clear the document snapshot with reason `"document-closed"`.

### Dispose

1. Dispose event subscriptions.
2. Cancel all pending timers.
3. Leave store disposal to extension activation ownership.

## Public API Sketch

```ts
class FragmentTracker implements vscode.Disposable {
  enableForDocument(document: vscode.TextDocument): void;
  disableForDocument(uri: vscode.Uri): void;
  toggleForDocument(document: vscode.TextDocument): void;
  enableTemporaryFocusedTracking(): void;
  disableTemporaryFocusedTracking(): void;
  rescanEditor(editor: vscode.TextEditor): void;
  dispose(): void;
}
```

## Event Flow

```text
VS Code event / command
        |
        v
FragmentTracker
        |
        v
Scanner
        |
        v
Store.setSnapshot / Store.clearDocument
        |
        v
HighlightPresenter
        |
        v
TextDecorator
```

## Placement

Suggested module:

- `src/tracking/FragmentTracker.ts`
- `src/tracking/index.ts`

`FragmentTracker` can use VS Code APIs because it is an integration layer. Scanner logic should remain independent from editor lifecycle and presentation concerns.
