# Security and trust boundaries

## Installed modules are trusted code

Runyth Rules Core validates provider descriptors, but it cannot sandbox the JavaScript of an enabled Foundry module. A malicious provider could ignore the public API and access any data available to the client. Review providers as independent software.

## GM authority

- Source tagging through the core is GM-only.
- Migration execution is GM-only.
- Actor audit access follows the configured permission and Actor ownership.
- Provider registration is runtime code registration, not a player-facing operation.

## Client synchronization

Do not store real-world secrets, credentials, private keys, or sensitive personal data in provider descriptors, settings intended for clients, document flags, or UI-hidden fields.

## No remote execution

The core does not fetch providers, import JavaScript from URLs, evaluate descriptor strings, or execute migration code not already registered by an active installed module.

## Diagnostics exports

Diagnostics may reveal module IDs, versions, system versions, compendium IDs, content titles, and UUIDs. Review JSON before publishing it. Do not attach a whole world export to a public issue.
