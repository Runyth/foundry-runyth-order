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


## Display-name changes are not migrations

The 1.0.2 rename to **Runyth Order** changes only user-facing text. It does not transform settings, provider IDs, source flags, migration records, or world documents. No migration is registered for this rename.
