-- R07a correction receipt. Canonical DEV writer was read with md5=db25bcbffbef1d0947c53defb1a6cb05.
-- This is an explicitly fenced DEV forward candidate; archive reconciliation is
-- required before treating the clean repo as a release-grade full migration replay.
DO $preflight$
BEGIN
  IF COALESCE((
    SELECT md5(pg_catalog.pg_get_functiondef(p.oid))
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='rpc_ai_apply_interview_turn_v2_service'
  ),'') <> 'db25bcbffbef1d0947c53defb1a6cb05' THEN
    RAISE EXCEPTION 'R07A_WRITER_SOURCE_DRIFT' USING errcode='55000';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.rpc_ai_apply_interview_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_conv public.ai_conversations%rowtype;
  v_item jsonb;
  v_key text;
  v_value jsonb;
  v_display text;
  v_evidence text;
  v_confidence numeric;
  v_value_type text;
  v_fact_id uuid;
  v_fact_ids uuid[]:='{}'::uuid[];
  v_previous_ids uuid[];
  v_user_message_id uuid;
  v_assistant_message_id uuid;
  v_proposals jsonb:=coalesce(p_proposals,'[]'::jsonb);
  v_price_invalidation_seen boolean:=FALSE;
begin
  if p_account_id is null or p_conversation_id is null then raise exception 'TURN_IDENTITY_REQUIRED' using errcode='22004'; end if;
  if coalesce(char_length(btrim(p_user_message)),0)<1 or char_length(btrim(p_user_message))>4000 then raise exception 'USER_MESSAGE_INVALID' using errcode='22023'; end if;
  if coalesce(char_length(btrim(p_assistant_message)),0)<1 or char_length(btrim(p_assistant_message))>1500 then raise exception 'ASSISTANT_MESSAGE_INVALID' using errcode='22023'; end if;
  if p_safety not in ('ALLOW','CLARIFY','REVIEW','BLOCK') then raise exception 'SAFETY_DECISION_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_proposals)<>'array' or jsonb_array_length(v_proposals)>22 then raise exception 'PROPOSALS_INVALID' using errcode='22023'; end if;
  if p_safety='BLOCK' and jsonb_array_length(v_proposals)>0 then raise exception 'BLOCK_CANNOT_PERSIST_PROPOSALS' using errcode='22023'; end if;

  select * into v_conv
    from public.ai_conversations
   where id=p_conversation_id
   for update;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_conv.account_id<>p_account_id then raise exception 'CONVERSATION_OWNER_MISMATCH' using errcode='42501'; end if;
  if v_conv.purpose<>'NEED_INTAKE' then raise exception 'CONVERSATION_PURPOSE_MISMATCH' using errcode='P0001'; end if;
  if v_conv.fact_schema_version<>'NEED_FACT_V2' then raise exception 'V2_CONVERSATION_REQUIRED' using errcode='P0001'; end if;
  if v_conv.status<>'OPEN' then raise exception 'CONVERSATION_CLOSED' using errcode='P0001'; end if;

  for v_item in select value from jsonb_array_elements(v_proposals)
  loop
    if jsonb_typeof(v_item)<>'object' then raise exception 'PROPOSAL_OBJECT_REQUIRED' using errcode='22023'; end if;

    -- R07a: a single, owner-scoped retraction changes price meaning only.
    -- A classification or model reply may request this, but the service-only
    -- writer validates it in the SAME transaction as the persisted turn.
    IF v_item->>'action'='INVALIDATE_PRICE' THEN
      IF p_safety NOT IN ('CLARIFY','REVIEW') OR v_price_invalidation_seen
        OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(v_item)) <> 2
        OR NOT (v_item ? 'reason')
        OR v_item->>'reason' IS NULL
        OR v_item->>'reason' NOT IN ('UNSUPPORTED_CURRENCY','AMBIGUOUS_CURRENCY','UNSUPPORTED_PRICE_BASIS')
        OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_proposals) concurrent_fact
                   WHERE concurrent_fact->>'key' IN ('need.price_mode','need.price_rsd','need.price_basis'))
      THEN
        RAISE EXCEPTION 'AI_PRICE_INVALIDATION_INVALID' USING errcode='22023';
      END IF;
      UPDATE public.ai_structured_facts
         SET superseded_at=statement_timestamp(),superseded_by=NULL
       WHERE account_id=p_account_id AND conversation_id=p_conversation_id
         AND fact_schema_version='NEED_FACT_V2' AND scope='NEED_DRAFT'
         AND fact_key IN ('need.price_mode','need.price_rsd','need.price_basis')
         AND superseded_at IS NULL;
      v_price_invalidation_seen:=TRUE;
      CONTINUE;
    END IF;
    IF v_item ? 'action' THEN
      RAISE EXCEPTION 'AI_ACTION_UNSUPPORTED' USING errcode='22023';
    END IF;
    v_key:=nullif(btrim(v_item->>'key'),'');
    v_value:=v_item->'value';
    v_display:=nullif(btrim(v_item->>'displayValue'),'');
    v_evidence:=nullif(btrim(v_item->>'evidence'),'');
    if v_key in('need.resolved_location','need.public_photo_paths') then raise exception 'LOCATION_EDITOR_REQUIRED' using errcode='42501'; end if;
    if v_key is null then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023'; end if;
    if v_display is null or char_length(v_display)>1000 then raise exception 'V2_FACT_DISPLAY_INVALID' using errcode='22023',detail=v_key; end if;
    if v_evidence is null or char_length(v_evidence)>500 then raise exception 'V2_FACT_EVIDENCE_INVALID' using errcode='22023',detail=v_key; end if;
    begin v_confidence:=(v_item->>'confidence')::numeric; exception when others then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end;
    if v_confidence is null or v_confidence<0 or v_confidence>1 then raise exception 'V2_FACT_CONFIDENCE_INVALID' using errcode='22023',detail=v_key; end if;

    select value_type into v_value_type from private.need_fact_registry where fact_key=v_key;
    if not found then raise exception 'V2_FACT_KEY_INVALID' using errcode='22023',detail=v_key; end if;
    perform private.validate_need_v2_fact(v_key,v_value);

    v_fact_id:=extensions.gen_random_uuid();
    with superseded as (
      update public.ai_structured_facts
         set superseded_at=statement_timestamp(),superseded_by=null
       where conversation_id=p_conversation_id
         and fact_key=v_key
         and superseded_at is null
       returning id
    )
    select coalesce(array_agg(id),'{}'::uuid[]) into v_previous_ids from superseded;

    insert into public.ai_structured_facts(
      id,account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,fact_schema_version,value_type,display_value
    ) values (
      v_fact_id,p_account_id,p_conversation_id,v_conv.bound_need_id,v_key,v_value,
      'NEEDS_CONFIRMATION','AI_INFERENCE','NEED_DRAFT',v_confidence,v_evidence,
      'NEED_FACT_V2',v_value_type,v_display
    );

    if cardinality(v_previous_ids)>0 then
      update public.ai_structured_facts set superseded_by=v_fact_id where id=any(v_previous_ids);
    end if;
    v_fact_ids:=array_append(v_fact_ids,v_fact_id);
  end loop;

  insert into public.ai_messages(account_id,conversation_id,role,body)
  values(p_account_id,p_conversation_id,'USER',btrim(p_user_message))
  returning id into v_user_message_id;

  insert into public.ai_messages(account_id,conversation_id,role,body,safety,proposed_fact_ids)
  values(p_account_id,p_conversation_id,'ASSISTANT',btrim(p_assistant_message),p_safety,v_fact_ids)
  returning id into v_assistant_message_id;

  return jsonb_build_object(
    'conversationId',p_conversation_id,
    'userMessageId',v_user_message_id,
    'assistantMessageId',v_assistant_message_id,
    'proposedCount',cardinality(v_fact_ids),
    'proposedFactIds',to_jsonb(v_fact_ids),
    'schemaVersion','NEED_FACT_V2',
    'safety',p_safety,
    'authoritative',true
  );
end
$function$;

REVOKE ALL ON FUNCTION public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)
  TO service_role;

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='rpc_ai_apply_interview_turn_v2_service'
       AND pg_catalog.strpos(pg_catalog.pg_get_functiondef(p.oid),'INVALIDATE_PRICE') > 0
       AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
       AND NOT pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
       AND pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'R07A_WRITER_POSTFLIGHT_FAILED' USING errcode='55000';
  END IF;
END
$postflight$;
