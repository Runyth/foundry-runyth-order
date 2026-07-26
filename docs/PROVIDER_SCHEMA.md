# Provider schema

The executable registration object contains descriptors plus optional handler functions. `schemas/provider-descriptor.schema.json` validates the serializable descriptor subset.

## Provider fields

| Field | Required | Description |
|---|---:|---|
| `id` | Yes | Stable lowercase hyphenated provider ID. |
| `moduleId` | No | Active Foundry module ID; defaults to `id`. |
| `title` | Yes | Human-readable provider title. |
| `description` | No | Concise scope description. |
| `version` | No | Provider version; defaults to active module version. |
| `coreApi` | Yes in practice | Supported core API minimum/verified/maximum. |
| `systems` | No | Supported game-system IDs and version ranges. Empty means system-neutral. |
| `dependencies` | No | Required or optional Foundry module dependencies. |
| `capabilities` | No | Standard capabilities or provider-namespaced custom capabilities. |
| `packs` | No | Content-pack descriptors. |
| `validators` | No | Actor-validator descriptors and handlers. |
| `migrations` | No | Migration descriptors and handlers. |
| `documentationUrl` | No | Provider documentation URL. |
| `repositoryUrl` | No | Source repository URL. |
| `authors` | No | Author names. |
| `metadata` | No | JSON-safe provider-specific metadata. |

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

All fields are optional individually. Providers should normally specify minimum and maximum for the core API and system versions they have actually tested.

## Dependency object

```javascript
{
  moduleId: "midi-qol",
  required: false,
  minimum: "13.0.0",
  maximum: "13.99.99"
}
```

Core diagnostics report missing and incompatible optional dependencies as warnings and required dependencies as errors.

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
