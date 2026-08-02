# Public API 1.0.0

Access the API through:

```javascript
const api = game.modules.get("runyth-rules-core")?.api;
```

The same object is supplied by `runyth-rules-core.apiReady` and resolves from `await api.whenReady()`.

## Identity

| Property | Value |
|---|---|
| `moduleId` | `runyth-rules-core` |
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

Runs generic source checks and matching provider Actor validators. The core does not update the Actor. The report shape is:

```javascript
{
  schemaVersion: 1,
  generatedAt: "2026-07-26T20:00:00.000Z",
  actor: {
    uuid: "Actor.abc",
    name: "Example"
  },
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
  ]
}
```

## Diagnostics

### `runDiagnostics({ deep = false })`

Checks:

- provider module activation and version;
- active-system support and version range;
- required and optional module dependencies;
- declared compendia;
- pack/system mismatches;
- pending migrations;
- entry UUID resolution when `deep` is true.

The report is JSON-safe and suitable for support requests after private fields have been reviewed.

## Migrations

### `listPendingMigrations(filters)`

Lists registered migrations whose version has not been recorded as completed. Supports `providerId`.

### `runMigration(migrationId)`

Runs one migration as a Game Master. Concurrent runs are serialized. Completion is recorded only after the handler resolves successfully.

### `runPendingMigrations(filters)`

Runs pending migrations in registry order. The Rules Hub requires explicit confirmation and warns the GM to back up the world.

## Source metadata

### `normalizeSource(source)`

Validates and normalizes a source descriptor.

### `readSource(document)`

Reads `flags.runyth-rules-core.source` from a Foundry document and returns an immutable copy.

### `tagDocument(document, source, options)`

GM-only. With default `{ update: true }`, writes the normalized flag. With `{ update: false }`, returns an update object suitable for inclusion in a larger atomic document creation/update operation.

## UI

### `openHub({ activeTab })`

Opens or focuses the Rules Hub. Valid tabs are `overview`, `providers`, `packs`, `audit`, and `diagnostics`.

## Hooks

| Hook | Arguments |
|---|---|
| `runyth-rules-core.apiReady` | `(api)` |
| `runyth-rules-core.ready` | `(api)` |
| `runyth-rules-core.providerRegistered` | `(providerDescriptor, api)` |
| `runyth-rules-core.providerRejected` | `(submittedProvider, error, api)` |
| `runyth-rules-core.packRegistered` | `(packDescriptor, api)` |
| `runyth-rules-core.beforeAuditActor` | `(actor, options)` |
| `runyth-rules-core.afterAuditActor` | `(actor, report, options)` |
| `runyth-rules-core.beforeMigration` | `(migrationDescriptor)` |
| `runyth-rules-core.afterMigration` | `(migrationDescriptor, report)` |
