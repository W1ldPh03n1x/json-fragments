export type JsonFragment = {
  uri: string;
  line: number;
  start: number;
  end: number;
  raw: string;
  value: unknown;
};

export class JsonFragmentsStore {
  private readonly fragmentsByUri = new Map<string, JsonFragment[]>();

  public setFragments(uri: string, fragments: JsonFragment[]): void {
    this.fragmentsByUri.set(uri, fragments);
  }

  public clearFragments(uri: string): void {
    this.fragmentsByUri.delete(uri);
  }

  public getFragments(uri: string): JsonFragment[] {
    return this.fragmentsByUri.get(uri) ?? [];
  }

  public findFragmentAt(uri: string, line: number, character: number): JsonFragment | undefined {
    return this.getFragments(uri).find((fragment) => (
      fragment.line === line &&
      fragment.start <= character &&
      character < fragment.end
    ));
  }
}
