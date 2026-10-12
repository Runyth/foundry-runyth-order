# Changelog

All notable changes to **Runyth Order** are documented here.

## Unreleased

- Hardened the Rules Hub settings launcher: localized values (including text from installed language-pack modules) are inserted only through text-safe DOM nodes so no localized value is ever parsed as HTML markup.
- Enforced the published `date-time` schema format during contract validation: contract tests now register canonical RFC 3339 enforcement instead of silently ignoring the declared format, while runtime timestamps continue to satisfy it.

## 1.0.6 — 2026-10-11

- Release verification now stages a single, explicit build revision (release tag in public CI via `RUNYTH_RELEASE_REF`, checked-out `HEAD` otherwise), rejects uncommitted tracked inputs, and cross-checks the archived install/source manifests and licence against the working tree manifest and upload checksums.
- Git metadata reconstruction switched to a canonical object closure (`git pack-objects --no-reuse-delta --no-reuse-object` plus `git index-pack`) with pinned pack settings, template-free initialization, sanitized Git environment, an enforced metadata allow-list, and byte-reproducible pack storage across independent staging runs; reproducibility comparisons preserve the first artifacts before re-running.
- Retained-history assurance: release verification imports the repository public key (`keys/release-signing.asc`) into an isolated keyring and cryptographically verifies every baseline release signature while enforcing `tools/release-baseline.json` (identities, independently preserved epoch timestamps/offsets, message digests, parent mapping, tag correspondence).
- Secret scanning decodes one object record at a time and detects classic and fine-grained tokens, authenticated HTTP and HTTPS URLs, `AUTHORIZATION` Basic and Bearer syntax, and private key blocks; scanner definitions are fragment-composed so the checker never embeds matchable literals, and scans cover decoded objects, Git metadata, and the extracted project-file inventory built from the archive root.
- The retained-ref policy keeps the source branch's exact tip as staged `refs/heads/master`, preserves the selected release tags, pins unreachable build revisions behind an explicit approved ref, records the closure's exact object-ID digest and count, and rejects stored objects outside that closure; the clean-extraction rebuild stages the exact recorded revision, including a release tag selected behind an advanced master.
- Annotated release-tag objects transfer with the retained closure (tag object bytes, tagger metadata and signatures preserved; peeled commits only select the worktree revision), and release verification treats HEAD as branch provenance while checking release/pinned revision provenance and worktree-tree equality separately.
- End-to-end production regressions run the real build and release verifier inside disposable checkouts for annotated-tag, advanced-untagged/tagged-master, and PR-style detached revisions.
- Schemas validated with the standard Draft 2020-12 validator (dev-only dependency); registration accepts the supported nullable `naming` form and normalized-pack fixtures exercise non-empty dependencies through parent-document reference resolution.
- Re-licensed the project as `AGPL-3.0-or-later`: the complete GNU AGPLv3 text ships in `LICENSE`, package metadata and project notices use the exact SPDX identifier, and source files carry per-file SPDX headers.
- Enforced the configured Actor-audit permission centrally inside the audit service; denied API calls (object or UUID input) reject before any audit hook, source inspection, or provider validator runs.
- Reworked the published JSON schemas into separate registration-intent and normalized-output contracts, aligned the Actor-audit report schema with the runtime timestamp contract, and added schema validation of real registration examples and live runtime output.
- Corrected TypeScript declaration drift for provider registration inputs, source descriptor inputs, and normalized descriptor nullability.
- Added a minimal support summary export to diagnostics (`runDiagnostics({ minimal: true })`) and a Rules Hub "Copy support summary" action; the full JSON copy remains explicitly labelled for private troubleshooting.
- Documented the per-client serialization limits of the migration coordinator and the single-runner procedure.
- Publication packaging now reconstructs credential-free Git metadata from explicitly selected public refs instead of archiving the checkout's working `.git`, disables checkout credential persistence in CI, and release verification checks complete history, exact refs, reconstructed config, signatures, and a byte-identical rebuild from a clean extraction.
- Corrected public distribution URLs to the intended repository and documented a concrete private vulnerability-reporting route; pinned workflow actions to full commit SHAs.
- Neutralized example identities in documentation and tests; replaced campaign-specific regression checks with example-provider checks and optional companion-provider notes.
- Continuous integration reconstructs retained public refs after tag checkouts so canonical staging works without a complete local ref inventory.
- Pipeline fixtures neutralize ambient release environment variables and fetch only refs that actually exist in the checked-out source, skipping explicitly when required public refs are absent.

## 1.0.5 — 2026-09-15

- Replaced direct browser loading of the editable `src/` tree with a deterministic, versioned runtime graph under `runtime/v1.0.5/`.
- Added a guarded bootstrap entrypoint that reports a single fatal initialization error if a required runtime module cannot be fetched or linked, without leaving a partially initialized registry.
- Added deterministic source-to-runtime import rewriting with neutral emitted filenames to avoid stale-path, case, rename, and content-filter sensitivity while preserving the public API and provider contract.
- Added strict case-sensitive source import-graph validation, runtime edge validation, source hash validation, and install-archive runtime completeness checks.
- Removed editable `src/` files from the install ZIP; all browser-loaded ESM resources now come exclusively from the generated versioned runtime graph.
- Added runtime graph metadata and upgrade-safe versioned paths so a 1.0.5 install never imports stale 1.0.4 ESM resources after an overlay upgrade or browser cache reuse.
- Expanded release verification to require the guarded bootstrap, runtime graph manifest, complete emitted dependency graph, and Git history in the reproducible source ZIP.
- Added provider regression fixtures for registry reset/reload behavior and documented live checks against realistic homebrew providers.
- Preserved API 1.0.0, provider descriptors, source flags, settings, hooks, and migration records without adding a data migration.

## 1.0.4 — 2026-08-03

- Replaced the built-in bilingual runtime bundle with an English-only canonical interface and independent language-pack modules.
- Removed `lang/de.json` and the German manifest entry from the Runyth Order runtime package.
- Kept all user-facing strings in the stable `RO.*` namespace and retained Foundry’s native `languages`, `game.i18n.localize`, and Handlebars localization workflow.
- Added machine-readable localization metadata to `module.json` and a JSON schema for external language-pack metadata.
- Added a dedicated localization contract covering Foundry’s global language selector, translation-pack identity, placeholder safety, versioning, content localization, and further-language development.
- Added validation that the core bundles exactly one English dictionary, exposes no custom language selector, and retains complete English key coverage.
- Distributed the existing German translation through the independent external language-pack module channel rather than the core runtime.
- Added no persistent-data migration because localization packaging does not change settings, provider IDs, source flags, or world documents.

## 1.0.3 — 2026-08-03

- Finalized the unpublished foundation module ID as `runyth-order`.
- Changed the API lookup, settings namespace, hook prefix, managed-source flag namespace, ApplicationV2 IDs, CSS namespace, package name, repository links, archive roots, schemas, examples, tests, and release tooling to the canonical Runyth Order identity.
- Renamed the runtime API class and TypeScript interface to `RunythOrderApi`.
- Renamed localization keys from the former internal abbreviation to the `RO.*` namespace and renamed UI CSS selectors and variables to the `ro-` namespace.
- Updated the example complementary provider to require `runyth-order` 1.0.3 and use the new API and source namespace.
- Added validation that rejects any reintroduction of the retired experimental identity in source files.
- Documented that all complementary modules must update their dependency ID and API integration; no compatibility migration is included because the previous identity was never published or distributed.

## 1.0.2 — 2026-08-02

- Established **Runyth Order** as the complete user-facing brand and introduced the complementary-module naming contract.
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
