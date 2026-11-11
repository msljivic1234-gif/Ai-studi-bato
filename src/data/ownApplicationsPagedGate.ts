/** The only build-flag value that compiles the paged read of "Moje prijave" (EX-04 S2) into a build. */
export const OWN_APPLICATIONS_PAGED_BUILT = '1';

/**
 * "Moje prijave" read a page at a time only against a backend that carries the ex04b package (`rpc_list_my_applications_page` completed). The client therefore
 * depends on ONE compile-time flag (`EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED`), never on a runtime probe: a build without it keeps the whole-list read byte for byte
 * (Jest, web, every build before the backend has the package), and recompiling a profile without the flag is the kill switch. Same pattern as
 * `EXPO_PUBLIC_EX04_OWN_TASKS_PAGED`, `EXPO_PUBLIC_P6_DISCOVERY_READER` and `EXPO_PUBLIC_VOICE_MESSAGES`; one flag per package, so each can be switched off alone.
 */
export function ownApplicationsPagedBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED): boolean {
  return buildFlag === OWN_APPLICATIONS_PAGED_BUILT;
}
