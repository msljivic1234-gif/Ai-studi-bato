-- R07: read the exact existing selection receipt without repeating its writer.
-- Current DEV preimage: 8338852, rpc_select_response 02934f7831db821a7b33fd6d40289b9a.
-- No business rows, existing writer, table, policy, grant or historical receipt changes.
DO $r07_selection_recovery$
DECLARE
  prior_writer jsonb;
BEGIN
  IF to_regprocedure('public.rpc_read_selection_result(uuid,integer,uuid,integer,text,text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'R07_SELECTION_READER_ALREADY_EXISTS' USING errcode='55000';
  END IF;
  SELECT to_jsonb(p) INTO prior_writer FROM pg_proc p
    WHERE p.oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)');
  IF prior_writer IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid=to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)')
      AND md5(p.prosrc)='02934f7831db821a7b33fd6d40289b9a'
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proacl::text='{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
      AND p.proconfig=ARRAY['search_path=public, pg_temp']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_assert_open(uuid,uuid)')
      AND md5(p.prosrc)='dc9bc4c718593850da4fdb49e612dbd2'
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proacl::text='{postgres=X/postgres}' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.closure_account_restricted(uuid)')
      AND md5(p.prosrc)='f4999250c315e0253374d4611291c7ad'
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proacl::text='{postgres=X/postgres}' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('private.push_session_valid(uuid,uuid)')
      AND md5(p.prosrc)='3454eb7040f3dab3cb0c35b512b46859'
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef
      AND p.proacl::text='{postgres=X/postgres}' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
  ) THEN
    RAISE EXCEPTION 'R07_SELECTION_RECOVERY_SOURCE_OR_ACL_DRIFT' USING errcode='55000';
  END IF;
  IF (SELECT jsonb_object_agg(a.attname,format_type(a.atttypid,a.atttypmod))
      FROM pg_attribute a WHERE a.attrelid='private.selection_commands'::regclass
        AND a.attnum>0 AND NOT a.attisdropped) IS DISTINCT FROM
      '{"requester_account_id":"uuid","client_request_id":"text","request_hash":"text","need_id":"uuid","need_revision":"integer","response_id":"uuid","response_version":"integer","response_content_hash":"text","covered_slots":"integer","selection_id":"uuid","agreement_id":"uuid","created_at":"timestamp with time zone"}'::jsonb THEN
    RAISE EXCEPTION 'R07_SELECTION_RECOVERY_SCHEMA_DRIFT' USING errcode='55000';
  END IF;

  EXECUTE $reader$
CREATE FUNCTION public.rpc_read_selection_result(
  p_need_id uuid, p_need_revision integer, p_response_id uuid,
  p_response_version integer, p_content_hash text, p_client_request_id text,
  p_covered_slots integer)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  u uuid := auth.uid();
  sid uuid;
  v_command private.selection_commands%rowtype;
  v_agreement public.agreements%rowtype;
  v_request_hash text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  -- A still-unexpired JWT from a revoked/foreign session is no current authority.
  -- Use the existing server guard; missing or invalid session_id never falls back.
  BEGIN
    sid := (auth.jwt()->>'session_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END;
  IF NOT private.push_session_valid(u,sid) THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  -- Same current-account closure authority as the Agreement SELECT policy.
  -- The existing shared lock orders this read with account closure.
  PERFORM private.closure_assert_open(u);
  IF p_need_id IS NULL OR p_response_id IS NULL
     OR p_need_revision IS NULL OR p_need_revision<1
     OR p_response_version IS NULL OR p_response_version<1
     OR p_covered_slots IS NULL OR p_covered_slots NOT BETWEEN 1 AND 50
     OR p_content_hash IS NULL OR p_content_hash !~ '^[a-f0-9]{64}$'
     OR p_client_request_id IS NULL OR char_length(btrim(p_client_request_id)) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'SELECTION_COMMAND_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_command FROM private.selection_commands
    WHERE requester_account_id=u AND client_request_id=p_client_request_id;
  IF NOT FOUND THEN
    -- A snapshot with no committed receipt does not prove a prior request failed.
    -- No selection lock, writer or fallback from today's candidate is invoked.
    RETURN jsonb_build_object('schema','SELECTION_RESULT_V1','authoritative',true,'found',false,'result',null);
  END IF;
  -- Recompute the writer's hash from the caller's exact reviewed intent. Do not
  -- borrow today's task, application version or capacity to fill missing data.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId',u,'needId',p_need_id,'needRevision',p_need_revision,
    'responseId',p_response_id,'responseVersion',p_response_version,
    'contentHash',p_content_hash,'coveredSlots',p_covered_slots
  )::text,'UTF8')),'hex');
  IF v_command.request_hash IS DISTINCT FROM v_request_hash
     OR v_command.need_id IS DISTINCT FROM p_need_id
     OR v_command.need_revision IS DISTINCT FROM p_need_revision
     OR v_command.response_id IS DISTINCT FROM p_response_id
     OR v_command.response_version IS DISTINCT FROM p_response_version
     OR v_command.response_content_hash IS DISTINCT FROM p_content_hash
     OR v_command.covered_slots IS DISTINCT FROM p_covered_slots THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING errcode='22023';
  END IF;
  SELECT * INTO v_agreement FROM public.agreements a
    WHERE a.id=v_command.agreement_id AND a.requester_account_id=u
      AND a.selection_id=v_command.selection_id AND a.need_id=v_command.need_id
      AND a.selected_response_id=v_command.response_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELECTION_RESULT_UNAVAILABLE' USING errcode='42501';
  END IF;
  -- Blocking/partner closure preserve the caller's own cooperation history.
  -- This minimal receipt grants no messaging, contact, location or media access.
  -- A terminal Agreement is reported honestly, never as a newly active one.
  RETURN jsonb_build_object('schema','SELECTION_RESULT_V1','authoritative',true,'found',true,
    'result',jsonb_build_object(
      'agreementId',v_agreement.id,'agreementStatus',v_agreement.status,
      'needId',v_command.need_id,'needRevision',v_command.need_revision,
      'responseId',v_command.response_id,'responseVersion',v_command.response_version,
      'contentHash',v_command.response_content_hash,'coveredSlots',v_command.covered_slots,
      'clientRequestId',v_command.client_request_id));
END;
$function$;
$reader$;
  REVOKE ALL ON FUNCTION public.rpc_read_selection_result(uuid,integer,uuid,integer,text,text,integer)
    FROM PUBLIC,anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION public.rpc_read_selection_result(uuid,integer,uuid,integer,text,text,integer)
    TO authenticated,service_role;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_read_selection_result(uuid,integer,uuid,integer,text,text,integer)')
      AND pg_get_userbyid(p.proowner)='postgres' AND p.prosecdef AND p.provolatile='s'
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND has_function_privilege('service_role',p.oid,'EXECUTE')
      AND NOT EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0)
  ) OR (SELECT to_jsonb(p) FROM pg_proc p
      WHERE p.oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure)
      IS DISTINCT FROM prior_writer THEN
    RAISE EXCEPTION 'R07_SELECTION_RECOVERY_POSTCHECK_FAILED' USING errcode='55000';
  END IF;
END;
$r07_selection_recovery$;
