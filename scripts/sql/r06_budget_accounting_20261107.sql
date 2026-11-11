-- R06 forward candidate for canonical DEV leqcwgzvjsxugfgzdmth.
-- Keep the existing $5 ceiling, all historical rows and all unknown holds.
-- The admission writer enforces the ceiling; accounting may truthfully exceed
-- it after a late usage receipt. Such an overrun blocks further reservations.
-- No provider request, new test account, budget reset, price change or invoice claim.
DO $r06_budget$
DECLARE
  expected jsonb := '{"private.ai_test_price_microusd(integer,integer)":{"body_md5":"87ad940334ae78be5a3c0b19983d5981","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true},"public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)":{"body_md5":"3cadd9345025fd962fc64cab085f29f7","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog, public, private"],"definer":true},"public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)":{"body_md5":"d4d6252075fe7affc6afd17b8b861d34","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true},"public.rpc_ai_test_release_unused_reservation_service(uuid)":{"body_md5":"0508f4b02a0f0abd620ba9da944500c0","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true},"public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)":{"body_md5":"794db1cf0e12774a92c77bcb0f45854e","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true},"private.ai_test_stt_price_microusd(bigint,integer)":{"body_md5":"ddbe2bb651ccc097b153ed4ec8ddb39b","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true}}'::jsonb;
  expected_constraints jsonb := '{"ai_test_budget_v5_reserved_microusd_check":{"relation":"private.ai_test_budget_v5","definition":"CHECK (((reserved_microusd >= 0) AND ((NOT reservation_cap_enforced) OR (reserved_microusd <= ceiling_microusd))))"},"ai_test_reservations_v5_audio_measure_check":{"relation":"private.ai_test_reservations_v5","definition":"CHECK (((settlement_basis = ''AUDIO_DURATION_AT_PUBLISHED_RATE''::text) = ((measured_audio_bytes IS NOT NULL) AND (measured_audio_bytes > 0) AND (measured_transcript_chars IS NOT NULL))))"},"ai_test_reservations_v5_settlement_check":{"relation":"private.ai_test_reservations_v5","definition":"CHECK ((((settled_microusd IS NULL) AND (settlement_basis IS NULL) AND (settled_at IS NULL)) OR (((settled_microusd >= 0) AND (settled_microusd <= max_cost_microusd)) AND (settlement_basis = ANY (ARRAY[''MEASURED''::text, ''CONSERVATIVE_ESTIMATE_UNMEASURED''::text, ''FAILED_NO_USAGE''::text, ''AUDIO_DURATION_AT_PUBLISHED_RATE''::text])) AND (settled_at IS NOT NULL))))"}}'::jsonb;
  observed jsonb;
  before_functions jsonb;
  before_tables jsonb;
  before_budget jsonb;
  before_rows jsonb;
  old_search_path text := current_setting('search_path');
  old_lock_timeout text := current_setting('lock_timeout');
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  PERFORM set_config('lock_timeout','5s',true);
  LOCK TABLE private.ai_test_budget_v5, private.ai_test_reservations_v5,
    private.ai_test_usage_v5, private.ai_test_accounts_v5 IN ACCESS EXCLUSIVE MODE;

  SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'body_md5',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),
    'acl',p.proacl::text,'config',p.proconfig,'definer',p.prosecdef))
  INTO observed FROM jsonb_each(expected) e
  LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.key);
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R06_BUDGET_SOURCE_OR_ACL_DRIFT' USING errcode='55000';
  END IF;
  SELECT jsonb_object_agg(e.key,jsonb_build_object('relation',e.value->>'relation',
    'definition',pg_get_constraintdef(c.oid)))
  INTO observed FROM jsonb_each(expected_constraints) e
  LEFT JOIN pg_constraint c ON c.conrelid=to_regclass(e.value->>'relation') AND c.conname=e.key;
  -- PostgreSQL deparsing after a parse/deparse round trip flattens this
  -- redundant AND group. Accept only that exact, equivalent second spelling;
  -- every other column/operator/literal/constraint remains pinned.
  IF observed IS DISTINCT FROM expected_constraints
    AND observed IS DISTINCT FROM jsonb_set(expected_constraints,
      '{ai_test_reservations_v5_settlement_check,definition}',
      to_jsonb('CHECK ((((settled_microusd IS NULL) AND (settlement_basis IS NULL) AND (settled_at IS NULL)) OR ((settled_microusd >= 0) AND (settled_microusd <= max_cost_microusd) AND (settlement_basis = ANY (ARRAY[''MEASURED''::text, ''CONSERVATIVE_ESTIMATE_UNMEASURED''::text, ''FAILED_NO_USAGE''::text, ''AUDIO_DURATION_AT_PUBLISHED_RATE''::text])) AND (settled_at IS NOT NULL))))'::text)) THEN
    RAISE EXCEPTION 'R06_BUDGET_SCHEMA_DRIFT' USING errcode='55000';
  END IF;
  IF (SELECT count(*) FROM private.ai_test_budget_v5)<>1
     OR (SELECT ceiling_microusd FROM private.ai_test_budget_v5 WHERE singleton) IS DISTINCT FROM 5000000::bigint
     OR (SELECT reserved_microusd FROM private.ai_test_budget_v5 WHERE singleton)
       IS DISTINCT FROM (SELECT coalesce(sum(coalesce(settled_microusd,max_cost_microusd)),0)::bigint
         FROM private.ai_test_reservations_v5) THEN
    RAISE EXCEPTION 'R06_BUDGET_LEDGER_MISMATCH' USING errcode='55000';
  END IF;
  SELECT jsonb_object_agg(e.key,to_jsonb(p)-'prosrc') INTO before_functions
    FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.key);
  SELECT jsonb_object_agg(c.oid::regclass::text,jsonb_build_object(
    'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity))
  INTO before_tables FROM pg_class c WHERE c.oid IN (
    'private.ai_test_budget_v5'::regclass,'private.ai_test_reservations_v5'::regclass,
    'private.ai_test_usage_v5'::regclass,'private.ai_test_accounts_v5'::regclass);
  SELECT to_jsonb(b)-'reservation_cap_enforced' INTO before_budget FROM private.ai_test_budget_v5 b WHERE singleton;
  SELECT jsonb_build_object(
    'reservations',(SELECT md5(coalesce(string_agg(r::text,',' ORDER BY r.operation_id),'')) FROM private.ai_test_reservations_v5 r),
    'usage',(SELECT md5(coalesce(string_agg(u::text,',' ORDER BY u.operation_id),'')) FROM private.ai_test_usage_v5 u),
    'accounts',(SELECT md5(coalesce(string_agg(a::text,',' ORDER BY a.account_id),'')) FROM private.ai_test_accounts_v5 a))
    INTO before_rows;

  -- Existing exposure is already above the ceiling. Keep that amount intact;
  -- the writer is the authority for admitting NEW costs, not this CHECK.
  ALTER TABLE private.ai_test_budget_v5 DROP CONSTRAINT ai_test_budget_v5_reserved_microusd_check;
  ALTER TABLE private.ai_test_budget_v5 ADD CONSTRAINT ai_test_budget_v5_reserved_microusd_check
    CHECK (reserved_microusd >= 0);
  ALTER TABLE private.ai_test_reservations_v5 DROP CONSTRAINT ai_test_reservations_v5_settlement_check;
  ALTER TABLE private.ai_test_reservations_v5 ADD CONSTRAINT ai_test_reservations_v5_settlement_check CHECK (
    (settled_microusd IS NULL AND settlement_basis IS NULL AND settled_at IS NULL)
    OR (settled_microusd IS NOT NULL AND settled_microusd >= 0
      AND settlement_basis IS NOT NULL
      AND settlement_basis IN ('MEASURED','CONSERVATIVE_ESTIMATE_UNMEASURED','FAILED_NO_USAGE','AUDIO_DURATION_AT_PUBLISHED_RATE')
      AND settled_at IS NOT NULL));
  -- Preserve audio measurement metadata when a later provider receipt supersedes
  -- the duration estimate. No existing measurement is erased.
  ALTER TABLE private.ai_test_reservations_v5 DROP CONSTRAINT ai_test_reservations_v5_audio_measure_check;
  ALTER TABLE private.ai_test_reservations_v5 ADD CONSTRAINT ai_test_reservations_v5_audio_measure_check CHECK (
    (measured_audio_bytes IS NULL AND measured_transcript_chars IS NULL
      AND settlement_basis IS DISTINCT FROM 'AUDIO_DURATION_AT_PUBLISHED_RATE')
    OR (kind='STT' AND measured_audio_bytes IS NOT NULL AND measured_audio_bytes>0
      AND measured_transcript_chars IS NOT NULL AND measured_transcript_chars>=0
      AND settlement_basis IS NOT NULL AND settlement_basis IN ('AUDIO_DURATION_AT_PUBLISHED_RATE','MEASURED')));

  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.rpc_ai_test_budget_reserve_service(p_account_id uuid, p_operation_id uuid, p_kind text, p_max_cost_microusd bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_budget private.ai_test_budget_v5%rowtype;
  v_existing private.ai_test_reservations_v5%rowtype;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_account_id is null or p_operation_id is null or p_kind not in ('LLM','STT') or p_kind is null
    or p_max_cost_microusd is distinct from (case p_kind when 'LLM' then 250000::bigint when 'STT' then 200000::bigint end) then
    raise exception 'AI_TEST_RESERVATION_INVALID';
  end if;

  -- Match existing closure ordering before the global budget row. A closing
  -- account cannot acquire a fresh provider operation.
  perform pg_advisory_xact_lock_shared(private.closure_account_key(p_account_id));
  -- Every reservation shares this row, so different accounts cannot each spend $5.
  select * into strict v_budget from private.ai_test_budget_v5 where singleton for update;
  select * into v_existing from private.ai_test_reservations_v5 where operation_id = p_operation_id;
  if found then
    if v_existing.account_id <> p_account_id or v_existing.kind <> p_kind
      or v_existing.max_cost_microusd <> p_max_cost_microusd then
      raise exception 'AI_TEST_OPERATION_CONFLICT';
    end if;
    -- Admission is deliberately false: a retry may read its existing receipt but cannot call a provider again.
    return jsonb_build_object('admitted',false,'reservationId',v_existing.id,'replay',true,'code','AI_TEST_OPERATION_REPLAY');
  end if;

  if not v_budget.enabled or not v_budget.reservation_cap_enforced
    or statement_timestamp() >= v_budget.price_valid_until then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_NOT_READY');
  end if;
  if not exists(select 1 from private.ai_test_accounts_v5 where account_id=p_account_id and retired_at is null)
    or not exists(select 1 from auth.users where id=p_account_id and deleted_at is null)
    or private.closure_account_restricted(p_account_id) then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_ACCOUNT_NOT_ADMITTED');
  end if;
  if v_budget.reserved_microusd + p_max_cost_microusd > v_budget.ceiling_microusd then
    return jsonb_build_object('admitted',false,'reservationId',null,'replay',false,'code','AI_TEST_BUDGET_EXHAUSTED');
  end if;

  insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd)
    values(p_operation_id,p_account_id,p_kind,p_max_cost_microusd) returning id into v_id;
  update private.ai_test_budget_v5 set reserved_microusd=reserved_microusd+p_max_cost_microusd where singleton;
  return jsonb_build_object('admitted',true,'reservationId',v_id,'replay',false,'code','AI_TEST_RESERVED');
end
$function$
;
$definition$;

  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.rpc_ai_test_record_usage_service(p_operation_id uuid, p_model text, p_prompt_tokens integer, p_output_tokens integer, p_total_tokens integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_existing private.ai_test_usage_v5;
  v_cost bigint;
  v_previous bigint;
  v_released bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_operation_id is null or p_model is null
     or p_prompt_tokens is null or p_output_tokens is null or p_total_tokens is null
     or p_prompt_tokens < 0 or p_output_tokens < 0 or p_total_tokens < 0 then
    raise exception 'AI_USAGE_INPUT_INVALID' using errcode = '22023';
  end if;

  -- Serialize every settlement with reservation admission before reading its
  -- current basis. A concurrent release/estimate cannot race measured usage.
  perform 1 from private.ai_test_budget_v5 where singleton for update;
  if not found then raise exception 'AI_TEST_BUDGET_NOT_READY' using errcode = '55000'; end if;

  select * into v_reservation from private.ai_test_reservations_v5
    where operation_id = p_operation_id for update;
  if not found then raise exception 'AI_USAGE_NO_RESERVATION' using errcode = '42501'; end if;

  select * into v_existing from private.ai_test_usage_v5 where operation_id = p_operation_id;
  if found then
    if v_existing.prompt_tokens = p_prompt_tokens and v_existing.output_tokens = p_output_tokens
       and v_existing.total_tokens = p_total_tokens and v_existing.model = btrim(p_model) then
      return jsonb_build_object('operationId', p_operation_id, 'recorded', false,
        'promptTokens', v_existing.prompt_tokens, 'outputTokens', v_existing.output_tokens,
        'totalTokens', v_existing.total_tokens, 'authoritative', true,
        'settledMicrousd', v_reservation.settled_microusd, 'releasedMicrousd', 0);
    end if;
    raise exception 'AI_USAGE_ALREADY_RECORDED' using errcode = '55000';
  end if;

  insert into private.ai_test_usage_v5(operation_id, account_id, model, prompt_tokens, output_tokens, total_tokens)
    values (p_operation_id, v_reservation.account_id, btrim(p_model), p_prompt_tokens, p_output_tokens, p_total_tokens);

  -- This is an internal price calculation from reported usage, not an invoice.
  -- Never truncate a known cost to the earlier estimated maximum. A late usage
  -- receipt replaces an earlier estimate or no-dispatch release exactly once.
  v_cost := private.ai_test_price_microusd(p_prompt_tokens, p_output_tokens);
  v_previous := coalesce(v_reservation.settled_microusd, v_reservation.max_cost_microusd);
  v_released := greatest(0, v_previous - v_cost);
  update private.ai_test_reservations_v5
     set settled_microusd = v_cost, settlement_basis = 'MEASURED', settled_at = statement_timestamp()
   where operation_id = p_operation_id;
  update private.ai_test_budget_v5
     set reserved_microusd = reserved_microusd + v_cost - v_previous where singleton;

  return jsonb_build_object('operationId', p_operation_id, 'recorded', true,
    'promptTokens', p_prompt_tokens, 'outputTokens', p_output_tokens,
    'totalTokens', p_total_tokens, 'authoritative', true,
    'settledMicrousd', v_cost, 'releasedMicrousd', v_released);
end
$function$
;
$definition$;

  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.rpc_ai_test_release_unused_reservation_service(p_operation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_rows integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_operation_id is null then raise exception 'AI_RELEASE_INPUT_INVALID' using errcode = '22023'; end if;


  -- Serialize every settlement with reservation admission before reading its
  -- current basis. A concurrent release/estimate cannot race measured usage.
  perform 1 from private.ai_test_budget_v5 where singleton for update;
  if not found then raise exception 'AI_TEST_BUDGET_NOT_READY' using errcode = '55000'; end if;

  select * into v_reservation from private.ai_test_reservations_v5 where operation_id = p_operation_id for update;
  if not found then raise exception 'AI_RELEASE_NO_RESERVATION' using errcode = '42501'; end if;

  -- A failed operation that nevertheless produced usage is a real call. It settles through
  -- the measured path and must never be recorded as FAILED_NO_USAGE.
  if exists (select 1 from private.ai_test_usage_v5 where operation_id = p_operation_id) then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_REFUSED_USAGE_EXISTS', 'releasedMicrousd', 0,
      'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  if v_reservation.settled_microusd is not null then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_ALREADY_SETTLED', 'releasedMicrousd', 0,
      'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  update private.ai_test_reservations_v5
     set settled_microusd = 0, settlement_basis = 'FAILED_NO_USAGE', settled_at = statement_timestamp()
   where operation_id = p_operation_id and settled_microusd is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('operationId', p_operation_id, 'released', false,
      'code', 'AI_RELEASE_ALREADY_SETTLED', 'releasedMicrousd', 0);
  end if;

  update private.ai_test_budget_v5
     set reserved_microusd = reserved_microusd - v_reservation.max_cost_microusd where singleton;

  return jsonb_build_object('operationId', p_operation_id, 'released', true,
    'code', 'AI_RELEASE_DONE', 'releasedMicrousd', v_reservation.max_cost_microusd,
    'settlementBasis', 'FAILED_NO_USAGE', 'settledMicrousd', 0);
end
$function$
;
$definition$;

  EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.rpc_ai_test_settle_audio_service(p_operation_id uuid, p_audio_bytes bigint, p_transcript_chars integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_reservation private.ai_test_reservations_v5;
  v_cost bigint;
  v_rows integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if p_operation_id is null or p_audio_bytes is null or p_transcript_chars is null
     or p_audio_bytes <= 0 or p_transcript_chars < 0 then
    raise exception 'AI_AUDIO_SETTLE_INPUT_INVALID' using errcode = '22023';
  end if;


  -- Serialize every settlement with reservation admission before reading its
  -- current basis. A concurrent release/estimate cannot race measured usage.
  perform 1 from private.ai_test_budget_v5 where singleton for update;
  if not found then raise exception 'AI_TEST_BUDGET_NOT_READY' using errcode = '55000'; end if;

  select * into v_reservation from private.ai_test_reservations_v5 where operation_id = p_operation_id for update;
  if not found then raise exception 'AI_AUDIO_SETTLE_NO_RESERVATION' using errcode = '42501'; end if;
  if v_reservation.kind <> 'STT' then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_NOT_STT', 'releasedMicrousd', 0);
  end if;
  -- Provider-reported usage always wins over a duration-based settlement.
  if exists (select 1 from private.ai_test_usage_v5 where operation_id = p_operation_id) then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_USAGE_EXISTS', 'releasedMicrousd', 0);
  end if;
  if v_reservation.settled_microusd is not null then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_ALREADY_SETTLED',
      'releasedMicrousd', 0, 'settlementBasis', v_reservation.settlement_basis, 'settledMicrousd', v_reservation.settled_microusd);
  end if;

  v_cost := private.ai_test_stt_price_microusd(p_audio_bytes, p_transcript_chars);

  update private.ai_test_reservations_v5
     set settled_microusd = v_cost, settlement_basis = 'AUDIO_DURATION_AT_PUBLISHED_RATE', settled_at = statement_timestamp(),
         measured_audio_bytes = p_audio_bytes, measured_transcript_chars = p_transcript_chars
   where operation_id = p_operation_id and settled_microusd is null;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('operationId', p_operation_id, 'settled', false, 'code', 'AI_AUDIO_SETTLE_ALREADY_SETTLED', 'releasedMicrousd', 0);
  end if;

  update private.ai_test_budget_v5
     set reserved_microusd = reserved_microusd + v_cost - v_reservation.max_cost_microusd where singleton;

  return jsonb_build_object('operationId', p_operation_id, 'settled', true, 'code', 'AI_AUDIO_SETTLED',
    'settledMicrousd', v_cost, 'releasedMicrousd', greatest(0, v_reservation.max_cost_microusd - v_cost),
    'audioSeconds', round(p_audio_bytes::numeric / 32000.0, 2), 'settlementBasis', 'AUDIO_DURATION_AT_PUBLISHED_RATE');
end
$function$
;
$definition$;

  UPDATE private.ai_test_budget_v5 SET reservation_cap_enforced=true WHERE singleton;
  SELECT jsonb_object_agg(e.key,to_jsonb(p)-'prosrc') INTO observed
    FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.key);
  IF observed IS DISTINCT FROM before_functions THEN
    RAISE EXCEPTION 'R06_BUDGET_FUNCTION_METADATA_CHANGED' USING errcode='55000';
  END IF;
  SELECT jsonb_object_agg(c.oid::regclass::text,jsonb_build_object(
    'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity))
  INTO observed FROM pg_class c WHERE c.oid IN (
    'private.ai_test_budget_v5'::regclass,'private.ai_test_reservations_v5'::regclass,
    'private.ai_test_usage_v5'::regclass,'private.ai_test_accounts_v5'::regclass);
  IF observed IS DISTINCT FROM before_tables
    OR (SELECT to_jsonb(b)-'reservation_cap_enforced' FROM private.ai_test_budget_v5 b WHERE singleton)
      IS DISTINCT FROM before_budget
    OR (SELECT reservation_cap_enforced FROM private.ai_test_budget_v5 WHERE singleton) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'R06_BUDGET_TABLE_OR_BALANCE_CHANGED' USING errcode='55000';
  END IF;
  SELECT jsonb_build_object(
    'reservations',(SELECT md5(coalesce(string_agg(r::text,',' ORDER BY r.operation_id),'')) FROM private.ai_test_reservations_v5 r),
    'usage',(SELECT md5(coalesce(string_agg(u::text,',' ORDER BY u.operation_id),'')) FROM private.ai_test_usage_v5 u),
    'accounts',(SELECT md5(coalesce(string_agg(a::text,',' ORDER BY a.account_id),'')) FROM private.ai_test_accounts_v5 a))
    INTO observed;
  IF observed IS DISTINCT FROM before_rows THEN
    RAISE EXCEPTION 'R06_BUDGET_HISTORY_CHANGED' USING errcode='55000';
  END IF;
  PERFORM set_config('search_path',old_search_path,true);
  PERFORM set_config('lock_timeout',old_lock_timeout,true);
END;
$r06_budget$;
