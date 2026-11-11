import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supportCaseClientService } from '../../data/supportCaseClientService';
import type { SupportReference } from '../../data/supportCaseTypes';
import { sesijaSada, useSesija } from '../../store/sesija';

import { ProductSheet } from '../product/ProductSheet';
import { SettingsAction, SettingsText as T } from '../settings/SettingsPresentation';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';

/** An explicit read opens an owned existing case or a new unsent form.
 * The route contains only an opaque reference, never a narrative or snapshot. */
export function SupportContextEntry({ reference, label = 'Otvori podršku', disabled = false, canAct = () => true,
  navigate = action => action(), previewText }: { reference: SupportReference; label?: string; disabled?: boolean; previewText?: string;
    canAct?: () => boolean; navigate?: (action: () => void) => void }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(false), [, setEpoch] = useState(0), selectedRef = useRef(false); selectedRef.current = selected;
  const selection = useRef<{ focus: object; view: object; accountId: string; accountRevision: number } | null>(null);
  const focus = useRef<object | null>(null), lock = useRef<object | null>(null);
  const view = useMemo(() => ({}), [reference.kind, reference.id, reference.revision, disabled, previewText]);
  const latestView = useRef(view); latestView.current = view;
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; lock.current = null; selection.current = null; setBusy(false); setError(null); setSelected(false); setEpoch(x => x + 1);
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { focus.current = null; lock.current = null; selection.current = null; setBusy(false); setError(null); setSelected(false); }
      else { focus.current = {}; lock.current = null; setBusy(false); setEpoch(x => x + 1); }
    });
    return () => { listener.remove(); focus.current = null; lock.current = null; selection.current = null; setSelected(false); };
  }, [accountId, accountRevision, view]));
  const renderedFocus = focus.current;
  const selectedForView = selected && selection.current?.focus === renderedFocus && selection.current?.view === view
    && selection.current?.accountId === accountId && selection.current?.accountRevision === accountRevision;
  const previewValid = previewText === undefined || typeof previewText === 'string' && previewText.trim().length > 0 && Array.from(previewText).length <= 6000;
  const canSelect = () => renderedFocus !== null && focus.current === renderedFocus && latestView.current === view && !disabled && previewValid
    && !['background', 'inactive'].includes(AppState.currentState) && canAct()
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const open = async () => {
    const token = renderedFocus;
    const ownLease = () => token !== null && focus.current === token && latestView.current === view
      && !['background', 'inactive'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const current = () => ownLease() && !disabled && canAct();
    if (!accountId || !current() || lock.current || !previewValid || previewText !== undefined && (!selectedForView || !selectedRef.current)) return;
    const operation = {}; lock.current = operation; setBusy(true); setError(null);
    const bound = { kind: reference.kind, id: reference.id, revision: reference.revision };
    try {
      const result = await supportCaseClientService.findContext(bound.kind, bound.id, { accountId, accountRevision, isCurrent: current });
      if (!current() || lock.current !== operation) return;
      if (!result.ok) { setError(result.poruka); return; }
      const target = result.podatak.caseId;
      // The preview sheet is a window over the conversation: it goes with this lease, before the next screen opens.
      focus.current = null; selection.current = null; setSelected(false);
      navigate(() => target ? router.push({ pathname: '/podrska/[id]', params: { id: target } })
        : router.push({ pathname: '/podrska/novi', params: { contextKind: bound.kind, contextId: bound.id,
          ...(bound.revision !== null ? { contextRevision: String(bound.revision) } : {}) } }));
    } catch { if (current()) setError('Postojeći zahtev nije učitan. Proveri ponovo pre nastavka.'); }
    // A parent authority refresh invalidates this result, while the same screen
    // lease still owns its busy indicator. Release that indicator without using
    // the rejected result or updating another account/focus/context.
    finally { if (lock.current === operation) { lock.current = null; if (ownLease()) setBusy(false); } }
  };
  // The sheet has closed (its own way out, Back, a tap outside): the local choice goes with it, whatever the parent's
  // guard says now. Clearing a choice writes nothing; only starting one and continuing are fenced by `canSelect()`.
  // Gating this on `canSelect()` left the sheet's invisible Modal mounted over the conversation after a failed refresh
  // (round 5 review), blocking every touch.
  const closePreview = () => { selection.current = null; setSelected(false); };
  const previewing = selectedForView && previewText !== undefined;
  return <>
    {/* The button keeps its words while it checks, with a spinner (the V2Action loading rule). */}
    {!selectedForView ? <SettingsAction label={label} kind="quiet" loading={busy} disabled={disabled || busy || !previewValid}
      onPress={() => { if (!canSelect() || lock.current) return; if (previewText !== undefined && renderedFocus) {
        selection.current = { focus: renderedFocus, view, accountId, accountRevision }; setSelected(true);
      } else void open(); }} /> : null}
    {previewing && previewText !== undefined ? <SupportMessagePreviewSheet previewText={previewText} busy={busy} disabled={disabled} error={error}
      onContinue={() => { void open(); }} onCancel={closePreview} /> : null}
    {error && !previewing ? <T tone="danger" accessibilityRole="alert">{error}</T> : null}
  </>;
}

/**
 * The chosen message, before it is attached: shown in a sheet over the conversation, not unfolded inside it, so the thread
 * does not jump and no primary button stands among the messages. Every way out (the quiet button, the X, Back, a tap
 * outside) ends in `onCancel` once the sheet has closed. Presentation only; the entry above owns every fence.
 */
export function SupportMessagePreviewSheet({ previewText, busy, disabled, error, onContinue, onCancel }: {
  previewText: string; busy: boolean; disabled: boolean; error: string | null; onContinue: () => void; onCancel: () => void;
}) {
  return <ProductSheet title="Izabrana poruka za privatnu podršku" closeLabel="Odustani od izbora poruke" dismissible={!busy} onClose={onCancel}
    footer={dismiss => <>
      <SettingsAction label="Nastavi sa izabranom porukom" loading={busy} disabled={disabled || busy} onPress={onContinue} />
      <SettingsAction label="Odustani od izbora poruke" kind="quiet" disabled={disabled || busy} onPress={dismiss} />
    </>}>
    {() => <View style={styles.preview}>
      {/* The chosen words as the system's note (a flat tint, not a card): a quotation inside the sheet. */}
      <Surface kind="note"><T selectable>{previewText}</T></Surface>
      <T variant="note" tone="muted">Uz privatni zahtev prilažeš samo ovu poruku. Ostatak razgovora se ne kopira i druga strana ne dobija zahtev.</T>
      {error ? <T variant="note" tone="danger" accessibilityRole="alert">{error}</T> : null}
    </View>}
  </ProductSheet>;
}

const styles = StyleSheet.create({
  preview: { gap: sys.space.md },
});
