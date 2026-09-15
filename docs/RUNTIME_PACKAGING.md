# Runtime packaging contract

Runyth Order keeps editable JavaScript modules under `src/` but distributes a generated browser graph. This is a release-integrity boundary, not a public API change.

## Build model

1. `tools/runtime-graph.mjs` walks every `.mjs` file under `src/`.
2. Every relative static or literal dynamic import is resolved against an exact case-sensitive source inventory. Imports that escape `src/`, differ only by case, or target a missing file fail the build.
3. The build emits all source modules into `runtime/v<version>/` using deterministic neutral filenames and rewrites internal ESM specifiers to those emitted names.
4. `graph.json` records source files, emitted files, SHA-256 hashes, and every runtime edge.
5. `bootstrap.mjs` dynamically imports the emitted `src/main.mjs` equivalent and catches a fetch/link failure once.
6. `module.json` points only to the guarded bootstrap.
7. The install ZIP includes the complete `runtime/v<version>/` graph and excludes editable `src/`.

## Why the runtime path is versioned

An upgrade may be extracted over an existing module directory and browser caches can retain earlier ESM responses. A versioned runtime directory makes every patch use a distinct URL namespace, so current imports cannot silently resolve to previous-release files. Old files left by an overlay extraction are inert because the manifest and runtime graph do not reference them.

## Failure semantics

The emitted main module still uses ordinary ESM semantics. All of its dependencies must fetch and link before its code evaluates. If any required emitted file is unavailable, the bootstrap receives one rejected dynamic import. It logs one fatal error, clears any exposed module API defensively, and schedules one permanent notification after Foundry reaches `ready`. No registry, audit service, diagnostics service, or migration service is partially constructed.

## Source archive Git metadata

The source ZIP intentionally contains usable Git history with reconstructed, credential-free Git metadata. It is never a raw backup of the CI checkout:

1. Publication staging resolves one explicit build revision: the release tag when `RUNYTH_RELEASE_REF` is set, the checked-out `HEAD` otherwise. Developer local builds refuse uncommitted tracked changes unless `RUNYTH_ALLOW_UNCOMMITTED=1` is set explicitly.
2. The retained-ref policy preserves the source branch's exact tip as staged `refs/heads/master`, keeps the selected `refs/tags/v*` release tags with their actual ref target objects (annotated tags keep their tag objects with tagger/message/signature bytes; lightweight tags keep their commit targets), and pins a build revision that is not reachable from those refs under an explicit approved `refs/heads/staged-revision` ref. Pack inputs, counts, digests and verification derive from this exact union closure; two staging runs produce identical pack bytes because regenerating canonical packs disables reused deltas and pins pack settings. Retained HEAD is checked as branch provenance, while release/pinned provenance and the exact worktree revision are verified separately from it.
3. The staged repository's object storage must contain exactly the approved reachable closure: verification compares all stored object IDs with the closure of the retained refs and rejects extras and omissions, and the recorded closure digest covers the full object-ID list rather than a count alone.
4. The reconstructed `.git/config` is a byte-fixed closed set of four safe core fields. No remote URL, credential helper, extraheader, include directive, signing key, or author identity is written; implementation uses `git init --template=`, hook removal before any import or ref operation, sanitized Git environment variables, and a metadata allow-list that rejects unknown files, directories and symlinks.
5. Working files are materialized from the staged revision tree (`git archive`), so untracked or leftover developer files cannot enter the archives.
6. Release verification re-checks the extracted archive: `git fsck --full --strict`, the metadata allow-list, exact selected refs with recorded objects, the closed config, decoded-object/archive-file/metadata scanning for credential-shaped content (classic and fine-grained tokens, authenticated HTTP/HTTPS URLs, Basic and Bearer authorization forms, private key blocks) and removed-identity material, companion/baseline variant scanning over the extracted project files, baseline row comparisons (both identities, independently preserved author/committer epochs and offsets, message digests, parent mapping, tag positions), full stored-object versus approved-closure equality, archived manifest/licence equality with the working tree, the central audit authorization marker in packaged runtime, and a byte-identical rebuild of both archives from the clean extraction staging the exact recorded revision.

## Release verification

Automated validation checks:

- exact-case source graph resolution;
- no source import outside `src/`;
- manifest entrypoint equality with the generated graph;
- emitted file existence and SHA-256 hashes;
- every emitted runtime edge;
- install ZIP inclusion of the bootstrap, graph, LICENSE, and all emitted files;
- absence of install-time `src/` ESM files;
- deterministic byte-identical rebuilds of both archives from two independent staging runs with preserved artifacts;
- clean source extraction, retained Git metadata allow-list, baseline signature verification, and byte-identical rebuild from the clean extraction;
- canonical, credential-free Git metadata and explicit build-revision selection on the source ZIP.
