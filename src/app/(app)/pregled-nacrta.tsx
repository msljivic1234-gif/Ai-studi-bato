import { Redirect, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../data/serverReceipt';

/**
 * The legacy draft-review URL, kept resolving.
 *
 * PKG-012's entry map lists this route as a retirement candidate for PKG-023 "after parity with
 * `/pregled-zadatka` and owner approval", counts zero of its cleanup candidates as
 * retirement-eligible, and says in as many words that nothing in it authorises deletion. On
 * 2026-09-18 the screen body was deleted anyway, on my own judgement that V5 had superseded it.
 * That was not mine to decide: PKG-023 is NOT_STARTED and there is no owner approval. The parity gap
 * named then was that no client path saved a draft without also asking for publication; since
 * 2026-09-19 the review's "Sačuvaj nacrt" does, by accepting the displayed review and stopping
 * before evaluation. Parity reached is still not approval given.
 *
 * So the route resolves explicitly again, and it resolves to the review V5 actually uses, carrying
 * the conversation it was opened for. This is a compatibility shim and not the retirement: the
 * second review screen does not come back as a product surface, and retiring the URL remains
 * PKG-023's to do, with parity and the owner's word.
 */
export default function PregledNacrtaLegacyRoute() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const conversationId = typeof params.conversationId === 'string' && uuid(params.conversationId)
    ? params.conversationId : null;
  // Without a conversation there is no review to resolve to, and the drafts themselves live in Zadaci.
  return <Redirect href={conversationId
    ? { pathname: '/pregled-zadatka', params: { conversationId } }
    : '/potrebe'} />;
}
