const decoder = new TextDecoder('utf-8', { fatal: true });

export type JsonObject = Record<string, unknown>;

export function parseOpenApi(bytes: Uint8Array): JsonObject {
  let text: string;
  let value: unknown;
  try {
    text = decoder.decode(bytes);
    rejectDuplicateKeys(text);
    value = JSON.parse(text);
  }
  catch (error) { throw new Error('INVALID_JSON: expected a single JSON object', { cause: error }); }
  if (!isObject(value)) throw new Error('INVALID_JSON: expected a single JSON object');
  if (!Object.hasOwn(value, 'openapi') || value.openapi === null) throw new Error('MISSING_VERSION: root openapi is required');
  if (value.openapi !== '3.1.0') throw new Error('UNSUPPORTED_VERSION: expected exact OpenAPI 3.1.0');
  return value;
}

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asObject(value: unknown): JsonObject | undefined { return isObject(value) ? value : undefined; }
export function own(object: JsonObject, key: string): boolean { return Object.hasOwn(object, key); }

function rejectDuplicateKeys(text: string): void {
  let index = 0;
  const whitespace = () => { while (/\s/.test(text[index] ?? '')) index++; };
  const string = (): string => {
    const start = index++;
    while (index < text.length) {
      if (text[index] === '\\') { index += 2; continue; }
      if (text[index++] === '"') return JSON.parse(text.slice(start, index)) as string;
    }
    throw new Error('unterminated string');
  };
  const value = (): void => {
    whitespace();
    if (text[index] === '{') {
      index++; whitespace(); const keys = new Set<string>();
      if (text[index] === '}') { index++; return; }
      while (index < text.length) {
        whitespace(); if (text[index] !== '"') throw new Error('object key expected');
        const key = string();
        if (keys.has(key)) throw new Error(`duplicate key ${key}`); keys.add(key);
        whitespace(); if (text[index++] !== ':') throw new Error('colon expected');
        value(); whitespace();
        if (text[index] === '}') { index++; return; }
        if (text[index++] !== ',') throw new Error('comma expected');
      }
      throw new Error('unterminated object');
    }
    if (text[index] === '[') {
      index++; whitespace();
      if (text[index] === ']') { index++; return; }
      while (index < text.length) {
        value(); whitespace();
        if (text[index] === ']') { index++; return; }
        if (text[index++] !== ',') throw new Error('comma expected');
      }
      throw new Error('unterminated array');
    }
    if (text[index] === '"') { string(); return; }
    const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(index));
    if (!match) throw new Error('value expected');
    index += match[0].length;
  };
  value(); whitespace();
  if (index !== text.length) throw new Error('trailing token');
}
