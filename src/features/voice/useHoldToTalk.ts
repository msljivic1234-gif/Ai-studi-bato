import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../store/sesija';
import { supabaseKlijent, supabaseKonfigurisan } from '../../data/supabaseClient';
import { readPublicSupabaseConfig } from '../../data/publicSupabaseConfig';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { HoldToTalkController, type HoldToTalkOptions } from './holdToTalk';
import { createNativeSpeechAdapter } from './nativeSpeechAdapter';
import { SPEECH_LIMITS } from './speechProtocol';

/**
 * The speech privacy notice. Round 4 review (ra item 1, 2026-09-24): the middle sentence used to say the text reaches the
 * conversation only after "Pošalji", which stopped being true when held speech started sending on release (owner,
 * 2026-09-23) in both conversations and in voice mode. It now says what the app does; the other sentences are unchanged.
 * Privacy copy: recorded for the owner's review.
 */
export const VOICE_PROCESSING_NOTICE = 'Zvuk se prolazno šalje Google servisu radi transkripcije. USKOČI ne čuva audio snimke. Kad pustite mikrofon, ili u glasovnom režimu ponovo dodirnete, izgovoreni tekst odmah odlazi u razgovor. Ako uključite „Pregledajte pre slanja“ ili koristite čitač ekrana, tekst najpre stiže u polje za poruku i šalje se tek kad izaberete Pošalji. Google može privremeno obrađivati podatke globalno radi bezbednosti plaćenog servisa.';

export function useHoldToTalk(options: {
  /** A getter exposes a lazily opened id before React's next render. Null disables speech. */
  conversationId: string | null | (() => string | null);
  prepareConversation?: HoldToTalkOptions['prepareConversation'];
  onTranscript: HoldToTalkOptions['onTranscript'];
  isAiSpeaking?: () => boolean;
}) {
  const { user, accountRevision } = useSesija();
  const latest = useRef(options); latest.current = options;
  const focused = useRef(false);
  const readConversationId = () => typeof latest.current.conversationId === 'function'
    ? latest.current.conversationId() : latest.current.conversationId;
  const renderedConversationId = readConversationId();
  const controller = useMemo(() => new HoldToTalkController({
    adapter: createNativeSpeechAdapter({ newOperationId: noviUuidZahtevId,
      async getConnection(session, signal) {
        const current = sesijaSada();
        if (signal.aborted || current.user?.id !== session.accountId || current.accountRevision !== session.accountRevision
          || readConversationId() !== session.conversationId || !current.session?.access_token) return null;
        const publicConfig = readPublicSupabaseConfig();
        return publicConfig ? { ...publicConfig, accessToken: current.session.access_token } : null;
      } }),
    getScope: () => {
      const current = sesijaSada(), conversationId = readConversationId();
      return focused.current && current.user?.id && conversationId !== null && (conversationId || latest.current.prepareConversation)
        ? { accountId: current.user.id, accountRevision: current.accountRevision, conversationId } : null;
    },
    prepareConversation: input => latest.current.prepareConversation?.(input) ?? Promise.resolve(null),
    isAiSpeaking: () => latest.current.isAiSpeaking?.() ?? false,
    onTranscript: input => latest.current.onTranscript(input),
    limits: { permissionMs: 30000, captureMs: SPEECH_LIMITS.captureMs, finalizationMs: SPEECH_LIMITS.finalizationMs },
  }), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.contextChanged(); }, [controller, user?.id, accountRevision, renderedConversationId]);
  useFocusEffect(useCallback(() => {
    focused.current = true; controller.setForeground(AppState.currentState === 'active');
    return () => { focused.current = false; controller.cancel('navigation'); };
  }, [controller]));
  useEffect(() => {
    const app = AppState.addEventListener('change', next => controller.setForeground(next === 'active'));
    // Auth callbacks fence native input immediately; no need to wait for the next React render.
    const auth = supabaseKonfigurisan() ? supabaseKlijent().auth.onAuthStateChange(() => controller.contextChanged()) : null;
    return () => { app.remove(); auth?.data.subscription.unsubscribe(); controller.cancel('dispose'); };
  }, [controller]);
  return { controller, state };
}
