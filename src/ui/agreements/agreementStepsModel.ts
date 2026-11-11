import type { DogovorProjekcija } from '../../contracts/projections';
import { textWidth } from '../v2/cardHeadFit';
import { layout } from '../system/layout';
import type { WindowRoom } from '../system/textScale';
import { sys } from '../system/tokens';

/**
 * The step bar of a Dogovor (plan 2.6), computed from where the Dogovor STANDS, never from its history: the history of a
 * Dogovor holds one event ("Dogovor je sklopljen"), so a bar built from it would always stand at the start.
 *
 *   Dogovoreno -> Gotovo -> Potvrđeno -> Ocena
 *
 * A step that is behind is `done` (a green check), the one the Dogovor is at is `current` (a filled green dot), the ones ahead are
 * `upcoming` (a grey outline). A cancelled Dogovor reached no step the data can name, so the whole bar is `cancelled` (grey).
 */
export type StepKey = 'agreed' | 'done' | 'confirmed' | 'rated';
export type StepStatus = 'done' | 'current' | 'upcoming' | 'cancelled';
export type OwnRating = 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type AgreementStep = { key: StepKey; label: string; status: StepStatus };

/**
 * The words of the four steps: one short word each, so that the bar stands in one row at the owner's phone and text size and a label is
 * never broken in the middle of a word (phone, 2026-10-08: "Dogovore / no", "Zadatak je / gotov"). "Gotovo" is the worker's report that
 * the work is done; the button that says it is "Zadatak je gotov" (the requester's is "Potvrdi završetak", of which "Potvrđeno" is the result).
 */
export const STEP_LABELS: Readonly<Record<StepKey, string>> = {
  agreed: 'Dogovoreno', done: 'Gotovo', confirmed: 'Potvrđeno', rated: 'Ocena',
};
const ORDER: readonly StepKey[] = ['agreed', 'done', 'confirmed', 'rated'];

/**
 * Where each state stands. The rating step is the person's own: due (or not readable yet - the same rule as the footer, which
 * keeps "Oceni saradnju" on offer) is the current step; given is behind; closed (it can no longer be given) was never reached.
 */
export function agreementStepModel(state: DogovorProjekcija['stanje'], ownRating: OwnRating = 'NOT_APPLICABLE'): AgreementStep[] {
  if (state === 'CANCELLED') return ORDER.map(key => ({ key, label: STEP_LABELS[key], status: 'cancelled' as const }));
  const current = state === 'CONFIRMED' ? 1 : state === 'AWAITING_REQUESTER' ? 2
    : ownRating === 'DUE' || ownRating === 'UNKNOWN' ? 3 : ownRating === 'GIVEN' ? 4 : -1;
  // `done` behind the current step; after a finished Dogovor with no step left to take, everything up to "Potvrđeno" (and the rating, once given) is done.
  const reached = current === -1 ? 3 : current;
  return ORDER.map((key, index) => ({ key, label: STEP_LABELS[key],
    status: index < reached ? 'done' as const : index === current ? 'current' as const : 'upcoming' as const }));
}

/** What a screen reader hears for the bar: each step and where it stands. */
const SPOKEN: Readonly<Record<StepStatus, string>> = { done: 'urađeno', current: 'trenutni korak', upcoming: 'na redu', cancelled: 'otkazano' };
export const stepsSummary = (steps: readonly AgreementStep[]): string =>
  steps.every(step => step.status === 'cancelled') ? 'Dogovor je otkazan.' : steps.map(step => `${step.label}: ${SPOKEN[step.status]}`).join('. ') + '.';

/** The drawn mark of a step, in dp, and the least air between two labels when the four stand side by side. */
export const STEP_MARK = 24;
export const STEP_GAP = sys.space.md;
/** The size a label is written at, before the person's text scale. */
export const STEP_LABEL_SIZE = sys.type.meta.fontSize as number;

/**
 * Whether the four labels stand in ONE row, each on one line, with at least `STEP_GAP` between two of them (phone, 2026-10-08: the equal
 * columns of a quarter of the width each broke "Dogovoreno" in the middle at the owner's text size, 1.15). The row is the window less the
 * screen's two edges; a label takes the width of its own words at the person's text size, measured the way the task card measures its title
 * (`v2/cardHeadFit`, Inter Bold's advance widths, which is the wide side of the Medium the labels are drawn in). When they do not fit - a larger
 * text size, or a narrower window - the bar is drawn as a column, one step under the other, and a word is still never broken.
 */
export function stepsFitInRow(labels: readonly string[], room: WindowRoom): boolean {
  const row = room.width - 2 * layout.gutter;
  const size = STEP_LABEL_SIZE * room.scale;
  const need = labels.reduce((sum, label) => sum + Math.max(STEP_MARK, textWidth(label, size)), 0) + STEP_GAP * (labels.length - 1);
  return Number.isFinite(row) && Number.isFinite(need) && need <= row;
}
