export interface DocumentSource { id: string; url: string }

export interface SmartDocConfig {
  serviceId: string;
  skillName: string;
  documents: DocumentSource[];
  output?: string;
  timeoutMs?: number;
}

export interface GenerateOptions {
  serviceId: string;
  skillName: string;
  documents: ReadonlyMap<string, Uint8Array>;
}

export interface RunOptions { cwd?: string; config?: string }

export interface RunResult {
  skillDirectory: string;
  documentCount: number;
  fileCount: number;
}
