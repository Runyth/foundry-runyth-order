# Provider schema

The executable registration object contains descriptors plus optional handler functions. Two JSON schemas describe the public contracts:

- `schemas/provider-registration.schema.json` validates the object passed to `registerProvider`. It describes registration intent: pack IDs are provider-local, generated fields (`localId`, `providerId`, global pack IDs) are absent, and fields the core defaults (`moduleId`, `version`, empty arrays) stay optional.
- `schemas/provider-descriptor.schema.json` validates the normalized, immutable descriptors the core returns. The same file carries a `normalizedPack` definition for returned pack descriptors.

Both contracts distinguish compatibility composition from sibling fields: a system or dependency object carries its own `minimum`/`verified`/`maximum` next to `id` or `moduleId`/`required`. `schemas/audit-report.schema.json` validates the audit report output, which uses the `startedAt`/`completedAt` timestamp contract, and `schemas/source-descriptor.schema.json` validates normalized managed-source flags. Both `naming` forms — an object or an explicit `null` — are accepted wherever registration permits it. Schema validation in the automated gate uses the standard Draft 2020-12 validator (dev-only dependency) against real registration examples and live runtime output; descriptors still lacking required fields, malformed naming metadata, or invalid compatibility ranges must be rejected by fixtures. Runtime responsibilities that remain executable checks outside the schemas: duplicate-ID rollback, handler signatures, naming consistency between provider and manifest, and live module-activity requirements.

## Provider fields

| Field | Required | Description |
|---|---:|---|
| `id` | Yes | Stable lowercase hyphenated provider ID. |
| `moduleId` | No | Active Foundry module ID; defaults to `id`. |
| `title` | Yes | Human-readable provider title. |
| `description` | No | Concise scope description. |
| `version` | No | Provider version; defaults to active module version. |
| `coreApi` | Yes | Supported core API minimum/verified/maximum. |
| `systems` | No | Supported game-system IDs and version ranges. Empty means system-neutral. |
| `dependencies` | No | Required or optional Foundry module dependencies. |
| `capabilities` | No | Standard capabilities or provider-namespaced custom capabilities. |
| `packs` | No | Content-pack descriptors. |
| `validators` | No | Actor-validator descriptors and handlers. |
| `migrations` | No | Migration descriptors and handlers. |
| `documentationUrl` | No | Provider documentation URL. |
| `repositoryUrl` | No | Source repository URL. |
| `authors` | No | Author names. |
| `naming` | No | Runyth Order naming metadata. Required for new complementary modules. |
| `metadata` | No | JSON-safe provider-specific metadata. |


## Naming metadata

```javascript
{
  orderName: "Runyth Order",
  moduleKind: "Class",
  contentName: "Example Vanguard",
  canonicalTitle: "Runyth Order: Class Example Vanguard"
}
```

When `naming` is present, all four fields are required. `orderName` must be exactly `Runyth Order`, and `canonicalTitle` must equal `<orderName>: <moduleKind> <contentName>`. A malformed provider `naming` object is a descriptor validation error. A valid descriptor whose title differs from the derived title is still registered and receives a non-blocking naming warning.

Manifest metadata uses the same fields under `flags.runyth`. Provider metadata is authoritative if provider and manifest metadata disagree. See [Naming Contract](NAMING_CONTRACT.md).

## IDs

- Provider and module IDs: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Local pack/entry/validator IDs: same pattern
- Global child IDs: generated as `<providerId>.<localId>`
- Custom capabilities: must begin with `<providerId>.`

IDs are permanent database keys, not display labels. Do not rename them merely to improve wording.

## Compatibility object

```javascript
{
  minimum: "1.0.0",
  verified: "1.0.0",
  maximum: "1.0.0"
}
```

Version values must use Foundry-style numeric versions. Minimum cannot exceed maximum, and verified must fall inside the declared range. `coreApi` must declare at least a minimum or maximum boundary. Duplicate system IDs and duplicate dependency module IDs are rejected.

## Dependency object

```javascript
{
  moduleId: "midi-qol",
  required: false,
  minimum: "13.0.0",
  maximum: "13.99.99"
}
```

Core diagnostics report missing and incompatible optional dependencies as warnings and required dependencies as errors. The same checks apply to provider-level and pack-level dependencies.

## Pack object

| Field | Required | Description |
|---|---:|---|
| `id` | Yes | Provider-local stable ID. |
| `title` | Yes | Display title. |
| `description` | No | Pack scope. |
| `version` | No | Content release version. |
| `systemId` | No | Target game system. |
| `contentKinds` | No | Declared content categories. |
| `compendia` | No | Foundry compendium collection IDs. |
| `entries` | No | Optional searchable source index. |
| `dependencies` | No | Pack-specific dependencies. |
| `documentationUrl` | No | Pack documentation. |
| `metadata` | No | JSON-safe provider metadata. |

## Entry object

```javascript
{
  id: "oath-of-the-harbor",
  title: "Oath of the Harbor",
  kind: "subclass",
  uuid: "Compendium.example.classes.Item.abcdefghijklmno",
  identifier: "oath-of-the-harbor",
  version: "1.2.0",
  tags: ["paladin", "player-option"],
  metadata: {}
}
```

Supported kinds are: `background`, `class`, `equipment`, `feature`, `feat`, `species`, `spell`, `subclass`, `condition`, `macro`, and `other`.
