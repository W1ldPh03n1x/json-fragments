# Step 1: Fragment Detection

## Purpose

Build the domain layer that finds valid JSON object and array fragments inside arbitrary text.

This step should not depend on VS Code APIs. The result should be reusable by highlighting, hover previews, static preview tabs, and dynamic preview tabs.

Scanner implementation should live in `src/scanner`. Domain types that are shared with the rest of the extension can stay in `src/domain`.

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
- primitive-only arrays when `includePrimitiveArrays` is disabled;
- JSON serialized inside string values.

## Serialized JSON Strings

JSON fragments can appear inside serialized JSON strings, but this is out of scope for the MVP.

Example:

```json
{
  "payload": "{\"user\":{\"id\":1,\"name\":\"Ann\"}}"
}
```

In this case the scanner should find only the outer object. The `payload` field remains a regular string value.

Do not recursively deserialize string values in the first implementation.

Future setting:

- `json-fragments.deserializationDepth`;
- default: `0`;
- `0`: only scan JSON fragments visible directly in the source text;
- `1`: after finding a fragment, try to parse JSON-looking string values inside it;
- `2+`: repeat the same process for strings inside deserialized values.

The MVP behaves as if `deserializationDepth` is always `0`. If this feature is added later, the scanner must never recurse without a hard limit.

## Proposed API

The scanner should live in `src/scanner`.

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

- source URI when available at integration level, but not from the scanner itself;
- start line and character;
- end line and character;
- raw JSON text;
- parsed JSON value.

For pure domain tests, URI can be optional or added later by VS Code integration code.

The scanner should not generate global fragment IDs. If an integration layer needs an ID for cache, hover, click, or preview features, it can derive one from document URI, document version, and source range.

## Source Fragment Policy

For the MVP, scanner results are only direct source fragments.

The scanner should return the outermost valid JSON fragment that starts in arbitrary text. It should not return internal objects or arrays as separate fragments when they are part of an already accepted outer fragment.

Example:

```text
prefix {"a":{"b":1}} suffix
```

Return:

```json
{"a":{"b":1}}
```

Do not also return:

```json
{"b":1}
```

This avoids overlapping ranges, nested decorations, and ambiguous hover/click behavior.

## Detection Strategy

1. Walk through the input text character by character.
2. Treat `{` and `[` outside strings as possible fragment starts.
3. Track nested `{}`, `[]`, string state, and escapes.
4. When the stack returns to zero, parse the candidate with `JSON.parse`.
5. Keep only valid object and array fragments.
6. Apply `includePrimitiveArrays` filtering for arrays.
7. Return exact source ranges for accepted fragments.
8. Continue scanning after the accepted fragment end so internal objects and arrays are not returned separately.

## Nested Fragment Ranges

Direct fragments found in source text must have exact source ranges.

Nested fragments found by deserializing string values are different: their text range inside the source document may not map cleanly to the decoded JSON because escaping changes character positions.

For the first version:

- direct source fragments should be highlightable;
- nested deserialized fragments should not be returned;
- inline highlighting for nested decoded content can be postponed.

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
- primitive-only array enabled and disabled;
- serialized JSON string remains a string value;
- internal object inside an outer object is not returned separately;
- internal objects inside an outer array are not returned separately.

## Done Criteria

- Scanner logic is implemented under `src/scanner`.
- Public domain exports are exposed through `src/domain/index.ts`.
- Public scanner exports are exposed through `src/scanner/index.ts`.
- Unit tests cover the main detection cases.
- `npm run check-types` and `npm run lint` pass.
