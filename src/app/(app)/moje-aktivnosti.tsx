import { Redirect } from 'expo-router';

/**
 * "Moje aktivnosti" is retired (owner's information architecture, 2026-09-23): my own tasks and my applications are the
 * two front doors on Početna, and nothing in the app links here any more. The address stays, like `/mapa` and
 * `/prilike`, so that an old link, a remembered route or an older build's notification still lands on the overview
 * it meant instead of a screen with no way in (2026-09-24).
 */
export default function RetiredMojeAktivnosti() {
  return <Redirect href="/" />;
}
