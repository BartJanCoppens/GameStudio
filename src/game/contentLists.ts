/** The lists a game's content is made of (levels, questions, cases…) with their sizes, one level deep. */
export function contentLists(data: unknown): { name: string; count: number }[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return Array.isArray(data) ? [{ name: 'items', count: data.length }] : [];
  return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
    if (Array.isArray(value)) return [{ name: key, count: value.length }];
    if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).filter(([, v]) => Array.isArray(v)).map(([k, v]) => ({ name: `${key}.${k}`, count: (v as unknown[]).length }));
    return [];
  });
}
