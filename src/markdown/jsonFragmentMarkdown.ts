import type { JsonFragment } from "../store/jsonFragmentsStore";

export function formatJsonFragmentValueAsMarkdown(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

export function formatJsonFragmentsAsMarkdown(fragments: Pick<JsonFragment, "value">[]): string {
  return fragments
    .map((fragment) => formatJsonFragmentValueAsMarkdown(fragment.value))
    .join("\n\n");
}
