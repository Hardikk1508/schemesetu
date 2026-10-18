export type Unit<T> = { group: string | null; items: T[] };

/**
 * Split rules (or rule results) into AND-units, preserving first-seen order.
 * Ungrouped rules are units of one; rules sharing a group form one OR-unit.
 * Mirrors _units() in backend/app/services/rules_engine.py.
 */
export function toUnits<T extends { group: string | null }>(items: T[]): Unit<T>[] {
  const units: Unit<T>[] = [];
  const byGroup = new Map<string, T[]>();
  for (const item of items) {
    if (!item.group) {
      units.push({ group: null, items: [item] });
      continue;
    }
    const members = byGroup.get(item.group);
    if (members) {
      members.push(item);
    } else {
      const fresh = [item];
      byGroup.set(item.group, fresh);
      units.push({ group: item.group, items: fresh });
    }
  }
  return units;
}
