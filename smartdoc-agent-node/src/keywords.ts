const CONTROL = /[\u0000-\u001f\u007f]/u;

export function normalizeKeywords(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`CONFIG: ${field} must be an array of keywords`);
  if (value.length > 16) throw new Error(`CONFIG: ${field} must contain at most 16 keywords`);
  const unique = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== 'string') throw new Error(`CONFIG: ${field} keyword must be text`);
    const keyword = raw.trim().normalize('NFC');
    if (!keyword || keyword.length > 64 || CONTROL.test(keyword)) {
      throw new Error(`CONFIG: ${field} keyword must contain 1 to 64 printable characters`);
    }
    unique.add(keyword);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, 'en'));
}

export function boundedKeywords(values: readonly string[], limit = 160): string {
  const ordered = [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));
  const joined = ordered.join('/');
  if (joined.length <= limit) return joined;
  const placeholder = `…(+${ordered.length})`;
  const available = Math.max(0, limit - placeholder.length);
  let kept = '';
  let count = 0;
  for (const value of ordered) {
    const candidate = kept ? `${kept}/${value}` : value;
    if (candidate.length > available) break;
    kept = candidate;
    count++;
  }
  if (count === 0) return `${ordered[0]!.slice(0, available)}${placeholder}`;
  return `${kept}…(+${ordered.length - count})`;
}
