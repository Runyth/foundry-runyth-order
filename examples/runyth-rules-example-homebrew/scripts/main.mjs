const MODULE_ID = "runyth-rules-example-homebrew";
const CORE_ID = "runyth-rules-core";

function providerVersion() {
  return game.modules.get(MODULE_ID)?.version ?? "0.0.0";
}

function actorValidator() {
  return {
    id: "managed-items",
    title: "Example managed Items",
    description: "Demonstrates a non-mutating provider Actor validator.",
    scope: "actor",
    timeoutMs: 5000,
    async run({ actor }) {
      if (actor.type !== "character") return [];
      const managedItems = [...actor.items].filter(
        (item) => item.getFlag(CORE_ID, "source")?.providerId === MODULE_ID,
      );
      const duplicateIds = managedItems
        .map((item) => item.getFlag(CORE_ID, "source")?.entryId)
        .filter((entryId, index, all) => entryId && all.indexOf(entryId) !== index);
      if (!duplicateIds.length) return [];

      return [
        {
          severity: "warning",
          code: "duplicate-example-item",
          title: "Duplicate example option",
          message: `${actor.name} contains duplicate example content: ${[...new Set(duplicateIds)].join(", ")}.`,
          remediation: "Review the Actor's Items and keep the intended provider-managed copy.",
          documentUuid: actor.uuid,
        },
      ];
    },
  };
}

function exampleMigration() {
  return {
    id: "example-flags-v1",
    title: "Normalize example flags",
    description: "Demonstrates an idempotent provider-owned Actor flag migration.",
    version: "1.0.0",
    scope: "documents",
    requiresBackup: true,
    async run({ game, logger }) {
      let inspected = 0;
      let updated = 0;
      for (const actor of game.actors) {
        const state = actor.getFlag(MODULE_ID, "exampleState");
        if (!state) continue;
        inspected += 1;
        if (state.schemaVersion === 1) continue;
        await actor.setFlag(MODULE_ID, "exampleState", {
          schemaVersion: 1,
          enabled: Boolean(state.enabled),
        });
        updated += 1;
      }
      logger.info(`Example migration inspected ${inspected} Actor(s) and updated ${updated}.`);
      return { inspected, updated };
    },
  };
}

Hooks.once("init", async () => {
  const core = game.modules.get(CORE_ID)?.api;
  if (!core) throw new Error(`${MODULE_ID} requires ${CORE_ID}.`);

  const response = await fetch(`modules/${MODULE_ID}/data/options.json`);
  if (!response.ok) throw new Error(`Unable to load example options: ${response.status}.`);
  const data = await response.json();

  core.registerProvider({
    id: MODULE_ID,
    moduleId: MODULE_ID,
    title: "Runyth Rules Example Homebrew",
    description: "Reference provider demonstrating packs, validation, capabilities, and migration.",
    version: providerVersion(),
    coreApi: {
      minimum: "1.0.0",
      verified: "1.0.0",
      maximum: "1.0.0",
    },
    systems: [
      {
        id: "dnd5e",
        minimum: "5.3.3",
        verified: "5.3.3",
        maximum: "5.3.3",
      },
    ],
    capabilities: [
      "content.features",
      "content.feats",
      "validation.actor",
      "migration.documents",
      `${MODULE_ID}.example`,
    ],
    packs: [
      {
        id: "options",
        title: "Example Homebrew Options",
        description: "Structured example entries. A production provider should normally reference module compendia by UUID.",
        version: providerVersion(),
        systemId: "dnd5e",
        contentKinds: ["feature", "feat"],
        compendia: [],
        entries: data.entries,
      },
    ],
    validators: [actorValidator()],
    migrations: [exampleMigration()],
    documentationUrl: "https://github.com/Runyth/runyth-rules-core/tree/main/examples/runyth-rules-example-homebrew",
    repositoryUrl: "https://github.com/Runyth/runyth-rules-core",
    authors: ["Runyth"],
  });
});
