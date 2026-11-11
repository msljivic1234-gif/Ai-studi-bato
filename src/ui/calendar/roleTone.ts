import { sys } from '../system/tokens';
import type { RoleKind } from './calendarViews';

/**
 * The colours of the two sides of a Dogovor, the same wherever Raspored draws one (owner's sketch, 8 Oct 2026): emerald where I "Uskačeš"
 * (`artRole.location`), coral where it is "Tvoj zadatak" (`artRole.people`). `front` is for a dot and an edge, `edge` (the darker one,
 * about 6:1 on white) is for words, `soft` is a tint a block of the day lies on. A Dogovor that does not say which side I am on wears the
 * neutral ones: no side's colour is ever borrowed for it.
 */
export type RoleTone = Readonly<{ front: string; edge: string; soft: string }>;

export const ROLE_TONES: Readonly<Record<RoleKind, RoleTone>> = {
  worker: sys.color.artRole.location,
  requester: sys.color.artRole.people,
  unknown: { front: sys.color.muted, edge: sys.color.muted, soft: sys.color.wash },
};
