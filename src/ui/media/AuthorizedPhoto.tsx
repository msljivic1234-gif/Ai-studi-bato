import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, View, type StyleProp, type ViewStyle } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
export { mediaAssetId } from '../../data/mediaAssetId';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
// Bounded in-memory representation; no signed URL or persistent image cache.
import { jpegDataUri } from './jpegDataUri';
import { ownPhotoCache } from './ownPhotoCache';

const inMemoryPhotoCache = new Map<string, { uri: string; at: number }>();
const MAX_CACHE_ENTRIES = 32;
const CACHE_TTL_MS = 15 * 60 * 1000;

if (typeof AppState?.addEventListener === 'function') {
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') inMemoryPhotoCache.clear();
  });
}

type PhotoAttempt = { visit: object; binding: string; abort: AbortController; phase: 'loading' | 'image' | 'failed' };
type PhotoState = { attempt: PhotoAttempt; uri: string | null } | null;

export function AuthorizedPhoto(p: { assetId: string; needId?: string; profileId?: string; caseId?: string; agreementId?: string; messageId?: string; label: string; style?: StyleProp<ViewStyle>; contentFit?: 'contain' | 'cover';
  /** Only a loaded image can open its viewer; failure recovery stays a separate target. */
  open?: { label: string; hint?: string; onPress: () => void; onLongPress?: () => void };
  /** Optional decorative identity while authorization/image data is pending; never a retained photo. */ pending?: ReactNode;
  /** Drawn instead of the failure sentence when the photo cannot be read, e.g. initials in a small avatar. */ unavailable?: ReactNode;
  /** The signed-in person's OWN photograph: it is remembered in memory for a while (`ownPhotoCache`) and drawn at once when the screen is entered again,
   * instead of the stand-in that waits for the read. Anyone else's photograph is never remembered, whatever this says. */ own?: boolean }) {
  const { user, accountRevision } = useSesija();
  const binding = `${user?.id}:${accountRevision}:${p.assetId}:${p.needId ?? ''}:${p.profileId ?? ''}:${p.caseId ?? ''}:${p.agreementId ?? ''}:${p.messageId ?? ''}`;
  // A remembered picture is kept under the exact account, revision, profile and asset that read it (null: nothing about this photograph is remembered).
  const scope = useMemo(() => p.own && user?.id ? { accountId: user.id, accountRevision } : null, [p.own, user?.id, accountRevision]);
  const profileKey = p.profileId ?? '';
  const renderedBinding = useRef(binding); renderedBinding.current = binding;
  const opening = useRef(p.open); opening.current = p.open;
  const [state, setState] = useState<PhotoState>(null);
  const active = useRef<object | null>(null);
  const request = useRef<PhotoAttempt | null>(null);
  const ownsVisit = useCallback((visit: object) => active.current === visit && renderedBinding.current === binding
    && !!user?.id && sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision,
  [binding, user?.id, accountRevision]);
  const current = useCallback((attempt: PhotoAttempt) => request.current === attempt && !attempt.abort.signal.aborted
    && attempt.binding === binding && ownsVisit(attempt.visit), [binding, ownsVisit]);
  const fail = useCallback((attempt: PhotoAttempt) => {
    if (!current(attempt) || attempt.phase === 'failed') return;
    // A picture that could not be drawn is not kept for the next visit.
    if (scope) ownPhotoCache.forgetImage(scope, profileKey, p.assetId);
    attempt.phase = 'failed'; setState({ attempt, uri: null });
  }, [current, scope, profileKey, p.assetId]);
  const read = useCallback((visit: object, retry?: PhotoAttempt) => {
    if (!ownsVisit(visit)) return;
    // Retained presses belong to one failed attempt. The synchronous reservation
    // blocks a second press before React has replaced the failure with its spinner.
    if (retry ? request.current !== retry || retry.phase !== 'failed' : request.current !== null) return;
    request.current?.abort.abort();
    const attempt: PhotoAttempt = { visit, binding, abort: new AbortController(), phase: 'loading' };
    request.current = attempt;
    // The person's own photograph, when it is remembered under this exact key, is the answer: nothing is read. Only a press on "Pokušaj ponovo" asks again.
    const known = scope && !retry ? ownPhotoCache.image(scope, profileKey, p.assetId) : undefined;
    if (known) { attempt.phase = 'image'; setState({ attempt, uri: known }); return; }
    const sessionKnown = inMemoryPhotoCache.get(binding);
    const sessionFresh = sessionKnown && (Date.now() - sessionKnown.at < CACHE_TTL_MS);
    if (sessionFresh && !retry) {
      attempt.phase = 'image'; setState({ attempt, uri: sessionKnown.uri }); return;
    }
    const mark = scope ? ownPhotoCache.mark() : 0;
    setState({ attempt, uri: null });
    void (async () => {
      try {
        const result = await mediaClientService.readMedia(p.assetId, { ...(p.needId ? { needId: p.needId } : {}),
          ...(p.profileId ? { profileId: p.profileId } : {}), ...(p.caseId ? { caseId: p.caseId } : {}),
          ...(p.agreementId ? { agreementId: p.agreementId } : {}), ...(p.messageId ? { messageId: p.messageId } : {}) }, { signal: attempt.abort.signal });
        if (!current(attempt)) return;
        if (!result.ok) { fail(attempt); return; }
        const uri = jpegDataUri(result.podatak.bytes);
        if (inMemoryPhotoCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = inMemoryPhotoCache.keys().next().value;
          if (oldestKey) inMemoryPhotoCache.delete(oldestKey);
        }
        inMemoryPhotoCache.set(binding, { uri, at: Date.now() });
        if (scope) ownPhotoCache.rememberImage(scope, profileKey, p.assetId, uri, mark);
        attempt.phase = 'image'; setState({ attempt, uri });
      } catch { fail(attempt); }
    })();
  }, [binding, current, fail, ownsVisit, scope, profileKey, p.assetId, p.needId, p.profileId, p.caseId, p.agreementId, p.messageId]);
  useFocusEffect(useCallback(() => {
    const visit = {}; active.current = visit;
    const sessionKnown = inMemoryPhotoCache.get(binding);
    const sessionFresh = sessionKnown && (Date.now() - sessionKnown.at < CACHE_TTL_MS);
    if (sessionFresh) {
      const attempt: PhotoAttempt = { visit, binding, abort: new AbortController(), phase: 'image' };
      request.current = attempt;
      setState({ attempt, uri: sessionKnown.uri });
    } else {
      setState(null);
      read(visit);
    }
    return () => {
      if (active.current !== visit) return;
      active.current = null; request.current?.abort.abort(); request.current = null;
    };
  }, [binding, read]));
  const shown = state && current(state.attempt) ? state : null;
  // Until this visit has decided anything (the very first render, or a screen that is out of focus) the person's own remembered picture of this exact key
  // stands in for it. The key holds the account, its revision, the profile and the asset, so it can never be another face.
  const remembered = scope && !shown ? ownPhotoCache.image(scope, profileKey, p.assetId) : undefined;
  const sessionCached = inMemoryPhotoCache.get(binding);
  const sessionFresh = sessionCached && (Date.now() - sessionCached.at < CACHE_TTL_MS);
  const uri = shown ? shown.attempt.phase === 'image' ? shown.uri : null : remembered ?? (sessionFresh ? sessionCached.uri : null);
  const image = uri ? <Image source={{ uri }} accessibilityLabel={p.label}
    accessible={!p.open} contentFit={p.contentFit ?? 'contain'} cachePolicy="none" recyclingKey={binding}
    onError={() => { if (shown) fail(shown.attempt); }} transition={0} style={{ width: '100%', height: '100%' }} /> : null;
  return <View style={[{ aspectRatio: 4 / 3, backgroundColor: sys.color.wash, borderRadius: sys.radius.control, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center' }, p.style]}>
    {image ? p.open ? <Press accessibilityRole="button" accessibilityLabel={p.open.label} accessibilityHint={p.open.hint}
      onPress={() => { if (shown && current(shown.attempt) && shown.attempt.phase === 'image' && opening.current === p.open) p.open?.onPress(); }}
      onLongPress={p.open.onLongPress ? () => { if (shown && current(shown.attempt) && shown.attempt.phase === 'image' && opening.current === p.open) p.open?.onLongPress?.(); } : undefined}
      scaleTo={1} style={{ width: '100%', height: '100%' }}>{image}</Press> : image
      // The entire failure frame is the target: a separate button below the old
      // multi-line notice would be clipped in the 96px prepared-photo thumbnail.
      : shown?.attempt.phase === 'failed' ? p.unavailable ?? <Press accessibilityRole="button"
        accessibilityLabel={`Pokušaj ponovo · ${p.label}`} accessibilityHint="Fotografija trenutno nije dostupna. Ponovo učitaj fotografiju."
        onPress={() => read(shown.attempt.visit, shown.attempt)}
        style={{ width: '100%', height: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, padding: sys.space.xs }}>
        <FactArt kind="photo" size={24} muted />
        <T variant="note" style={{ color: sys.color.green, textAlign: 'center' }}>Pokušaj ponovo</T>
      </Press>
        : p.pending ? <View accessible accessibilityLabel="Učitavanje fotografije" accessibilityState={{ busy: true }}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{p.pending}</View>
        </View> : <ActivityIndicator size="small" accessibilityLabel="Učitavanje fotografije" color={sys.color.green} />}
  </View>;
}
