# FragmentTracker

## Current Status

`FragmentTracker` is implemented in `src/tracking/FragmentTracker.ts`.

It is currently used by extension activation for inline highlighting and manual visible-range scans.

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
- Future `FragmentHoverProvider`: reads current snapshots from `Store` and can fall back to local current-line scanning without asking the tracker to rescan visible ranges.

## State

`FragmentTracker` keeps only coordination state:

- tracked document URIs;
- temporary tracking mode state;
- pending debounce timers per document;
- disposable event subscriptions.

The scheduled document version is captured in each pending scan callback and checked before the scan commits.

The canonical fragment list remains in `Store`.

## Scan Scope

For inline highlighting, the current implementation scans expanded visible ranges.

`json-fragments.viewportLookaheadRatio` controls how many extra lines are scanned above and below each visible range. The tracker clamps expanded ranges to document boundaries, expands them to line numbers, and scans each line independently with `scanner.scanLine(...)`.

Current limitation:

- multiline fragments are not detected by the tracker because scanning is currently line-based.

Future scan scopes:

- current line as a local hover fallback owned by the hover provider;
- current selection for preview;
- whole document when explicitly requested;
- changed ranges after document edits.

## Lifecycle

### Activate

1. Create `FragmentTracker` in extension activation.
2. Pass `Config` and `Store` to it.
3. Register it in `context.subscriptions`.
4. Register commands that call tracker methods.

`FragmentTracker` creates scanner instances internally when it scans. Scanner options are built from runtime settings plus `scannerLimits` from `src/config/constants.ts`.

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

1. Find visible editors for the changed document.
2. Check whether each editor should be tracked.
3. Cancel any pending scan for the document.
4. Schedule a new scan with debounce.
5. Ignore stale scan results if the document version changed before commit.

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

Current public API:

```ts
class FragmentTracker implements vscode.Disposable {
  toggleActiveEditor(): void;
  scanActiveEditor(): void;
  toggleTemporaryFocusedTracking(): void;
  dispose(): void;
}
```

Lower-level enable, disable, schedule, and scan methods are private implementation details for now.

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

Hover preview is expected to be a separate read path:

```text
VS Code hover request
        |
        v
FragmentHoverProvider
        |
        v
Store.getSnapshot / Store.findFragmentAt
        |
        v
Scanner.scanLine fallback when the store snapshot is missing or stale
        |
        v
FragmentHover
        |
        v
vscode.Hover
```

`FragmentTracker` should not be called by hover requests in the MVP. It remains responsible for background and command-driven snapshots, while hover remains a lightweight on-demand reader.

## Placement

Current module:

- `src/tracking/FragmentTracker.ts`
- `src/tracking/index.ts`

`FragmentTracker` can use VS Code APIs because it is an integration layer. Scanner logic should remain independent from editor lifecycle and presentation concerns.

Hover provider code should live outside `src/tracking`, for example in `src/hover`, because it is a presentation/integration feature rather than tracking lifecycle coordination.

## Current Commands

`FragmentTracker` is wired to:

- `json-fragments.scanVisibleJsonFragments`: scan visible ranges in the active editor once.
- `json-fragments.toggleHighlightForFile`: toggle tracking for the active editor document.
- `json-fragments.toggleTemporaryHighlightForFocusedFiles`: toggle tracking that follows the focused editor.

`json-fragments.openLineJsonFragmentsPreview` is registered in `package.json` but is not wired yet.

## Current Settings

- `json-fragments.autoHighlightVisibleRanges`: when enabled, visible editors are scanned without manual per-file tracking.
- `json-fragments.includePrimitiveArrays`: passed to scanner options.
- `json-fragments.autoHighlightDebounceMs`: controls delayed rescans after editor and document events.

## Current Data Flow

```text
VS Code event / command
  -> FragmentTracker
  -> Scanner.scanLine(...)
  -> Store.setSnapshot(...) / Store.clearDocument(...)
  -> Store.onDidChangeFragments
  -> HighlightPresenter
  -> TextDecorator
  -> editor.setDecorations(...)
```
