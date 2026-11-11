/** Exact PostgreSQL-compatible instant, in microseconds; never normalize invalid dates. */
export function calendarInstant(value: unknown): bigint | null {
  if (typeof value !== 'string' || value.length > 32) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]
      || hour > 23 || minute > 59 || second > 59) return null;
  const offsetHours = Number(match[10] ?? 0);
  const offsetMinutes = Number(match[11] ?? 0);
  if (offsetHours > 15 || offsetMinutes > 59) return null;
  const offset = (offsetHours * 60 + offsetMinutes) * (match[9] === '-' ? -1 : 1);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return BigInt(date.getTime() - offset * 60_000) * 1000n + BigInt((match[7] ?? '').padEnd(6, '0'));
}
