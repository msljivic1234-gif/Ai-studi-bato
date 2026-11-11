import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { REQUIRED_NEED_FACT_V2_KEYS, type NeedTaskGeography } from '../../contracts/needFactsV2';
import { calendarInstant } from '../../lib/calendarTime';
import { raspon, vreme } from '../../lib/vreme';
import { DOGOVORENA_ZONA, napomenaZone } from '../../lib/dogovorenoVreme';
import { novac } from '../../lib/novac';
import { needScheduleText } from '../../data/needDetailPresentation';
import { osoba } from '../system/plural';
import type { TaskValue } from './TaskFace';

/**
 * The public face of a task that is still a draft, in the words the task card draws. Pure: no service, no Supabase, so
 * a screen suite can import it. The conversation's live card (`IntakePresentation`) and the publish review both use it.
 */
export const schedules: Record<string, string> = { FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };

export function fixedRange(startsAt: unknown, endsAt: unknown): string | undefined {
  const start = calendarInstant(startsAt), end = calendarInstant(endsAt);
  if (start === null) return undefined;
  if (end === null) {
    // A missing end is valid; a supplied but malformed end is not. Never invent duration.
    if (endsAt !== null && endsAt !== undefined) return undefined;
    const onlyStart = vreme(new Date(Number(start / 1000n)), { zona: DOGOVORENA_ZONA });
    return onlyStart ? `Od ${onlyStart}${napomenaZone()}` : undefined;
  }
  if (end <= start) return undefined;
  // The app's one way to write a window (src/lib/vreme.ts: "26. sep · 17:00–19:00"), read in Serbian time as every agreed
  // term is, and named so only on a phone set to another zone. Display only; never inferred or saved as the task's timezone.
  const text = raspon(new Date(Number(start / 1000n)), new Date(Number(end / 1000n)), { zona: DOGOVORENA_ZONA });
  return text ? text + napomenaZone() : undefined;
}

/** Flexible means a choice within any recorded bounds, not permission to ignore those bounds. */
function flexibleRange(startsAt: unknown, endsAt: unknown): string | undefined {
  if (startsAt == null && endsAt == null) return schedules.FLEXIBLE;
  const start = calendarInstant(startsAt), end = calendarInstant(endsAt);
  if ((startsAt != null && (typeof startsAt !== 'string' || start === null))
    || (endsAt != null && (typeof endsAt !== 'string' || end === null))
    || (start !== null && end !== null && end <= start)) return undefined;
  // Share the review's display, including an exclusive midnight end and date-specific DST offsets.
  return needScheduleText({ kind: 'FLEXIBLE', startsAt: startsAt as string | null ?? null,
    endsAt: endsAt as string | null ?? null }, DOGOVORENA_ZONA).replace('Fleksibilno · Od ', 'Fleksibilno · od ');
}

/** What the card shows: public facts only, each already in the words the card draws. */
export type Summary = { title: string | null; service?: string | null; zone: string; schedule?: string; value: TaskValue | null; people: string | null;
  /** How many people, as a number: the card says how many only when it is more than one. */
  peopleCount?: number | null };
type SummaryFact = Pick<AiNeedV2Fact, 'key' | 'value' | 'privacyClass' | 'status'>;

/** Display readiness of already decoded proposals, not permission to save or publish. Confirmation stays in review. */
export function completeDraftProposal(facts: readonly SummaryFact[]): boolean {
  const proposed = new Map(facts.filter(fact => fact.privacyClass === 'PUBLIC' && fact.status !== 'UNKNOWN').map(fact => [fact.key, fact.value]));
  if (REQUIRED_NEED_FACT_V2_KEYS.some(key => {
    const value = proposed.get(key);
    return value == null || (typeof value === 'string' && !value.trim());
  })) return false;
  const summary = publicSummary(facts);
  if (!summary.title || !summary.value || !summary.schedule || !summary.peopleCount || summary.peopleCount < 1) return false;
  if (proposed.get('need.price_mode') === 'MY_PRICE') {
    const amount = proposed.get('need.price_rsd'), basis = proposed.get('need.price_basis');
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) return false;
    if (summary.peopleCount > 1 && basis !== 'TOTAL' && basis !== 'PER_PERSON' && basis !== 'HOURLY') return false;
  }
  return true;
}

export function publicSummary(facts: readonly SummaryFact[]): Summary {
  // A compact public projection has an explicit field allowlist. Never use the
  // private exact address, access notes, resolved points or arbitrary displayValue.
  const value = (key: AiNeedV2Fact['key']) => facts.find(fact => fact.key === key && fact.privacyClass === 'PUBLIC' && fact.status !== 'UNKNOWN')?.value;
  const title = value('need.title'), geography = value('need.task_geography') as NeedTaskGeography | undefined;
  const category = value('need.category');
  const mode = value('need.price_mode'), amount = value('need.price_rsd'), people = value('need.people_needed');
  const basis = value('need.price_basis');
  const schedule = value('need.schedule_kind');
  const publicPlace = geography?.start ?? geography?.serviceArea;
  // A free-form label can contain an accidentally repeated house number. Use
  // it only as a fallback when it has no digits; city/area remain preferred.
  const safeLabel = (label: unknown) => typeof label === 'string' && !/\d/.test(label) ? label.trim() : '';
  const pointName = (point: typeof publicPlace) => point && ([point.area, point.city].filter(item => typeof item === 'string' && item.trim()).join(', ') || safeLabel(point.label));
  const route = geography?.mode === 'POINT_TO_POINT' || geography?.mode === 'MULTI_STOP';
  const stops = route ? [geography?.start, ...(geography?.waypoints ?? []), geography?.end].map(pointName).filter(Boolean) : [];
  const zone = geography?.mode === 'REMOTE' ? 'Na daljinu'
    : route && stops.length > 1 ? stops.join(' → ')
      : [publicPlace?.city, publicPlace?.area].filter(item => typeof item === 'string' && item.trim()).join(' · ') || safeLabel(publicPlace?.label);
  const money = mode === 'MY_PRICE' && typeof amount === 'number' ? novac(amount) : '';
  return { title: typeof title === 'string' && title.trim() ? title : null,
    service: typeof category === 'string' && category.trim() && !/^[A-Z0-9_]+$/.test(category.trim())
      && !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(category.trim()) ? category.trim() : null, zone,
    schedule: schedule === 'FIXED_WINDOW' ? fixedRange(value('need.starts_at'), value('need.ends_at'))
      : schedule === 'FLEXIBLE' ? flexibleRange(value('need.starts_at'), value('need.ends_at'))
      : typeof schedule === 'string' ? schedules[schedule] : undefined,
    // An amount with what it buys, or "Tražim ponude" as a quiet word. A price not reached yet is no slot at all.
    value: mode === 'OFFERS' ? { kind: 'offers' }
      : money ? { kind: 'amount', amount: money, basis: basis === 'HOURLY' ? 'po osobi po satu' : basis === 'TOTAL' ? 'ukupno' : basis === 'PER_PERSON' ? 'po osobi' : null } : null,
    people: typeof people === 'number' ? osoba(people) : null, peopleCount: typeof people === 'number' ? people : null };
}
