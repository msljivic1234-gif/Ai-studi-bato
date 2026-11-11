/** The only build-flag value that compiles the optional written comment with a review (D12) into a build. */
export const REVIEW_COMMENT_BUILT = '1';

/**
 * The written comment with the star rating is asked for, drawn and sent only against a backend that carries the D12 package
 * (`rpc_submit_agreement_review_v2`, `rpc_get_my_agreement_review_v2`, `rpc_list_review_comments_v1`). The client therefore
 * depends on ONE compile-time flag (`EXPO_PUBLIC_D12_REVIEW_COMMENT`): a build without it keeps the legacy review pair byte for
 * byte (Jest, web, every build before the owner turns the flag on), and recompiling a profile without the flag is the kill
 * switch. Even with the flag on, the backend itself is tested at run time (`reviewCommentsClientService`: a missing v2 function
 * means "no comments" and the legacy pair is used). Same pattern as `EXPO_PUBLIC_EX04_*`, `EXPO_PUBLIC_P6_DISCOVERY_READER` and
 * `EXPO_PUBLIC_VOICE_MESSAGES`; one flag per package, so each can be switched off alone.
 */
export function reviewCommentBuilt(buildFlag: unknown = process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT): boolean {
  return buildFlag === REVIEW_COMMENT_BUILT;
}
