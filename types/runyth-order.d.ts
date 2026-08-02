export type Compatibility = {
  minimum?: string | null;
  verified?: string | null;
  maximum?: string | null;
};

export type ProviderDependency = Compatibility & {
  moduleId: string;
  required?: boolean;
};

export type ProviderSystem = Compatibility & {
  id: string;
};

export type RunythNamingMetadata = {
  orderName: "Runyth Order";
  moduleKind: string;
  contentName: string;
  canonicalTitle: string;
};

export type NamingFindingCode =
  | "PROVIDER_NAMING_MISMATCH"
  | "MODULE_NAMING_MISMATCH"
  | "NAMING_METADATA_CONFLICT"
  | "NAMING_METADATA_INVALID"
  | "NAMING_METADATA_MISSING";

export type NamingFinding = {
  severity: "info" | "warning";
  code: NamingFindingCode;
  messageKey: string;
  providerId: string;
  moduleId: string;
  data: Record<string, unknown>;
};

export type ContentKind =
  | "background"
  | "class"
  | "equipment"
  | "feature"
  | "feat"
  | "species"
  | "spell"
  | "subclass"
  | "condition"
  | "macro"
  | "other";

export type ContentEntry = {
  id: string;
  title: string;
  kind: ContentKind;
  uuid?: string | null;
  identifier?: string | null;
  version?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type ContentPack = {
  id: string;
  title: string;
  description?: string | null;
  version?: string | null;
  systemId?: string | null;
  contentKinds?: ContentKind[];
  compendia?: string[];
  entries?: ContentEntry[];
  dependencies?: ProviderDependency[];
  documentationUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditSeverity = "info" | "warning" | "error";

export type AuditIssue = {
  id?: string;
  severity?: AuditSeverity;
  code?: string;
  title?: string;
  message: string;
  remediation?: string | null;
  documentUuid?: string | null;
  data?: Record<string, unknown>;
};

export type ActorValidator = {
  id: string;
  title: string;
  description?: string | null;
  scope?: "actor";
  timeoutMs?: number;
  run(context: {
    actor: unknown;
    options: Readonly<{ includeProviderValidators: boolean }>;
    provider: Readonly<ProviderDescriptor>;
    packs: ReadonlyArray<Readonly<RegisteredContentPack>>;
    coreApi: {
      registry: Readonly<RegistrySnapshot>;
      resolveUuid(uuid: string): Promise<unknown>;
      readSource(document: unknown): ManagedSource | null;
    };
  }): Promise<AuditIssue[]> | AuditIssue[];
};

export type ProviderMigration = {
  id: string;
  title: string;
  description?: string | null;
  version: string;
  scope?: "world" | "documents";
  requiresBackup?: boolean;
  run(context: {
    game: unknown;
    migration: Readonly<RegisteredMigration>;
    logger: Console;
  }): Promise<Record<string, unknown> | void> | Record<string, unknown> | void;
};

export type ProviderRegistration = {
  id: string;
  moduleId?: string;
  title: string;
  description?: string;
  version?: string;
  coreApi?: Compatibility;
  systems?: ProviderSystem[];
  dependencies?: ProviderDependency[];
  capabilities?: string[];
  packs?: ContentPack[];
  validators?: ActorValidator[];
  migrations?: ProviderMigration[];
  documentationUrl?: string;
  repositoryUrl?: string;
  authors?: string[];
  naming?: RunythNamingMetadata | null;
  metadata?: Record<string, unknown>;
};

export type ProviderDescriptor = Omit<
  ProviderRegistration,
  "packs" | "validators" | "migrations"
> & {
  moduleId: string;
  version: string;
  coreApi: Compatibility;
  systems: ProviderSystem[];
  dependencies: ProviderDependency[];
  capabilities: string[];
  packIds: string[];
  validatorIds: string[];
  migrationIds: string[];
  registeredAt: string;
};

export type RegisteredContentPack = Omit<ContentPack, "id"> & {
  id: string;
  localId: string;
  providerId: string;
  contentKinds: ContentKind[];
  compendia: string[];
  entries: ContentEntry[];
  dependencies: ProviderDependency[];
};

export type RegisteredValidator = {
  id: string;
  localId: string;
  providerId: string;
  title: string;
  description: string | null;
  scope: "actor";
  timeoutMs: number | null;
};

export type RegisteredMigration = {
  id: string;
  localId: string;
  providerId: string;
  title: string;
  description: string | null;
  version: string;
  scope: "world" | "documents";
  requiresBackup: boolean;
};

export type RegistrySnapshot = {
  providers: ProviderDescriptor[];
  packs: RegisteredContentPack[];
  validators: RegisteredValidator[];
  migrations: RegisteredMigration[];
  namingFindings: NamingFinding[];
};

export type ManagedSource = {
  schemaVersion: 1;
  providerId: string;
  packId: string;
  entryId: string;
  sourceUuid: string | null;
  contentVersion: string | null;
  checksum: string | null;
  importedAt: string;
};

export interface RunythOrderApi {
  readonly moduleId: "runyth-order";
  readonly apiVersion: "1.0.0";
  readonly dataSchemaVersion: 1;
  isReady(): boolean;
  whenReady(): Promise<RunythOrderApi>;
  registerProvider(provider: ProviderRegistration): Readonly<ProviderDescriptor>;
  registerPack(providerId: string, pack: ContentPack): Readonly<RegisteredContentPack>;
  registerActorValidator(providerId: string, validator: ActorValidator): Readonly<RegisteredValidator>;
  registerMigration(providerId: string, migration: ProviderMigration): Readonly<RegisteredMigration>;
  unregisterProvider(providerId: string): boolean;
  listProviders(): ReadonlyArray<Readonly<ProviderDescriptor>>;
  getProvider(providerId: string): Readonly<ProviderDescriptor> | null;
  listNamingFindings(filters?: {
    providerId?: string;
    severity?: "info" | "warning";
  }): ReadonlyArray<Readonly<NamingFinding>>;
  listPacks(filters?: {
    providerId?: string;
    contentKind?: ContentKind;
    systemId?: string;
  }): ReadonlyArray<Readonly<RegisteredContentPack>>;
  getPack(packId: string): Readonly<RegisteredContentPack> | null;
  hasCapability(capability: string, filters?: {
    providerId?: string;
    systemId?: string;
  }): boolean;
  snapshot(): Readonly<RegistrySnapshot>;
  resolveContent(reference: string | { packId: string; entryId: string }): Promise<unknown>;
  auditActor(actorOrUuid: unknown, options?: { includeProviderValidators?: boolean }): Promise<unknown>;
  runDiagnostics(options?: { deep?: boolean }): Promise<unknown>;
  listPendingMigrations(filters?: { providerId?: string }): Promise<ReadonlyArray<Readonly<RegisteredMigration>>>;
  runMigration(migrationId: string): Promise<unknown>;
  runPendingMigrations(filters?: { providerId?: string }): Promise<ReadonlyArray<unknown>>;
  normalizeSource(source: Omit<ManagedSource, "schemaVersion" | "importedAt"> & Partial<Pick<ManagedSource, "importedAt">>): Readonly<ManagedSource>;
  readSource(document: unknown): Readonly<ManagedSource> | null;
  tagDocument(document: unknown, source: Partial<ManagedSource>, options?: { update?: boolean }): Promise<unknown>;
  openHub(options?: { activeTab?: "overview" | "providers" | "packs" | "audit" | "diagnostics" }): Promise<unknown>;
}
