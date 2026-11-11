/** The only build-flag value that compiles the paged read of "Moji zadaci" (EX-04 S1) into a build. */
export const OWN_TASKS_PAGED_BUILT = '1';

/**
 * "Moji zadaci" read a page at a time only against a backend that carries the ex04a package (`rpc_list_my_needs_page` completed in place). The client
 * therefore depends on ONE compile-time flag (`EXPO_PUBLIC_EX04_OWN_TASKS_PAGED`), never on a runtime probe: a build without it keeps the whole-list read
 * byte for byte (Jest, web, every build before the backend has the package), and recompiling a profile without the flag is the kill switch. Same pattern as
 * `EXPO_PUBLIC_P6_DISCOVERY_READER` and `EXPO_PUBLIC_VOICE_MESSAGES`.
 */
export function ownTasksPagedBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_EX04_OWN_TASKS_PAGED): boolean {
  return buildFlag === OWN_TASKS_PAGED_BUILT;
}
