import type { Fragment } from "../domain";

export class Store {
  private readonly fragmentsByUri = new Map<string, Fragment[]>();

  public setFragments(uri: string, fragments: Fragment[]): void {
    this.fragmentsByUri.set(uri, fragments);
  }

  public clearFragments(uri: string): void {
    this.fragmentsByUri.delete(uri);
  }

  public getFragments(uri: string): Fragment[] {
    return this.fragmentsByUri.get(uri) ?? [];
  }

  public findFragmentAt(uri: string, line: number, character: number): Fragment | undefined {
    return this.getFragments(uri).find((fragment) => (
      fragment.line === line &&
      fragment.start <= character &&
      character < fragment.end
    ));
  }
}
