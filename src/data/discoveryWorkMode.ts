import type { WhereFilter } from './marketplaceView';

/** Older views without a work mode enter physical work. Explicit "any" is the
 * person's both-modes choice and must reach P6 unchanged, like remote/onsite.
 * Apply before requests as well as display so counts and pagination agree.
 */
export function discoveryWorkMode<T extends { where?: WhereFilter }>(value: T): T {
  return value.where === undefined ? { ...value, where: 'onsite' } : value;
}
