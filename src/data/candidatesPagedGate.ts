/** The only build-flag value that compiles the paged read of the applications to a task (EX-04 S4) into a build. */
export const CANDIDATES_PAGED_BUILT = '1';

/**
 * The applications to a task ("Prijave", `potrebe/[id]/kandidati`) are read a page at a time only against a backend that carries the ex04d package (`rpc_list_need_candidates_page`
 * and its state function). The client therefore depends on ONE compile-time flag (`EXPO_PUBLIC_EX04_CANDIDATES_PAGED`), never on a runtime probe: a build without it keeps the
 * whole-list read byte for byte (Jest, web, every build before the backend has the package), and recompiling a profile without the flag is the kill switch. Same pattern as
 * `EXPO_PUBLIC_EX04_OWN_TASKS_PAGED`, `EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED`, `EXPO_PUBLIC_P6_DISCOVERY_READER` and `EXPO_PUBLIC_VOICE_MESSAGES`; one flag per package, so each can be
 * switched off alone.
 */
export function candidatesPagedBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_EX04_CANDIDATES_PAGED): boolean {
  return buildFlag === CANDIDATES_PAGED_BUILT;
}
