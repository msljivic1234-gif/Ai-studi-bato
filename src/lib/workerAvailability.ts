import type { AvailabilityRule, AvailabilityWindow, WorkerAvailabilityInput } from '../contracts/workerAvailability';
import { calendarInstant } from './calendarTime';

const object = (raw: unknown): Record<string, unknown> | null =>
  raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const id = (raw: unknown): raw is string => typeof raw === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw);
const label = (raw: unknown): raw is string => typeof raw === 'string' && Array.from(raw).length <= 256;
export const availabilityRevision = (raw: unknown): raw is string => typeof raw === 'string' && /^[0-9a-f]{64}$/.test(raw);
export function availabilityTimezone(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 100 || (raw !== 'UTC' && !raw.includes('/')) || /^(posix|right)\//.test(raw)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: raw }).format(0); return true; } catch { return false; }
}
function date(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && calendarInstant(raw + 'T00:00:00Z') !== null;
}
function time(raw: unknown, end: boolean): { text: string; micros: bigint } | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(raw);
  if (!match) return null;
  const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  const fraction = (match[4] ?? '').replace(/0+$/, '');
  if (minute > 59 || second > 59 || hour > 24 || (hour === 24 && (!end || minute !== 0 || second !== 0 || fraction !== ''))) return null;
  return { text: `${match[1]}:${match[2]}:${match[3] ?? '00'}${fraction ? '.' + fraction : ''}`,
    micros: BigInt(hour * 3600 + minute * 60 + second) * 1_000_000n + BigInt(fraction.padEnd(6, '0')) };
}
function rule(raw: unknown): AvailabilityRule | null {
  const value = object(raw);
  if (!value || !exactKeys(value, ['id', 'weekdays', 'startTime', 'endTime', 'startsOn', 'endsOn', 'label', 'active']) ||
      !id(value.id) || !Array.isArray(value.weekdays) || !label(value.label) || typeof value.active !== 'boolean' ||
      !date(value.startsOn) || (value.endsOn !== null && !date(value.endsOn))) return null;
  const start = time(value.startTime, false), end = time(value.endTime, true);
  if (!start || !end || start.micros >= end.micros || (value.endsOn !== null && value.endsOn < value.startsOn)) return null;
  if (value.weekdays.length < 1 || value.weekdays.length > 7 ||
      value.weekdays.some(day => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(value.weekdays).size !== value.weekdays.length) return null;
  return { id: value.id.toLowerCase(), weekdays: [...value.weekdays].sort((a, b) => a - b),
    startTime: start.text, endTime: end.text, startsOn: value.startsOn, endsOn: value.endsOn, label: value.label, active: value.active };
}
function windowValue(raw: unknown): AvailabilityWindow | null {
  const value = object(raw);
  if (!value || !exactKeys(value, ['id', 'startsAt', 'endsAt', 'state', 'label']) || !id(value.id) || !label(value.label) ||
      typeof value.startsAt !== 'string' || typeof value.endsAt !== 'string' ||
      (value.state !== 'AVAILABLE' && value.state !== 'UNAVAILABLE')) return null;
  const start = calendarInstant(value.startsAt), end = calendarInstant(value.endsAt);
  if (start === null || end === null || start >= end) return null;
  return { id: value.id.toLowerCase(), startsAt: value.startsAt, endsAt: value.endsAt, state: value.state, label: value.label };
}
/** Validate/copy before async work. Unknown fields and duplicate IDs never become writes. */
export function normalizeWorkerAvailability(raw: unknown): WorkerAvailabilityInput | null {
  const value = object(raw);
  if (!value || !exactKeys(value, ['timezone', 'availableNow', 'rules', 'windows']) || !availabilityTimezone(value.timezone) ||
      typeof value.availableNow !== 'boolean' || !Array.isArray(value.rules) || !Array.isArray(value.windows) ||
      value.rules.length > 128 || value.windows.length > 512) return null;
  const rules: AvailabilityRule[] = [], windows: AvailabilityWindow[] = [];
  const ruleIds = new Set<string>(), windowIds = new Set<string>();
  for (const rawRule of value.rules) {
    const item = rule(rawRule);
    if (!item || ruleIds.has(item.id)) return null;
    ruleIds.add(item.id); rules.push(item);
  }
  for (const rawWindow of value.windows) {
    const item = windowValue(rawWindow);
    if (!item || windowIds.has(item.id)) return null;
    windowIds.add(item.id); windows.push(item);
  }
  rules.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  windows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { timezone: value.timezone, availableNow: value.availableNow, rules, windows };
}
/** PostgreSQL canonical UTC formatting may differ without changing the interval. */
export function sameWorkerAvailability(a: WorkerAvailabilityInput, b: WorkerAvailabilityInput): boolean {
  if (a.timezone !== b.timezone || a.availableNow !== b.availableNow || JSON.stringify(a.rules) !== JSON.stringify(b.rules) || a.windows.length !== b.windows.length) return false;
  return a.windows.every((item, index) => {
    const other = b.windows[index];
    return item.id === other.id && item.state === other.state && item.label === other.label &&
      calendarInstant(item.startsAt) === calendarInstant(other.startsAt) && calendarInstant(item.endsAt) === calendarInstant(other.endsAt);
  });
}
