import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { AgreementVoiceController } from '../../hooks/useAgreementVoice';
import { voiceClock } from '../../features/voiceMessages/voiceCopy';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { bubbleGap, bubbleShape } from './bubbleShape';
import { MARK_HEIGHT } from './MessageMark';
import type { ThreadMessage } from './threadModel';

/**
 * The three bodies of one bubble shape (team T3c, 2026-10-07): text, photo and voice. The bubble owns the shape (`bubbleShape`),
 * the air above it (`bubbleGap`) and where the small mark stands; the chat owns every state, journal and guard and passes down what
 * is drawn. Each body keeps what the older chat established:
 *
 * - the spoken summary of a message (who, what, when, state) is ONE stop, and what a person can act on inside a bubble (the play
 *   button, a photo's own retry) is never hidden inside it. A text bubble is that stop whole; a voice or photo bubble keeps its
 *   stop on the part that holds no other control;
 * - the long press that offers a message to support is the summary's, so it stays reachable for photos and voice too.
 */
type Summary = Omit<ComponentProps<typeof Press>, 'style' | 'children'>;
/** Fills the box it stands in (spelled out: this React Native has no `StyleSheet.absoluteFillObject`, and spreading the missing one would fill nothing). */
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
type Common = {
  mine: boolean; first: boolean; last: boolean; afterSeparator: boolean;
  /** The Press props that make the summary stop: role, spoken label, hint, long press. */
  summary: Summary;
  /** The small mark of my message (null for the other person's, and for a failed send, which goes red instead). */
  mark: ReactNode;
  failed?: boolean;
  testID?: string;
};

/** The bubble's own column of words, and the mark that closes its last line. */
function Words({ lines, mine, failed, mark }: { lines: readonly string[]; mine: boolean; failed: boolean; mark: ReactNode }) {
  return <View style={s.line}>
    <View style={s.words}>{lines.map((line, index) => <T key={index} selectable style={[s.body, mine && !failed && s.onMine]}>{line}</T>)}</View>
    {mark ? <View style={s.markSlot}>{mark}</View> : null}
  </View>;
}

/**
 * Text (and the line a voice message shows where it cannot be played): the whole bubble is the summary stop. `sender` is the
 * name a group draws once, at the start of another person's run; a private Dogovor names its one other person in the bar instead.
 */
export function TextBubble({ lines, mine, first, last, afterSeparator, summary, mark, failed = false, testID, sender = null }:
  Common & { lines: readonly string[]; sender?: string | null }) {
  return <Press {...summary} testID={testID} style={[s.bubble, bubbleShape({ mine, first, last, failed }), { marginTop: bubbleGap(first, afterSeparator) }]}>
    {sender ? <T variant="meta" style={s.sender}>{sender}</T> : null}
    <Words lines={lines} mine={mine} failed={failed} mark={mark} />
  </Press>;
}

/**
 * Photos in the same shape. The photos are separate stops with their own recovery (a photo that did not load offers its own
 * retry), so the summary stop never wraps them: it is the caption when there is one (the mark closes its line), and otherwise the
 * bubble's own frame, laid UNDER the photos as a sibling, so the whole bubble is one target of at least the photo's size, no band
 * is added to the bubble, and a tap on a photo reaches the photo. The mark of my message then stands over the photo's corner on a
 * dim chip (a mark on a photograph must carry its own ground); the stop's spoken label already says the state.
 */
export function PhotoBubble({ caption, photos, mine, first, last, afterSeparator, summary, mark, failed = false, testID }:
  Common & { caption: string | null; photos: ReactNode }) {
  return <View testID={testID} style={[s.bubble, s.media, bubbleShape({ mine, first, last, failed }), { marginTop: bubbleGap(first, afterSeparator) }]}>
    {caption ? <Press {...summary} style={s.captionStop}><Words lines={[caption]} mine={mine} failed={failed} mark={mark} /></Press>
      : <Press {...summary} style={FILL} />}
    {photos}
    {!caption && mark ? <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.markChip}>{mark}</View> : null}
  </View>;
}

const PLAY = 'M5.2 3.2 L13.4 8 L5.2 12.8 Z';
/** The glyph of the round play control: a triangle, or two bars while it plays. Drawn, not animated. */
function PlayPause({ playing, color }: { playing: boolean; color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {playing ? <><Rect x={3.6} y={3} width={3} height={10} rx={1} fill={color} /><Rect x={9.4} y={3} width={3} height={10} rx={1} fill={color} /></>
      : <Path d={PLAY} fill={color} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />}
  </Svg>;
}

/**
 * A voice message: the round play control, a progress line and the duration, in the same shape. Playback is the chat's own
 * controller and the process-wide audio arbiter (one speaker at a time, ownership by asset): this only asks `voice.toggle` and
 * reads `voice.playback`. The progress is the player's position over the stored length, never a drawn waveform, which would
 * look like data the app does not have. The control keeps its three spoken names (play, pause, load again), and a failure is
 * said in the player's own plain sentence under the bubble's body.
 */
export function VoiceBubble({ voice, message, mine, first, last, afterSeparator, summary, mark, testID }:
  Omit<Common, 'failed'> & { voice: AgreementVoiceController; message: ThreadMessage }) {
  const glas = message.glas;
  if (!glas) return null;
  const active = voice.playback.assetId === glas.assetId;
  const status = active ? voice.playback.status : 'idle';
  const playing = status === 'playing', loading = status === 'loading';
  const label = playing ? 'Pauzirajte glasovnu poruku' : status === 'error' ? 'Ponovo učitajte glasovnu poruku' : 'Preslušajte glasovnu poruku';
  const total = voiceClock(glas.trajanjeMs);
  const position = active && status !== 'error' ? voice.playback.positionMs : 0;
  const share = glas.trajanjeMs > 0 ? Math.max(0, Math.min(1, position / glas.trajanjeMs)) : 0;
  const ink = mine ? sys.conversation.user : sys.conversation.onUser;
  return <View testID={testID} style={[s.bubble, s.voice, bubbleShape({ mine, first, last }), { marginTop: bubbleGap(first, afterSeparator) }]}>
    <View style={s.voiceRow}>
      <Press accessibilityRole="button" accessibilityLabel={`${label}, ${total}`} accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading} hitSlop={0} onPress={() => { void voice.toggle(message); }} style={s.playTouch}>
        <View style={[s.play, mine ? s.playOnDark : s.playOnLight]}>
          {loading ? <ActivityIndicator size="small" color={ink} /> : <PlayPause playing={playing} color={ink} />}
        </View>
      </Press>
      <Press {...summary} style={s.voiceStop}>
        <View style={s.track}>
          <View style={[s.trackWell, mine ? s.trackWellOnDark : s.trackWellOnLight]} />
          <View testID="voice-progress" style={[s.fill, mine ? s.fillOnDark : s.fillOnLight, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        <View style={s.voiceMeta}>
          <T variant="meta" style={[s.length, mine && s.onMine]}>{active && status !== 'error' && position > 0 ? `${voiceClock(position)} / ${total}` : total}</T>
          {mark ? <View style={s.markSlot}>{mark}</View> : null}
        </View>
      </Press>
    </View>
    {active && voice.playback.error ? <T variant="note" style={[s.problem, mine && s.onMine]} accessibilityLiveRegion="polite">{voice.playback.error.message}</T> : null}
  </View>;
}

const PLAY_SIZE = 40;
const s = StyleSheet.create({
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: sys.space.sm },
  words: { flexShrink: 1, gap: 2 },
  // A 16/24 line is 24 high and the mark 12: the mark's centre lands on the last line's.
  markSlot: { flexShrink: 0, marginBottom: (24 - MARK_HEIGHT) / 2 },
  body: { ...sys.type.body, color: sys.color.ink },
  onMine: { color: sys.conversation.onUser },
  sender: { color: sys.color.ink, fontWeight: '600', marginBottom: 2 },
  media: { padding: 4, gap: 4, width: 220 + 8, maxWidth: '86%' },
  captionStop: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingTop: 6 },
  markChip: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 6, paddingVertical: 3, borderRadius: sys.radius.pill, backgroundColor: sys.color.scrim },
  voice: { width: 228, maxWidth: '86%', paddingLeft: 4, paddingRight: 14, paddingVertical: 4, gap: 2 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  playTouch: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  play: { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  playOnDark: { backgroundColor: sys.conversation.onUser },
  playOnLight: { backgroundColor: sys.conversation.user },
  voiceStop: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  // The well is its own layer so its dimming never touches the fill: white at a third on the charcoal, the control grey on white.
  trackWell: { ...FILL },
  trackWellOnDark: { backgroundColor: sys.conversation.onUser, opacity: 0.3 }, trackWellOnLight: { backgroundColor: sys.color.control },
  fill: { height: 4, borderRadius: 2 },
  fillOnDark: { backgroundColor: sys.conversation.onUser }, fillOnLight: { backgroundColor: sys.conversation.user },
  voiceMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  length: { fontVariant: ['tabular-nums'], color: sys.color.muted },
  problem: { paddingHorizontal: 10, paddingBottom: 6, color: sys.color.muted },
});
