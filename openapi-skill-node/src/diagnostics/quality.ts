import { asObject, JsonObject, own } from '../input/parse.js';

export interface QualityFinding {
  code: 'MISSING_SUMMARY' | 'OPAQUE_JSON_BODY';
  serviceId: string;
  documentId: string;
  method: string;
  path: string;
}

/** Conservative documentation hints, not validation errors or inferred API behavior. */
export function qualityFindings(contract: JsonObject): QualityFinding[] {
  const op = asObject(contract.operation) ?? {};
  const codes: QualityFinding['code'][] = [];
  if (typeof op.summary !== 'string' || !op.summary.trim()) codes.push('MISSING_SUMMARY');
  const content = asObject(asObject(op.requestBody)?.content) ?? {};
  if (Object.entries(content).some(([media, value]) => {
    const raw = asObject(value)?.schema;
    const schema = asObject(raw);
    return /(?:application\/json|\+json)(?:;|$)/i.test(media)
      && (raw === undefined || schema?.type === 'string' && !['enum', 'const', 'pattern', 'format', '$ref', 'allOf', 'anyOf', 'oneOf'].some(key => own(schema, key)));
  })) codes.push('OPAQUE_JSON_BODY');
  return codes.map(code => ({ code, serviceId: String(contract.serviceId), documentId: String(contract.documentId),
    method: String(contract.method).toUpperCase(), path: String(contract.path) }));
}
