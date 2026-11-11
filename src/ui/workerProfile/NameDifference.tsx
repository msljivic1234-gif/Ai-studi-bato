import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';

/**
 * Whether the work profile still carries a name of its own that is not the account's (owner, 8 Oct 2026: he was "Milos" on his profile and "Pera peric"
 * on his work profile). Only a name that is there can differ: a work profile with no name says nothing here (the account's name is what it takes when
 * it is activated), and an account with no name has nothing to offer. Letters and case are compared as they are written.
 */
export function namesDiffer(workName: string | null | undefined, accountName: string | null | undefined): boolean {
  const work = workName?.trim() ?? '', account = accountName?.trim() ?? '';
  return work.length > 0 && account.length > 0 && work !== account;
}

/**
 * The difference, said quietly and with its one way out: "Na radnom profilu piše „Pera peric“." and the button "Koristi „Milos“", which writes the
 * account's name into the work profile. It is the PERSON's action (never automatic: the name is theirs to choose), white, because the screen's one green
 * action is another; and it goes by itself once the two names agree (after the first save of the name in "Lični podaci", or after this button).
 */
export function NameDifference({ workName, accountName, disabled, working = false, onUse }: {
  workName: string; accountName: string; disabled: boolean; working?: boolean; onUse: () => void;
}) {
  return <View testID="worker-name-difference" style={s.wrap}>
    <T variant="note" tone="muted">{`Na radnom profilu piše „${workName.trim()}“.`}</T>
    <V2Action label={`Koristite „${accountName.trim()}“`} kind="secondary" compact disabled={disabled} loading={working} onPress={onUse} style={s.button} />
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: sys.space.sm, alignItems: 'flex-start' },
  button: { alignSelf: 'flex-start' },
});
