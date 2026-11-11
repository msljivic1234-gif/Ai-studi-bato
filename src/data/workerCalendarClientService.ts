import type { WorkerCalendarEvent, WorkerCalendarRange } from '../contracts/workerCalendar';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, uuid } from './serverReceipt';

import { calendarInstant } from '../lib/calendarTime';

const INVALID = 'WORKER_CALENDAR_INVALID_RESPONSE';
const CALENDAR_COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da otvorite svoj Raspored.',
  CALENDAR_RANGE_INVALID: 'Izabrani period nije ispravan.',
};

function validRange(from: string, to: string): boolean {
  const start = calendarInstant(from);
  const end = calendarInstant(to);
  return start !== null && end !== null && start < end;
}

function sameInstant(value: string, expected: string): boolean {
  return calendarInstant(value) !== null && calendarInstant(value) === calendarInstant(expected);
}

function mapEvent(raw: unknown, from: string, to: string): WorkerCalendarEvent | null {
  const value = record(raw);
  if (!value || !uuid(value.eventId) || !uuid(value.agreementId) ||
      !positiveInteger(value.agreementVersion) || typeof value.startsAt !== 'string' || typeof value.endsAt !== 'string' ||
      value.agreementStatus !== 'CONFIRMED' || value.source !== 'AGREEMENT') return null;
  const starts = calendarInstant(value.startsAt);
  const ends = calendarInstant(value.endsAt);
  const rangeStart = calendarInstant(from);
  const rangeEnd = calendarInstant(to);
  if (starts === null || ends === null || rangeStart === null || rangeEnd === null
      || starts >= ends || starts >= rangeEnd || ends <= rangeStart) return null;
  return {
    eventId: value.eventId,
    agreementId: value.agreementId,
    agreementVersion: value.agreementVersion,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    agreementStatus: 'CONFIRMED',
    source: 'AGREEMENT',
  };
}

async function calendarReceipt(options: Parameters<typeof readReceipt<WorkerCalendarRange>>[0]): Promise<Ishod<WorkerCalendarRange>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
    return failure(result.kod, 'Nalog je promenjen. Ponovo otvorite Raspored.');
  }
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, CALENDAR_COPY.AUTH_REQUIRED);
  return result;
}

export const workerCalendarClientService = {
  readRange(from: string, to: string): Promise<Ishod<WorkerCalendarRange>> {
    if (!validRange(from, to)) {
      return Promise.resolve(failure('CALENDAR_RANGE_INVALID', CALENDAR_COPY.CALENDAR_RANGE_INVALID));
    }
    return calendarReceipt({
      rpc: 'rpc_get_worker_calendar',
      args: { p_from: from, p_to: to },
      errors: CALENDAR_COPY,
      fallback: 'WORKER_CALENDAR_READ_FAILED',
      invalid: INVALID,
      decode(raw): WorkerCalendarRange | null {
        const value = record(raw);
        if (!value || value.authoritative !== true || typeof value.from !== 'string' || typeof value.to !== 'string' ||
            !sameInstant(value.from, from) || !sameInstant(value.to, to) || !Array.isArray(value.events)) return null;
        const events: WorkerCalendarEvent[] = [];
        const eventIds = new Set<string>();
        const agreementIds = new Set<string>();
        for (const rawEvent of value.events) {
          const event = mapEvent(rawEvent, from, to);
          if (!event || eventIds.has(event.eventId.toLowerCase()) || agreementIds.has(event.agreementId.toLowerCase())) return null;
          eventIds.add(event.eventId.toLowerCase());
          agreementIds.add(event.agreementId.toLowerCase());
          events.push(event);
        }
        for (let index = 1; index < events.length; index += 1) {
          const previous = events[index - 1];
          const current = events[index];
          const previousTime = calendarInstant(previous.startsAt);
          const currentTime = calendarInstant(current.startsAt);
          if (previousTime === null || currentTime === null || previousTime > currentTime) return null;
        }
        return { from: value.from, to: value.to, events, authoritative: true };
      },
    });
  },
};
