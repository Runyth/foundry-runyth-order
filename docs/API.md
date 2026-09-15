# Public API 1.0.0

Access the API through:

```javascript
const api = game.modules.get("runyth-order")?.api;
```

The same object is supplied by `runyth-order.apiReady` and resolves from `await api.whenReady()`.

## Identity

| Property | Value |
|---|---|
| `moduleId` | `runyth-order` |
| `apiVersion` | `1.0.0` |
| `dataSchemaVersion` | `1` |
| Display title | `Runyth Order` |

## Registration

### `registerProvider(provider)`

Atomically validates and registers one provider plus any nested packs, validators, and migrations. It returns an immutable provider descriptor. Registration throws `ProviderValidationError` on invalid data.

### `registerPack(providerId, pack)`

Adds a pack to an already registered provider. Prefer nested provider registration when possible because that operation is atomic across all contributions.

### `registerActorValidator(providerId, validator)`

Registers a bounded, non-mutating Actor validator.

### `registerMigration(providerId, migration)`

Registers a GM-only explicit migration. Registration does not run it.

### `unregisterProvider(providerId)`

Removes the provider and all of its runtime descriptors and handlers. It does not delete Foundry documents or provider flags.

## Discovery

### `listProviders()` / `getProvider(providerId)`

Returns immutable descriptors. Unknown providers return `null`. A descriptor may include normalized Runyth Order `naming` metadata.

### `listNamingFindings(filters)`

Returns immutable naming findings without emitting new console warnings. Filters support `providerId` and `severity` (`info` or `warning`). Stable codes and compatibility behavior are defined in [Naming Contract](NAMING_CONTRACT.md).

### `listPacks(filters)` / `getPack(packId)`

Supported filters:

```javascript
{
  providerId: "example-homebrew",
  systemId: "dnd5e",
  contentKind: "subclass"
}
```

Global pack IDs use `<providerId>.<localPackId>`.

### `hasCapability(capability, filters)`

Checks whether at least one matching provider declares a capability. Filters support `providerId` and `systemId`.

### `snapshot()`

Returns one immutable snapshot containing providers, packs, validators, and migrations. It never exposes executable handler functions.

## Content references

### `resolveContent(reference)`

Accepts either a Foundry UUID string or:

```javascript
{
  packId: "example-homebrew.subclasses",
  entryId: "oath-of-the-harbor"
}
```

The registry entry must contain a resolvable `uuid`. Providers may use their own provisioning API for entries represented by structured source data instead of UUIDs.

## Actor audit

### `auditActor(actorOrUuid, options)`

Runs generic source checks and matching provider Actor validators. The core does not update the Actor.

The configured actor-audit permission (`owner` or `gm`, with Game Masters always allowed) is enforced centrally for every call: the service authorizes the resolved Actor before running any boundary hook, source inspection, or provider validator. Denied calls reject without producing a report or invoking validators. The Rules Hub applies the same policy before its own button becomes available.

The report shape is:

```javascript
{
  schemaVersion: 1,
  actor: {
    uuid: "Actor.abc",
    id: "abc",
    name: "Example",
    type: "character"
  },
  startedAt: "2026-07-26T20:00:00.000Z",
  completedAt: "2026-07-26T20:00:00.041Z",
  counts: {
    info: 0,
    warning: 1,
    error: 0
  },
  issues: [
    {
      id: "example-homebrew:missing-choice:1",
      providerId: "example-homebrew",
      severity: "warning",
      code: "missing-choice",
      title: "Missing choice",
      message: "Select one homebrew discipline.",
      remediation: "Open the class Advancement flow.",
      documentUuid: "Actor.abc",
      data: {}
    }
  ],
  providerRuns: [
    {
      validatorId: "example-homebrew.progression",
      status: "ok",
      issueCount: 1,
      durationMs: 4
    }
  ]
}
```

`startedAt`/`completedAt` are the canonical timestamp contract of the audit report; the Diagnostics report uses `generatedAt` because it represents one completed snapshot.

## Diagnostics

### `runDiagnostics({ deep = false, minimal = false })`

Checks:

- provider module activation and version;
- active-system support and version range;
- required and optional module dependencies;
- declared compendia;
- pack/system mismatches;
- pending migrations;
- entry UUID resolution when `deep` is true.

The full report uses `mode: "full"` and includes normalized provider and pack descriptors, pending migration detail, and finding data. With `minimal: true` it returns `mode: "minimal-support"`: the same `generatedAt`, core versions, system id/version, counts, and finding codes only — no descriptors, titles, UUIDs, migration detail, or finding data. The full report is JSON-safe and suitable for support requests after private fields have been reviewed. The minimal export is the pre-reviewed form for public issue reports; the same summary is available from the Rules Hub "Copy support summary" action.

## Migrations

### `listPendingMigrations(filters)`

Lists registered migrations whose version has not been recorded as completed. Supports `providerId`.

### `runMigration(migrationId)`

Runs one migration as a Game Master. Serialization applies within this client: concurrent calls for distinct migrations in one client run serially, and repeated calls for one migration return the same tracked run. This is not world-wide coordination — two Game Master clients can run the same migration concurrently because each client owns its own queue. Designate a single migration runner and keep provider handlers idempotent. See [Migrations](MIGRATIONS.md#coordination-across-gm-clients). Completion is recorded only after the handler resolves successfully.

### `runPendingMigrations(filters)`

Runs pending migrations in registry order. The Rules Hub requires explicit confirmation and warns the GM to back up the world.

## Source metadata

### `normalizeSource(source)`

Validates and normalizes a source descriptor.

### `readSource(document)`

Reads `flags.runyth-order.source` from a Foundry document and returns an immutable copy.

### `tagDocument(document, source, options)`

GM-only. With default `{ update: true }`, writes the normalized flag. With `{ update: false }`, returns an update object suitable for inclusion in a larger atomic document creation/update operation.

## UI

### `openHub({ activeTab })`

Opens or focuses the Rules Hub. Valid tabs are `overview`, `providers`, `packs`, `audit`, and `diagnostics`.

## Hooks

| Hook | Arguments |
|---|---|
| `runyth-order.apiReady` | `(api)` |
| `runyth-order.ready` | `(api)` |
| `runyth-order.providerRegistered` | `(providerDescriptor, api)` |
| `runyth-order.providerRejected` | `(submittedProvider, error, api)` |
| `runyth-order.packRegistered` | `(packDescriptor, api)` |
| `runyth-order.beforeAuditActor` | `(actor)` |
| `runyth-order.afterAuditActor` | `(actor, report)` |
| `runyth-order.beforeMigration` | `(migrationDescriptor)` |
| `runyth-order.afterMigration` | `(migrationDescriptor, report)` |

## Localization is not an API service

Runyth Order does not expose language selection or translation registration through its JavaScript API. Localization uses Foundry’s package `languages` manifest field and global language setting. The canonical key contract is documented in `LOCALIZATION.md`. External language packs do not need to call `registerProvider` unless they also contribute actual provider content or behavior.
