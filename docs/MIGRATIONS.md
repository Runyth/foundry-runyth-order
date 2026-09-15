# Provider migrations

Migrations are an escape hatch for provider-owned data that cannot remain compatible through ordinary defensive reads.

## Properties

- Registered during provider registration.
- Listed as pending when their recorded completion record differs.
- Executed only by a Game Master.
- Never executed automatically on `init` or `ready`.
- Serialized within one connected client: each Runyth Order instance owns its own queue and running-migration set. Distinct migrations called from one client run serially, and repeated calls for the same migration converge on one run.
- Recorded complete only after successful resolution.
- Exposed through before/after hooks for logging and testing.

## Coordination across GM clients

The queue and running identifiers are per client instance, not world-wide. Two Game Master clients (two browsers, two tabs, or two clients that both trigger API calls concurrently) each own their own serialization. Two GM clients can therefore execute the same migration twice before either client's completion record is visible, because every connected client copies the world setting and writes it back.

Consequences for unsafe or non-idempotent provider handlers:

- duplicate execution can perform provider-specific changes twice;
- completion records written from stale state can be overwritten by another client.

Required mitigation: keep provider handlers idempotent and restartable, and designate a single migration runner for material transformations — one GM client runs the migrations from the Rules Hub while other clients do not call the migration API. Record the procedure in the provider's manual checklist. Future core versions may add world-level coordination; do not rely on it yet.

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

## Localization packaging in 1.0.4

Version 1.0.4 removes non-English dictionaries from the foundation runtime and distributes them through independent language-pack modules. This changes no world setting, provider descriptor, completed migration record, managed source flag, Actor, Item, compendium, or application state. No migration is registered.

A Game Master may install or remove a language pack and use Foundry’s global language setting. Translation-package lifecycle is outside the persistent data migration service.
