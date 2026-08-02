# Changelog

All notable changes to **Runyth Order** are documented here.

## 1.0.2 — 2026-08-02

- Renamed the complete user-facing core brand to **Runyth Order** while preserving module ID `runyth-rules-core`, API lookup, hooks, settings, source flags, provider IDs, and migration records.
- Added the canonical complementary-module naming contract `Runyth Order: <Category> <Content Name>` and recommended `runyth-order-<category-slug>-<content-name-slug>` IDs.
- Added validated provider `naming` metadata and manifest `flags.runyth` guidance.
- Added non-blocking provider-title and module-title mismatch warnings with stable codes, machine-readable details, per-world-load deduplication, diagnostics visibility, and localized Rules Hub presentation.
- Added a legacy compatibility policy that accepts providers without naming metadata and reports an informational finding without guessing a canonical title.
- Added a dedicated naming-contract document and updated all developer, API, architecture, troubleshooting, migration, testing, and release documentation.
- Changed repository workflow and example links to use `master` as the default branch.
- Added comprehensive naming-contract tests without introducing a display-only data migration.

## 1.0.1 — 2026-08-02

- Replaced the obsolete Foundry V12 Scene Controls `onClick`/array integration with the public Foundry V13 `Record<string, SceneControl>` and `SceneControlTool.onChange` contract, including explicit tool ordering.
- Reused the public ApplicationV2 instance registry so Module Settings, keybinding, Settings sidebar, and Scene Controls cannot create competing Rules Hub instances.
- Prevented completed audits, diagnostics, and migrations from forcing a closed Rules Hub window to reopen.
- Added duplicate-operation guards and disabled affected controls while the Rules Hub is busy.
- Added viewport-aware position sanitization so saved windows recover from monitor, resolution, zoom, and viewport changes.
- Improved responsive layout, field padding, button wrapping, long-label handling, and small-screen behavior.
- Prevented ambiguous multi-Actor token selections from silently falling back to the assigned user character.
- Prevented patch updates within the same major/minor line from repeating the onboarding notification.
- Serialized distinct concurrent migrations while deduplicating repeated requests for the same migration.
- Added diagnostics for pack-level dependencies and cached repeated deep UUID resolutions.
- Rejected malformed, inverted, duplicated, and structurally invalid provider compatibility declarations before registration.
- Expanded automated coverage from 18 to 27 tests and added explicit Foundry V13 launcher and window-lifecycle gates.

## 1.0.0 — 2026-07-26

- Added API 1.0.0 for atomic complementary-module provider registration.
- Added namespaced content packs, capability discovery, Actor validators, and explicit migrations.
- Added immutable registry snapshots and managed-document source metadata.
- Added non-mutating Actor audits with bounded provider validators.
- Added provider, dependency, system, compendium, UUID, and migration diagnostics.
- Added an ApplicationV2 Rules Hub with persistent geometry and redundant launchers.
- Added English and German localization.
- Added complete complementary-module developer documentation, JSON schemas, and an example provider.
- Added dependency-free validation, automated tests, deterministic dual-ZIP packaging, checksums, and release verification.
