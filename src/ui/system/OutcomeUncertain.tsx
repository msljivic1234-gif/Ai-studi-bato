import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { BALANCED_LINES, balancedStyle } from './balanced';
import { CHECKING, CHECK_SPOKEN, OUTCOME, OUTCOME_ACTION, UNCERTAIN_ABOUT, type UncertainSubject } from './outcomeCopy';
import { StateView, type StateAction } from './StateView';
import { Surface } from './Surface';
import { sys } from './tokens';

export type OutcomeUncertainProps = {
  /** What the person did and the app is not sure about: picks the title and the picture ("Ne znamo da li je prijava stigla"). The generic line when left out. */
  about?: UncertainSubject;
  /** The flow's own title or sentence, when it knows better than the table (`outcomeCopy.ts`). Say what is not known, never that it failed. */
  title?: string;
  copy?: string;
  /** Reads the state again: the ONE main action. What it finds is the screen's to show: the thing arrived (say so) or it did not (the form is back). */
  onCheck: () => void;
  /** The read is on its way: the button keeps its colour and shows its spinner, cannot be pressed twice, and a screen reader is told. */
  checking?: boolean;
  /** The one quiet way out: back, edit, leave. Never a second way to send the same thing again. */
  quiet?: StateAction;
  /**
   * `screen` (the default): the state view, a centred column that takes the screen's place. `inline`: a calm note for a footer, a thread or a
   * sheet, where the form or the conversation stays and the note stands over its action.
   */
  layout?: 'screen' | 'inline';
  /** `screen` inside a section or a sheet: smaller (see `StateView`). */
  compact?: boolean;
  testID?: string;
};

/**
 * "We do not know whether it worked" (UI/UX pass 2026-10-08, F8b; text revision 2026-10-07, finding 4). The app sent something (a
 * prijava, a task, a message, a cancellation), no answer came back, and it cannot say whether it was saved. About 350 sentences told
 * that in the engine's words ("ishod nije potvrđen", "sačuvano stanje", "zahtev") and 36 buttons offered it ("Proveri ishod", "Učitaj
 * sačuvano stanje", "Osveži stanje"). It is one part now: an honest title that says what is not known, one sentence that says why, and
 * ONE button, "Proveri", that reads the state again. The words are `outcomeCopy.ts`.
 *
 * Honesty is the whole job. The title never says "Nije uspelo" (the app does not know that), the sentence promises nothing it cannot know
 * ("neće se poslati dvaput" is for the flow to add, when it is sure), and while it is not known the thing that was sent cannot be sent again:
 * the way to a second attempt is what the check finds ("it did not arrive"), and that screen is the flow's. A second send beside "Proveri"
 * is the double that this state exists to prevent, so the one quiet action is a way OUT (back, edit), never "Pošalji ponovo".
 *
 * Two shapes, one meaning. `screen` takes the screen's place (the state view, grey picture, alert). `inline` is a `note` in the warning tint
 * with the title, the button and, only when the flow passes one, a sentence; its button is the secondary one (white, green words), because a
 * screen has ONE green action and in the flow this note stands in that is the foot's.
 */
export function OutcomeUncertain({ about = 'generic', title, copy, onCheck, checking = false, quiet, layout = 'screen', compact = false, testID }: OutcomeUncertainProps) {
  const subject = UNCERTAIN_ABOUT[about];
  const heading = title ?? subject.title;
  useEffect(() => { if (checking) AccessibilityInfo.announceForAccessibility(CHECKING); }, [checking]);

  if (layout === 'screen') return <StateView kind="uncertain" art={subject.art} title={heading} body={copy ?? OUTCOME.uncertain.copy} compact={compact} testID={testID}
    primary={{ label: OUTCOME_ACTION.check, accessibilityLabel: CHECK_SPOKEN, onPress: onCheck, busy: checking }} quiet={quiet} />;

  return <Surface kind="note" tone="warn" testID={testID}>
    <View accessibilityLiveRegion="polite" style={s.inline}>
      <T variant="bodyStrong" accessibilityRole="alert" {...BALANCED_LINES} style={balancedStyle}>{heading}</T>
      {copy ? <T variant="note" tone="muted" {...BALANCED_LINES} style={balancedStyle}>{copy}</T> : null}
      <View style={s.actions}>
        <V2Action label={OUTCOME_ACTION.check} accessibilityLabel={CHECK_SPOKEN} kind="secondary" loading={checking} onPress={onCheck} />
        {quiet ? <V2Action label={quiet.label} accessibilityLabel={quiet.accessibilityLabel} kind="quiet" disabled={quiet.disabled} onPress={quiet.onPress} /> : null}
      </View>
    </View>
  </Surface>;
}

const s = StyleSheet.create({
  inline: { gap: sys.space.xs },
  // The note pads 12 round it; the button stands 8 under the words, as it does under the reason in a foot.
  actions: { marginTop: sys.space.sm, gap: sys.space.sm },
});
