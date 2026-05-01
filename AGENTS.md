# AGENTS

## Project Rules

- This repository is already scoped to the JSON Fragments extension. Do not prefix every file, class, type, function, or local entity with `JsonFragments`, `jsonFragments`, or similar names only to show that it belongs to this project.
- Prefixes are acceptable when they express a real domain distinction. For example, if another store appears later, names like `FragmentStore` and another domain-specific store name can make sense to distinguish responsibilities.
- Domain folders should preferably expose an `index.ts` barrel as their public entrypoint.
- Keep index files small and intentional: re-export the folder public API, but do not put implementation logic in them.
- Prefer existing project structure and naming over introducing new abstractions.
- Keep VS Code API code near integration modules. Keep scanner and formatting logic independent from VS Code APIs where possible.
- Add focused tests for domain behavior before wiring it into extension activation.

## Documentation

- High-level implementation plan: `doc/PLAN.md`.
- First user-facing feature plan: `doc/feature-1-inline-highlighting.md`.
- First implementation step details: `doc/step-1-fragment-detection.md`.
- Existing local Codex notes: `.codex`.

## Useful Commands

- `npm run check-types`: run TypeScript checks.
- `npm run lint`: run ESLint.
- `npm run compile`: run type checks, lint, and build the extension bundle.
- `npm test`: run the VS Code extension test suite.

## Implementation Notes

- Use `rg` or `rg --files` for searching.
- Use `apply_patch` for manual edits.
- Do not revert unrelated user changes in the working tree.
- Keep generated output such as `dist` and `out` changes out of source edits unless the task explicitly requires build artifacts.
