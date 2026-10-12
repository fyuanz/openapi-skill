export function identity(value: string): void {
  if (typeof value !== 'string' || value.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(value)) throw new Error('IDENTITY: use a safe lowercase name under 64 characters');
}
