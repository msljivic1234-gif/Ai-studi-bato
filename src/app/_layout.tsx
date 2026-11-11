import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useReducedMotion as useLaunchReducedMotion } from 'react-native-reanimated';
import { sys } from '../ui/system/tokens';
import { useReducedMotion, useReducedMotionRoot } from '../ui/system/motion';
import { sesijaSada, useSesija } from '../store/sesija';
import { povratniCilj } from '../store/povratniCilj';
import { pendingRoute } from '../store/pendingRoute';
import { signupConfirmationIntent } from '../store/signupConfirmationIntent';
import { PushRuntime } from '../ui/notifications/PushRuntime';
import { DevAutoPushEnrollment } from '../ui/notifications/DevAutoPushEnrollment';
import { PermissionAskHost } from '../ui/permissions/PermissionAskHost';
import { BrandMark } from '../ui/entry/BrandAssets';
import { T } from '../ui/Text';
import { useEntrySplashReady } from '../hooks/useEntrySplashReady';
import { AccountClosingScreen, useAccountClosing } from '../ui/auth/AccountClosingState';

// A screen that throws while rendering shows a way out instead of a white page (release, 2026-09-23). The
// screen-level boundary catches it at the screen, so "Pokušaj ponovo" redraws that screen and the back stack stays;
// the root export is the last resort for an error in the layout itself.
import { AppErrorBoundary } from '../ui/system/AppErrorBoundary';
export { AppErrorBoundary as ErrorBoundary };
export const unstable_settings = { screenErrorBoundary: AppErrorBoundary };

export default function RootLayout() {
  // The one reduced-motion store starts here: Reanimated read the system setting natively at launch, so the first frame
  // of the first screen already respects it, and from here the store follows every change (ui/system/motion.ts).
  useReducedMotionRoot(useLaunchReducedMotion());
  const reduced = useReducedMotion();
  const { isLoaded, session, sessionEpoch, accountRevision, returnTargetRevision } = useSesija();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  // Native linking resolves asynchronously. An empty route is not a request
  // for the welcome screen; do not overwrite its incoming Auth/recovery link.
  // Stack.Protected continues to enforce access while the route resolves.
  const routeResolved = segments.length > 0;
  const naAuth = segments[0] === 'auth';
  const naOporavku = segments[0] === 'oporavak';
  const { onLayout: onRouteLayout } = useEntrySplashReady({
    enabled: isLoaded && routeResolved && (naOporavku || (!!session && !naAuth)),
  });
  // An account in its closing stage is refused every ordinary read, so Početna could only say it did not load. Once per
  // account incarnation the root asks whether it is closing and, only on a confirmed answer, shows that instead. Private
  // support is the one place the closing account may still open, so the closing state steps aside there.
  const closing = useAccountClosing(isLoaded && routeResolved && session && !naOporavku
    ? { accountId: session.user.id, accountRevision } : null);
  const naPodrsci = pathname === '/podrska' || pathname.startsWith('/podrska/');
  const closingShown = closing.closing && !naPodrsci;

  // Protected-route authority: unauthenticated users never remain inside the
  // marketplace shell. Auth is one screen in the same app, not a second app.
  // Two and a half seconds of nothing is where a person decides the app is frozen.
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => {
    if (!isLoaded || !session) return;
    const returned = signupConfirmationIntent.snapshot();
    if (returned) signupConfirmationIntent.clear(returned.id);
  }, [isLoaded, session, accountRevision]);
  useEffect(() => {
    const timer = setTimeout(() => setSlowStart(true), 2500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!isLoaded || !routeResolved) return;
    if (sesijaSada().sessionEpoch !== sessionEpoch ||
      sesijaSada().user?.id !== session?.user.id) return;
    if (!session && !naAuth && !naOporavku) {
      // The path was used to choose the form and then thrown away, so a tapped Dogovor became the
      // tab home after signing in. Remember it; the consumer below hands it back exactly once.
      pendingRoute.remember(pathname);
      router.replace(pathname === '/' ? '/auth' : { pathname: '/auth', params: { form: 'login' } });
      return;
    }
    if (session && naAuth) {
      router.replace('/');
    }
  }, [isLoaded, routeResolved, session, sessionEpoch, naAuth, naOporavku, pathname, router]);

  // Consume a completed pre-auth intent exactly once after a real session has
  // been restored/created. The store itself guards which user completed it.
  useEffect(() => {
    if (!isLoaded || !routeResolved || !session || naOporavku) return;
    let aktivan = true;
    const isCurrent = () => aktivan && sesijaSada().sessionEpoch === sessionEpoch &&
      sesijaSada().user?.id === session.user.id;
    void povratniCilj.consumeCompleted(session.user.id, isCurrent).then((record) => {
      if (!isCurrent()) return;
      // Where they were going wins over where the app would otherwise drop them. A person who was
      // sent to sign in by a link or a push is finishing that journey, not starting a new one.
      const resumed = pendingRoute.takeDecision({ accountId: session.user.id, accountRevision, sessionEpoch });
      if (resumed) {
        if (resumed.kind === 'ROUTE') router.replace(resumed.path as Parameters<typeof router.replace>[0]);
        return;
      }
      if (!record) return;

      const target = record.intent.returnTarget;
      if (!target || target.kind === 'NONE') {
        // What the person chose before signing in is where they go, not what the app becomes:
        // "Uskoči i zaradi" opens Zadaci, "Objavi zadatak" opens a new task.
        router.replace(record.intent.intent === 'WORKER' ? '/zadaci' : '/nova');
        return;
      }
      if (target.kind === 'REQUESTER_DRAFT') {
        router.replace({ pathname: '/nova', params: { conversationId: target.draftKey } });
      } else if (target.kind === 'NEED') {
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: target.needId } });
      } else if (target.kind === 'DOGOVOR') {
        router.replace({ pathname: '/dogovor/[id]', params: { id: target.agreementId } });
      }
    }).catch(() => {});
    return () => {
      aktivan = false;
    };
  }, [isLoaded, routeResolved, session, sessionEpoch, returnTargetRevision, naOporavku, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: sys.color.surface, justifyContent: 'center', alignItems: 'center' }}>
        {/* Same original mark and nominal size as the padded native splash. */}
        <BrandMark size={126} />
        <View style={{ position: 'absolute', alignSelf: 'center', top: '65%', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator accessibilityLabel="Učitavanje" size="small" color={sys.color.ink} />
          {/* A wordless white field says nothing about whether anything is happening. The restore
              is bounded at 8s, so this sentence is never the last thing on screen for long. */}
          {slowStart ? <T variant="copy" tone="muted">Otvaramo aplikaciju…</T> : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView onLayout={onRouteLayout} style={{ flex: 1, backgroundColor: sys.color.surface }}>
        <StatusBar style="dark" />
        {/* The navigator stays mounted under the closing state, so leaving it (support, sign-out) keeps the stack; while it
            is covered, a screen reader does not reach it either. */}
        <View style={{ flex: 1 }} importantForAccessibility={closingShown ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={closingShown}>
          <Stack
            key={`${session?.user.id ?? 'signed-out'}:${accountRevision}`}
            initialRouteName={session ? '(app)' : 'auth'}
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: sys.color.surface },
              animation: reduced ? 'none' : 'slide_from_right',
            }}
          >
            <Stack.Protected guard={!session}>
              <Stack.Screen name="auth" options={{ animation: 'none' }} />
            </Stack.Protected>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(app)" options={{ contentStyle: { backgroundColor: sys.color.ground } }} />
              <Stack.Screen name="dogovor/[id]" />
              <Stack.Screen name="obavestenja" />
              <Stack.Screen name="prijave" />
            </Stack.Protected>
            {/* Recovery remains a public link destination, never the cold-start
                fallback when Protected removes the private index route. */}
            <Stack.Screen name="oporavak" options={{ animation: 'none' }} />
          </Stack>
        </View>
        {closingShown ? <AccountClosingScreen execution={closing.execution} working={closing.working} message={closing.message}
          onCheck={closing.check} onSignOut={closing.signOut} onSupport={() => router.push('/podrska')} /> : null}
        {/* A closing account is refused every push registration read, so the runtime waits until the account is open. */}
        <PushRuntime ready={routeResolved && !naAuth && !naOporavku && !closing.closing} />
        <DevAutoPushEnrollment ready={routeResolved && !naAuth && !naOporavku && !closing.closing} />
        {/* The one question before the system's window for the microphone, photos and location (design proposal N, T4b2): it only shows
            when a feature asks for a permission it has not been given yet, and it idles as nothing. */}
        <PermissionAskHost />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
