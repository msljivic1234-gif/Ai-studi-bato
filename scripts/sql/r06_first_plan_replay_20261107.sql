-- R06 LOCAL_ONLY forward candidate. Target: leqcwgzvjsxugfgzdmth (DEV).
-- Source: exact read-only definitions in r06_first_plan_preimage_20261107.json.
-- A scheduling-only completion used to insert a continuity hint immediately
-- before the atomic first-plan writer tried to capture its own plan. The former
-- has no catalog_resolution, so the replay guard correctly refused the latter.
-- Keep legacy continuity and existing replay checks. Give the two existing
-- callers an explicit choice inside ONE private implementation of completion.
-- No historical receipt, user row, RLS policy, or applied migration is rewritten.
-- Apply only as a reviewed migration after DEV identity/preimage revalidation.
DO $r06$
DECLARE
 base_def text;
 first_def text;
 core_def text;
 base_metadata jsonb;
 first_metadata jsonb;
 core_signature text:='private.ai_complete_need_turn_v2_core(uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean)';
 base_signature text:='public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)';
 first_signature text:='public.rpc_ai_complete_need_turn_with_first_plan_service(uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb)';
 owner_name text;
BEGIN
 IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(base_signature))
      IS DISTINCT FROM '1a27afa0e474f67d37b72393318ab854'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(first_signature))
      IS DISTINCT FROM 'da51afb2763855e580931444ad60cba0'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'private.taxonomy_first_plan_complete_receipt_v1(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,text,boolean)'))
      IS DISTINCT FROM '1fd600075014202a6cc719c262af6e5e'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'private.taxonomy_first_plan_lock_v1(uuid,uuid,uuid,uuid,text)'))
      IS DISTINCT FROM '78a249a0705dd5cc7918cb2d3d18e154'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'public.rpc_ai_read_first_plan_completion_service(text,jsonb)'))
      IS DISTINCT FROM '5305ce0c9ea1cd41e28491737ef55d58'
 THEN RAISE EXCEPTION 'R06_COMPLETION_SOURCE_DRIFT' USING errcode='55000'; END IF;
 IF to_regprocedure(core_signature) IS NOT NULL THEN
  RAISE EXCEPTION 'R06_COMPLETION_CORE_ALREADY_EXISTS' USING errcode='55000'; END IF;
 IF has_function_privilege('anon',base_signature,'EXECUTE')
 OR has_function_privilege('authenticated',base_signature,'EXECUTE')
 OR has_function_privilege('anon',first_signature,'EXECUTE')
 OR has_function_privilege('authenticated',first_signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',base_signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',first_signature,'EXECUTE') THEN
  RAISE EXCEPTION 'R06_COMPLETION_ACL_DRIFT' USING errcode='55000'; END IF;

 SELECT pg_catalog.pg_get_functiondef(p.oid),pg_catalog.pg_get_userbyid(p.proowner),to_jsonb(p)-'prosrc'
 INTO base_def,owner_name,base_metadata FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(base_signature);
 SELECT pg_catalog.pg_get_functiondef(p.oid),to_jsonb(p)-'prosrc' INTO first_def,first_metadata
 FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(first_signature);
 IF base_metadata->>'prosecdef' IS DISTINCT FROM 'true'
 OR first_metadata->>'prosecdef' IS DISTINCT FROM 'true'
 OR base_metadata->'proconfig' IS DISTINCT FROM '["search_path=pg_catalog"]'::jsonb
 OR first_metadata->'proconfig' IS DISTINCT FROM '["search_path=pg_catalog"]'::jsonb
 OR base_metadata->>'proowner' IS DISTINCT FROM first_metadata->>'proowner' THEN
  RAISE EXCEPTION 'R06_COMPLETION_METADATA_DRIFT' USING errcode='55000'; END IF;

 core_def:=replace(base_def,'public.rpc_ai_complete_need_turn_v2_service(',
   'private.ai_complete_need_turn_v2_core(');
 core_def:=replace(core_def,E'p_proposals jsonb)\n RETURNS jsonb',
   E'p_proposals jsonb, p_capture_schedule_continuity boolean)\n RETURNS jsonb');
 -- Only the existing public wrappers run as their owner. The new helper is
 -- SECURITY INVOKER and cannot be called directly by client or service roles.
 core_def:=replace(core_def,E' SECURITY DEFINER\n','');
 core_def:=replace(core_def,E'begin\n if p_account_id',
   E'begin\n if p_capture_schedule_continuity is null then raise exception ''R06_CONTINUITY_MODE_REQUIRED'' using errcode=''22023'';end if;\n if p_account_id');
 core_def:=replace(core_def,
   ' IF p_safety IN (''ALLOW'',''CLARIFY'') AND jsonb_typeof(p_proposals)=''array''',
   ' IF p_capture_schedule_continuity AND p_safety IN (''ALLOW'',''CLARIFY'') AND jsonb_typeof(p_proposals)=''array''');
 EXECUTE core_def;
 EXECUTE format('ALTER FUNCTION %s OWNER TO %I',core_signature,owner_name);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',core_signature);

 EXECUTE $legacy$
CREATE OR REPLACE FUNCTION public.rpc_ai_complete_need_turn_v2_service(p_account_id uuid, p_conversation_id uuid, p_client_request_id uuid, p_attempt_id uuid, p_user_message text, p_assistant_message text, p_safety text, p_proposals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 RETURN private.ai_complete_need_turn_v2_core(p_account_id,p_conversation_id,p_client_request_id,p_attempt_id,
  p_user_message,p_assistant_message,p_safety,p_proposals,true);
END;
$function$;
$legacy$;

 first_def:=replace(first_def,
   E'completed:=public.rpc_ai_complete_need_turn_v2_service(p_account_id,p_conversation_id,p_client_request_id,\n  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals);',
   E'completed:=private.ai_complete_need_turn_v2_core(p_account_id,p_conversation_id,p_client_request_id,\n  p_attempt_id,p_user_message,p_assistant_message,p_safety,p_proposals,false);');
 EXECUTE first_def;

 -- CREATE OR REPLACE must preserve the same RPC identity, owner, ACL, named
 -- arguments, result type, volatility, language, security and search_path.
 IF (SELECT to_jsonb(p)-'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(base_signature))
      IS DISTINCT FROM base_metadata
 OR (SELECT to_jsonb(p)-'prosrc' FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(first_signature))
      IS DISTINCT FROM first_metadata THEN
  RAISE EXCEPTION 'R06_COMPLETION_POSTIMAGE_METADATA_MISMATCH' USING errcode='55000'; END IF;

 IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(core_signature))
      IS DISTINCT FROM '70389d9f437a1edda4014df273435037'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(base_signature))
      IS DISTINCT FROM 'fc4bc88352cb73fb1a67e5d1a130f42f'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(first_signature))
      IS DISTINCT FROM '091f63c2342373db5870352cddd1ece8'
 OR (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(
      'private.taxonomy_first_plan_complete_receipt_v1(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,text,boolean)'))
      IS DISTINCT FROM '1fd600075014202a6cc719c262af6e5e' THEN
  RAISE EXCEPTION 'R06_COMPLETION_POSTIMAGE_MISMATCH' USING errcode='55000'; END IF;
 IF (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid=to_regprocedure(core_signature))
 OR has_function_privilege('anon',core_signature,'EXECUTE')
 OR has_function_privilege('authenticated',core_signature,'EXECUTE')
 OR has_function_privilege('service_role',core_signature,'EXECUTE')
 OR has_function_privilege('anon',base_signature,'EXECUTE')
 OR has_function_privilege('authenticated',base_signature,'EXECUTE')
 OR has_function_privilege('anon',first_signature,'EXECUTE')
 OR has_function_privilege('authenticated',first_signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',base_signature,'EXECUTE')
 OR NOT has_function_privilege('service_role',first_signature,'EXECUTE') THEN
  RAISE EXCEPTION 'R06_COMPLETION_POSTIMAGE_ACL_MISMATCH' USING errcode='55000'; END IF;
END;
$r06$;
