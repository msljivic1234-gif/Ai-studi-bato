/** Self-declared availability is not an Agreement booking, activation or push consent. */
export type AvailabilityRule = Readonly<{
  id: string; weekdays: readonly number[]; startTime: string; endTime: string;
  startsOn: string; endsOn: string | null; label: string; active: boolean;
}>;
export type AvailabilityWindow = Readonly<{
  id: string; startsAt: string; endsAt: string; state: 'AVAILABLE' | 'UNAVAILABLE'; label: string;
}>;
export type WorkerAvailabilityInput = Readonly<{
  timezone: string; availableNow: boolean;
  rules: readonly AvailabilityRule[]; windows: readonly AvailabilityWindow[];
}>;
export type WorkerAvailability = WorkerAvailabilityInput & Readonly<{
  profileId: string; accountId: string; revision: string;
}>;
export type AvailabilitySave = Readonly<{
  expectedRevision: string; value: WorkerAvailabilityInput;
}>;
export type AvailabilityReceipt = Readonly<{
  saved: true; idempotentReplay: boolean; availability: WorkerAvailability;
}>;
