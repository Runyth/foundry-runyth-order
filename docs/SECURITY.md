# Security and trust boundaries

## Installed modules are trusted code

Runyth Order validates provider descriptors, but it cannot sandbox the JavaScript of an enabled Foundry module. A malicious provider could ignore the public API and access any data available to the client. Review providers as independent software.

## Release history guarantees

Release archives carry only reconstructed, credential-free Git metadata built from the explicitly approved public refs. Release verification cryptographically checks each baseline release signature against the repository's public key (`keys/release-signing.asc`) and structural baseline (`tools/release-baseline.json`): identity, preserved author/committer timestamps with offsets, message digests, parent mapping, and tag correspondence. Scanners cover credential-shaped content and previously removed identity material across decoded objects, Git metadata, and archive files.

## GM authority

- Source tagging through the core is GM-only.
- Migration execution is GM-only.
- Actor audit access follows the configured permission and Actor ownership. The permission is enforced centrally inside the audit service after the Actor is resolved and before any audit hook, source inspection, or provider validator runs. The Rules Hub pre-check and the public API path cannot bypass it.
- Provider registration is runtime code registration, not a player-facing operation.

## Client synchronization

Do not store real-world secrets, credentials, private keys, or sensitive personal data in provider descriptors, settings intended for clients, document flags, or UI-hidden fields.

## No remote execution

The core does not fetch providers, import JavaScript from URLs, evaluate descriptor strings, or execute migration code not already registered by an active installed module.

## Diagnostics exports

Runyth Order provides two diagnostics sharing levels:

- **Minimal support summary** (default "Copy support summary" in Rules Hub, or `runDiagnostics({ minimal: true })`): core versions, counts, and finding codes (severity, code, provider, pack). No provider or pack descriptors, titles, UUIDs, migration detail, or arbitrary finding data.
- **Full JSON** (`runDiagnostics()` or "Copy full JSON"): complete descriptors with compendium IDs, entry titles, module dependency declarations, pending migrations, and arbitrary provider- or world-supplied metadata. It may contain content names and world document UUIDs; review it and share it privately.

Audit reports always include the audited Actor's name, ID, and UUID, managed Item/source details, and provider issue data. Use them locally.

Error traces kept inside reports preserve complete stack traces. Stacks can contain personal filesystem paths and content-dependent messages. Redact or reuse the minimal summary before publishing.

Diagnostics may reveal module IDs, versions, and system versions even in the minimal summary. Review any export before publishing. Do not attach a whole world export to a public issue.
