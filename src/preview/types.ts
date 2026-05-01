import * as vscode from "vscode";

export const staticPreviewScheme = "json-fragments-preview";
export const dynamicPreviewScheme = "json-fragments-dynamic-preview";
export const openStaticPreviewCommand = "json-fragments.openStaticPreview";
export const openDynamicPreviewCommand = "json-fragments.openDynamicPreview";

export type SerializablePosition = {
  line: number;
  character: number;
};

export type SerializableRange = {
  start: SerializablePosition;
  end: SerializablePosition;
};

export type OpenStaticPreviewArgs = {
  sourceUri: string;
  sourceVersion: number;
  range: SerializableRange;
};

export type StaticPreviewIdentity = OpenStaticPreviewArgs;

export type StaticPreview = {
  identity: StaticPreviewIdentity;
  uri: vscode.Uri;
  content: string;
  openedAt: number;
};

export const dynamicPreviewUri = vscode.Uri.from({
  scheme: dynamicPreviewScheme,
  path: "/current-line.json",
});

export function serializeRange(range: vscode.Range): SerializableRange {
  return {
    start: serializePosition(range.start),
    end: serializePosition(range.end),
  };
}

export function deserializeRange(range: SerializableRange): vscode.Range {
  return new vscode.Range(
    deserializePosition(range.start),
    deserializePosition(range.end),
  );
}

export function serializePosition(position: vscode.Position): SerializablePosition {
  return {
    line: position.line,
    character: position.character,
  };
}

export function deserializePosition(position: SerializablePosition): vscode.Position {
  return new vscode.Position(position.line, position.character);
}

export function createStaticPreviewIdentity(
  document: vscode.TextDocument,
  range: vscode.Range,
): StaticPreviewIdentity {
  return {
    sourceUri: document.uri.toString(),
    sourceVersion: document.version,
    range: serializeRange(range),
  };
}

export function createStaticPreviewKey(identity: StaticPreviewIdentity): string {
  return [
    identity.sourceUri,
    identity.sourceVersion,
    identity.range.start.line,
    identity.range.start.character,
    identity.range.end.line,
    identity.range.end.character,
  ].join(":");
}

export function createStaticPreviewUri(identity: StaticPreviewIdentity): vscode.Uri {
  return vscode.Uri.from({
    scheme: staticPreviewScheme,
    path: `/${createStaticPreviewFileName(identity)}`,
    query: encodeURIComponent(JSON.stringify(identity)),
  });
}

export function parseStaticPreviewIdentity(uri: vscode.Uri): StaticPreviewIdentity | undefined {
  if (uri.scheme !== staticPreviewScheme || uri.query.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(uri.query)) as unknown;

    if (!isStaticPreviewIdentity(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function createStaticPreviewFileName(identity: StaticPreviewIdentity): string {
  const sourceName = getSourceName(identity.sourceUri);
  const line = identity.range.start.line + 1;
  const character = identity.range.start.character + 1;

  return `${sourceName}:${line}:${character}.json`;
}

function getSourceName(sourceUri: string): string {
  const uri = vscode.Uri.parse(sourceUri);
  const pathParts = uri.path.split("/").filter((part) => part.length > 0);
  const basename = pathParts[pathParts.length - 1] ?? "Untitled";

  return basename.replace(/[?#]/g, "_");
}

function isStaticPreviewIdentity(value: unknown): value is StaticPreviewIdentity {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<StaticPreviewIdentity>;

  return typeof candidate.sourceUri === "string" &&
    typeof candidate.sourceVersion === "number" &&
    isSerializableRange(candidate.range);
}

function isSerializableRange(value: unknown): value is SerializableRange {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SerializableRange>;

  return isSerializablePosition(candidate.start) && isSerializablePosition(candidate.end);
}

function isSerializablePosition(value: unknown): value is SerializablePosition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SerializablePosition>;

  return typeof candidate.line === "number" && typeof candidate.character === "number";
}
