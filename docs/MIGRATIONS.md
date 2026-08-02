# Provider migrations

Migrations are an escape hatch for provider-owned data that cannot remain compatible through ordinary defensive reads.

## Properties

- Registered during provider registration.
- Listed as pending when their recorded completion version differs.
- Executed only by a Game Master.
- Never executed automatically on `init` or `ready`.
- Serialized to prevent concurrent migration runs.
- Recorded complete only after successful resolution.
- Exposed through before/after hooks for logging and testing.

## Descriptor

```javascript
{
  id: "flags-v2",
  title: "Migrate flags to schema 2",
  description: "Converts provider-owned Actor flags.",
  version: "2.0.0",
  scope: "documents",
  requiresBackup: true,
  async run({ game, migration, logger }) {
    return { updated: 0 };
  }
}
```

## Idempotency

A migration must inspect the actual target data rather than assuming the completion record is perfect. If interrupted after updating some documents but before the completion record is written, rerunning it must safely skip already converted documents.

## Bounded work

Large worlds should process documents in deterministic batches and yield to the browser event loop. Avoid loading every compendium document unless the migration specifically owns and needs it.

## Rollback

Foundry document updates are not one global transaction. A provider should document whether rollback is possible, emit enough counts for verification, and require a world backup for material transformations.


## Pre-publication package identity finalization

Version 1.0.3 finalizes the unpublished foundation package as `runyth-order`, including its settings, hooks, API lookup, and managed-source namespace. No compatibility migration is registered because the earlier experimental package identity was neither published nor distributed. Test worlds using an earlier development build should remove that build and install 1.0.3 cleanly.

This package-identity change does not alter provider-owned document structures or the public API method surface. Complementary modules must update their required-module ID, API lookup, hooks, source-flag expectations, documentation, and tests before being used with 1.0.3.
