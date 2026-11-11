-- R08: authoritative cancellation eligibility, one durable event and complete reason.
-- Forward candidate for canonical DEV leqcwgzvjsxugfgzdmth; base 20903892, 2026-11-07.
-- Only rpc_cancel_agreement changes. No tables, RLS, signatures, grants or backfill.
-- Existing completion, calendar, message owner/export/closure contracts stay pinned.
-- No full private reason is copied into notification/event payloads.
DO $r08_cancellation$
DECLARE
  expected jsonb := '{"public.rpc_cancel_agreement":{"body_md5":"f6d9b651b68d52e5271d60fe58216724","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"void","signature":"public.rpc_cancel_agreement(uuid,text)"},"private.agreement_action_state":{"body_md5":"fdda79c270eb331bf1679dc12c654263","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"private.agreement_action_state(uuid,uuid)"},"private.agreement_cancellation_facts_v1":{"body_md5":"65eec38f58d81667f14a046f3596a243","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"private.agreement_cancellation_facts_v1(uuid)"},"private.refresh_worker_calendar_event":{"body_md5":"1baef4c6659e83073fe7886e3fd3d7e9","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"void","signature":"private.refresh_worker_calendar_event(uuid)"},"private.tg_worker_calendar_agreement_update":{"body_md5":"07d1002963f9a7cb6256c34a61b8f1fd","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"trigger","signature":"private.tg_worker_calendar_agreement_update()"},"public.rpc_agreement_cancellation_v1":{"body_md5":"f54af14827bdd1c0906f512ee8aa9043","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_agreement_cancellation_v1(uuid[])"},"public.rpc_confirm_completion":{"body_md5":"658006c318c3847ab7a9f80706ef3003","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_confirm_completion(uuid)"},"public.rpc_mark_work_done":{"body_md5":"955e0719a3c0a67b684ee0d28483300c","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"timestamp with time zone","signature":"public.rpc_mark_work_done(uuid)"},"public.rpc_tick_auto_completion":{"body_md5":"b617890420e11846dbe528ffc4d800d7","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"integer","signature":"public.rpc_tick_auto_completion()"},"private.closure_account_restricted":{"body_md5":"f4999250c315e0253374d4611291c7ad","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"boolean","signature":"private.closure_account_restricted(uuid)"},"private.closure_guard_owned_write":{"body_md5":"f13117fd601dcb82de423b78f25acb4f","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"trigger","signature":"private.closure_guard_owned_write()"},"private.emit_event":{"body_md5":"586c40786332a9863922585503f083f6","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=public, pg_temp"],"definer":true,"strict":false,"volatility":"v","result":"uuid","signature":"private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamp with time zone)"},"private.safety_guard_interaction_write":{"body_md5":"85730117267a115e5d5517d463c847e7","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"trigger","signature":"private.safety_guard_interaction_write()"},"private.safety_pair_blocked":{"body_md5":"698fb21abb0379743bc7ab09d9f946ad","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"boolean","signature":"private.safety_pair_blocked(uuid,uuid)"},"private.set_updated_at":{"body_md5":"d2ba7342ae061b491b5ec4bb74fb81c4","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"v","result":"trigger","signature":"private.set_updated_at()"},"private.closure_redaction_patch_v5":{"body_md5":"55ba7bf41ce39d9c914929270b916570","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)"},"private.closure_redaction_scope_v5":{"body_md5":"81dbe706544b14990da7fe2bebb6bbb2","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"i","result":"text","signature":"private.closure_redaction_scope_v5(text)"},"private.data_export_snapshot":{"body_md5":"c3bde16e2175c7ec33c1a171e0ad04a3","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"text","signature":"private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)"}}'::jsonb;
  observed jsonb;
  prior_attributes jsonb;
  old_search_path text := current_setting('search_path');
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R08_CANCELLATION_SOURCE_OR_ACL_DRIFT' USING errcode='55000';
  END IF;
  IF (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
      WHERE c.conrelid='public.agreement_messages'::regclass
      AND c.conname='agreement_messages_body_media_check') IS DISTINCT FROM 'CHECK (((char_length(btrim(body)) <= 2000) AND ((cardinality(photo_asset_ids) >= 0) AND (cardinality(photo_asset_ids) <= 6)) AND (((voice_asset_id IS NULL) AND ((char_length(btrim(body)) >= 1) OR (cardinality(photo_asset_ids) >= 1))) OR ((voice_asset_id IS NOT NULL) AND (btrim(body) = ''''::text) AND (cardinality(photo_asset_ids) = 0)))))' THEN
    RAISE EXCEPTION 'R08_CANCELLATION_MESSAGE_SCHEMA_DRIFT' USING errcode='55000';
  END IF;
  SELECT to_jsonb(p)-'prosrc' INTO prior_attributes FROM pg_proc p
    WHERE p.oid='public.rpc_cancel_agreement(uuid,text)'::regprocedure;
  EXECUTE $r08_definition$
CREATE OR REPLACE FUNCTION public.rpc_cancel_agreement(p_agreement_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  uid uuid := auth.uid();
  v_need_id uuid;
  v_agr public.agreements%rowtype;
  v_covered integer;
  v_need public.needs%rowtype;
  v_execution public.agreement_execution%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_part integer;
  v_parts integer;
  v_message_prefix text;
  v_chunk_chars constant integer := 1967;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if v_reason is null or v_reason ~ '^[[:space:]]*$' then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_reason) > 4000 then
    raise exception 'REASON_TOO_LONG' using errcode = '22023';
  end if;

  select a.need_id into v_need_id
    from public.agreements a
   where a.id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;

  select * into v_need
    from public.needs n
   where n.id = v_need_id
   for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_agr from public.agreements
   where id = p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_agr.need_id is distinct from v_need.id then
    raise exception 'AGREEMENT_NEED_MISMATCH' using errcode = 'P0001';
  end if;
  if not public.fn_is_party(p_agreement_id, uid) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;
  if v_agr.status = 'CANCELLED' then return; end if;
  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  -- The same Need -> Agreement -> Execution order as completion. The action
  -- projection permits either party while CONFIRMED and only the worker after
  -- marking done. A direct RPC cannot bypass that already-published rule.
  if v_agr.status <> 'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  select * into v_execution from public.agreement_execution
   where agreement_id = p_agreement_id for update;
  if not found then
    raise exception 'EXECUTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_execution.agreement_version <> v_agr.current_version then
    raise exception 'EXECUTION_VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  if not (v_execution.state = 'CONFIRMED'
      or (v_execution.state = 'AWAITING_REQUESTER' and uid = v_agr.worker_account_id)) then
    raise exception 'AGREEMENT_CANCELLATION_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
  update public.agreement_execution set state = 'CANCELLED'
   where agreement_id = p_agreement_id;
  update public.need_selections set status = 'CANCELLED'
   where id = v_agr.selection_id;
  update public.marketplace_responses
     set status = 'NOT_SELECTED', selected_at = null
   where id = v_agr.selected_response_id;
  update public.access_grants
     set status = 'REVOKED',
         revoked_at = coalesce(revoked_at, statement_timestamp())
   where agreement_id = p_agreement_id and status = 'GRANTED';
  update public.notification_deliveries d
     set state = 'EXPIRED'
    from public.user_activity_events e
   where d.event_id = e.id
     and e.entity_type = 'AGREEMENT'
     and e.entity_id = p_agreement_id
     and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');

  -- Keep the reason in its existing author-owned ordinary message domain.
  -- These rows are already covered by ownAgreementMessages export and sender
  -- closure redaction. The other party's activity payload must not retain a
  -- second plaintext copy outside that author scope.
  if not private.safety_pair_blocked(v_agr.requester_account_id,v_agr.worker_account_id)
     and not private.closure_account_restricted(v_agr.requester_account_id)
     and not private.closure_account_restricted(v_agr.worker_account_id) then
    if char_length(v_reason) <= 1973 then
      insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
      values(v_agr.id,v_agr.current_version,uid,'Otkazujem Dogovor. Razlog: '||v_reason);
    else
      -- PostgreSQL character slices preserve complete Unicode code points.
      -- At most three numbered messages preserve all 4,000 accepted characters.
      -- The first canonical prefix remains readable by the existing cancellation
      -- projection; subsequent parts are read in the existing conversation.
      v_parts := (char_length(v_reason)+v_chunk_chars-1)/v_chunk_chars;
      -- One random UUID prefix orders the bounded parts in the existing
      -- (created_at,id) reader while retaining the true shared statement time.
      v_message_prefix := left(gen_random_uuid()::text,35);
      for v_part in 1..v_parts loop
        insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body)
        values((v_message_prefix||v_part::text)::uuid,v_agr.id,v_agr.current_version,uid,
          case when v_part=1 then 'Otkazujem Dogovor. Razlog: '||format('[%s/%s] ',v_part,v_parts)
            else format('Razlog otkazivanja [%s/%s]: ',v_part,v_parts) end
          ||substr(v_reason,(v_part-1)*v_chunk_chars+1,v_chunk_chars));
      end loop;
    end if;
  end if;

  -- A single safe terminal event identifies who cancelled and when. Existing
  -- notification privacy guards still suppress delivery to a closing account.
  -- Persist it before the closed-search completion branch can return early.
  perform private.emit_event(
    case when uid=v_agr.requester_account_id then v_agr.worker_account_id else v_agr.requester_account_id end,
    case when uid=v_agr.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CANCELLED','AGREEMENT',v_agr.id,v_agr.current_version,
    'Saradnja je otkazana','Otvorite Dogovor da vidite trenutne informacije.',
    'agreement-cancelled:'||v_agr.id::text,'NORMAL',
    jsonb_build_object('cancelledByRole',case when uid=v_agr.requester_account_id then 'REQUESTER' else 'WORKER' end),null);

  if v_need.remaining_search_closed_at is not null then
    if private.sync_need_completion(v_need.id) then
      return;
    end if;
  end if;

  v_covered := public.fn_need_covered_slots(v_agr.need_id);

  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION') then
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
end;
$function$

$r08_definition$;
  expected:=jsonb_set(expected,ARRAY['public.rpc_cancel_agreement','body_md5'],to_jsonb('e592af7aead2172ff769f38aada8e056'::text));
  SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R08_CANCELLATION_POSTIMAGE_MISMATCH' USING errcode='55000';
  END IF;
  IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p
      WHERE p.oid='public.rpc_cancel_agreement(uuid,text)'::regprocedure) IS DISTINCT FROM prior_attributes THEN
    RAISE EXCEPTION 'R08_CANCELLATION_METADATA_CHANGED' USING errcode='55000';
  END IF;
  PERFORM set_config('search_path',old_search_path,true);
END;
$r08_cancellation$;
