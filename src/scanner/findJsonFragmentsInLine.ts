export type JsonFragmentInLine = {
  start: number;
  end: number;
  raw: string;
  value: unknown;
};

export type FindJsonFragmentsInLineOptions = {
  includePrimitiveArrays?: boolean;
};

export function findJsonFragmentsInLine(
  line: string,
  options: FindJsonFragmentsInLineOptions = {},
): JsonFragmentInLine[] {
  const fragments: JsonFragmentInLine[] = [];
  let index = 0;

  while (index < line.length) {
    const character = line[index];

    if (character !== "{" && character !== "[") {
      index += 1;
      continue;
    }

    const candidate = readJsonCandidate(line, index);
    if (!candidate) {
      index += 1;
      continue;
    }

    try {
      const value = parseJsonFragment(candidate.raw);
      if (!shouldIncludeJsonFragment(value, options)) {
        index = candidate.end;
        continue;
      }

      fragments.push({
        start: index,
        end: candidate.end,
        raw: candidate.raw,
        value,
      });
      index = candidate.end;
    } catch {
      index += 1;
    }
  }

  return fragments;
}

type JsonCandidate = {
  end: number;
  raw: string;
};

function readJsonCandidate(line: string, start: number): JsonCandidate | undefined {
  const stack: string[] = [line[start]];
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < line.length; index += 1) {
    const character = line[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }

      continue;
    }

    if (character === "\"" && (line[index + 1] === "{" || line[index + 1] === "[")) {
      const quotedNestedCandidate = readJsonCandidate(line, index + 1);
      if (quotedNestedCandidate && line[quotedNestedCandidate.end] === "\"") {
        index = quotedNestedCandidate.end;
        continue;
      }
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{" || character === "[") {
      stack.push(character);
      continue;
    }

    if (character !== "}" && character !== "]") {
      continue;
    }

    const opener = stack[stack.length - 1];
    if (!isMatchingPair(opener, character)) {
      return undefined;
    }

    stack.pop();
    if (stack.length === 0) {
      const end = index + 1;

      return {
        end,
        raw: line.slice(start, end),
      };
    }
  }

  return undefined;
}

function isMatchingPair(opener: string | undefined, closer: string): boolean {
  return (opener === "{" && closer === "}") || (opener === "[" && closer === "]");
}

function parseJsonFragment(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const recovered = unwrapQuotedNestedJsonValues(raw);

    if (recovered === raw) {
      throw error;
    }

    return JSON.parse(recovered) as unknown;
  }
}

function unwrapQuotedNestedJsonValues(raw: string): string {
  let result = "";
  let index = 0;

  while (index < raw.length) {
    const character = raw[index];

    if (character !== ":") {
      result += character;
      index += 1;
      continue;
    }

    const replacement = readQuotedNestedJsonValue(raw, index);
    if (!replacement) {
      result += character;
      index += 1;
      continue;
    }

    result += raw.slice(index, replacement.valueStart);
    result += replacement.rawJson;
    index = replacement.end;
  }

  return result;
}

type QuotedNestedJsonValue = {
  end: number;
  rawJson: string;
  valueStart: number;
};

function readQuotedNestedJsonValue(raw: string, colonIndex: number): QuotedNestedJsonValue | undefined {
  let quoteIndex = colonIndex + 1;

  while (quoteIndex < raw.length && /\s/.test(raw[quoteIndex])) {
    quoteIndex += 1;
  }

  if (raw[quoteIndex] !== "\"") {
    return undefined;
  }

  const nestedJsonStart = quoteIndex + 1;
  const valueStartCharacter = raw[nestedJsonStart];

  if (valueStartCharacter !== "{" && valueStartCharacter !== "[") {
    return undefined;
  }

  const candidate = readJsonCandidate(raw, nestedJsonStart);
  if (!candidate || raw[candidate.end] !== "\"") {
    return undefined;
  }

  let nextSignificantIndex = candidate.end + 1;
  while (nextSignificantIndex < raw.length && /\s/.test(raw[nextSignificantIndex])) {
    nextSignificantIndex += 1;
  }

  const nextSignificantCharacter = raw[nextSignificantIndex];
  if (
    nextSignificantCharacter !== undefined &&
    nextSignificantCharacter !== "," &&
    nextSignificantCharacter !== "}" &&
    nextSignificantCharacter !== "]"
  ) {
    return undefined;
  }

  return {
    end: candidate.end + 1,
    rawJson: candidate.raw,
    valueStart: quoteIndex,
  };
}

function shouldIncludeJsonFragment(value: unknown, options: FindJsonFragmentsInLineOptions): boolean {
  if (Array.isArray(value)) {
    return options.includePrimitiveArrays === true || value.some((item) => (
      Array.isArray(item) || isJsonObject(item)
    ));
  }

  if (isJsonObject(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
