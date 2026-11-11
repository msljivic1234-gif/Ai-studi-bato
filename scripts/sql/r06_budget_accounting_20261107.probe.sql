-- Bounded canonical DEV probe. No provider call; no durable data mutation.
-- Service-claim SQL admission/replay evidence, not ordinary Auth or native E2E.
BEGIN;
DO $probe$
DECLARE
  v_account uuid;
  v_existing private.ai_test_reservations_v5;
  v_before jsonb;
  v_after jsonb;
  v_new jsonb;
  v_replay jsonb;
BEGIN
  SELECT jsonb_build_object(
    'budget',(SELECT to_jsonb(b) FROM private.ai_test_budget_v5 b WHERE singleton),
    'reservations',(SELECT md5(coalesce(string_agg(r::text,',' ORDER BY r.operation_id),'')) FROM private.ai_test_reservations_v5 r),
    'usage',(SELECT md5(coalesce(string_agg(u::text,',' ORDER BY u.operation_id),'')) FROM private.ai_test_usage_v5 u)) INTO v_before;
  SELECT a.account_id INTO STRICT v_account FROM private.ai_test_accounts_v5 a
    JOIN auth.users u ON u.id=a.account_id
    WHERE a.retired_at IS NULL AND u.deleted_at IS NULL
      AND NOT private.closure_account_restricted(a.account_id)
    ORDER BY a.account_id LIMIT 1;
  SELECT * INTO STRICT v_existing FROM private.ai_test_reservations_v5
    WHERE account_id=v_account ORDER BY operation_id LIMIT 1;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  v_new:=public.rpc_ai_test_budget_reserve_service(v_account,gen_random_uuid(),'LLM',250000);
  IF v_new->>'code' IS DISTINCT FROM 'AI_TEST_BUDGET_EXHAUSTED'
    OR v_new->'admitted' IS DISTINCT FROM 'false'::jsonb
    OR v_new->'reservationId' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'R06_NEW_RESERVATION_WAS_NOT_REFUSED';
  END IF;
  v_replay:=public.rpc_ai_test_budget_reserve_service(v_existing.account_id,
    v_existing.operation_id,v_existing.kind,v_existing.max_cost_microusd);
  IF v_replay->>'code' IS DISTINCT FROM 'AI_TEST_OPERATION_REPLAY'
    OR v_replay->'admitted' IS DISTINCT FROM 'false'::jsonb
    OR v_replay->'replay' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'R06_EXISTING_OPERATION_WAS_READMITTED';
  END IF;
  SELECT jsonb_build_object(
    'budget',(SELECT to_jsonb(b) FROM private.ai_test_budget_v5 b WHERE singleton),
    'reservations',(SELECT md5(coalesce(string_agg(r::text,',' ORDER BY r.operation_id),'')) FROM private.ai_test_reservations_v5 r),
    'usage',(SELECT md5(coalesce(string_agg(u::text,',' ORDER BY u.operation_id),'')) FROM private.ai_test_usage_v5 u)) INTO v_after;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'R06_PROBE_CHANGED_ACCOUNTING'; END IF;
  PERFORM set_config('uskoci.r06_probe',jsonb_build_object(
    'newAdmission',v_new->>'code','existingOperation',v_replay->>'code',
    'accountingUnchanged',true,'providerCalls',0,'ordinaryAuth',false)::text,true);
END;
$probe$;
SELECT current_setting('uskoci.r06_probe')::jsonb AS result;
ROLLBACK;
