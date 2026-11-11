/** The application window is independent of the task's execution schedule. */
export type TaskApplicationDeadlineFact =
  | Readonly<{ kind: 'AT'; at: string }>
  | Readonly<{ kind: 'NONE' }>;

/**
 * Exact JSON shape and a real civil instant with an explicit offset. `undefined`
 * means no fact was supplied; `{kind:'NONE'}` is an explicit decision to remove
 * a previously set deadline. A date without a clock/zone is not an instant.
 */
export function decodeTaskApplicationDeadlineFact(value: unknown): TaskApplicationDeadlineFact | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const fact = value as Record<string, unknown>;
  if (fact.kind === 'NONE') return Object.keys(fact).length === 1 ? { kind: 'NONE' } : null;
  if (fact.kind !== 'AT' || Object.keys(fact).length !== 2 || typeof fact.at !== 'string') return null;
  const at = fact.at;
  if (!/^(?:20\d\d|2100)-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(at)) return null;
  const offset = at.endsWith('Z') ? '+00:00' : at.slice(-6);
  if (offset.slice(1, 3) === '14' && offset.slice(4) !== '00') return null;
  const instant = Date.parse(at);
  if (!Number.isFinite(instant)) return null;
  const offsetMinutes = (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4)));
  if (new Date(instant + offsetMinutes * 60_000).toISOString().slice(0, 19) !== at.slice(0, 19)) return null;
  return { kind: 'AT', at };
}

export function applicationDeadlineIso(fact: TaskApplicationDeadlineFact): string | null {
  return fact.kind === 'AT' ? fact.at : null;
}
