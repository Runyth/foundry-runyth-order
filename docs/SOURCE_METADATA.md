# Managed-document source metadata

Runyth Rules Core defines one normalized flag for tracing a world document or embedded document back to provider-owned source content.

## Flag path

```text
flags.runyth-rules-core.source
```

## Shape

```json
{
  "schemaVersion": 1,
  "providerId": "example-homebrew",
  "packId": "example-homebrew.character-options",
  "entryId": "oath-of-the-harbor",
  "sourceUuid": "Compendium.example-homebrew.classes.Item.abcdefghijklmno",
  "contentVersion": "1.2.0",
  "checksum": "sha256:0123456789abcdef",
  "importedAt": "2026-07-26T20:00:00.000Z"
}
```

`providerId`, `packId`, and `entryId` are required. Other fields may be `null`.

## Creating a document atomically

Normalize the descriptor and include it directly in source data:

```javascript
const core = game.modules.get("runyth-rules-core").api;
const source = core.normalizeSource({
  providerId: PROVIDER_ID,
  packId: `${PROVIDER_ID}.character-options`,
  entryId: "oath-of-the-harbor",
  sourceUuid: sourceItem.uuid,
  contentVersion: PROVIDER_VERSION
});

const created = await actor.createEmbeddedDocuments("Item", [
  {
    ...sourceItem.toObject(),
    _id: undefined,
    flags: {
      ...sourceItem.flags,
      "runyth-rules-core": {
        source
      }
    }
  }
]);
```

Do not copy `_id` from a compendium document unless the workflow intentionally preserves stable embedded IDs and collision handling is implemented.

## Tagging an existing document

```javascript
await core.tagDocument(worldItem, source);
```

Only a Game Master may call this method successfully.

## Update policy

Source metadata does not authorize blind overwrites. A provider should:

1. compare provider, pack, and entry IDs;
2. compare the current source version or checksum;
3. distinguish provider-managed fields from user-edited fields;
4. preserve user-renamed documents unless the user explicitly requests reset;
5. preview destructive changes;
6. make updates idempotent;
7. record the new source version only after a successful update.

The core audit warns about unknown providers, packs, entries, duplicate managed sources on one Actor, and pack-version differences. It does not decide how a provider should merge content.
