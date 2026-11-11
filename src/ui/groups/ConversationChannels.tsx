import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GroupContext } from '../../data/groupConversationService';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { Segmented } from '../system/Segmented';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/** Routes are only the reader's own Agreement or the requester's authorized management IDs. */
export function privateConversationChoices(context: GroupContext): { id: string; name: string }[] {
  const group = context.group;
  if (!group) return [];
  if (group.role === 'PARTICIPANT') return [{ id: context.agreementId,
    name: group.members.find(member => member.role === 'REQUESTER')?.displayName ?? 'Osoba koja traži pomoć' }];
  const counts = new Map<string, number>();
  for (const item of group.management ?? []) counts.set(item.accountId, (counts.get(item.accountId) ?? 0) + 1);
  return (group.management ?? []).map((item, index) => {
    const name = group.members.find(member => member.accountId === item.accountId)?.displayName ?? 'Učesnik';
    const duplicate = (counts.get(item.accountId) ?? 0) > 1;
    return { id: item.agreementId, name: duplicate || name === 'Učesnik' ? `${name} · Dogovor ${index + 1}` : name };
  });
}

export function ConversationChannels({ context, selected, disabled = false, error = false, onGroup, onPrivate, onMore, onPickerVisibilityChange }: {
  context: GroupContext; selected: 'group' | 'private'; disabled?: boolean;
  error?: boolean;
  onGroup: () => void; onPrivate: (id: string) => void; onMore?: () => void;
  onPickerVisibilityChange?: (open: boolean) => void;
}) {
  const [choosing, setChoosing] = useState(false), reduced = useReducedMotion();
  if (!context.group) return null;
  const choices = privateConversationChoices(context);
  const openPrivate = () => {
    if (disabled) return;
    if (choices.length === 1 && !context.group?.managementNextId) onPrivate(choices[0].id);
    else { onPickerVisibilityChange?.(true); setChoosing(true); }
  };
  const actions: SheetAction[] = choices.map(choice => ({ key: choice.id, label: choice.name, icon: 'chat',
    subtitle: 'Privatna prepiska uz ovaj Dogovor.', disabled, reason: disabled ? 'Sačekaj da se razgovor osveži.' : undefined,
    onPress: () => { if (!disabled) onPrivate(choice.id); } }));
  if (context.group.managementNextId && onMore) actions.push({ key: 'more', label: 'Još privatnih razgovora', icon: 'users', onPress: onMore, disabled });
  return <View style={s.channel}>
    <Segmented value={selected} options={[{ key: 'group', label: 'Svi učesnici', disabled }, { key: 'private', label: 'Privatno', disabled }]}
      onChange={key => { if (!disabled) { if (key === 'group') onGroup(); else openPrivate(); } }} />
    {selected === 'private' && context.group.role === 'REQUESTER' && (choices.length > 1 || !!context.group.managementNextId)
      ? <V2Action label="Promeni privatni razgovor" kind="quiet" compact disabled={disabled} onPress={openPrivate} /> : null}
    {choosing ? <ActionSheet title="Privatna poruka" actions={actions} onClose={() => { setChoosing(false); onPickerVisibilityChange?.(false); }} reduced={reduced} /> : null}
    {selected === 'group' ? <T variant="meta" tone="muted">Ove poruke vide svi učesnici zadatka.</T> : null}
    {error ? <View><T variant="meta" tone="muted" accessibilityLiveRegion="polite">Nisu učitani svi privatni razgovori.</T>
      {onMore ? <V2Action label="Pokušaj ponovo" kind="quiet" compact disabled={disabled} onPress={onMore} /> : null}</View> : null}
  </View>;
}
const s = StyleSheet.create({ channel: { gap: sys.space.sm } });
