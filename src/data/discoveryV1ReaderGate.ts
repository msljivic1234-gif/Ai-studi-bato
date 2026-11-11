import { discoveryV1NativeProofAllowed } from './discoveryV1NativeProofGate';

/** The only build-flag value that compiles the P6 server reader into a build. Anything else keeps the legacy readers. */
export const P6_DISCOVERY_READER_BUILT = '1';

export type DiscoveryReader = 'P6' | 'LEGACY';

/**
 * Production selection of the Zadaci reader. It depends on ONE compile-time flag (`EXPO_PUBLIC_P6_DISCOVERY_READER`), never on a
 * route parameter or an Android package, so an ordinary link cannot switch a build's reader and a shipping build does not need the
 * proof parameter. The flag lives in the build profiles that target a backend carrying the P6 rollout; a build without it (the
 * disposable-stack proof builds, Jest, web) keeps the legacy readers, and recompiling a profile without it is the kill switch.
 */
export function discoveryV1ProductionReaderBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_P6_DISCOVERY_READER): boolean {
  return buildFlag === P6_DISCOVERY_READER_BUILT;
}

/**
 * Which reader the Zadaci route mounts.
 *
 * - An authentic publication handoff (this session's own confirmed publication) keeps the separately proved exact-public landing
 *   reader: the P6 route has no publication landing, so it must not take that visit over.
 * - Otherwise the production build flag selects P6; the fail-closed native proof gate (parameter + compile flag + DEV package)
 *   can still ADD the P6 reader to a proof build, and can never remove it from a production build.
 */
export function selectDiscoveryReader(input: {
  publicationHandoff: boolean;
  proofParam: unknown;
  productionFlag?: unknown;
  proofFlag?: unknown;
  androidPackage?: unknown;
}): DiscoveryReader {
  if (input.publicationHandoff) return 'LEGACY';
  // An omitted value falls back to the build's own compile-time setting; tests pass explicit values.
  const production = discoveryV1ProductionReaderBuilt(input.productionFlag);
  const proof = discoveryV1NativeProofAllowed(input.proofParam, input.proofFlag, input.androidPackage);
  return production || proof ? 'P6' : 'LEGACY';
}
