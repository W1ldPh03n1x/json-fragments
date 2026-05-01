import type { RuntimeSettings } from "./settings";

export function isFileAllowed(
  filePath: string | undefined,
  settings: RuntimeSettings["files"],
): boolean {
  if (filePath === undefined) {
    return true;
  }

  const normalizedPath = normalizePath(filePath);

  if (matchesAny(settings.exclude, normalizedPath)) {
    return false;
  }

  if (settings.filterMode === "exclude") {
    return true;
  }

  return matchesAny(settings.include, normalizedPath);
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function matchesAny(patterns: readonly string[], filePath: string): boolean {
  return patterns.some((pattern) => matchesGlob(pattern, filePath));
}

function matchesGlob(pattern: string, filePath: string): boolean {
  const normalizedPattern = normalizePath(pattern.trim());

  if (normalizedPattern.length === 0) {
    return false;
  }

  return matchSegments(
    normalizedPattern.split("/").filter(Boolean),
    filePath.split("/").filter(Boolean),
  );
}

function matchSegments(patternSegments: readonly string[], pathSegments: readonly string[]): boolean {
  if (patternSegments.length === 0) {
    return pathSegments.length === 0;
  }

  const [patternHead, ...patternTail] = patternSegments;

  if (patternHead === "**") {
    return matchSegments(patternTail, pathSegments) ||
      (pathSegments.length > 0 && matchSegments(patternSegments, pathSegments.slice(1)));
  }

  if (pathSegments.length === 0 || !matchSegment(patternHead, pathSegments[0])) {
    return false;
  }

  return matchSegments(patternTail, pathSegments.slice(1));
}

function matchSegment(pattern: string, value: string): boolean {
  const source = pattern
    .split("*")
    .map(escapeRegExp)
    .join("[^/]*");

  return new RegExp(`^${source}$`).test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}
