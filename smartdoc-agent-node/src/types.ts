export type SourceType = 'internal' | 'third-party';

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
  output?: string;
  timeoutMs?: number;
}

/** Backward-compatible single-service configuration. */
export interface LegacySmartDocConfig extends CommonConfig {
  serviceId: string;
  skillName: string;
  documents: DocumentSource[];
  services?: never;
}

/** Preferred project configuration: one Skill containing one or more services. */
export interface ProjectSmartDocConfig extends CommonConfig {
  services: ServiceSource[];
  serviceId?: never;
  documents?: never;
}

export type SmartDocConfig = LegacySmartDocConfig | ProjectSmartDocConfig;

export interface ResolvedDocumentSource extends DocumentSource { keywords: string[] }

export interface ResolvedServiceSource extends Omit<ServiceSource, 'documents' | 'keywords' | 'sourceType'> {
  sourceType: SourceType;
  keywords: string[];
  documents: ResolvedDocumentSource[];
}

export interface ResolvedSmartDocConfig {
  mode: 'legacy' | 'project';
  skillName: string;
  keywords: string[];
  services: ResolvedServiceSource[];
  output: string;
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
  serviceCount: number;
  documentCount: number;
  fileCount: number;
}
