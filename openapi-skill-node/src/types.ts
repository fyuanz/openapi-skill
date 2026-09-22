export type SourceType = 'internal' | 'third-party';
export type DocumentSourceKind = 'remote' | 'local';

export interface DocumentSource {
  id: string;
  url: string;
  keywords?: string[];
}

export interface ServiceSource {
  serviceId: string;
  sourceType?: SourceType;
  keywords?: string[];
  documents: DocumentSource[];
}

interface CommonConfig {
  skillName?: string;
  keywords?: string[];
  output?: string | string[];
  timeoutMs?: number;
}

/** Backward-compatible single-service configuration. */
export interface LegacyOpenApiSkillConfig extends CommonConfig {
  serviceId: string;
  skillName: string;
  documents: DocumentSource[];
  services?: never;
}

/** Preferred project configuration: one Skill containing one or more services. */
export interface ProjectOpenApiSkillConfig extends CommonConfig {
  services: ServiceSource[];
  serviceId?: never;
  documents?: never;
}

export type OpenApiSkillConfig = LegacyOpenApiSkillConfig | ProjectOpenApiSkillConfig;

export interface ResolvedDocumentSource extends DocumentSource {
  keywords: string[];
  kind: DocumentSourceKind;
  path: string;
}

export interface ResolvedServiceSource extends Omit<ServiceSource, 'documents' | 'keywords' | 'sourceType'> {
  sourceType: SourceType;
  keywords: string[];
  documents: ResolvedDocumentSource[];
}

export interface ResolvedOpenApiSkillConfig {
  mode: 'legacy' | 'project';
  skillName: string;
  keywords: string[];
  services: ResolvedServiceSource[];
  output: string;
  outputs: string[];
  timeoutMs: number;
}

export interface GenerateOptions {
  serviceId: string;
  skillName: string;
  documents: ReadonlyMap<string, Uint8Array>;
  sourceType?: SourceType;
  keywords?: readonly string[];
  documentKeywords?: ReadonlyMap<string, readonly string[]>;
}

export interface ProjectServiceInput {
  serviceId: string;
  sourceType?: SourceType;
  keywords?: readonly string[];
  documents: ReadonlyMap<string, Uint8Array>;
  documentKeywords?: ReadonlyMap<string, readonly string[]>;
}

export interface GenerateProjectOptions {
  skillName?: string;
  keywords?: readonly string[];
  services: readonly ProjectServiceInput[];
}

export interface RunOptions { cwd?: string; config?: string }

export interface RunResult {
  skillDirectory: string;
  skillDirectories: string[];
  serviceCount: number;
  documentCount: number;
  fileCount: number;
}
