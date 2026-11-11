/**
 * Where an account's recent searches of Zadaci live on this phone (U4 of the owner-approved plan). The search keeps them per account;
 * the local sign-out forgets them (the owner, 8 Oct 2026: "Samo napred" to "they are removed when you sign out").
 */
export const recentSearchesKey = (account: string) => `uskoci.zadaci.recent.v1.${account}`;
