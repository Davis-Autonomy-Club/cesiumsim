# Contributing

## Runtime Code Placement

- Put new runtime code under `src/**`.
- Use the canonical runtime layout defined in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- New simulator runtime work belongs in `src/main.ts` and `src/simulator/**`.
- Future evaluation work belongs in `src/evaluation/**`.
- Future gym or environment integration work belongs in `src/gym/**`.

## Legacy Runtime Rules

- Root JavaScript runtime files are legacy and reference-only.
- Do not expand root runtime JavaScript files or add new runtime modules outside `src/**`.
- Do not delete legacy runtime files in refactors like this one unless the ticket explicitly calls for that migration.

## Change Scope

- Preserve simulator behavior unless the ticket explicitly asks for a behavior change.
- Port the smallest useful piece from legacy code instead of copying legacy runtime structure forward.
- If you need a new top-level runtime namespace, update [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) in the same change.

## Validation

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm run benchmark:smoke` when that script exists.
- GitHub Actions runs the same validation flow with `npm ci` on pushes and pull requests.
