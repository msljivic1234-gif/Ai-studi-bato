/** The only build-flag value that compiles the voice-message contract (the V2 history readers, later the recorder and player) into a build. */
export const VOICE_MESSAGES_BUILT = '1';

/**
 * Voice messages need a backend that carries the B1 package (the V2 history readers and the upload/send functions). The client therefore
 * depends on ONE compile-time flag (`EXPO_PUBLIC_VOICE_MESSAGES`), never on a runtime probe: a build without it keeps the V1 readers byte for byte
 * (Jest, web, the disposable-stack proof builds and every build before the backend has the package), and recompiling a profile without the
 * flag is the kill switch. Same pattern as `EXPO_PUBLIC_P6_DISCOVERY_READER`.
 */
export function voiceMessagesBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_VOICE_MESSAGES): boolean {
  return buildFlag === VOICE_MESSAGES_BUILT;
}
