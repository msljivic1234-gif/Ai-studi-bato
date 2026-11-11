-- R01 forward SOURCE candidate; reviewed target: leqcwgzvjsxugfgzdmth (DEV).
-- Table-level SELECT currently bypasses the existing public column projection.
-- Remove only direct access to the internal close reason and close actor.
-- No row, function, signature, RLS policy, non-SELECT grant or historical migration changes.
-- Adjacent preimage captures the live ACL, all columns, policies and reader boundaries.
-- Existing app RPCs use explicit projections; computed fields receive only an ID.
-- Their whole-row read is behind the existing SECURITY DEFINER owner, not caller SELECT.
-- Auth/PostgREST probes remain required on explicitly owned TEST fixtures after any reviewed apply.
DO $r01_needs_projection$
DECLARE
 expected_relation jsonb := '{"acl":"{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"kind":"r","owner":"postgres","forceRls":false}'::jsonb;
 expected_columns jsonb := '[{"name":"id","position":1,"type":"uuid","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"requester_account_id","position":2,"type":"uuid","acl":null,"generated":"","notNull":true},{"name":"requester_profile_id","position":3,"type":"uuid","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"status","position":4,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"title","position":5,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"description","position":6,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"category","position":7,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"approximate_city","position":8,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"approximate_area","position":9,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"approximate_lat","position":10,"type":"numeric(6,2)","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"approximate_lng","position":11,"type":"numeric(7,2)","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"schedule_kind","position":12,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"starts_at","position":13,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"ends_at","position":14,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"required_slots","position":15,"type":"integer","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"mode","position":16,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"requester_price_rsd","position":17,"type":"integer","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"required_skills","position":18,"type":"text[]","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"required_tools","position":19,"type":"text[]","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"required_vehicles","position":20,"type":"text[]","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"verified_identity_required","position":21,"type":"boolean","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"urgent","position":22,"type":"boolean","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"public_photo_paths","position":23,"type":"text[]","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"revision","position":24,"type":"integer","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"published_at","position":25,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"created_at","position":26,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"updated_at","position":27,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"response_deadline","position":28,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"urgent_activated_at","position":29,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"urgent_expires_at","position":30,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"urgent_policy_version","position":31,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"minimum_experience_years","position":32,"type":"integer","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"execution_location_mode","position":33,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"approx_geog","position":35,"type":"geography","acl":"{authenticated=r/postgres}","generated":"s","notNull":false},{"name":"required_licenses","position":36,"type":"text[]","acl":"{authenticated=r/postgres}","generated":"","notNull":true},{"name":"remaining_search_closed_at","position":37,"type":"timestamp with time zone","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"remaining_search_closed_by_account_id","position":38,"type":"uuid","acl":null,"generated":"","notNull":false},{"name":"remaining_search_close_reason","position":39,"type":"text","acl":null,"generated":"","notNull":false},{"name":"task_country_code","position":40,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"task_timezone","position":41,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"price_basis","position":42,"type":"text","acl":"{authenticated=r/postgres}","generated":"","notNull":false},{"name":"category_id","position":43,"type":"uuid","acl":null,"generated":"","notNull":false}]'::jsonb;
 expected_policies jsonb := '[{"cmd":"INSERT","name":"needs_owner_insert","qual":null,"check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = ''DRAFT''::text))","roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_owner_select","qual":"(requester_account_id = ( SELECT auth.uid() AS uid))","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"UPDATE","name":"needs_owner_update","qual":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = ''DRAFT''::text))","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = ''DRAFT''::text))","roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_participant_read","qual":"rls_private.need_participant_can_read(id)","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_public_discovery","qual":"((status = ANY (ARRAY[''PUBLISHED''::text, ''SELECTION''::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"v5_closed_account_visibility","qual":"( SELECT rpc_storage_account_open() AS rpc_storage_account_open)","check":null,"roles":["authenticated"],"permissive":"RESTRICTIVE"}]'::jsonb;
 expected_functions jsonb := '[{"signature":"public.fn_need_urgency(uuid)","body_md5":"8845c7ad50ab5e64aa853043c113a15a","owner":"postgres","definer":false,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"public.rpc_discovery_v1(jsonb)","body_md5":"a5ce63c8874fbd3550730dd46d4044d7","owner":"postgres","definer":false,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)","body_md5":"7c1d9a979585deae6c2bc2c1b9d597b1","owner":"postgres","definer":false,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"public.rpc_read_task(uuid)","body_md5":"1e01db5140248f27ab374187f01fded3","owner":"postgres","definer":false,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"},{"signature":"public.rpc_resolve_activity_event(uuid)","body_md5":"e5dc05773da08471db572194caf467e2","owner":"postgres","definer":false,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"public.covered_slots(public.needs)","body_md5":"ac09f84c85ff8ae237c8db463a43d547","owner":"postgres","definer":true,"config":["search_path=public, pg_temp"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"},{"signature":"public.selectable_application_count(public.needs)","body_md5":"fe53442f8b661d6f33d22a54e2a468a8","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"rls_private.need_participant_can_read(uuid)","body_md5":"c23e2bbab829ad716435e56862a495b6","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.rpc_list_my_tasks()","body_md5":"2a8ff0fa8a1211414e5e1fc69c6fb4f7","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"},{"signature":"public.rpc_storage_account_open()","body_md5":"7350621ef256678e209aa6a28c79b58b","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}"},{"signature":"rls_private.p6_discovery_test_world_accounts()","body_md5":"6193869dd532dbe5d2723c078940d10e","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,authenticated=X/postgres}"},{"signature":"public.is_my_task(uuid)","body_md5":"42b6802d2f3114d1e211025c4c475e55","owner":"postgres","definer":true,"config":["search_path=pg_catalog"],"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}"}]'::jsonb;
 observed jsonb;
 prior_nonselect jsonb;
 after_nonselect jsonb;
 prior_columns_without_acl jsonb;
 prior_function_metadata jsonb;
 fn jsonb;
 old_search_path text := current_setting('search_path');
 expected_invokers oid[];
BEGIN
 -- Fixed deparse path gives schema/ACL guards the same spelling on preflight/readback.
 PERFORM set_config('search_path','public, extensions, pg_catalog',true);
 LOCK TABLE public.needs IN SHARE ROW EXCLUSIVE MODE;
 SELECT jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
   'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl::text)
 INTO observed FROM pg_catalog.pg_class c WHERE c.oid='public.needs'::regclass;
 IF observed IS DISTINCT FROM expected_relation THEN
   RAISE EXCEPTION 'R01_NEEDS_RELATION_ACL_DRIFT' USING errcode='55000';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('position',a.attnum,'name',a.attname,
   'type',CASE WHEN a.attname='approx_geog' THEN t.typname ELSE format_type(a.atttypid,a.atttypmod) END,
   'acl',a.attacl::text,'generated',a.attgenerated,'notNull',a.attnotnull) ORDER BY a.attnum)
 INTO observed FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
 WHERE a.attrelid='public.needs'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF observed IS DISTINCT FROM expected_columns THEN
   RAISE EXCEPTION 'R01_NEEDS_COLUMN_DRIFT' USING errcode='55000';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('name',policyname,'permissive',permissive,
   'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) ORDER BY policyname)
 INTO observed FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='needs';
 IF observed IS DISTINCT FROM expected_policies THEN
   RAISE EXCEPTION 'R01_NEEDS_POLICY_DRIFT' USING errcode='55000';
 END IF;
 SELECT jsonb_agg(to_jsonb(a)-'attacl' ORDER BY a.attnum) INTO prior_columns_without_acl
 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.needs'::regclass;
 SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)) INTO prior_function_metadata
 FROM jsonb_array_elements(expected_functions) e JOIN pg_catalog.pg_proc p
   ON p.oid=to_regprocedure(e->>'signature');
 FOR fn IN SELECT value FROM jsonb_array_elements(expected_functions) LOOP
   SELECT jsonb_build_object('signature',fn->>'signature','body_md5',md5(p.prosrc),
     'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text)
   INTO observed FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(fn->>'signature');
   IF observed IS DISTINCT FROM fn THEN
     RAISE EXCEPTION 'R01_NEEDS_READER_DRIFT' USING errcode='55000';
   END IF;
 END LOOP;
 SELECT array_agg(to_regprocedure(value->>'signature')::oid) INTO expected_invokers
 FROM jsonb_array_elements(expected_functions) WHERE value->'definer'='false'::jsonb;
 -- No newly introduced invoker/whole-row/dynamic or view dependency may be
 -- silently broken or bypass this projection. A new consumer requires review.
 IF EXISTS (
   SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN('public','rls_private') AND p.prokind='f' AND NOT p.prosecdef
     AND (p.prosrc ~ '\mneeds\M' OR 'public.needs'::regtype=ANY(p.proargtypes)
       OR 'public.needs[]'::regtype=ANY(p.proargtypes) OR p.prosrc ~* '\mexecute\M')
     AND NOT p.oid=ANY(expected_invokers))
 OR EXISTS (
   SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE p.prokind='f' AND p.prorettype IN('public.needs'::regtype,'public.needs[]'::regtype)
     AND has_schema_privilege('authenticated',n.oid,'USAGE')
     AND has_function_privilege('authenticated',p.oid,'EXECUTE'))
 OR EXISTS (
   SELECT 1 FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_rewrite r
     ON d.classid='pg_rewrite'::regclass AND r.oid=d.objid
   JOIN pg_catalog.pg_class v ON v.oid=r.ev_class
   WHERE d.refobjid='public.needs'::regclass AND v.relkind IN('v','m'))
 THEN RAISE EXCEPTION 'R01_NEEDS_DEPENDENCY_DRIFT' USING errcode='55000'; END IF;

 SELECT jsonb_agg(jsonb_build_object('grantor',x.grantor,'grantee',x.grantee,
   'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantor,x.grantee,x.privilege_type)
 INTO prior_nonselect FROM pg_catalog.pg_class c, LATERAL aclexplode(c.relacl) x
 WHERE c.oid='public.needs'::regclass
   AND NOT (x.grantee='authenticated'::regrole AND x.privilege_type='SELECT');

 REVOKE SELECT ON TABLE public.needs FROM authenticated;
 GRANT SELECT (
   id, requester_account_id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, approximate_lat, approximate_lng, schedule_kind, starts_at, ends_at, required_slots, mode, requester_price_rsd, required_skills, required_tools, required_vehicles, verified_identity_required, urgent, public_photo_paths, revision, published_at, created_at, updated_at, response_deadline, urgent_activated_at, urgent_expires_at, urgent_policy_version, minimum_experience_years, execution_location_mode, approx_geog, required_licenses, remaining_search_closed_at, task_country_code, task_timezone, price_basis, category_id
 ) ON TABLE public.needs TO authenticated;

 IF has_table_privilege('authenticated','public.needs','SELECT')
 OR has_column_privilege('authenticated','public.needs','remaining_search_close_reason','SELECT')
 OR has_column_privilege('authenticated','public.needs','remaining_search_closed_by_account_id','SELECT')
 OR EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid='public.needs'::regclass
   AND a.attnum>0 AND NOT a.attisdropped AND (
     has_column_privilege('anon','public.needs',a.attname,'SELECT')
     OR NOT has_column_privilege('service_role','public.needs',a.attname,'SELECT')
     OR a.attname NOT IN('remaining_search_close_reason','remaining_search_closed_by_account_id')
       AND NOT has_column_privilege('authenticated','public.needs',a.attname,'SELECT')))
 THEN RAISE EXCEPTION 'R01_NEEDS_PROJECTION_POSTCHECK_FAILED' USING errcode='55000'; END IF;

 SELECT jsonb_agg(jsonb_build_object('grantor',x.grantor,'grantee',x.grantee,
   'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantor,x.grantee,x.privilege_type)
 INTO after_nonselect FROM pg_catalog.pg_class c, LATERAL aclexplode(c.relacl) x
 WHERE c.oid='public.needs'::regclass
   AND NOT (x.grantee='authenticated'::regrole AND x.privilege_type='SELECT');
 IF after_nonselect IS DISTINCT FROM prior_nonselect
 OR (SELECT jsonb_agg(to_jsonb(a)-'attacl' ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
     WHERE a.attrelid='public.needs'::regclass) IS DISTINCT FROM prior_columns_without_acl
 OR (SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)) FROM jsonb_array_elements(expected_functions) e
     JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(e->>'signature')) IS DISTINCT FROM prior_function_metadata
 THEN RAISE EXCEPTION 'R01_NEEDS_UNRELATED_METADATA_CHANGED' USING errcode='55000'; END IF;
 SELECT jsonb_agg(jsonb_build_object('name',policyname,'permissive',permissive,
   'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) ORDER BY policyname)
 INTO observed FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='needs';
 IF observed IS DISTINCT FROM expected_policies
 OR (SELECT jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
     'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) FROM pg_catalog.pg_class c
     WHERE c.oid='public.needs'::regclass) IS DISTINCT FROM expected_relation-'acl'
 THEN RAISE EXCEPTION 'R01_NEEDS_POLICY_POSTCHECK_FAILED' USING errcode='55000'; END IF;
 PERFORM set_config('search_path',old_search_path,true);
END;
$r01_needs_projection$;
