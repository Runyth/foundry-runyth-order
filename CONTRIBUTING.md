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
- Canonical English localization kept complete; non-English translations belong in independently versioned language-pack modules.
- All user-visible runtime strings use stable localization keys, and translation placeholders remain compatible with English.
- Documentation and changelog updates for public contracts.
- Deterministic install and source archives.
- The project licence is `AGPL-3.0-or-later`; keep the `SPDX-License-Identifier` header at the top of source files and preserve third-party notices.

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


## Default branch

Use `master` as the default branch for this repository and complementary Runyth Order repositories. Initialize new repositories with `git init -b master` and target `master` in pull requests and workflow filters unless a repository explicitly documents another branch.
