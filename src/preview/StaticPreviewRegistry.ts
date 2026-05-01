import * as vscode from "vscode";
import {
  createStaticPreviewKey,
  createStaticPreviewUri,
  type StaticPreview,
  type StaticPreviewIdentity,
} from "./types";

export type StaticPreviewRegistrationResult =
  | {
      kind: "blocked";
      evicted: readonly StaticPreview[];
    }
  | {
      kind: "created" | "existing";
      preview: StaticPreview;
      evicted: readonly StaticPreview[];
    };

export class StaticPreviewRegistry implements vscode.Disposable {
  private readonly previewsByIdentity = new Map<string, StaticPreview>();
  private readonly identityByUri = new Map<string, string>();
  private nextOpenOrder = 1;

  public register(
    identity: StaticPreviewIdentity,
    content: string,
    maxOpenPreviews: number,
  ): StaticPreviewRegistrationResult {
    const key = createStaticPreviewKey(identity);
    const existing = this.previewsByIdentity.get(key);

    if (existing !== undefined) {
      return {
        kind: "existing",
        preview: existing,
        evicted: [],
      };
    }

    const evicted = this.evictForLimit(maxOpenPreviews);

    if (maxOpenPreviews === 0) {
      return {
        kind: "blocked",
        evicted,
      };
    }

    const preview = this.createPreview(identity, content);

    this.previewsByIdentity.set(key, preview);
    this.identityByUri.set(preview.uri.toString(), key);

    return {
      kind: "created",
      preview,
      evicted,
    };
  }

  public getContent(uri: vscode.Uri): string | undefined {
    return this.getByUri(uri)?.content;
  }

  public getByUri(uri: vscode.Uri): StaticPreview | undefined {
    const identityKey = this.identityByUri.get(uri.toString());

    if (identityKey === undefined) {
      return undefined;
    }

    return this.previewsByIdentity.get(identityKey);
  }

  public removeByUri(uri: vscode.Uri): StaticPreview | undefined {
    const uriKey = uri.toString();
    const identityKey = this.identityByUri.get(uriKey);

    if (identityKey === undefined) {
      return undefined;
    }

    this.identityByUri.delete(uriKey);

    const preview = this.previewsByIdentity.get(identityKey);
    this.previewsByIdentity.delete(identityKey);

    return preview;
  }

  public get size(): number {
    return this.previewsByIdentity.size;
  }

  public dispose(): void {
    this.previewsByIdentity.clear();
    this.identityByUri.clear();
  }

  private evictForLimit(maxOpenPreviews: number): StaticPreview[] {
    if (maxOpenPreviews <= 0) {
      return [];
    }

    const evicted: StaticPreview[] = [];

    while (this.previewsByIdentity.size >= maxOpenPreviews && this.previewsByIdentity.size > 0) {
      const oldest = this.findOldestPreview();

      if (oldest === undefined) {
        break;
      }

      this.removeByUri(oldest.uri);
      evicted.push(oldest);
    }

    return evicted;
  }

  private findOldestPreview(): StaticPreview | undefined {
    return [...this.previewsByIdentity.values()]
      .sort((left, right) => left.openedAt - right.openedAt)[0];
  }

  private createPreview(identity: StaticPreviewIdentity, content: string): StaticPreview {
    const openedAt = this.nextOpenOrder;
    this.nextOpenOrder += 1;

    return {
      identity,
      uri: createStaticPreviewUri(identity),
      content,
      openedAt,
    };
  }
}
