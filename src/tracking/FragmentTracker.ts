import * as vscode from "vscode";
import { scannerLimits, type Config } from "../config";
import { createScanner, type Fragment } from "../scanner";
import type { CurrentLineChangeReason, Store } from "../store";

export class FragmentTracker implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly fragmentTrackedDocuments = new Set<string>();
    private readonly syntaxTrackedDocuments = new Set<string>();
    private readonly pendingScans = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly highlightLayersChangedEmitter = new vscode.EventEmitter<vscode.Uri>();
    private currentSourceEditor: vscode.TextEditor | undefined;
    private temporaryFocusedTrackingEnabled = false;
    private temporaryFocusedSyntaxTrackingEnabled = false;

    public readonly onDidChangeHighlightLayers = this.highlightLayersChangedEmitter.event;

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
                this.handleActiveEditorChange(editor);

                if (editor === undefined) {
                    return;
                }

                if (this.temporaryFocusedTrackingEnabled) {
                    this.enableFragmentHighlight(editor);
                }

                if (this.temporaryFocusedSyntaxTrackingEnabled) {
                    this.enableInlineSyntaxHighlight(editor);
                }
            }),
            vscode.window.onDidChangeTextEditorSelection((event) => {
                this.handleSelectionChange(event.textEditor);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                for (const editor of vscode.window.visibleTextEditors) {
                    if (sameUri(editor.document.uri, event.document.uri)) {
                        this.scheduleScanEditorIfTracked(editor);
                    }
                }

                if (
                    this.currentSourceEditor !== undefined &&
                    sameUri(this.currentSourceEditor.document.uri, event.document.uri)
                ) {
                    this.updateCurrentLineSnapshot("document-change");
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                const key = createUriKey(document.uri);

                this.fragmentTrackedDocuments.delete(key);
                this.syntaxTrackedDocuments.delete(key);
                this.cancelPendingScan(key);
                this.store.clearDocument(document.uri, "document-closed");
                this.highlightLayersChangedEmitter.fire(document.uri);

                if (
                    this.currentSourceEditor !== undefined &&
                    sameUri(this.currentSourceEditor.document.uri, document.uri)
                ) {
                    this.currentSourceEditor = undefined;
                }
            }),
            this.config.onDidChange(() => {
                for (const editor of vscode.window.visibleTextEditors) {
                    if (!this.config.isDocumentAllowed(editor.document)) {
                        this.disableAllDocumentLayers(editor.document.uri);
                        continue;
                    }

                    this.highlightLayersChangedEmitter.fire(editor.document.uri);

                    if (this.shouldTrackEditor(editor)) {
                        this.scheduleScanEditor(editor);
                    } else {
                        this.clearSnapshotIfNoLayersRemain(editor.document.uri);
                    }
                }

                if (
                    this.currentSourceEditor === undefined ||
                    !this.config.isDocumentAllowed(this.currentSourceEditor.document)
                ) {
                    this.currentSourceEditor = undefined;
                    this.store.clearCurrentLine("disabled");
                    return;
                }

                this.updateCurrentLineSnapshot("active-editor");
            }),
        );

        this.handleActiveEditorChange(vscode.window.activeTextEditor);
    }

    public toggleActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;

        if (editor === undefined || isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        const key = createUriKey(editor.document.uri);

        if (this.fragmentTrackedDocuments.has(key)) {
            this.disableFragmentHighlight(editor.document.uri);
            return;
        }

        this.enableFragmentHighlight(editor);
    }

    public scanActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;

        if (editor !== undefined) {
            if (isPreviewDocument(editor.document)) {
                return;
            }

            if (!this.config.isDocumentAllowed(editor.document)) {
                this.disableAllDocumentLayers(editor.document.uri);
                return;
            }

            this.scanEditor(editor);
        }
    }

    public refreshCurrentLine(): void {
        this.handleActiveEditorChange(vscode.window.activeTextEditor);
    }

    public toggleTemporaryFocusedTracking(): void {
        this.temporaryFocusedTrackingEnabled = !this.temporaryFocusedTrackingEnabled;

        if (!this.temporaryFocusedTrackingEnabled) {
            for (const key of [...this.fragmentTrackedDocuments]) {
                const uri = vscode.Uri.parse(key);

                this.disableFragmentHighlight(uri);
            }

            return;
        }

        const editor = vscode.window.activeTextEditor;

        if (editor !== undefined) {
            this.enableFragmentHighlight(editor);
        }
    }

    public toggleActiveEditorInlineSyntaxHighlight(): void {
        const editor = vscode.window.activeTextEditor;

        if (editor === undefined || isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        const key = createUriKey(editor.document.uri);

        if (this.syntaxTrackedDocuments.has(key)) {
            this.disableInlineSyntaxHighlight(editor.document.uri);
            return;
        }

        this.enableInlineSyntaxHighlight(editor);
    }

    public toggleTemporaryFocusedInlineSyntaxHighlight(): void {
        this.temporaryFocusedSyntaxTrackingEnabled = !this.temporaryFocusedSyntaxTrackingEnabled;

        if (!this.temporaryFocusedSyntaxTrackingEnabled) {
            for (const key of [...this.syntaxTrackedDocuments]) {
                const uri = vscode.Uri.parse(key);

                this.disableInlineSyntaxHighlight(uri);
            }

            return;
        }

        const editor = vscode.window.activeTextEditor;

        if (editor !== undefined) {
            this.enableInlineSyntaxHighlight(editor);
        }
    }

    public isFragmentHighlightEnabled(uri: vscode.Uri): boolean {
        return this.config.get("tracker.autoHighlightVisibleRanges") ||
            this.fragmentTrackedDocuments.has(createUriKey(uri));
    }

    public isInlineSyntaxHighlightEnabled(uri: vscode.Uri): boolean {
        return this.config.get("inlineSyntaxHighlighting.autoHighlightVisibleRanges") ||
            this.syntaxTrackedDocuments.has(createUriKey(uri));
    }

    public dispose(): void {
        for (const key of this.pendingScans.keys()) {
            this.cancelPendingScan(key);
        }

        vscode.Disposable.from(...this.disposables, this.highlightLayersChangedEmitter).dispose();
    }

    private enableFragmentHighlight(editor: vscode.TextEditor): void {
        if (isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        this.fragmentTrackedDocuments.add(createUriKey(editor.document.uri));
        this.highlightLayersChangedEmitter.fire(editor.document.uri);
        this.scheduleScanEditor(editor);
    }

    private enableInlineSyntaxHighlight(editor: vscode.TextEditor): void {
        if (isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        this.syntaxTrackedDocuments.add(createUriKey(editor.document.uri));
        this.highlightLayersChangedEmitter.fire(editor.document.uri);
        this.scheduleScanEditor(editor);
    }

    private disableFragmentHighlight(uri: vscode.Uri): void {
        const key = createUriKey(uri);

        this.fragmentTrackedDocuments.delete(key);
        this.highlightLayersChangedEmitter.fire(uri);
        this.clearSnapshotIfNoLayersRemain(uri);
    }

    private disableInlineSyntaxHighlight(uri: vscode.Uri): void {
        const key = createUriKey(uri);

        this.syntaxTrackedDocuments.delete(key);
        this.highlightLayersChangedEmitter.fire(uri);
        this.clearSnapshotIfNoLayersRemain(uri);
    }

    private disableAllDocumentLayers(uri: vscode.Uri): void {
        const key = createUriKey(uri);

        this.fragmentTrackedDocuments.delete(key);
        this.syntaxTrackedDocuments.delete(key);
        this.cancelPendingScan(key);
        this.store.clearDocument(uri, "disabled");
        this.highlightLayersChangedEmitter.fire(uri);
    }

    private clearSnapshotIfNoLayersRemain(uri: vscode.Uri): void {
        if (this.shouldTrackUri(uri)) {
            return;
        }

        const key = createUriKey(uri);

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
        if (isPreviewDocument(editor.document)) {
            return false;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return false;
        }

        return this.shouldTrackUri(editor.document.uri);
    }

    private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
        if (editor === undefined) {
            this.currentSourceEditor = undefined;
            this.store.clearCurrentLine("clear");
            return;
        }

        if (isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.currentSourceEditor = undefined;
            this.store.clearCurrentLine("disabled");
            return;
        }

        this.currentSourceEditor = editor;
        this.updateCurrentLineSnapshot("active-editor");
    }

    private handleSelectionChange(editor: vscode.TextEditor): void {
        if (isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            if (
                this.currentSourceEditor !== undefined &&
                sameUri(this.currentSourceEditor.document.uri, editor.document.uri)
            ) {
                this.currentSourceEditor = undefined;
                this.store.clearCurrentLine("disabled");
            }

            return;
        }

        this.currentSourceEditor = editor;
        this.updateCurrentLineSnapshot("cursor");
    }

    private updateCurrentLineSnapshot(reason: CurrentLineChangeReason): void {
        const editor = this.currentSourceEditor;

        if (editor === undefined || !this.config.isDocumentAllowed(editor.document)) {
            this.store.clearCurrentLine("disabled");
            return;
        }

        const lineNumber = editor.selection.active.line;

        if (lineNumber < 0 || lineNumber >= editor.document.lineCount) {
            this.store.clearCurrentLine("clear");
            return;
        }

        const scanner = createScanner({
            ...this.config.scannerOptions,
            ...scannerLimits,
        });
        const line = editor.document.lineAt(lineNumber);

        this.store.setCurrentLineSnapshot({
            uri: editor.document.uri,
            version: editor.document.version,
            line: lineNumber,
            range: line.range,
            fragments: scanner.scanLine(line).fragments,
        }, reason);
    }

    private scheduleScanEditor(editor: vscode.TextEditor): void {
        if (isPreviewDocument(editor.document)) {
            return;
        }

        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        const key = createUriKey(editor.document.uri);
        const version = editor.document.version;
        const debounceMs = this.config.get("tracker.autoHighlightDebounceMs");

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
        if (!this.config.isDocumentAllowed(editor.document)) {
            this.disableAllDocumentLayers(editor.document.uri);
            return;
        }

        const scanner = createScanner({
            ...this.config.scannerOptions,
            ...scannerLimits,
        });
        const scannedRanges = createScanRanges(
            editor.visibleRanges,
            editor.document.lineCount,
            this.config.get("tracker.viewportLookaheadRatio"),
        );
        const lines = getRangeLineNumbers(scannedRanges);
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

    private shouldTrackUri(uri: vscode.Uri): boolean {
        return this.isFragmentHighlightEnabled(uri) || this.isInlineSyntaxHighlightEnabled(uri);
    }
}

function createScanRanges(
    visibleRanges: readonly vscode.Range[],
    documentLineCount: number,
    lookaheadRatio: number,
): vscode.Range[] {
    const boundedLookaheadRatio = clampRatio(lookaheadRatio);

    return visibleRanges.map((range) => {
        const lineCount = range.end.line - range.start.line + 1;
        const paddingLines = Math.floor(lineCount * boundedLookaheadRatio);
        const startLine = clampLine(range.start.line - paddingLines, documentLineCount);
        const endLine = clampLine(range.end.line + paddingLines, documentLineCount);

        return new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, Number.MAX_SAFE_INTEGER),
        );
    });
}

function clampRatio(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}

function clampLine(line: number, documentLineCount: number): number {
    return Math.min(Math.max(line, 0), documentLineCount - 1);
}

function getRangeLineNumbers(ranges: readonly vscode.Range[]): number[] {
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

function isPreviewDocument(document: vscode.TextDocument): boolean {
    return document.uri.scheme === "json-fragments-preview" ||
        document.uri.scheme === "json-fragments-dynamic-preview";
}
