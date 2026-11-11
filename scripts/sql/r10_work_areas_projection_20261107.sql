-- R10 / F19: preserve workAreas in existing own-account and archive projections.
-- Candidate only until coordinator review. No policy approval, lifetime changes,
-- retention/erasure repinning, public RPC, active-profile edit, or activation.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog;
CREATE TEMP TABLE uskoci_r10_projection_guard(
  signature text PRIMARY KEY, body_md5 text NOT NULL, metadata jsonb NOT NULL
) ON COMMIT DROP;
DO $r10_preimage$
DECLARE captured record; actual_md5 text; actual_meta jsonb; full_meta jsonb;
BEGIN
  IF to_regprocedure('private.data_export_worker_areas_v5(jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'R10_PROJECTION_ADAPTER_ALREADY_EXISTS';
  END IF;
  FOR captured IN SELECT * FROM (VALUES
    ('private.validate_worker_areas_v1(jsonb)','8f1cd592eb48eb9da31e0af02c0bdd2e','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"plpgsql","parallel":"u","arguments":"areas jsonb","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.closure_taxonomy_project_v1(text,jsonb,uuid)','6877307e228608f6283eec166c98016a','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_scope_v1(text)','48a8c7d266e86586a457aa2d2fa51e45','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text","strict":false,"language":"plpgsql","parallel":"u","arguments":"r text","leakproof":false,"volatility":"i","security_definer":true}'::jsonb),
    ('private.data_export_worker_candidate_v5(jsonb)','aa9c5f1b7ab4711cda7cb16905de55a4','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"v jsonb","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)','55ba7bf41ce39d9c914929270b916570','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid, g uuid","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_redaction_relations_v5()','102e417ab6d52ab0eec421a8bda5c0c4','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text[]","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_inventory_v1()','16ed9d5077dd2662e4502a5040a83f80','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.closure_taxonomy_patch_v1(text,jsonb,uuid,uuid)','5c88c60b705d2d99c61da935536ec137','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid, g uuid","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_reset_sections_v1()','0b1c4a0b5884cdcf9c3b3db67e6bdc41','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.closure_taxonomy_semantic_v1(jsonb)','1d4c6fd6725c00cb2c65bccc091cecc9','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"plpgsql","parallel":"u","arguments":"v jsonb","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.data_export_array_v5(jsonb,text)','00933c589c16905b09318c080a2150f6','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"v jsonb, t text","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.data_export_dataset_catalog()','e08e712c811ab2a093e48ca75a436c25','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":true}'::jsonb),
    ('private.data_export_projection_sha_v5()','ffd64be69db4663dcb3e2d07713176cd','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.data_export_scalar_v5(jsonb,text)','e02fe0db0a56b90b74a29c2b81a38357','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"v jsonb, t text","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.data_export_snapshot(uuid,uuid,jsonb,timestamp with time zone)','c3bde16e2175c7ec33c1a171e0ad04a3','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text","strict":false,"language":"sql","parallel":"u","arguments":"p_account_id uuid, p_receipt_id uuid, p_binding jsonb, p_cutoff timestamp with time zone","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_export_catalog_v1()','6753530b240ef747d5a18f9e74ce6fb0','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_export_rows_v1(uuid)','2845351ac34bceeb346257dbc37a686c','{"acl":"{postgres=X/postgres}","cost":100,"rows":1000,"owner":"postgres","config":["search_path=pg_catalog"],"result":"TABLE(key text, value jsonb)","strict":false,"language":"plpgsql","parallel":"u","arguments":"a uuid","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_held_v1(text,jsonb,uuid)','6d9000e634489b43342297d73f6e8809','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"boolean","strict":false,"language":"plpgsql","parallel":"u","arguments":"r text, t jsonb, a uuid","leakproof":false,"volatility":"s","security_definer":true}'::jsonb),
    ('private.closure_taxonomy_semantic_keys_v1()','079dfd89aec66efbf2513cf8cad4eda9','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"text[]","strict":false,"language":"sql","parallel":"u","arguments":"","leakproof":false,"volatility":"i","security_definer":false}'::jsonb),
    ('private.data_export_task_facts_v5(jsonb)','b1552206df3434002e6d294befbca5b6','{"acl":"{postgres=X/postgres}","cost":100,"rows":0,"owner":"postgres","config":["search_path=pg_catalog"],"result":"jsonb","strict":false,"language":"sql","parallel":"u","arguments":"v jsonb","leakproof":false,"volatility":"i","security_definer":false}'::jsonb)
  ) AS expected(signature,body_md5,metadata) LOOP
    SELECT md5(p.prosrc),jsonb_build_object('owner',p.proowner::regrole::text,'language',l.lanname,
        'security_definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,
        'parallel',p.proparallel,'leakproof',p.proleakproof,'cost',p.procost,'rows',p.prorows,
        'config',p.proconfig,'acl',p.proacl::text,'result',pg_get_function_result(p.oid),
        'arguments',pg_get_function_arguments(p.oid)),to_jsonb(p)-'prosrc'
      INTO actual_md5,actual_meta,full_meta FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=to_regprocedure(captured.signature);
    IF actual_md5 IS DISTINCT FROM captured.body_md5 THEN
      RAISE EXCEPTION 'R10_PROJECTION_PREIMAGE_MISMATCH:%',captured.signature;
    END IF;
    IF actual_meta IS DISTINCT FROM captured.metadata THEN
      RAISE EXCEPTION 'R10_PROJECTION_METADATA_MISMATCH:%',captured.signature;
    END IF;
    INSERT INTO pg_temp.uskoci_r10_projection_guard VALUES(captured.signature,actual_md5,full_meta);
  END LOOP;
END $r10_preimage$;

CREATE FUNCTION private.data_export_worker_areas_v5(v jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path=pg_catalog
AS $r10_areas$
DECLARE item jsonb; area jsonb; result jsonb:='[]'::jsonb;
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN RETURN result; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN CONTINUE; END IF;
    SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO area
      FROM jsonb_each(item)
      WHERE key=ANY(ARRAY['kind','countryCode','label','city','sourceRef','latitude','longitude','radiusKm']);
    BEGIN
      PERFORM private.validate_worker_areas_v1(jsonb_build_array(area));
    EXCEPTION WHEN invalid_parameter_value THEN
      -- Export follows the existing tolerant projection contract: omit only
      -- this invalid entry; do not repair its facts or reject the whole account.
      CONTINUE;
    END;
    result:=result||jsonb_build_array(area);
  END LOOP;
  -- This projects historical entries. It neither edits nor validates a new
  -- active profile set, so order and repeated valid entries remain unchanged.
  RETURN result;
END $r10_areas$;
REVOKE ALL ON FUNCTION private.data_export_worker_areas_v5(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.data_export_worker_candidate_v5(v jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$ select jsonb_build_object('displayName',private.data_export_scalar_v5(v->'displayName','string'),'bio',private.data_export_scalar_v5(v->'bio','string'),'skills',private.data_export_array_v5(v->'skills','string'),'tools',private.data_export_array_v5(v->'tools','string'),'licenses',private.data_export_array_v5(v->'licenses','string'),'vehicles',private.data_export_array_v5(v->'vehicles','string'),'teamCapacity',private.data_export_scalar_v5(v->'teamCapacity','number'),'workAreas',private.data_export_worker_areas_v5(v->'workAreas'),'location',jsonb_build_object('operatingCountryCode',private.data_export_scalar_v5(v#>'{location,operatingCountryCode}','string'),'city',private.data_export_scalar_v5(v#>'{location,city}','string'),'radiusKm',private.data_export_scalar_v5(v#>'{location,radiusKm}','number'),'approximatePosition',jsonb_build_object('latitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,latitude}','number'),'longitude',private.data_export_scalar_v5(v#>'{location,approximatePosition,longitude}','number'))),'availability',jsonb_build_object('timezone',private.data_export_scalar_v5(v#>'{availability,timezone}','string'),'availableNow',private.data_export_scalar_v5(v#>'{availability,availableNow}','boolean'),'rules',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startTime',private.data_export_scalar_v5(x->'startTime','string'),'endTime',private.data_export_scalar_v5(x->'endTime','string'),'startsOn',private.data_export_scalar_v5(x->'startsOn','string'),'endsOn',private.data_export_scalar_v5(x->'endsOn','string'),'label',private.data_export_scalar_v5(x->'label','string'),'active',private.data_export_scalar_v5(x->'active','boolean'),'weekdays',private.data_export_array_v5(x->'weekdays','number')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,rules}')='array' then v#>'{availability,rules}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb),'windows',coalesce((select jsonb_agg(jsonb_build_object('id',private.data_export_scalar_v5(x->'id','string'),'startsAt',private.data_export_scalar_v5(x->'startsAt','string'),'endsAt',private.data_export_scalar_v5(x->'endsAt','string'),'state',private.data_export_scalar_v5(x->'state','string'),'label',private.data_export_scalar_v5(x->'label','string')) order by ordinal) from jsonb_array_elements(case when jsonb_typeof(v#>'{availability,windows}')='array' then v#>'{availability,windows}' else '[]'::jsonb end) with ordinality as a(x,ordinal) where jsonb_typeof(x)='object'),'[]'::jsonb))) $function$;

CREATE OR REPLACE FUNCTION private.data_export_projection_sha_v5()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$ select encode(extensions.digest(convert_to(string_agg(signature||':'||md5(replace(p.prosrc,E'\r\n',E'\n')),E'\n' order by signature),'UTF8'),'sha256'),'hex') from unnest(array['private.data_export_dataset_catalog()','private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)','private.data_export_scalar_v5(jsonb,text)','private.data_export_array_v5(jsonb,text)','private.data_export_worker_candidate_v5(jsonb)','private.data_export_worker_areas_v5(jsonb)','private.validate_worker_areas_v1(jsonb)','private.data_export_task_facts_v5(jsonb)','private.closure_taxonomy_inventory_v1()','private.closure_taxonomy_semantic_keys_v1()','private.closure_taxonomy_reset_sections_v1()','private.closure_taxonomy_scope_v1(text)','private.closure_taxonomy_semantic_v1(jsonb)','private.closure_taxonomy_project_v1(text,jsonb,uuid)','private.closure_taxonomy_export_rows_v1(uuid)','private.closure_taxonomy_export_catalog_v1()']) signature join pg_proc p on p.oid=to_regprocedure(signature) having count(*)=16 $function$;

-- Every existing dependency must retain all pg_proc metadata. Only the two
-- explicitly reviewed function bodies may change; their exact postimages are pinned.
DO $r10_postimage$
DECLARE captured record; expected_body text; actual_body text; actual_meta jsonb;
BEGIN
  FOR captured IN SELECT * FROM pg_temp.uskoci_r10_projection_guard LOOP
    expected_body:=CASE captured.signature
      WHEN 'private.data_export_worker_candidate_v5(jsonb)' THEN 'c54d2b639082356d06609317be8226f0'
      WHEN 'private.data_export_projection_sha_v5()' THEN '39faec2ad11eadd6f1184cb4e560d61d'
      ELSE captured.body_md5 END;
    SELECT md5(prosrc),to_jsonb(p)-'prosrc' INTO actual_body,actual_meta
      FROM pg_proc p WHERE p.oid=to_regprocedure(captured.signature);
    IF actual_body IS DISTINCT FROM expected_body THEN
      RAISE EXCEPTION 'R10_PROJECTION_POSTIMAGE_MISMATCH:%',captured.signature;
    END IF;
    IF actual_meta IS DISTINCT FROM captured.metadata THEN
      RAISE EXCEPTION 'R10_PROJECTION_DEPENDENCY_METADATA_CHANGED:%',captured.signature;
    END IF;
  END LOOP;
  IF (SELECT md5(prosrc) FROM pg_proc
      WHERE oid='private.data_export_worker_areas_v5(jsonb)'::regprocedure) IS DISTINCT FROM '052eea0037026beb43c653bc248af2ad' THEN
    RAISE EXCEPTION 'R10_PROJECTION_ADAPTER_POSTIMAGE_MISMATCH';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid='private.data_export_worker_areas_v5(jsonb)'::regprocedure
      AND p.proowner='postgres'::regrole AND l.lanname='plpgsql' AND NOT p.prosecdef
      AND NOT p.proisstrict AND p.provolatile='i' AND p.proparallel='u' AND NOT p.proleakproof
      AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
      AND p.proacl::text='{postgres=X/postgres}' AND p.procost=100 AND p.prorows=0
      AND pg_get_function_result(p.oid)='jsonb' AND pg_get_function_arguments(p.oid)='v jsonb') THEN
    RAISE EXCEPTION 'R10_PROJECTION_ADAPTER_AUTHORITY_MISMATCH';
  END IF;
  IF private.data_export_projection_sha_v5() IS NULL THEN
    RAISE EXCEPTION 'R10_PROJECTION_DEPENDENCY_ROSTER_INCOMPLETE';
  END IF;
END $r10_postimage$;
COMMIT;
