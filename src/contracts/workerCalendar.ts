export type WorkerCalendarSource = 'AGREEMENT';

export type WorkerCalendarEvent = Readonly<{
  eventId: string;
  agreementId: string;
  agreementVersion: number;
  startsAt: string;
  endsAt: string;
  agreementStatus: 'CONFIRMED';
  source: WorkerCalendarSource;
}>;

export type WorkerCalendarRange = Readonly<{
  from: string;
  to: string;
  events: readonly WorkerCalendarEvent[];
  authoritative: true;
}>;
