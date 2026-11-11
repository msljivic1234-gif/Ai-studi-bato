import { Redirect } from 'expo-router';

/**
 * The root list of open tasks is Zadaci now (owner's information architecture, 2026-09-23). A task itself stays at
 * `/prilike/[id]` and its application at `/prilike/[id]/prijava`; only this list address redirects.
 */
export default function RetiredPrilike() {
  return <Redirect href="/zadaci" />;
}
