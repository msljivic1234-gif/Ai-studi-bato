/** One existing Worker allocation capacity, not seats/load/towing. */
export type WorkerCapacity = { accountId: string; profileId: string; teamCapacity: number; revision: string };
export type WorkerCapacitySave = { expectedRevision: string; teamCapacity: number };
export type WorkerCapacityReceipt = { saved: true; idempotentReplay: boolean; capacity: WorkerCapacity };
export const workerCapacityValue = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 50;
export const workerCapacityRevision = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
