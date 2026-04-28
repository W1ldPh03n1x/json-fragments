export type JsonFragmentInLine = {
  start: number;
  end: number;
  raw: string;
  value: unknown;
};

export function findJsonFragmentsInLine(line: string): JsonFragmentInLine[] {
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
      fragments.push({
        start: index,
        end: candidate.end,
        raw: candidate.raw,
        value: JSON.parse(candidate.raw) as unknown,
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
