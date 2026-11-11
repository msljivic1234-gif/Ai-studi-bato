-- R06 LOCAL_ONLY forward candidate. Target: leqcwgzvjsxugfgzdmth (DEV).
-- Preserve the durable dispatch fact when settling a failed Need attempt.
-- FAILED + provider_dispatched=true is already supported by status/recovery,
-- the claim writer and current mobile decoder: it forbids a paid retry of the
-- same request. A failure before dispatch remains retryable under existing rules.
-- No new state, invoice claim, refund, user-data repair or historical rewrite.
DO $r06_dispatch$
DECLARE
 signature text:='public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)';
 definition text;
 metadata jsonb;
BEGIN
 IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(signature))
      IS DISTINCT FROM '60bb093a18d558058b1b66ce3219160c'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'private.ai_need_turn_status(uuid,uuid,uuid)')) IS DISTINCT FROM '3e282af463b21b4fbbcd5ede077878d6'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)')) IS DISTINCT FROM '114bd0b4b9d6e60a0abb0d0d64e63c69'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'public.rpc_ai_dispatch_need_turn_v2_service(uuid,uuid,uuid,uuid)')) IS DISTINCT FROM 'fa90211a3fb9297eeebc74463845c7ca'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'public.rpc_ai_recover_need_turn_v2(uuid,uuid)')) IS DISTINCT FROM 'd6601c035f78d5e97de93d2a3ef0b6c4' THEN
  RAISE EXCEPTION 'R06_DISPATCH_SOURCE_DRIFT' USING errcode='55000'; END IF;
 IF has_function_privilege('anon',signature,'EXECUTE')
 OR has_function_privilege('authenticated',signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
  RAISE EXCEPTION 'R06_DISPATCH_ACL_DRIFT' USING errcode='55000'; END IF;
 SELECT pg_catalog.pg_get_functiondef(p.oid),to_jsonb(p)-'prosrc' INTO definition,metadata
 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(signature);
 IF metadata->>'prosecdef' IS DISTINCT FROM 'true'
 OR metadata->'proconfig' IS DISTINCT FROM '["search_path=pg_catalog"]'::jsonb THEN
  RAISE EXCEPTION 'R06_DISPATCH_METADATA_DRIFT' USING errcode='55000'; END IF;

 definition:=replace(definition,
   'set state=''FAILED'', provider_dispatched=false, updated_at=clock_timestamp()',
   'set state=''FAILED'', updated_at=clock_timestamp()');
 EXECUTE definition;

 IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(signature))
      IS DISTINCT FROM '1d6ee774d7eae32b2c6d7c6f56e07b10'
 OR (SELECT to_jsonb(p)-'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(signature))
      IS DISTINCT FROM metadata THEN
  RAISE EXCEPTION 'R06_DISPATCH_POSTIMAGE_MISMATCH' USING errcode='55000'; END IF;
 IF has_function_privilege('anon',signature,'EXECUTE')
 OR has_function_privilege('authenticated',signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN
  RAISE EXCEPTION 'R06_DISPATCH_POSTIMAGE_ACL_MISMATCH' USING errcode='55000'; END IF;
END;
$r06_dispatch$;
