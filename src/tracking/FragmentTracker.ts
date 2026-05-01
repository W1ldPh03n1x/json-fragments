import * as vscode from "vscode";
import { scannerLimits, type Config } from "../config";
import { createScanner, type Fragment } from "../scanner";
import type { Store } from "../store";

export class FragmentTracker implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly trackedDocuments = new Set<string>();
    private readonly pendingScans = new Map<string, ReturnType<typeof setTimeout>>();
    private temporaryFocusedTrackingEnabled = false;

    public constructor(
        private readonly config: Config,
        private readonly store: Store<Fragment>,
    ) {
        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors((editors) => {
                for (const editor of editors) {
                    this.scheduleScanEditorIfTracked(editor);
                }
            }),
            vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
                this.scheduleScanEditorIfTracked(event.textEditor);
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor === undefined || !this.temporaryFocusedTrackingEnabled) {
                    return;
                }

                this.enableEditor(editor);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                for (const editor of vscode.window.visibleTextEditors) {
                    if (sameUri(editor.document.uri, event.document.uri)) {
                        this.scheduleScanEditorIfTracked(editor);
                    }
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                const key = createUriKey(document.uri);

                this.trackedDocuments.delete(key);
                this.cancelPendingScan(key);
                this.store.clearDocument(document.uri, "document-closed");
            }),
            this.config.onDidChange(() => {
                for (const editor of vscode.window.visibleTextEditors) {
                    this.scheduleScanEditorIfTracked(editor);
                }
            }),
        );
    }

    public toggleActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;

        if (editor === undefined) {
            return;
        }

        const key = createUriKey(editor.document.uri);

        if (this.trackedDocuments.has(key)) {
            this.disableDocument(editor.document.uri);
            return;
        }

        this.enableEditor(editor);
    }

    public scanActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;

        if (editor !== undefined) {
            this.scanEditor(editor);
        }
    }

    public toggleTemporaryFocusedTracking(): void {
        this.temporaryFocusedTrackingEnabled = !this.temporaryFocusedTrackingEnabled;

        if (!this.temporaryFocusedTrackingEnabled) {
            for (const key of this.trackedDocuments) {
                const uri = vscode.Uri.parse(key);

                this.cancelPendingScan(key);
                this.store.clearDocument(uri, "disabled");
            }

            this.trackedDocuments.clear();
            return;
        }

        const editor = vscode.window.activeTextEditor;

        if (editor !== undefined) {
            this.enableEditor(editor);
        }
    }

    public dispose(): void {
        for (const key of this.pendingScans.keys()) {
            this.cancelPendingScan(key);
        }

        vscode.Disposable.from(...this.disposables).dispose();
    }

    private enableEditor(editor: vscode.TextEditor): void {
        this.trackedDocuments.add(createUriKey(editor.document.uri));
        this.scheduleScanEditor(editor);
    }

    private disableDocument(uri: vscode.Uri): void {
        const key = createUriKey(uri);

        this.trackedDocuments.delete(key);
        this.cancelPendingScan(key);
        this.store.clearDocument(uri, "disabled");
    }

    private scheduleScanEditorIfTracked(editor: vscode.TextEditor): void {
        if (!this.shouldTrackEditor(editor)) {
            return;
        }

        this.scheduleScanEditor(editor);
    }

    private shouldTrackEditor(editor: vscode.TextEditor): boolean {
        return this.config.get("autoHighlightVisibleRanges") ||
            this.trackedDocuments.has(createUriKey(editor.document.uri));
    }

    private scheduleScanEditor(editor: vscode.TextEditor): void {
        const key = createUriKey(editor.document.uri);
        const version = editor.document.version;
        const debounceMs = this.config.get("autoHighlightDebounceMs");

        this.cancelPendingScan(key);
        this.pendingScans.set(key, setTimeout(() => {
            this.pendingScans.delete(key);

            if (editor.document.version !== version) {
                return;
            }

            this.scanEditor(editor);
        }, debounceMs));
    }

    private scanEditor(editor: vscode.TextEditor): void {
        const scanner = createScanner({
            ...this.config.scannerOptions,
            ...scannerLimits,
        });
        const scannedRanges = editor.visibleRanges;
        const lines = getVisibleLineNumbers(scannedRanges);
        const fragments: Fragment[] = [];

        for (const lineNumber of lines) {
            if (lineNumber >= editor.document.lineCount) {
                continue;
            }

            fragments.push(...scanner.scanLine(editor.document.lineAt(lineNumber)).fragments);
        }

        this.store.setSnapshot({
            uri: editor.document.uri,
            version: editor.document.version,
            scannedRanges,
            fragments,
        });
    }

    private cancelPendingScan(key: string): void {
        const timer = this.pendingScans.get(key);

        if (timer === undefined) {
            return;
        }

        clearTimeout(timer);
        this.pendingScans.delete(key);
    }
}

function getVisibleLineNumbers(ranges: readonly vscode.Range[]): number[] {
    const lines = new Set<number>();

    for (const range of ranges) {
        for (let line = range.start.line; line <= range.end.line; line += 1) {
            lines.add(line);
        }
    }

    return [...lines].sort((left, right) => left - right);
}

function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
    return createUriKey(left) === createUriKey(right);
}

function createUriKey(uri: vscode.Uri): string {
    return uri.toString();
}
