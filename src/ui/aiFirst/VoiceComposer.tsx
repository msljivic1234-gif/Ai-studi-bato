import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { HourglassMedium, Microphone, StopCircle } from 'phosphor-react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, voiceErrorCopy, type HoldToTalkController, type VoicePhase, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { tick } from '../system/haptics';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * One conversation controller, two presentational parts. The microphone owns the
 * hold/tap gesture; the notice shows real capture state and recovery. Delivery is
 * independently selected (auto-send or review), with mandatory screen-reader review.
 * Every transcript still passes through its consumer's owned onTranscript guards.
 */
export type VoiceInput = {
  controller: HoldToTalkController; state: VoiceSnapshot;
  /** The screen cannot take a new message now (one is pending, the answer is being written, the conversation is closed). */
  disabled: boolean;
  /** Moves text kept after a failed capture into the message field; false when the field cannot take it. */
  onKeepText: (text: string) => boolean;
};

const ACTIVE: readonly VoicePhase[] = ['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING'];
/** The microphone is on its way or listening; FINALIZING is after it, and IDLE is before. */
export const voiceActive = (state: VoiceSnapshot) => ACTIVE.includes(state.phase);

/** What each phase is called where it is shown or spoken; LISTENING and IDLE depend on the mode and are said by the caller. */
const PHASE_WORDS: Partial<Record<VoicePhase, string>> = {
  PERMISSION_PENDING: 'Čekamo dozvolu mikrofona…', PREPARING: 'Pripremamo govorni unos…', STARTING: 'Povezujemo mikrofon…',
  FINALIZING: 'Završavamo tekst…',
};
/** Shown when the microphone was only tapped: it listens while it is held. */
export const HOLD_HINT = 'Držite mikrofon dok govorite, pa pustite da pošaljete.';

export function useVoiceScreenReader(): boolean {
  const [reader, setReader] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (alive) setReader(enabled); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; listener.remove(); };
  }, []);
  return reader;
}
/** Whether the text of this capture goes to the field for review: from the running session, else from the screen reader. */
const reviewing = (state: VoiceSnapshot, reader: boolean) => state.session ? state.session.mode === 'accessible' : reader;

/** The microphone keeps its gesture; the ordinary AI pill uses a practical 52 px target. */
export function VoiceComposer(p: VoiceInput & { onTooShort?: () => void; size?: 48 | 52 | 60 | 64; tapToTalk?: boolean; reviewFirst?: boolean }) {
  const reader = useVoiceScreenReader();
  const reduced = useReducedMotion();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const gesture = useRef<string | null>(null), startX = useRef(0), startY = useRef(0);
  const gestureTap = useRef(false);
  // Gesture and delivery are independent. A held recording can be reviewed; a tapped
  // recording can auto-send. Screen readers always retain the explicit review step.
  const explicit = p.state.phase !== 'IDLE' && gesture.current ? gestureTap.current : reader || !!p.tapToTalk;
  const { phase } = p.state;
  const active = voiceActive(p.state);
  const occupied = phase !== 'IDLE' && !active;
  const blocked = (p.disabled && !active) || occupied;
  const listening = phase === 'LISTENING';
  const targetSize = p.size ?? 48;
  const glyphSize = targetSize === 64 ? 30 : targetSize === 60 ? 28 : targetSize === 52 ? 26 : 22;
  // Pressable's onPressOut also fires on leaving its press rectangle or losing the responder.
  // Held speech must finish only on actual responder release; termination cancels it unsent.
  const MicTarget = explicit ? Pressable : View;
  // The three ticks of holding to talk are outcomes (haptics rule R5): the recording really began, the finger was lifted to send what
  // was said, the recording was called off. The first is read from the phase, not from the touch: a hold that never got the
  // microphone (permission, a busy adapter) has not started anything to feel.
  useEffect(() => { if (phase === 'LISTENING' && gesture.current) tick('gestureStart'); }, [phase]);
  // A recording that fails says so with the error tick, here and not in the notice, so the same error is not felt twice.
  useEffect(() => { if (p.state.error) tick('error'); }, [p.state.error]);
  useEffect(() => { if (phase === 'IDLE') gesture.current = null; }, [phase]);
  useEffect(() => {
    if (listening && !reduced && targetSize === 64) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: sys.motion.arrive.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: sys.motion.arrive.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [listening, reduced, targetSize, pulseAnim]);
  const begin = () => {
    if (p.disabled || occupied || active || gesture.current) return;
    const id = noviUuidZahtevId(); gesture.current = id; gestureTap.current = explicit;
    // The controller's existing `accessible` mode routes the transcript to the draft.
    // It does not define the responder gesture used by this component.
    if (!p.controller.begin(id, reader || p.reviewFirst ? 'accessible' : 'hold')) gesture.current = null;
  };
  const release = () => {
    const id = gesture.current; gesture.current = null;
    if (!id) return;
    // A tap on a held control does nothing a person can see, so the composer says how it works.
    const early = phase !== 'LISTENING';
    if (!early) tick('gestureEnd');
    void p.controller.release(id);
    if (early && !explicit) p.onTooShort?.();
  };
  // A running capture is said and drawn in its own mode; before one starts, the mode is the screen reader's.
  const review = reviewing(p.state, reader || !!p.reviewFirst);
  const label = listening ? explicit ? review ? 'Zaustavite i pregledajte tekst' : 'Zaustavite i pošaljite'
    : review ? 'Slušamo — pustite za pregled' : 'Slušamo — pustite da pošaljete'
    : PHASE_WORDS[phase] ?? (explicit ? 'Pokrenite govorni unos' : 'Držite da govorite');
  const waiting = phase === 'PERMISSION_PENDING' || phase === 'PREPARING' || phase === 'STARTING' || phase === 'FINALIZING';
  const cancel = () => { if (gesture.current) { gesture.current = null; tick('cancel'); p.controller.cancel('gesture'); } };
  return <MicTarget testID="voice-mic" accessible accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={explicit ? review ? 'Zaustavljanje priprema tekst za pregled i izmenu. Poruku šaljete zasebnim dugmetom.'
      : 'Dodirnite da počnete, pa ponovo da pošaljete. Snimanje možete da otkažete.'
      : review ? 'Držite tokom govora. Kada pustite, tekst je spreman za pregled. Povucite prst naviše da otkažete.'
        : 'Držite tokom govora. Kada pustite, poruka ide u razgovor. Povucite prst naviše da otkažete.'}
    accessibilityState={{ disabled: blocked, busy: waiting }} disabled={blocked}
    // Switch Access and Voice Access click instead of holding: that click reaches only `onPress` (or this action), never
    // the press-in and press-out a hold is made of, so on its own it did nothing. In hold mode it shows the same advice
    // as a short tap, with "Govori bez držanja" beside it, which selects the alternative gesture on this same control.
    accessibilityActions={explicit ? undefined : [{ name: 'activate' }]}
    onAccessibilityAction={explicit ? undefined : event => { if (event.nativeEvent.actionName === 'activate' && !blocked) p.onTooShort?.(); }}
    onStartShouldSetResponder={explicit ? undefined : () => !blocked}
    onResponderGrant={explicit ? undefined : event => { startX.current = event.nativeEvent.pageX ?? 0; startY.current = event.nativeEvent.pageY; begin(); }}
    onResponderRelease={explicit ? undefined : release}
    onResponderTerminate={explicit ? undefined : cancel}
    onResponderTerminationRequest={explicit ? undefined : () => true}
    onPress={explicit ? () => gesture.current ? release() : begin() : undefined}
    onResponderMove={explicit ? undefined : event => { if (gesture.current && (startY.current - event.nativeEvent.pageY > 70 || Math.abs(startX.current - (event.nativeEvent.pageX ?? startX.current)) > 70)) cancel(); }}
    style={[s.target, { width: targetSize, height: targetSize }]}>
    <View style={[s.micCircle, { width: targetSize - 4, height: targetSize - 4 }, targetSize === 60 && s.micPrimary, targetSize === 64 && s.mic64, listening && s.micListening, waiting && s.micWaiting]}>
      {listening && !reduced && targetSize === 64 ? (
        <Animated.View style={[s.pulseRing, {
          width: targetSize - 4,
          height: targetSize - 4,
          borderRadius: (targetSize - 4) / 2,
          transform: [{
            scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] })
          }],
          opacity: pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.25, 0] }),
        }]} />
      ) : null}
      {waiting ? reduced
        ? <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <HourglassMedium size={glyphSize} color={targetSize === 64 ? '#FFFFFF' : sys.color.artRole.ai.front} />
          </View>
        : <ActivityIndicator size="small" color={targetSize === 64 ? '#FFFFFF' : sys.color.artRole.ai.front} />
        : active && review ? <StopCircle size={glyphSize} weight="fill" color={targetSize === 64 ? '#FFFFFF' : listening ? sys.color.onGreen : sys.color.ink} />
          : <Microphone size={glyphSize} weight={listening ? 'fill' : 'regular'} color={targetSize === 64 ? '#FFFFFF' : listening ? sys.color.onGreen : blocked ? sys.color.muted : sys.color.ink} />}
    </View>
  </MicTarget>;
}

/** Five still bars for the measured level; they redraw with the level and never animate on their own. */
function Levels({ level }: { level: number }) {
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.levels}>
    {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
      style={[s.level, { height: 6 + i * 4 }, level >= threshold && s.levelOn]} />)}
  </View>;
}

/**
 * The line above the composer: what the microphone is doing and what it heard, or what went wrong and the way out.
 * `hint` is the composer's own quiet advice, shown only while the microphone has nothing to say.
 */
export function VoiceNotice(p: VoiceInput & { tapToTalk?: boolean; hint?: string | null; hintAction?: { label: string; onPress: () => void } }) {
  const reader = useVoiceScreenReader();
  const { state } = p;
  const active = voiceActive(state), listening = state.phase === 'LISTENING';
  if (active || state.phase === 'FINALIZING') {
    const words = [state.finalText, state.interimText].filter(Boolean).join(' ');
    const line = listening ? (reader || p.tapToTalk ? 'Slušamo… Dodirnite za slanje' : 'Slušamo… Pustite za slanje')
      : state.phase === 'FINALIZING' ? 'Šaljemo poruku…' : PHASE_WORDS[state.phase] ?? '';
    return <View testID="voice-notice" style={s.notice}>
      {listening && words ? <View style={s.heardBubble}>
        <T testID="voice-live-transcript" selectable numberOfLines={2} style={s.heard}>{words}</T>
      </View> : null}
      <View style={s.noticeRow}>
        {listening && state.audioLevel !== null ? <Levels level={state.audioLevel} /> : null}
        <T accessibilityLiveRegion="polite" variant="note" numberOfLines={1} style={[s.noticeText, listening && s.noticeLive]}>{line}</T>
        {active ? <V2Action tone="neutral" kind="quiet" compact label="Otkaži" onPress={() => p.controller.cancel('gesture')} /> : null}
      </View>
    </View>;
  }
  if (state.error === 'MIC_PERMISSION_DENIED') return <PermissionRecovery compact message={VOICE_ERROR_COPY[state.error]} />;
  const keep = state.fallbackText && state.phase === 'IDLE';
  if (state.error || keep) return <View testID="voice-notice" style={s.notice}>
    {state.error ? <T accessibilityLiveRegion="polite" variant="note" style={s.error}>{voiceErrorCopy(state.error, state.fallbackText)}</T> : null}
    {keep ? <V2Action tone="neutral" kind="quiet" compact label="Uredite sačuvani tekst" style={s.start}
      onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
  </View>;
  if (!p.hint) return null;
  // Switch/Voice Access can request the same alternative gesture from the held
  // microphone, including while a typed draft is retained.
  return <View style={s.hintRow}>
    <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.hintText}>{p.hint}</T>
    {p.hintAction ? <V2Action tone="neutral" kind="quiet" compact label={p.hintAction.label} onPress={p.hintAction.onPress} /> : null}
  </View>;
}

const s = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  // The composer's controls: a 48 px target, a 44 px circle inside it.
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  micCircle: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  micPrimary: { backgroundColor: sys.color.artRole.ai.soft },
  mic64: { backgroundColor: sys.color.green, shadowColor: sys.color.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  pulseRing: { position: 'absolute', borderWidth: 2, borderColor: sys.color.green, backgroundColor: sys.color.green },
  heardBubble: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, backgroundColor: sys.conversation.userSoft, borderWidth: 1, borderColor: sys.conversation.userSoftEdge, alignSelf: 'stretch', marginBottom: 4 },
  micListening: { backgroundColor: sys.color.green },
  micWaiting: { backgroundColor: sys.color.wash },
  notice: { gap: 4, paddingHorizontal: 8 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, color: sys.color.muted },
  noticeLive: { color: sys.color.ink, fontWeight: '600' },
  heard: { ...sys.type.body, color: sys.color.ink },
  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, paddingHorizontal: 8 },
  hintText: { flexShrink: 1 },
  error: { color: sys.color.danger },
  levels: { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  level: { width: 3, borderRadius: sys.radius.pill, backgroundColor: sys.color.lineStrong },
  levelOn: { backgroundColor: sys.color.artRole.ai.front },
});
