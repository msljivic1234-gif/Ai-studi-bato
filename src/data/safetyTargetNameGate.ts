/** The only build-flag value that compiles the displayed name of a safety target (EX-07 S06) into a build. */
export const SAFETY_TARGET_NAME_BUILT = '1';
/** The name of the build variable; the one place the client spells it out (a test pins that, and that no release profile carries it). */
export const SAFETY_TARGET_NAME_FLAG = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';

/**
 * The safety screen shows the name of the person it is about only against a backend that carries the EX-07 S06 candidate (`rpc_read_safety_target` returns the
 * displayed name of the profile that was asked for). The client therefore depends on ONE compile-time flag (`EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME`), never on a
 * runtime probe: a build without it keeps the safety screen, the profile entry and the route exactly as they were (Jest, web, every build before the backend has
 * the candidate), and recompiling a profile without the flag is the kill switch. Same pattern as `EXPO_PUBLIC_EX04_CANDIDATES_PAGED` and
 * `EXPO_PUBLIC_VOICE_MESSAGES`; one flag per package, so each can be switched off alone.
 */
export function safetyTargetNameBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME): boolean {
  return buildFlag === SAFETY_TARGET_NAME_BUILT;
}
