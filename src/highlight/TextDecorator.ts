import * as vscode from "vscode";
import type { Fragment } from "../scanner";
import { collectJsonTokenRanges, type JsonTokenKind, type JsonTokenRange } from "./jsonTokenRanges";
import { defaultJsonTokenDecorationStyles } from "./syntaxHighlightConfig";
import {
  defaultFragmentDecorationStyle,
  type FragmentDecorationStyle,
  type HighlightRenderLayers,
  type JsonTokenDecorationStyles,
} from "./types";

export class TextDecorator implements vscode.Disposable {
  private fragmentDecorationType: vscode.TextEditorDecorationType;
  private tokenDecorationTypes: Record<JsonTokenKind, vscode.TextEditorDecorationType>;
  private readonly themeSubscription: vscode.Disposable;
  private readonly renderedStateByEditor = new Map<string, RenderedEditorState>();

  public constructor(
    fragmentStyle: FragmentDecorationStyle = defaultFragmentDecorationStyle,
    tokenStyles: JsonTokenDecorationStyles = defaultJsonTokenDecorationStyles,
  ) {
    this.fragmentDecorationType = createFragmentDecorationType(fragmentStyle);
    this.tokenDecorationTypes = createTokenDecorationTypes(tokenStyles);
    this.themeSubscription = vscode.window.onDidChangeActiveColorTheme(() => {
      this.renderKnownVisibleEditors();
    });
  }

  public setStyle(style: FragmentDecorationStyle): void {
    this.fragmentDecorationType.dispose();
    this.fragmentDecorationType = createFragmentDecorationType(style);
    this.renderKnownVisibleEditors();
  }

  public render(
    editor: vscode.TextEditor,
    ranges: readonly vscode.Range[],
    fragments: readonly Fragment[],
    layers: HighlightRenderLayers,
  ): void {
    const tokenRanges = collectJsonTokenRanges(fragments);

    this.renderedStateByEditor.set(createEditorKey(editor), {
      fragmentRanges: [...ranges],
      tokenRanges,
      layers,
    });
    this.renderState(editor, {
      fragmentRanges: ranges,
      tokenRanges,
      layers,
    });
  }

  public clearFragmentLayer(editor: vscode.TextEditor): void {
    const editorKey = createEditorKey(editor);
    const state = this.renderedStateByEditor.get(editorKey);

    if (state !== undefined) {
      this.renderedStateByEditor.set(editorKey, {
        ...state,
        layers: {
          ...state.layers,
          fragment: false,
        },
      });
    }

    editor.setDecorations(this.fragmentDecorationType, []);
  }

  public clearSyntaxLayer(editor: vscode.TextEditor): void {
    const editorKey = createEditorKey(editor);
    const state = this.renderedStateByEditor.get(editorKey);

    if (state !== undefined) {
      this.renderedStateByEditor.set(editorKey, {
        ...state,
        layers: {
          ...state.layers,
          inlineSyntax: false,
        },
      });
    }

    this.clearTokenDecorations(editor);
  }

  public clear(editor: vscode.TextEditor): void {
    this.renderedStateByEditor.delete(createEditorKey(editor));
    editor.setDecorations(this.fragmentDecorationType, []);
    this.clearTokenDecorations(editor);
  }

  public clearDocument(uri: vscode.Uri): void {
    const uriKey = createUriKey(uri);

    for (const editorKey of this.renderedStateByEditor.keys()) {
      if (editorKey.startsWith(uriKey)) {
        this.renderedStateByEditor.delete(editorKey);
      }
    }

    for (const editor of vscode.window.visibleTextEditors) {
      if (createUriKey(editor.document.uri) === uriKey) {
        editor.setDecorations(this.fragmentDecorationType, []);
        this.clearTokenDecorations(editor);
      }
    }
  }

  public dispose(): void {
    this.renderedStateByEditor.clear();
    this.themeSubscription.dispose();
    this.fragmentDecorationType.dispose();

    for (const decorationType of Object.values(this.tokenDecorationTypes)) {
      decorationType.dispose();
    }
  }

  private renderKnownVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const state = this.renderedStateByEditor.get(createEditorKey(editor));

      if (state !== undefined) {
        this.renderState(editor, state);
      }
    }
  }

  private renderState(editor: vscode.TextEditor, state: RenderedEditorState): void {
    if (state.layers.fragment) {
      editor.setDecorations(this.fragmentDecorationType, state.fragmentRanges);
    } else {
      editor.setDecorations(this.fragmentDecorationType, []);
    }

    if (state.layers.inlineSyntax) {
      this.renderTokenRanges(editor, state.tokenRanges);
    } else {
      this.clearTokenDecorations(editor);
    }
  }

  private renderTokenRanges(editor: vscode.TextEditor, ranges: readonly JsonTokenRange[]): void {
    const groupedRanges = groupTokenRanges(ranges);

    for (const kind of tokenKinds) {
      editor.setDecorations(this.tokenDecorationTypes[kind], groupedRanges[kind]);
    }
  }

  private clearTokenDecorations(editor: vscode.TextEditor): void {
    for (const kind of tokenKinds) {
      editor.setDecorations(this.tokenDecorationTypes[kind], []);
    }
  }
}

type RenderedEditorState = {
  fragmentRanges: readonly vscode.Range[];
  tokenRanges: readonly JsonTokenRange[];
  layers: HighlightRenderLayers;
};

const tokenKinds: readonly JsonTokenKind[] = [
  "key",
  "string",
  "number",
  "keyword",
  "punctuation",
];

function createFragmentDecorationType(style: FragmentDecorationStyle): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    border: "1px solid",
    borderColor: style.borderColor,
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    overviewRulerColor: style.overviewRulerColor,
    overviewRulerLane: style.overviewRulerColor === undefined
      ? undefined
      : vscode.OverviewRulerLane.Right,
  });
}

function createTokenDecorationTypes(
  styles: JsonTokenDecorationStyles,
): Record<JsonTokenKind, vscode.TextEditorDecorationType> {
  return {
    key: createTokenDecorationType(styles.key),
    string: createTokenDecorationType(styles.string),
    number: createTokenDecorationType(styles.number),
    keyword: createTokenDecorationType(styles.keyword),
    punctuation: createTokenDecorationType(styles.punctuation),
  };
}

function createTokenDecorationType(style: JsonTokenDecorationStyles[JsonTokenKind]): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    color: style.color,
  });
}

function groupTokenRanges(
  ranges: readonly JsonTokenRange[],
): Record<JsonTokenKind, vscode.Range[]> {
  const groupedRanges: Record<JsonTokenKind, vscode.Range[]> = {
    key: [],
    string: [],
    number: [],
    keyword: [],
    punctuation: [],
  };

  for (const tokenRange of ranges) {
    groupedRanges[tokenRange.kind].push(tokenRange.range);
  }

  return groupedRanges;
}

function createEditorKey(editor: vscode.TextEditor): string {
  return `${createUriKey(editor.document.uri)}#${editor.viewColumn ?? "unknown"}`;
}

function createUriKey(uri: vscode.Uri): string {
  return uri.toString();
}
