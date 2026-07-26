# Contributing

## Scope

Changes to the core must remain system-neutral and broadly reusable. Campaign-specific rules belong in complementary modules.

## Requirements

- Node.js 22.13.0 or newer.
- Two-space indentation.
- Public Foundry APIs only.
- ApplicationV2 for module windows.
- No external runtime service or socket dependency.
- Tests for behaviour and failure cases.
- English and German localization keys kept identical.
- Documentation and changelog updates for public contracts.
- Deterministic install and source archives.

## Commit convention

Use the Runyth capitalized Conventional Commit form, for example:

```text
Feat: Add provider diagnostics
Fix: Reject duplicate pack identifiers
Docs: Explain Actor validator purity
Prog: Refresh release tooling
```

## Pull requests

Run:

```text
npm ci --ignore-scripts
npm run check
```

Do not weaken a quality gate to make a change pass.
