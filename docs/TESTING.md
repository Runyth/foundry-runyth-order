# Testing strategy

## Automated gate

```text
npm ci --ignore-scripts
npm run check
```

The gate covers:

- deterministic formatting rules;
- prohibited runtime patterns and basic source linting;
- registry validation, atomic rollback, immutability, capabilities, version ranges;
- source metadata;
- Actor audit normalization and provider failure isolation;
- migration completion and retry behaviour;
- manifest, English localization, external language-pack metadata, placeholder, path, schema, API, and example validation;
- JavaScript syntax with Node;
- deterministic install/source ZIP creation;
- archive root, file allowlist, version, checksum, and reproducibility verification.

## Live qualification

Static and unit tests do not prove browser rendering, Foundry hook signatures, module interaction, document migrations, or a particular game-system data model. Use `MANUAL_TEST_CHECKLIST.md` in the intended stack.

## Provider test doubles

Complementary modules should test their registration against the public API rather than importing core private classes. The included example demonstrates a minimal registration flow.


## Naming-contract coverage

Automated tests cover canonical titles, provider/module mismatches, warning deduplication, multiword metadata, legacy compatibility, core exclusion, diagnostics visibility, provider-count preservation, and absence of a display-only migration. Live tests verify module-management text and console behavior in Foundry.

## Localization coverage

Automated tests verify that the core manifest bundles only `en`, every literal `RO.*` key exists in the canonical dictionary, values are non-empty strings, localization metadata advertises Foundry selection and external packs, and no module-specific language control is registered. Separate language-pack repositories must compare their keys and interpolation placeholders against the target core release.

## Runtime/package graph coverage

The automated gate additionally validates the complete editable ESM graph and generated browser graph. It checks exact-case source targets, rejects imports escaping `src/`, regenerates the versioned runtime graph deterministically, verifies emitted file hashes and every runtime edge, confirms the manifest points to the guarded bootstrap, confirms the install ZIP contains every runtime resource, and confirms no install-time ESM import points back to `src/`. Release verification stages the build revision once more and compares both archives byte-for-byte, so the two artifacts are preserved independently before the comparison.

The source ZIP includes reconstructed, credential-free Git history transferred as a canonical object closure from the explicitly selected public refs, and both archives can be rebuilt byte-identically from a clean extraction of that history.

## Staging and release-verification coverage

Dedicated tests stage disposable fixture repositories and assert that:

- the reconstructed metadata passes its allow-list policy (`HEAD`, closed config, canonical pack storage, approved refs only) with no `hooks`, `objects/info`, reflogs, or leftover runner files;
- developer credential configuration (helpers, authorization headers, includes, signing references) and untracked secret files never reach the staged tree or archives;
- synthetic Git template/environment canaries (template directories, injected `GIT_CONFIG_*` variables) are stripped by environment isolation and absent from the final metadata;
- canonical pack transfer is byte-reproducible across independent staging runs;
- detached release revisions stage and archive the exact tagged tree while the branch history stays retained;
- staging a release revision behind an advanced master (untagged or tagged ahead) packages that exact tagged tree, retains the full approved closure, and fails explicitly when an unselected object appears in pack storage;
- release verification reconciles the stored object set with the recorded closure digest and count, detects Basic and Bearer credential headers and HTTP authenticated URLs, enforces extracted-file credential scanning from the archive root, and verifies baseline parent/tag positions and both identity/date field sets independently;
- end-to-end production fixtures run the real build and release verifier inside disposable checkouts: an annotated release tag over an identical commit, a release tag behind an advanced untagged master, a retained annotated tag on a newer tagged tip above an earlier release, and a GitHub-style PR detached revision with its pinned provenance ref.
- the tag/manifest guard rejects mismatched public release-tag invocations before any archive is produced.
- credential-shaped content (classic and fine-grained tokens, authenticated URLs, `AUTHORIZATION`/`extraheader` basic syntax, private key blocks) fails the archive scanners while harmless documentation and scanner sources do not;
- distinctive companion-name and baseline-phrasing variants are detected across spaced, hyphenated, underscored, and compact forms while ordinary RPG vocabulary remains accepted.
