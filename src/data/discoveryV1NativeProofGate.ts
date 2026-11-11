import Constants from 'expo-constants';

export const P6_DISCOVERY_PROOF_PARAM = '1';

/**
 * Native P6 proof is fail-closed in ordinary builds. A URL/query parameter alone can never
 * switch the marketplace reader: the exact DEV Android package and an explicit compile-time
 * proof flag are also required.
 */
export function discoveryV1NativeProofAllowed(
  routeParam: unknown,
  buildFlag: unknown = process.env.EXPO_PUBLIC_P6_DISCOVERY_PROOF,
  androidPackage: unknown = Constants.expoConfig?.android?.package,
): boolean {
  return routeParam === P6_DISCOVERY_PROOF_PARAM && buildFlag === '1' && androidPackage === 'rs.uskoci.dev';
}
