import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { SettingsText as T, SettingsAction } from '../settings/SettingsPresentation';
import { field, sys } from '../system/tokens';

/** What the bar's "Sačuvaj" needs to be drawn and pressed: it exists only while the name differs from the saved one. */
export type NameSaveControl = { disabled: boolean; loading: boolean; press: () => void };

/**
 * The display name, one field and, only when there is something to save, its one action (2026-09-24; owner's phone, 8 Oct 2026: a grey
 * "Sačuvaj ime" stood there all the time, with "Ovo ime je već sačuvano." under it, and a paragraph on who sees the name). The label stands
 * above the field (not a second title under the bar). The "Sačuvaj" is drawn once the name differs from the saved one, and goes
 * when it has been saved: a button that cannot do anything is not drawn (J14), and who sees the name is said once for the whole screen.
 * After an unknown outcome or a refusal the one action reads the saved name instead, because nothing else can be done until that read.
 *
 * Where "Sačuvaj" stands (approved draft of the product, 8 Oct 2026, P2: "Sačuvaj u zaglavlju tek kad se nešto promeni"): with `onSaveControl`
 * the form does not draw the action under the field; it reports it (`NameSaveControl`, or `null` while there is nothing to save) and the screen
 * draws it in the bar. Without it (the isolated name scenes) the action stands under the field, as it did. The reason a save waits is a muted
 * line under the field in both.
 *
 * The request id belongs to the typed name: the same name retried reuses it, and any edit retires it.
 */
export function DisplayNameForm(p: { savedName: string; /** The name already typed when the form opens (the design gallery shows the form with a change in it). */ typed?: string; busy: boolean; uncertain: boolean; saved: boolean; error: string | null;
  onDirtyChange?: (dirty: boolean) => void;
  /** Reports the bar's "Sačuvaj" (or `null`); with it the form draws no action of its own to save. */ onSaveControl?: (control: NameSaveControl | null) => void;
  /** A read is in flight or a write is. */ checking: boolean; check: () => void; save: (name: string, key: string) => Promise<void> }) {
  const [name, setName] = useState(p.typed ?? p.savedName), request = useRef<{ name: string; id: string } | null>(null);
  const unchanged = name.trim() === p.savedName;
  useEffect(() => { p.onDirtyChange?.(!unchanged); }, [unchanged, p.onDirtyChange]);
  // A grey button says why it is grey (owner rule, 2026-09-23): an emptied name, and the saved name being read again (the form stays on
  // screen; the editor would refuse a save without a word, review of step 9, 2026-09-24). Busy states are named by the action itself.
  const reason = p.busy || p.uncertain ? null : !name.trim() ? 'Ime ne može da ostane prazno.' : p.checking ? 'Učitavamo sačuvano ime…' : null;
  const reconcile = p.uncertain || !!p.error;
  const send = () => { const command = request.current ?? { name: name.trim(), id: noviUuidZahtevId() }; request.current = command; void p.save(command.name, command.id); };
  const sendNow = useRef(send); sendNow.current = send;
  // The bar's "Sačuvaj": there while the name has changed and no recovery is waiting; the same numbers as the action under the field.
  const inBar = !!p.onSaveControl, offered = !reconcile && !unchanged;
  const disabled = p.checking || !name.trim(), loading = p.busy, report = p.onSaveControl;
  useEffect(() => {
    if (!report) return;
    report(offered ? { disabled, loading, press: () => sendNow.current() } : null);
  }, [report, offered, disabled, loading]);
  useEffect(() => () => { report?.(null); }, [report]);
  return <View style={s.form}>
    <T variant="meta" tone="muted">Ime za prikaz</T>
    <TextInput accessibilityLabel="Ime za prikaz" autoComplete="name" textContentType="name" value={name} maxLength={200}
      editable={!p.busy && !p.uncertain} onChangeText={value => { request.current = null; setName(value); }} style={field} />
    {reconcile ? <SettingsAction label="Proveri sačuvane podatke" disabled={p.checking} onPress={p.check} />
      : unchanged ? null
        : inBar ? (reason ? <T variant="note" tone="muted">{reason}</T> : null)
          : <SettingsAction label="Sačuvaj ime" loading={p.busy} disabled={disabled} reason={reason} onPress={send} />}
    {p.saved && unchanged ? <T accessibilityLiveRegion="polite">Ime je sačuvano.</T> : null}
    {p.error ? <T accessibilityRole="alert" tone="danger">{p.error}</T> : null}
  </View>;
}

const s = StyleSheet.create({ form: { gap: sys.space.md } });
