import { Redirect } from 'expo-router';

/**
 * The Mapa tab became Zadaci (owner's information architecture, 2026-09-23). The address stays so that an old link,
 * a remembered route or an older build's notification still lands on the discovery it meant.
 */
export default function RetiredMapa() {
  return <Redirect href="/zadaci" />;
}
