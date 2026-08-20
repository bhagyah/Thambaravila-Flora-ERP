export function generateNextReadableId(
  ids: Array<string | null | undefined>,
  prefix: string,
  width: number
): string {
  let max = 0;

  for (const id of ids) {
    if (!id || !id.startsWith(prefix)) continue;
    const match = id.slice(prefix.length).match(/^(\d+)/);
    if (!match) continue;

    const value = parseInt(match[1], 10);
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }

  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}
