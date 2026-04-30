# Step 1: Fragment Detection

## Purpose

Build the domain layer that finds valid JSON object and array fragments inside arbitrary text.

This step should not depend on VS Code APIs. The result should be reusable by highlighting, hover previews, static preview tabs, and dynamic preview tabs.

## Scope

Implement detection for:

- a single line of text;
- a text block with a known starting line and character offset;
- JSON objects starting with `{` and arrays starting with `[`;
- nested objects and arrays;
- strings with escaped quotes and escaped characters.

Ignore:

- invalid JSON;
- incomplete fragments;
- primitive standalone values such as strings, numbers, booleans, and `null`;
- primitive-only arrays when `includePrimitiveArrays` is disabled.

## Proposed API

The scanner should live in `src/domain`.

Possible public functions:

- `scanLine(text, line, options): Fragment[]`;
- `scanText(text, startLine, startCharacter, options): Fragment[]`;
- `formatFragment(value): string`.

Possible options:

- `includePrimitiveArrays: boolean`;
- `maxInputLength: number`;
- `maxFragmentLength: number`.

## Fragment Shape

Reuse and extend the existing `Fragment` type if needed.

The domain result should include:

- source URI when available at integration level;
- start line and character;
- end line and character;
- raw JSON text;
- parsed JSON value.

For pure domain tests, URI can be optional or added later by VS Code integration code.

## Detection Strategy

1. Walk through the input text character by character.
2. Treat `{` and `[` outside strings as possible fragment starts.
3. Track nested `{}`, `[]`, string state, and escapes.
4. When the stack returns to zero, parse the candidate with `JSON.parse`.
5. Keep only valid object and array fragments.
6. Apply `includePrimitiveArrays` filtering for arrays.
7. Return exact source ranges for each accepted fragment.

## Test Cases

Cover at least:

- one object in a line;
- one array in a line;
- multiple fragments in one line;
- nested object and array;
- braces inside JSON strings;
- escaped quotes inside strings;
- invalid JSON-like text;
- incomplete JSON at end of line;
- multiline object in selected text;
- primitive-only array enabled and disabled.

## Done Criteria

- Scanner logic is implemented under `src/domain`.
- Public domain exports are exposed through `src/domain/index.ts`.
- Unit tests cover the main detection cases.
- `npm run check-types` and `npm run lint` pass.
