import { memo, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { StanjePotrebe } from '../../contracts/projections';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { TaskRecordBody, useTaskRecord } from './discovery/TaskRecordBody';
import type { TaskCardRelation } from './TaskFace';

/**
 * How far the other whole cards (my own task, my application, a Dogovor) give under the finger. The task card itself gives as a
 * `Surface record` does, on the row rung of the press ladder (`sys.motion.scale.row`); this constant stays for the cards that
 * still spell their own press until they stand on `Surface` too.
 */
export const CARD_PRESS_SCALE = sys.motion.scale.row;

/**
 * A task in a list: a `Surface record`, because it is a thing that is touched (composition spec 2026-10-07, 4.2). One press
 * opens the task; the face inside (`TaskRecordBody`) is the one the pin's card on the map shows, in the same order and in the
 * same words, and it is said to a screen reader once, as the card's own sentence, with no stop of its own inside.
 *
 * What this account is to the task (mine, applied to, not known yet) comes from the list that read it (`relation`) and is
 * said as a state at the top of the face; nothing else is added to it. My own tasks in Moji zadaci are `OwnTaskCard`'s.
 */
function TaskCardBase({ item, onOpen, relation, sectionSays, portrait, style }: {
  item: MarketplaceItem; onOpen: () => void;
  /** What this account is to a task found in discovery, from its own tasks and applications. Absent = nothing known. */
  relation?: TaskCardRelation;
  /** The state the list's own section is named for (Nacrti, Istorija), which the face then does not repeat. */
  sectionSays?: StanjePotrebe;
  /** Authorized public portrait supplied by the collection; no per-card reads are started here. */
  portrait?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const model = useTaskRecord(item, relation, sectionSays);
  return <Surface kind="record" onPress={onOpen} style={style} accessibilityLabel={`Otvori zadatak ${model.title}. ${model.spoken}`}>
    <View pointerEvents="none">
      <TaskRecordBody model={model} portrait={portrait} />
    </View>
  </Surface>;
}
export const TaskCard = memo(TaskCardBase);
