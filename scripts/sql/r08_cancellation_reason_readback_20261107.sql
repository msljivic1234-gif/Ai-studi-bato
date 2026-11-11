-- R08: complete cancellation-reason readback from the existing ordinary message rows.
-- Forward candidate; source 94f2801 / canonical DEV leqcwgzvjsxugfgzdmth.
-- One read-only helper body changes. No writer, table, policy, grant or reason copy.
DO $r08_reason$
DECLARE
  expected jsonb := '{"private.agreement_cancellation_facts_v1":{"signature":"private.agreement_cancellation_facts_v1(uuid)","body_md5":"65eec38f58d81667f14a046f3596a243","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb"},"public.rpc_agreement_cancellation_v1":{"signature":"rpc_agreement_cancellation_v1(uuid[])","body_md5":"f54af14827bdd1c0906f512ee8aa9043","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb"},"public.rpc_cancel_agreement":{"signature":"rpc_cancel_agreement(uuid,text)","body_md5":"e592af7aead2172ff769f38aada8e056","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"void"}}';
  observed jsonb;
  prior_attributes jsonb;
BEGIN
  SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R08_REASON_PREIMAGE_MISMATCH' USING errcode='55000';
  END IF;
  SELECT to_jsonb(p)-'prosrc' INTO prior_attributes FROM pg_proc p
    WHERE p.oid='private.agreement_cancellation_facts_v1(uuid)'::regprocedure;
  EXECUTE $r08_definition$
CREATE OR REPLACE FUNCTION private.agreement_cancellation_facts_v1(p_agreement_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- CANCEL-INFO (2026-10-07). When, by which side and why ONE cancelled Dogovor was cancelled, read from exactly what the only
  -- writer, public.rpc_cancel_agreement(uuid,text) (body pinned by md5 when this package is applied), leaves behind inside ONE
  -- statement, so all three carry the same statement_timestamp():
  --   1. public.agreements: status 'CANCELLED', updated_at stamped by the trigger private.set_updated_at();
  --   2. the event AGREEMENT_CANCELLED with the dedupe key 'agreement-cancelled:<id>', sent to the OTHER party;
  --   3. unless the pair was blocked or a party was under a closure restriction at that moment: the canceller's own message
  --      'Otkazujem Dogovor. Razlog: <reason>' in the Dogovor's conversation. The current writer retains up to 4,000 characters
  --      in one message or a bounded two/three-part sequence of ordinary author-owned messages.
  -- No other function sets a Dogovor CANCELLED (catalog scan of canonical DEV, 2026-10-07), so there is no SYSTEM side today: a
  -- future system path must record its side and this helper must learn it. A closure deletes the events of a closing RECIPIENT and
  -- replaces the text of a closing SENDER's messages; the side then comes from what is left and is null when nothing is left
  -- (never guessed). Returns null for a Dogovor that does not exist or is not cancelled.
  select jsonb_build_object(
    'agreementId', a.id,
    'cancelledAt', coalesce(e.created_at, a.updated_at),
    'cancelledBy', case
      when e.recipient_user_id = a.worker_account_id then 'REQUESTER'
      when e.recipient_user_id = a.requester_account_id then 'WORKER'
      when m.sender_account_id = a.requester_account_id then 'REQUESTER'
      when m.sender_account_id = a.worker_account_id then 'WORKER' end,
    'sideSource', case
      when e.recipient_user_id in (a.worker_account_id, a.requester_account_id) then 'EVENT'
      when m.sender_account_id in (a.requester_account_id, a.worker_account_id) then 'MESSAGE' end,
    'cancelledByAccountId', case
      when e.recipient_user_id = a.worker_account_id then a.requester_account_id
      when e.recipient_user_id = a.requester_account_id then a.worker_account_id
      when m.sender_account_id in (a.requester_account_id, a.worker_account_id) then m.sender_account_id end,
    'reason', case when left(m.body, 27) = 'Otkazujem Dogovor. Razlog: ' then coalesce(parts.reason, nullif(substr(m.body, 28), '')) end,
    'reasonState', case
      when m.sender_account_id is null then 'NOT_KEPT'
      when left(m.body, 27) = 'Otkazujem Dogovor. Razlog: ' then 'KEPT'
      else 'REMOVED' end)
  from (select x.id, x.updated_at, x.requester_account_id, x.worker_account_id
          from public.agreements x where x.id = p_agreement_id and x.status = 'CANCELLED') a
  left join lateral (
    select ev.created_at, ev.recipient_user_id from public.user_activity_events ev
     where ev.dedupe_key = 'agreement-cancelled:' || a.id::text and ev.event_type = 'AGREEMENT_CANCELLED'
       and ev.entity_type = 'AGREEMENT' and ev.entity_id = a.id) e on true
  left join lateral (
    select msg.id, msg.agreement_version, msg.sender_account_id, msg.body from public.agreement_messages msg
     where msg.agreement_id = a.id and msg.created_at = coalesce(e.created_at, a.updated_at)
       and msg.sender_account_id in (a.requester_account_id, a.worker_account_id)
     order by (left(msg.body, 27) = 'Otkazujem Dogovor. Razlog: ') desc, msg.id
     limit 1) m on true
  -- R08: the writer stores a reason longer than 1,973 characters as two or
  -- three ordinary sender-owned messages. Reconstruct only a complete writer
  -- sequence, never adjacent conversation text or another version/author.
  -- Incomplete, removed, or unrecognized legacy content retains the previous
  -- visibly numbered first-part fallback; no missing text is invented.
  left join lateral (
    select string_agg(piece.content, '' order by part.i) as reason
      from (select substring(m.body from '^Otkazujem Dogovor[.] Razlog: \[1/([23])\] ')::integer as total) header
      cross join lateral generate_series(1, header.total) part(i)
      join public.agreement_messages chunk
        on chunk.id = (left(m.id::text, 35) || part.i::text)::uuid
       and chunk.agreement_id = a.id
       and chunk.agreement_version = m.agreement_version
       and chunk.created_at = coalesce(e.created_at, a.updated_at)
       and chunk.sender_account_id = m.sender_account_id
      cross join lateral (select case when part.i = 1
        then 'Otkazujem Dogovor. Razlog: ' || format('[%s/%s] ', part.i, header.total)
        else format('Razlog otkazivanja [%s/%s]: ', part.i, header.total) end as text) prefix
      cross join lateral (select substr(chunk.body, char_length(prefix.text) + 1) as content) piece
     where right(m.id::text, 1) = '1'
       and left(chunk.body, char_length(prefix.text)) = prefix.text
       and char_length(piece.content) between 1 and 1967
       and (part.i = header.total or char_length(piece.content) = 1967)
     group by header.total
    having count(*) = header.total
       and sum(char_length(piece.content)) between 1974 and 4000
  ) parts on true;
$function$

$r08_definition$;
  expected:=jsonb_set(expected,ARRAY['private.agreement_cancellation_facts_v1','body_md5'],to_jsonb('ec935f3da29105d0308f9952f9acd58f'::text));
  SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R08_REASON_POSTIMAGE_MISMATCH' USING errcode='55000';
  END IF;
  IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p
      WHERE p.oid='private.agreement_cancellation_facts_v1(uuid)'::regprocedure) IS DISTINCT FROM prior_attributes THEN
    RAISE EXCEPTION 'R08_REASON_METADATA_CHANGED' USING errcode='55000';
  END IF;
END;
$r08_reason$;
