export type DiagnosticPhase = 'CONFIG' | 'DOWNLOAD' | 'LOCAL' | 'PARSE' | 'VALIDATE' | 'GENERATE' | 'PUBLISH' | 'INTERNAL';

export interface DiagnosticDetails {
  phase: DiagnosticPhase;
  code: string;
  safeMessage: string;
  owner?: string;
  line?: number;
  column?: number;
  cause?: unknown;
}

export class DiagnosticError extends Error {
  readonly phase: DiagnosticPhase;
  readonly code: string;
  readonly safeMessage: string;
  readonly owner?: string;
  readonly line?: number;
  readonly column?: number;

  constructor(details: DiagnosticDetails) {
    super(`${details.code}: ${details.safeMessage}`, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = 'DiagnosticError';
    this.phase = details.phase;
    this.code = details.code;
    this.safeMessage = details.safeMessage;
    if (details.owner !== undefined) this.owner = details.owner;
    if (details.line !== undefined) this.line = details.line;
    if (details.column !== undefined) this.column = details.column;
  }
}

const PHASES = new Set<DiagnosticPhase>(['CONFIG', 'DOWNLOAD', 'LOCAL', 'PARSE', 'VALIDATE', 'GENERATE', 'PUBLISH', 'INTERNAL']);
const VALIDATION_CODES = new Set(['INVALID_JSON', 'MISSING_VERSION', 'UNSUPPORTED_VERSION', 'STRUCTURE', 'REFERENCE', 'UNSUPPORTED', 'IDENTITY']);

export function normalizeDiagnostic(error: unknown): DiagnosticError {
  const chain = errorChain(error);
  const structured = chain.find((item): item is DiagnosticError => item instanceof DiagnosticError);
  const owner = chain.map(errorMessage).map(ownerFromMessage).find((value) => value !== undefined);
  if (structured) return new DiagnosticError({
    phase: structured.phase,
    code: structured.code,
    safeMessage: structured.safeMessage,
    ...(owner ?? structured.owner ? { owner: owner ?? structured.owner } : {}),
    ...(structured.line === undefined ? {} : { line: structured.line }),
    ...(structured.column === undefined ? {} : { column: structured.column }),
    cause: error
  });
  if (!(error instanceof Error)) return new DiagnosticError({
    phase: 'INTERNAL', code: 'UNEXPECTED_ERROR', safeMessage: 'Unexpected non-error failure', cause: error
  });
  const parsed = parseLegacyMessage(error.message);
  return new DiagnosticError({ ...parsed, ...(owner ? { owner } : {}), cause: error });
}

export function formatDiagnostic(error: DiagnosticError): string {
  const owner = error.owner ? ` ${error.owner}` : '';
  const location = error.line === undefined ? '' : ` (line ${error.line}, column ${error.column})`;
  return `ERROR${owner} [${error.phase}/${error.code}]: ${oneLine(error.safeMessage)}${location}`;
}

export function formatDebugChain(error: unknown, maxDepth = 12): string {
  const lines: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;
  for (let depth = 0; current !== undefined && depth < maxDepth; depth++) {
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) { lines.push('Caused by: [circular cause]'); return lines.join('\n'); }
      seen.add(current);
    }
    const rendered = current instanceof Error ? (current.stack ?? `${current.name}: ${current.message}`) : String(current);
    lines.push(depth === 0 ? rendered : `Caused by: ${rendered}`);
    current = current instanceof Error ? current.cause : undefined;
  }
  if (current !== undefined) lines.push(`Caused by: [cause chain truncated after ${maxDepth} levels]`);
  return lines.join('\n');
}

function errorChain(error: unknown): unknown[] {
  const result: unknown[] = [];
  const seen = new Set<object>();
  let current: unknown = error;
  while (current !== undefined && result.length < 32) {
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) break;
      seen.add(current);
    }
    result.push(current);
    current = current instanceof Error ? current.cause : undefined;
  }
  return result;
}

function parseLegacyMessage(message: string): DiagnosticDetails {
  const withoutOwner = message.replace(/^[^:\s]+\/[^:\s]+:\s+/, '').replace(/^[^:\s]+:\s+(?=[A-Z_]+:)/, '');
  const match = /^([A-Z_]+):\s*(.*)$/s.exec(withoutOwner);
  if (!match) return { phase: 'INTERNAL', code: 'UNEXPECTED_ERROR', safeMessage: 'Unexpected operation failure' };
  const prefix = match[1]!;
  const detail = safeDetail(prefix, match[2] ?? '');
  if (PHASES.has(prefix as DiagnosticPhase)) {
    const phase = prefix as DiagnosticPhase;
    return { phase, code: `${phase}_FAILED`, safeMessage: detail || `${phase.toLowerCase()} operation failed` };
  }
  const phase: DiagnosticPhase = VALIDATION_CODES.has(prefix) ? (prefix === 'INVALID_JSON' ? 'PARSE' : 'VALIDATE')
    : prefix === 'OUTPUT' ? 'PUBLISH' : prefix === 'LIMIT' ? 'GENERATE' : 'INTERNAL';
  return { phase, code: prefix, safeMessage: detail || 'Operation failed' };
}

function safeDetail(prefix: string, detail: string): string {
  if (prefix === 'DOWNLOAD') return 'Unable to download configured document';
  if (prefix === 'LOCAL') return 'Unable to read configured local document';
  return redactUrls(detail);
}

function redactUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s]+/gi, (raw) => {
    try { const url = new URL(raw); return `${url.protocol}//${url.host}${url.pathname}`; }
    catch { return '[remote URL]'; }
  });
}

function ownerFromMessage(message: string): string | undefined {
  return /^([^:\s]+\/[^:\s]+):\s+/.exec(message)?.[1];
}

function errorMessage(value: unknown): string { return value instanceof Error ? value.message : String(value); }
function oneLine(value: string): string { return value.replace(/[\r\n]+/g, ' ').trim(); }
