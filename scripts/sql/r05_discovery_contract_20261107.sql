-- R05 forward repair for canonical DEV leqcwgzvjsxugfgzdmth.
-- Restores the existing PAGE/MAP/PLACES/EXACT_PUBLIC wire contract and optional
-- ForMe/stated-budget filters. No data, grants, RLS, helper or matcher changes.
-- Historic reader source: a3623973450130fcf0e770f9ed28f315f366d5b2,
-- supabase/candidates/discovery-min-price-20261020/before.sql (body a9b09859...).
-- This is a NEW adapted migration, never a claim of historical byte equivalence.
-- A complete current body/metadata/projection preimage is checked atomically.
DO $r05_discovery$
DECLARE
 expected_functions jsonb := $r05_functions$[{"signature":"private.effective_radius_km(integer)","body_md5":"ed003276f5aa5d3cfd9c655330a3415f","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"private.worker_need_fit_v1(uuid,uuid,boolean)","body_md5":"fd81bdd1a86946a43399e136d5534e99","definer":true,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"private.worker_need_match_v1(uuid,uuid)","body_md5":"ef94ef7de07a347824ace68789f08c41","definer":true,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"private.worker_need_time_tier_v1(uuid,uuid)","body_md5":"a845d98b624ae4ac8ec33159beb8bb17","definer":true,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.discovery_fold_v1(text)","body_md5":"41353abe05d434d513495ae5974b9802","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.discovery_for_me_state_v1()","body_md5":"bd4dcf16863e7564a5d82ac22aca1418","definer":true,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.discovery_for_me_v1(uuid)","body_md5":"60c104139cebbccfa16a570fc3386c0c","definer":true,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_area(text,text,boolean)","body_md5":"65f41c2ec10d1bb926f34ecf04b36ec4","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_civil(text)","body_md5":"cee687f43419dfb2fa9cc9233e8bea34","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_days(text,timestamp with time zone,timestamp with time zone,text,timestamp with time zone)","body_md5":"e1c81ce573875504d60e025c07573ee6","definer":false,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_key(text)","body_md5":"ebfe1252f1798d89bbffb35b6eef6167","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_trim(text)","body_md5":"40109e93b620146aa8d536907d28c91b","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.p6_discovery_unquote(text)","body_md5":"d9ab01e57fb2f667ee865f69aa246741","definer":false,"volatility":"i","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]},{"signature":"public.rpc_discovery_v1(jsonb)","body_md5":"a5ce63c8874fbd3550730dd46d4044d7","definer":false,"volatility":"s","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"]}]$r05_functions$::jsonb;
 expected_needs jsonb := $r05_needs${"columns":[{"acl":"{authenticated=r/postgres}","name":"id","type":"uuid","position":1,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"requester_account_id","type":"uuid","position":2,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"requester_profile_id","type":"uuid","position":3,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"status","type":"text","position":4,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"title","type":"text","position":5,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"description","type":"text","position":6,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"category","type":"text","position":7,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"approximate_city","type":"text","position":8,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"approximate_area","type":"text","position":9,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"approximate_lat","type":"numeric(6,2)","position":10,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"approximate_lng","type":"numeric(7,2)","position":11,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"schedule_kind","type":"text","position":12,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"starts_at","type":"timestamp with time zone","position":13,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"ends_at","type":"timestamp with time zone","position":14,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"required_slots","type":"integer","position":15,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"mode","type":"text","position":16,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"requester_price_rsd","type":"integer","position":17,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"required_skills","type":"text[]","position":18,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"required_tools","type":"text[]","position":19,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"required_vehicles","type":"text[]","position":20,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"verified_identity_required","type":"boolean","position":21,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"urgent","type":"boolean","position":22,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"public_photo_paths","type":"text[]","position":23,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"revision","type":"integer","position":24,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"published_at","type":"timestamp with time zone","position":25,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"created_at","type":"timestamp with time zone","position":26,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"updated_at","type":"timestamp with time zone","position":27,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"response_deadline","type":"timestamp with time zone","position":28,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"urgent_activated_at","type":"timestamp with time zone","position":29,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"urgent_expires_at","type":"timestamp with time zone","position":30,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"urgent_policy_version","type":"text","position":31,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"minimum_experience_years","type":"integer","position":32,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"execution_location_mode","type":"text","position":33,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"approx_geog","type":"geography","position":35,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"required_licenses","type":"text[]","position":36,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"remaining_search_closed_at","type":"timestamp with time zone","position":37,"readAuthenticated":true},{"acl":null,"name":"remaining_search_closed_by_account_id","type":"uuid","position":38,"readAuthenticated":false},{"acl":null,"name":"remaining_search_close_reason","type":"text","position":39,"readAuthenticated":false},{"acl":"{authenticated=r/postgres}","name":"task_country_code","type":"text","position":40,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"task_timezone","type":"text","position":41,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"price_basis","type":"text","position":42,"readAuthenticated":true},{"acl":"{authenticated=r/postgres}","name":"category_id","type":"uuid","position":43,"readAuthenticated":true}],"policies":[{"cmd":"INSERT","name":"needs_owner_insert","qual":null,"check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_owner_select","qual":"(requester_account_id = ( SELECT auth.uid() AS uid))","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"UPDATE","name":"needs_owner_update","qual":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","check":"((requester_account_id = ( SELECT auth.uid() AS uid)) AND (status = 'DRAFT'::text))","roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_participant_read","qual":"rls_private.need_participant_can_read(id)","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"needs_public_discovery","qual":"((status = ANY (ARRAY['PUBLISHED'::text, 'SELECTION'::text])) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((requester_account_id = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[]))) = (( SELECT auth.uid() AS uid) = ANY (COALESCE(( SELECT rls_private.p6_discovery_test_world_accounts() AS p6_discovery_test_world_accounts), ARRAY[]::uuid[])))))","check":null,"roles":["authenticated"],"permissive":"PERMISSIVE"},{"cmd":"SELECT","name":"v5_closed_account_visibility","qual":"( SELECT rpc_storage_account_open() AS rpc_storage_account_open)","check":null,"roles":["authenticated"],"permissive":"RESTRICTIVE"}],"relation":{"acl":"{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=awDxtm/postgres,service_role=arwdDxtm/postgres}","rls":true,"owner":"postgres","forceRls":false}}$r05_needs$::jsonb;
 new_body text := $r05_body$
declare
 r jsonb:=p_request; f jsonb; a jsonb; scope jsonb; cursor_doc jsonb; result jsonb;
 min_budget_rsd integer;
 query_text text; locality text; price text; location_mode text; when_mode text; scope_mode text; request_mode text;
 filter_key text; scope_key text; need_id uuid; people integer; page_limit integer; for_me boolean:=false; for_me_doc jsonb;
 now_at timestamptz:=statement_timestamp(); time_at timestamptz; through_at timestamptz; expires_at timestamptz;
 before_at timestamptz; before_id uuid; before_section integer;
 west numeric; south numeric; east numeric; north numeric; point_lat numeric; point_lng numeric;
 grid integer; grid_cells numeric; grid_w numeric; grid_e numeric; grid_s numeric; grid_n numeric; grid_width numeric;
 prefix_text text; facet_area jsonb; before_count bigint; before_text text; before_key text;
 fold_text text; fold_place text; fold_prefix text; place_level text:='AREA';
 range_from text; range_to text; iso_pattern text:='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$';
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
 request_mode:=r->>'mode';
 if request_mode='EXACT_PUBLIC' then
  if r-array['mode','needId']<>'{}' or not(r?&array['mode','needId']) or jsonb_typeof(r->'needId')<>'string'
    or r->>'needId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  need_id:=(r->>'needId')::uuid; time_at:=now_at; through_at:=now_at; page_limit:=1;
  f:='{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null}';
  scope:='{"kind":"ALL"}';
 elsif request_mode='PAGE' then
  if r-array['mode','filter','anchor','scope','limit','after']<>'{}' or not(r?&array['mode','filter','anchor','scope','limit','after'])
    or jsonb_typeof(r->'limit')<>'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 100 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  page_limit:=(r->>'limit')::integer; f:=r->'filter'; scope:=r->'scope';
 elsif request_mode='MAP' then
  if r-array['mode','filter','anchor','bounds','grid']<>'{}' or not(r?&array['mode','filter','anchor','bounds','grid'])
    or jsonb_typeof(r->'grid') is distinct from 'number' or (r->>'grid')::numeric<>trunc((r->>'grid')::numeric)
    or (r->>'grid')::numeric not between 1 and 24 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  grid:=(r->>'grid')::integer; f:=r->'filter'; scope:=jsonb_build_object('kind','AREA','bounds',r->'bounds'); page_limit:=1;
 elsif request_mode='PLACES' then
  if r-array['mode','filter','anchor','prefix','facetArea','limit','after','groupBy']<>'{}'
    or not(r?&array['mode','filter','anchor','prefix','facetArea','limit','after'])
    or (r?'groupBy' and (jsonb_typeof(r->'groupBy') is distinct from 'string' or r->>'groupBy' not in ('AREA','CITY')))
    or jsonb_typeof(r->'prefix') is distinct from 'string' or length(r->>'prefix')>500
    or jsonb_typeof(r->'limit') is distinct from 'number' or (r->>'limit')::numeric<>trunc((r->>'limit')::numeric)
    or (r->>'limit')::numeric not between 1 and 30 then raise exception 'P6_INVALID_REQUEST' using errcode='22023'; end if;
  prefix_text:=public.p6_discovery_key(r->>'prefix'); f:=r->'filter'; page_limit:=(r->>'limit')::integer;
  -- DISCOVERY-GRAD (owner 2026-10-07): the optional groupBy CITY lists cities instead of place texts; absent or AREA is the list of before.
  place_level:=coalesce(r->>'groupBy','AREA'); fold_prefix:=public.discovery_fold_v1(prefix_text);
  facet_area:=r->'facetArea';
  scope:=case when facet_area='null'::jsonb then '{"kind":"ALL"}'::jsonb else jsonb_build_object('kind','AREA','bounds',facet_area) end;
 else raise exception 'P6_MODE_NOT_IMPLEMENTED' using errcode='22023'; end if;
 if jsonb_typeof(f) is distinct from 'object' or f-array['text','price','where','places','when','dates','place','forMe','minBudgetRsd']<>'{}'
   or not(f?&array['text','price','where','places','when','dates','place'])
   or (f?'forMe' and jsonb_typeof(f->'forMe') is distinct from 'boolean')
   or jsonb_typeof(f->'text')<>'string' or octet_length(f->>'text')>16000
   or coalesce(f->>'price','') not in ('all','MY_PRICE','OFFERS') or coalesce(f->>'where','') not in ('any','onsite','remote')
   or coalesce(f->>'when','') not in ('any','today','tomorrow','week','weekend','next7')
   or jsonb_typeof(f->'places')<>'number' or (f->>'places')::numeric<>trunc((f->>'places')::numeric)
   or (f->>'places')::numeric not between 1 and 10 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
 -- R05: an optional minimum filters the STATED RSD number; it never divides
 -- by people or converts TOTAL/PER_PERSON/HOURLY. OFFERS remain in all mode.
 if f?'minBudgetRsd' then
  if jsonb_typeof(f->'minBudgetRsd') is distinct from 'number' or f->>'price' not in ('all','MY_PRICE')
  then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  if (f->>'minBudgetRsd')::numeric<>trunc((f->>'minBudgetRsd')::numeric)
    or (f->>'minBudgetRsd')::numeric not between 1 and 2147483647
  then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  min_budget_rsd:=(f->>'minBudgetRsd')::integer;
 end if;
 -- DISCOVERY-ZAMENE (owner 2026-10-07): the optional "forMe" key narrows PAGE, MAP, PLACES and their counts to the
 -- caller's "Odgovara mi" (private.worker_need_match_v1: kind of work + area + time), the same rule as the
 -- notifications. Absent or false keeps the request, its filterKey and the response exactly as before.
 for_me:=coalesce((f->>'forMe')::boolean,false);
 if for_me then
  for_me_doc:=public.discovery_for_me_state_v1();
  if for_me_doc->>'state' is distinct from 'ACTIVE' then
   raise exception 'P6_FOR_ME_PROFILE_REQUIRED' using errcode='22023',detail=coalesce(for_me_doc->>'state','MISSING');
  end if;
  -- R05: the existing matcher owns saved work areas, remote handoff and time.
  -- A legacy profile-circle prefilter would discard valid distant saved areas.
 end if;
 query_text:=lower(public.p6_discovery_trim(f->>'text') collate pg_catalog."sr-Latn-RS-x-icu");
 price:=f->>'price'; location_mode:=f->>'where'; people:=(f->>'places')::integer; when_mode:=f->>'when';
 if f->'dates'<>'null'::jsonb then
  if jsonb_typeof(f->'dates')<>'object' or (f->'dates')-array['from','to']<>'{}'
    or not public.p6_discovery_civil(f#>>'{dates,from}') or not public.p6_discovery_civil(f#>>'{dates,to}')
    or f#>>'{dates,from}'>f#>>'{dates,to}' then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  range_from:=f#>>'{dates,from}'; range_to:=f#>>'{dates,to}'; when_mode:='any';
 end if;
 if f->'place'<>'null'::jsonb then
  if jsonb_typeof(f->'place')<>'string' or octet_length(f->>'place')>16000 then raise exception 'P6_INVALID_FILTER' using errcode='22023'; end if;
  locality:=nullif(public.p6_discovery_key(f->>'place'),'');
 end if;
 if request_mode='PLACES' then query_text:=''; locality:=null; end if;
 if location_mode='remote' then
  locality:=null;
  if request_mode<>'MAP' then scope:='{"kind":"ALL"}'; facet_area:='null'::jsonb; end if;
 end if;
 -- DISCOVERY-GRAD (owner 2026-10-07): words and places are FOUND through discovery_fold_v1 (Serbian letters and case do not
 -- matter); what the request binds (filterKey, anchors, cursors) and every text that is shown stay exactly as before.
 fold_text:=public.discovery_fold_v1(query_text); fold_place:=public.discovery_fold_v1(locality);
 f:=jsonb_build_object('text',query_text,'price',price,'where',location_mode,'places',people,'when',when_mode,
   'dates',case when range_from is null then null else jsonb_build_object('from',range_from,'to',range_to) end,'place',locality);
 if for_me then f:=f||jsonb_build_object('forMe',true,'forMeAccountId',auth.uid()); end if;
 if min_budget_rsd is not null then f:=f||jsonb_build_object('minBudgetRsd',min_budget_rsd); end if;
 -- PLACES binds its prefix/area too; the documented count/text/key cursor
 -- cannot be reused under another facet context without a fresh anchor.
 filter_key:=md5(case when request_mode='PLACES' then (jsonb_build_object('filter',f,'prefix',prefix_text,'facetArea',facet_area)
   ||case when place_level='CITY' then '{"groupBy":"CITY"}'::jsonb else '{}'::jsonb end)::text else f::text end);
 if request_mode in ('PAGE','MAP','PLACES') then
  if r->'anchor'='null'::jsonb then
   if request_mode<>'MAP' and r->'after'<>'null'::jsonb then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
   time_at:=now_at; through_at:=now_at; expires_at:=now_at+interval '30 minutes';
  else
   a:=r->'anchor';
   if jsonb_typeof(a)<>'object' or a-array['version','filterKey','timeAt','publishedThrough','expiresAt']<>'{}'
     or not(a?&array['version','filterKey','timeAt','publishedThrough','expiresAt'])
     or a->>'version' is distinct from 'DISCOVERY_V1' or a->>'filterKey' is distinct from filter_key
     or coalesce(a->>'timeAt','')!~iso_pattern or coalesce(a->>'publishedThrough','')!~iso_pattern or coalesce(a->>'expiresAt','')!~iso_pattern
     then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   time_at:=(a->>'timeAt')::timestamptz; through_at:=(a->>'publishedThrough')::timestamptz; expires_at:=(a->>'expiresAt')::timestamptz;
   if not isfinite(time_at) or time_at>now_at or through_at<>time_at or expires_at<>time_at+interval '30 minutes' then raise exception 'P6_INVALID_ANCHOR' using errcode='22023'; end if;
   if expires_at<=now_at then raise exception 'P6_ANCHOR_EXPIRED' using errcode='22023'; end if;
  end if;
 end if;
 if jsonb_typeof(scope) is distinct from 'object' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_mode:=scope->>'kind';
 if scope_mode='ALL' then
  if scope-array['kind']<>'{}' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 elsif scope_mode='AREA' then
  if scope-array['kind','bounds']<>'{}' or jsonb_typeof(scope->'bounds') is distinct from 'array' or jsonb_array_length(scope->'bounds')<>4
    or exists(select 1 from jsonb_array_elements(scope->'bounds') x where jsonb_typeof(x)<>'number') then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  west:=(scope#>>'{bounds,0}')::numeric; south:=(scope#>>'{bounds,1}')::numeric; east:=(scope#>>'{bounds,2}')::numeric; north:=(scope#>>'{bounds,3}')::numeric;
  if abs(west)>180 or abs(east)>180 or south< -90 or north>90 or south>north then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'bounds',jsonb_build_array(west::double precision,south::double precision,east::double precision,north::double precision));
 elsif scope_mode in ('POINT_LIST','POINT_MEMBERS') then
  if scope-array['kind','point']<>'{}' or jsonb_typeof(scope->'point') is distinct from 'object' or (scope->'point')-array['lat','lng']<>'{}'
    or jsonb_typeof(scope#>'{point,lat}') is distinct from 'number' or jsonb_typeof(scope#>'{point,lng}') is distinct from 'number' then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  point_lat:=(scope#>>'{point,lat}')::numeric; point_lng:=(scope#>>'{point,lng}')::numeric;
  if abs(point_lat)>90 or abs(point_lng)>180 or round(point_lat,2)<>point_lat or round(point_lng,2)<>point_lng then raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
  scope:=jsonb_build_object('kind',scope_mode,'point',jsonb_build_object('lat',point_lat::double precision,'lng',point_lng::double precision));
 else raise exception 'P6_INVALID_SCOPE' using errcode='22023'; end if;
 scope_key:=md5(jsonb_build_object('filterKey',filter_key,'scope',scope,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text);
 cursor_doc:=r->'after';
 if request_mode='PAGE' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc)<>'object' or cursor_doc-array['scopeKey','section','sortAt','id']<>'{}'
    or not(cursor_doc?&array['scopeKey','section','sortAt','id']) or cursor_doc->>'scopeKey' is distinct from scope_key
    or cursor_doc->'section' not in ('0'::jsonb,'1'::jsonb) or coalesce(cursor_doc->>'sortAt','')!~iso_pattern
    or coalesce(cursor_doc->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_at:=(cursor_doc->>'sortAt')::timestamptz; before_id:=(cursor_doc->>'id')::uuid; before_section:=(cursor_doc->>'section')::integer;
  if before_at>through_at or (scope_mode in ('ALL','POINT_MEMBERS') and before_section<>0) then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
 end if;
 if request_mode='PLACES' and cursor_doc<>'null'::jsonb then
  if jsonb_typeof(cursor_doc) is distinct from 'object' or cursor_doc-array['count','text','key']<>'{}'
    or not(cursor_doc?&array['count','text','key']) or jsonb_typeof(cursor_doc->'count') is distinct from 'number'
    or (cursor_doc->>'count')::numeric<>trunc((cursor_doc->>'count')::numeric)
    or (cursor_doc->>'count')::numeric not between 1 and 9007199254740991
    or jsonb_typeof(cursor_doc->'text') is distinct from 'string' or length(cursor_doc->>'text') not between 1 and 500
    or jsonb_typeof(cursor_doc->'key') is distinct from 'string' or length(cursor_doc->>'key') not between 1 and 500
    or public.p6_discovery_key(cursor_doc->>'text') is distinct from cursor_doc->>'key'
    then raise exception 'P6_INVALID_CURSOR' using errcode='22023'; end if;
  before_count:=(cursor_doc->>'count')::bigint; before_text:=cursor_doc->>'text'; before_key:=cursor_doc->>'key';
 end if;
 if request_mode='MAP' then
  -- World-anchored grid covers the whole box; never truncate the first N pins.
  loop
   grid_cells:=power(2::numeric,grid);
   grid_w:=least(grid_cells-1,floor((west+180)/360*grid_cells));
   grid_e:=least(grid_cells-1,floor((east+180)/360*grid_cells));
   grid_s:=least(grid_cells-1,floor((south+90)/180*grid_cells));
   grid_n:=least(grid_cells-1,floor((north+90)/180*grid_cells));
   grid_width:=case when west<=east then grid_e-grid_w+1 else least(grid_cells,grid_cells-grid_w+grid_e+1) end;
   exit when grid_width*(grid_n-grid_s+1)<=256;
   grid:=grid-1;
   if grid<1 then raise exception 'P6_GRID_BOUND_FAILED'; end if;
  end loop;
 end if;
 if request_mode='PLACES' then
  with place_base as materialized (
   select n.id,n.published_at,n.execution_location_mode,n.approximate_city,n.approximate_area,
    n.approximate_lat,n.approximate_lng,n.required_slots,n.mode,n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,
    case when when_mode='any' and range_from is null then null::text[]
      else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,
    case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
    (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
   from public.needs n
   where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null
    and n.remaining_search_closed_at is null and n.published_at<=through_at
    and (price='all' or n.mode=price)
    and (min_budget_rsd is null or n.mode='OFFERS' or (n.mode='MY_PRICE' and n.requester_price_rsd>=min_budget_rsd))
    and (location_mode='any' or location_mode='remote' and n.execution_location_mode='REMOTE'
      or location_mode='onsite' and n.execution_location_mode is not null and n.execution_location_mode<>'REMOTE')
    and (people=1 or greatest(0,coalesce(nullif(n.required_slots,0),1)
      -coalesce(public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))),0))>=people)
    and (not for_me or public.discovery_for_me_v1(n.id))
  ), place_wanted as materialized (
   select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode
    when 'today' then array[today::text,today::text]
    when 'tomorrow' then array[(today+1)::text,(today+1)::text]
    when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]
    when 'next7' then array[today::text,(today+6)::text]
    when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,
                              (today+7-extract(isodow from today)::integer)::text]
    else null end end as wanted,
    case when scope_mode='ALL' then true when not has_point then false else
      approximate_lat between south and north and
      (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))
    end as in_area
   from place_base b
  ), place_qualified as materialized (
   select w.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok
   from place_wanted w
  ), facet_raw_counts as materialized (
   select approximate_area,approximate_city,count(*)::bigint as raw_count
   from place_qualified
   where time_ok and execution_location_mode is distinct from 'REMOTE'
   group by approximate_area,approximate_city
  ), facet_raw_representatives as materialized (
   select distinct on(approximate_area,approximate_city)
    approximate_area,approximate_city,published_at,id
   from place_qualified
   where time_ok and execution_location_mode is distinct from 'REMOTE'
   order by approximate_area,approximate_city,published_at desc,id desc
  ), facet_raw as materialized (
   select c.approximate_area,c.approximate_city,c.raw_count,r.published_at,r.id,
    public.p6_discovery_area(c.approximate_area,c.approximate_city,false) as area_text
   from facet_raw_counts c join facet_raw_representatives r using(approximate_area,approximate_city)
  ), facet_keys as materialized (
   -- DISCOVERY-GRAD: a row is a place text (AREA, as before) or, with groupBy CITY, the task's city: approximate_city, and
   -- for a task that names no city the last part of its place text after a comma. The key stays p6_discovery_key(text).
   select public.p6_discovery_key(p.shown) as key,p.shown as text,public.p6_discovery_key(area_text) as area_key,raw_count,id,published_at
   from facet_raw cross join lateral (select case when place_level='CITY' then coalesce(public.p6_discovery_unquote(approximate_city),
     nullif(public.p6_discovery_trim(substring(area_text from '[^,]*$')),''),area_text) else area_text end as shown) p
  ), facet_members as materialized (
   -- One row per place as people find it: texts that differ only by Serbian letters or case are one place (discovery_fold_v1).
   select k.key,k.text,k.raw_count,k.id,k.published_at,public.discovery_fold_v1(k.key) as fold_key from facet_keys k
   where k.area_key not in ('na daljinu','lokacija nije navedena')
    and (prefix_text='' or strpos(public.discovery_fold_v1(k.key),fold_prefix)>0)
  ), facet_representatives as materialized (
   select distinct on(fold_key) fold_key,key,text from facet_members order by fold_key,published_at desc,id desc
  ), facet_counts as materialized (
   select fold_key,sum(raw_count)::bigint as count from facet_members group by fold_key
  ), facets as materialized (
   select r.key,r.text,c.count from facet_counts c join facet_representatives r using(fold_key)
  ), facet_page as materialized (
   select * from facets
   where before_count is null or count<before_count or count=before_count and
    (text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C")>
    (before_text collate pg_catalog."sr-Latn-RS-x-icu",before_key collate pg_catalog."C")
   order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C"
   limit page_limit+1
  ), facet_shown as materialized (
   select * from facet_page
   order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C"
   limit page_limit
  )
  select jsonb_build_object(
   'version','DISCOVERY_V1','mode','PLACES','asOf',now_at,'filterKey',filter_key,
   'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,
    'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
   'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count)
     order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C") from facet_shown),'[]'::jsonb),
   'hasMore',(select count(*)>page_limit from facet_page),
   'nextCursor',case when (select count(*)>page_limit from facet_page) then
    (select jsonb_build_object('count',count,'text',text,'key',key) from facet_shown
     order by count,text collate pg_catalog."sr-Latn-RS-x-icu" desc,key collate pg_catalog."C" desc limit 1)
    else null end,
   'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,
    'everywhere',(select count(*) from place_qualified where time_ok),
    'inArea',case when scope_mode='ALL' then null else
      (select count(*) from place_qualified where time_ok and has_point and in_area) end)
  ) into result;
  if exists(select 1 from jsonb_array_elements(result->'items') x
    where length(x->>'text')>500 or length(x->>'key')>500)
   then raise exception 'P6_PLACE_LABEL_TOO_LONG' using errcode='22023'; end if;
  return result;
 end if;
 with base as materialized (
  select n.id,n.revision,n.published_at,n.title,n.category,n.status,n.urgent,n.schedule_kind,n.starts_at,n.ends_at,n.execution_location_mode,
   n.task_country_code,n.task_timezone,n.verified_identity_required,n.approximate_city,n.approximate_area,n.approximate_lat,n.approximate_lng,
   n.required_slots,n.required_skills,n.required_tools,n.required_vehicles,n.required_licenses,n.minimum_experience_years,n.mode,
   n.requester_price_rsd,n.price_basis,n.requester_profile_id,n.response_deadline,
   case when people>1 then public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id))) else null::integer end as covered_now,
   case when request_mode in ('MAP','PLACES') and when_mode='any' and range_from is null then null::text[] else public.p6_discovery_days(n.schedule_kind,n.starts_at,n.ends_at,n.task_timezone,time_at) end as days,
   case when request_mode='PLACES'
     or query_text<>''
    then public.p6_discovery_area(n.approximate_area,n.approximate_city,n.execution_location_mode='REMOTE')
    else null::text end as area_text,
   case when n.execution_location_mode='REMOTE' or n.approximate_lat is null or n.approximate_lng is null then false else true end as has_point,
   (time_at at time zone coalesce(n.task_timezone,'UTC'))::date as today
  from public.needs n where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
   and (request_mode='EXACT_PUBLIC' and n.id=need_id or request_mode in ('PAGE','MAP','PLACES') and n.published_at<=through_at)
 ), place_keys as materialized (
  -- DISCOVERY-GRAD (owner 2026-10-07): a place is the task's whole place text OR its city (approximate_city; for a task that
  -- names no city, the last part of its place text after a comma), both compared through discovery_fold_v1. Decided once per
  -- distinct (area, city) text of the rows base read (never once per task, never a second read of the tasks); a task then only
  -- looks up its key (length-prefixed, so no two texts share one). OFFSET 0 fences: the test would otherwise be pushed below the
  -- GROUP BY (it reads only grouping columns) and the place text repeated per use. A remote task and a task without a place text
  -- never match a place; a task without a point but with a city does. Both columns are NOT NULL (default ''); coalesce only guards.
  select length(p.place_area)::text||':'||p.place_area||p.place_city as place_key from (
    select coalesce(b.approximate_area,'') as place_area,coalesce(b.approximate_city,'') as place_city from base b
    where locality is not null and b.execution_location_mode is distinct from 'REMOTE' group by 1,2 offset 0) p
   cross join lateral (select public.p6_discovery_area(p.place_area,p.place_city,false) as label offset 0) l
  where public.p6_discovery_key(l.label) not in ('na daljinu','lokacija nije navedena')
   and (public.discovery_fold_v1(public.p6_discovery_key(l.label))=fold_place
    or public.discovery_fold_v1(public.p6_discovery_key(coalesce(public.p6_discovery_unquote(p.place_city),
      nullif(public.p6_discovery_trim(substring(l.label from '[^,]*$')),''),l.label)))=fold_place)
 ), shared as materialized (
  select b.*,case when range_from is not null then array[range_from,range_to] else case when_mode
   when 'today' then array[today::text,today::text] when 'tomorrow' then array[(today+1)::text,(today+1)::text]
   when 'week' then array[today::text,(today+7-extract(isodow from today)::integer)::text]
   when 'next7' then array[today::text,(today+6)::text]
   when 'weekend' then array[(today+greatest(0,6-extract(isodow from today)::integer))::text,(today+7-extract(isodow from today)::integer)::text] else null end end as wanted
  from base b where (price='all' or b.mode=price)
   and (min_budget_rsd is null or b.mode='OFFERS' or (b.mode='MY_PRICE' and b.requester_price_rsd>=min_budget_rsd))
   and (location_mode='any' or location_mode='remote' and b.execution_location_mode='REMOTE'
     or location_mode='onsite' and b.execution_location_mode is not null and b.execution_location_mode<>'REMOTE')
   and (people=1 or greatest(0,coalesce(nullif(b.required_slots,0),1)-coalesce(b.covered_now,0))>=people)
   -- DISCOVERY-GRAD: the place (its key among place_keys) and the words, found in the title, the place text and the needed
   -- skills, tools and vehicles through discovery_fold_v1, one fold per task (the title is the start of that text).
   and (locality is null or b.execution_location_mode is distinct from 'REMOTE'
     and length(coalesce(b.approximate_area,''))::text||':'||coalesce(b.approximate_area,'')||coalesce(b.approximate_city,'') in (select place_key from place_keys))
   and (query_text='' or strpos(public.discovery_fold_v1(coalesce(b.title,'')||' '||b.area_text||' '||array_to_string(coalesce(b.required_skills,'{}')||coalesce(b.required_tools,'{}')||coalesce(b.required_vehicles,'{}'),' ')),fold_text)>0)
   and (not for_me or public.discovery_for_me_v1(b.id))
 ), qualified as materialized (
  select s.*,(wanted is null or days[1]<=wanted[2] and days[2]>=wanted[1]) is true as time_ok,
   case when scope_mode='ALL' then true when not has_point then false when scope_mode='AREA' then
    approximate_lat between south and north and (west<=east and approximate_lng between west and east or west>east and (approximate_lng>=west or approximate_lng<=east))
    else approximate_lat=point_lat and approximate_lng=point_lng end as in_area
  from shared s
 ), scoped as materialized (
  select q.*,case when scope_mode in ('AREA','POINT_LIST') and not has_point then 1 else 0 end as section
  from qualified q where in_area or not has_point and scope_mode in ('AREA','POINT_LIST')
 ), page as materialized (
  select * from scoped where request_mode in ('PAGE','EXACT_PUBLIC') and time_ok and (before_id is null or section>before_section or section=before_section and (published_at,id)<(before_at,before_id))
  order by section,published_at desc,id desc limit page_limit+1
 ), shown as materialized (select * from page order by section,published_at desc,id desc limit page_limit),
 shown_covered as materialized (
  select s.*,coalesce(s.covered_now,public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',s.id)))) as projected_covered from shown s
 ), projected as (
  select s.section,s.published_at,s.id,jsonb_build_object(
   'id',s.id,'revision',s.revision,'sortAt',to_char(s.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedAt',s.published_at,'title',s.title,'category',s.category,'status',s.status,'urgent',s.urgent,
   'scheduleKind',s.schedule_kind,'startsAt',s.starts_at,'endsAt',s.ends_at,'executionLocationMode',s.execution_location_mode,
   'taskCountryCode',s.task_country_code,'taskTimezone',s.task_timezone,'verifiedIdentityRequired',s.verified_identity_required,
   'approximateCity',nullif(btrim(s.approximate_city),''),'approximateArea',nullif(btrim(s.approximate_area),''),
   'pin',case when not s.has_point then null else jsonb_build_object('lat',s.approximate_lat,'lng',s.approximate_lng,'precision','COARSE_1KM') end,
   'requiredSlots',s.required_slots,'coveredSlots',s.projected_covered,'requiredSkills',to_jsonb(s.required_skills),'requiredTools',to_jsonb(s.required_tools),
   'requiredVehicles',to_jsonb(s.required_vehicles),'requiredLicenses',to_jsonb(s.required_licenses),'minimumExperienceYears',s.minimum_experience_years,
   'priceMode',s.mode,'requesterPriceRsd',s.requester_price_rsd,'priceBasis',s.price_basis,'requesterProfileId',s.requester_profile_id,
   'responseDeadline',s.response_deadline,'acceptsApplications',s.required_slots>s.projected_covered and (s.response_deadline is null or s.response_deadline>now_at),
   'publicTopology',(select g.public_topology from public.need_geography g where g.need_id=s.id),
   'criticalConditions',(select to_jsonb(d.critical_conditions) from public.need_requirement_details d where d.need_id=s.id)) as item from shown_covered s
 ), map_points as materialized (
  select q.id,q.published_at,q.approximate_lat as lat,q.approximate_lng as lng,
   least(grid_cells-1,floor((q.approximate_lng+180)/360*grid_cells)) as gx,
   least(grid_cells-1,floor((q.approximate_lat+90)/180*grid_cells)) as gy
  from qualified q where request_mode='MAP' and time_ok and has_point and in_area
 ), map_representatives as materialized (
  select distinct on(gx,gy) gx,gy,id,lat,lng from map_points order by gx,gy,published_at desc,id desc
 ), map_groups as (
  select gx,gy,count(*) as tasks,count(distinct (lat,lng)) as points,
   min(lng) as left_edge,min(lat) as bottom_edge,max(lng) as right_edge,max(lat) as top_edge
  from map_points group by gx,gy
 ), map_buckets as (
  select g.gx,g.gy,
   case when g.tasks=1 then jsonb_build_object('kind','TASK','key','task:'||m.id,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskId',m.id)
    when g.points=1 then jsonb_build_object('kind','PLACE','key','place:'||m.lat||':'||m.lng,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),'taskCount',g.tasks)
    else jsonb_build_object('kind','CLUSTER','key','cluster:'||grid||':'||g.gx||':'||g.gy,'point',jsonb_build_object('lat',m.lat,'lng',m.lng),
      'taskCount',g.tasks,'distinctPointCount',g.points,'memberBounds',jsonb_build_array(g.left_edge,g.bottom_edge,g.right_edge,g.top_edge)) end as bucket
  from map_groups g join map_representatives m using(gx,gy)
 ), facet_keys as materialized (
  select public.p6_discovery_key(area_text) as key,area_text as text,id,published_at
  from qualified where request_mode='PLACES' and time_ok and execution_location_mode is distinct from 'REMOTE'
 ), facet_members as materialized (
  select * from facet_keys where key not in ('na daljinu','lokacija nije navedena') and (prefix_text='' or strpos(key,prefix_text)>0)
 ), facet_representatives as materialized (
  select distinct on(key) key,text from facet_members order by key,published_at desc,id desc
 ), facet_counts as (select key,count(*) as count from facet_members group by key), facets as (
  select c.key,r.text,c.count from facet_counts c join facet_representatives r using(key)
 ), facet_page as materialized (
  select * from facets where before_count is null or count<before_count or count=before_count and
   (text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C")>(before_text collate pg_catalog."sr-Latn-RS-x-icu",before_key collate pg_catalog."C")
  order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit+1
 ), facet_shown as (
  select * from facet_page order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C" limit page_limit
 ) select case when request_mode='MAP' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','MAP','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'coverageBounds',scope->'bounds','effectiveGrid',grid,
  'wholeBounds',(select case when count(*)=0 then null else jsonb_build_array(min(approximate_lng),min(approximate_lat),max(approximate_lng),max(approximate_lat)) end from qualified where time_ok and has_point),
  'buckets',coalesce((select jsonb_agg(bucket order by gx,gy) from map_buckets),'[]'::jsonb),
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'mapped',(select count(*) from qualified where time_ok),
   'withoutPoint',(select count(*) from qualified where time_ok and not has_point)))
 when request_mode='PLACES' then jsonb_build_object(
  'version','DISCOVERY_V1','mode','PLACES','asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(jsonb_build_object('key',key,'text',text,'count',count) order by count desc,text collate pg_catalog."sr-Latn-RS-x-icu",key collate pg_catalog."C") from facet_shown),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from facet_page),
  'nextCursor',case when (select count(*)>page_limit from facet_page) then
   (select jsonb_build_object('count',count,'text',text,'key',key) from facet_shown
    order by count,text collate pg_catalog."sr-Latn-RS-x-icu" desc,key collate pg_catalog."C" desc limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,'everywhere',(select count(*) from qualified where time_ok),
   'inArea',case when scope_mode='ALL' then null else (select count(*) from qualified where time_ok and has_point and in_area) end))
 else jsonb_build_object('version','DISCOVERY_V1','mode',request_mode,'asOf',now_at,'filterKey',filter_key,
  'anchor',jsonb_build_object('version','DISCOVERY_V1','filterKey',filter_key,'timeAt',to_char(time_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'publishedThrough',to_char(through_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'expiresAt',to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
  'items',coalesce((select jsonb_agg(item order by section,published_at desc,id desc) from projected),'[]'::jsonb),
  'hasMore',(select count(*)>page_limit from page),
  'nextCursor',case when (select count(*)>page_limit from page) then (select jsonb_build_object('scopeKey',scope_key,'section',section,
   'sortAt',to_char(published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',id) from shown order by section desc,published_at,id limit 1) else null end,
  'counts',jsonb_build_object('kind','exact_live','observedAt',now_at,
   'mapped',case when scope_mode='POINT_MEMBERS' then (select count(*) from scoped where time_ok) else (select count(*) from qualified where time_ok) end,
   'listed',(select count(*) from scoped where time_ok),'inArea',(select count(*) from scoped where time_ok and in_area),
   'withoutPoint',(select count(*) from scoped where time_ok and section=1),
   'undated',(select count(*) from scoped where wanted is not null and days is null)),
  'availability',jsonb_build_object('hasKnownWorkMode',exists(select 1 from base where execution_location_mode is not null),
   'hasKnownSchedule',exists(select 1 from base where days is not null),'priceModes',(select coalesce(jsonb_agg(mode order by mode),'[]') from (select distinct mode from base) modes))) end into result;
 if request_mode='EXACT_PUBLIC' then return result-array['anchor','filterKey','counts','availability']; end if;
 if request_mode='MAP' and jsonb_array_length(result->'buckets')>256 then raise exception 'P6_MAP_BOUND_FAILED'; end if;
 if request_mode='PLACES' and exists(select 1 from jsonb_array_elements(result->'items') x
   where length(x->>'text')>500 or length(x->>'key')>500) then raise exception 'P6_PLACE_LABEL_TOO_LONG' using errcode='22023'; end if;
 return result;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
 raise exception 'P6_INVALID_REQUEST' using errcode='22023';
end $r05_body$;
 expected_body_md5 text := '1cb5ece85a18972ca3ef827981733858';
 f jsonb; actual jsonb; phase integer; target oid; old_body text; definition_before text; meta_before jsonb; comment_before text;
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM set_config('statement_timeout','30s',true);
 FOR phase IN 0..1 LOOP
  FOR f IN SELECT value FROM jsonb_array_elements(expected_functions) LOOP
   SELECT jsonb_build_object('signature',f->>'signature','body_md5',md5(p.prosrc),'definer',p.prosecdef,
    'volatility',p.provolatile::text,'owner',p.proowner::regrole::text,'acl',p.proacl::text,'config',p.proconfig)
    INTO actual FROM pg_proc p WHERE p.oid=to_regprocedure(f->>'signature');
   IF phase=1 AND f->>'signature'='public.rpc_discovery_v1(jsonb)' THEN
    IF actual IS DISTINCT FROM (f||jsonb_build_object('body_md5',expected_body_md5)) THEN
     RAISE EXCEPTION 'R05_DISCOVERY_POSTIMAGE_DRIFT' USING ERRCODE='55000';
    END IF;
   ELSIF actual IS DISTINCT FROM f THEN
    RAISE EXCEPTION 'R05_DISCOVERY_PREIMAGE_DRIFT: %',f->>'signature' USING ERRCODE='55000';
   END IF;
  END LOOP;
  select jsonb_build_object(
 'relation',(select jsonb_build_object('owner',relowner::regrole::text,'acl',relacl::text,'rls',relrowsecurity,'forceRls',relforcerowsecurity) from pg_class where oid='public.needs'::regclass),
 'columns',(select jsonb_agg(jsonb_build_object('name',attname,'position',attnum,'type',case when attname='approx_geog' then (select typname from pg_type where oid=atttypid) else format_type(atttypid,atttypmod) end,'acl',attacl::text,'readAuthenticated',has_column_privilege('authenticated','public.needs',attname,'SELECT')) order by attnum)
 from pg_attribute where attrelid='public.needs'::regclass and attnum>0 and not attisdropped),
 'policies',(select jsonb_agg(jsonb_build_object('name',policyname,'permissive',permissive,'roles',roles,'cmd',cmd,'qual',qual,'check',with_check) order by policyname)
 from pg_policies where schemaname='public' and tablename='needs')) INTO actual;
  IF actual IS DISTINCT FROM expected_needs THEN
   RAISE EXCEPTION 'R05_DISCOVERY_PROJECTION_DRIFT' USING ERRCODE='55000';
  END IF;
  IF phase=0 THEN
   target:=to_regprocedure('public.rpc_discovery_v1(jsonb)');
   SELECT p.prosrc,to_jsonb(p)-'prosrc',obj_description(p.oid,'pg_proc') INTO STRICT old_body,meta_before,comment_before FROM pg_proc p WHERE p.oid=target;
   IF md5(new_body) IS DISTINCT FROM expected_body_md5 THEN
    RAISE EXCEPTION 'R05_DISCOVERY_PAYLOAD_DRIFT' USING ERRCODE='55000';
   END IF;
   definition_before:=pg_get_functiondef(target);
   IF (length(definition_before)-length(replace(definition_before,old_body,'')))/length(old_body)<>1 THEN
    RAISE EXCEPTION 'R05_DISCOVERY_BODY_ANCHOR_DRIFT' USING ERRCODE='55000';
   END IF;
   EXECUTE replace(definition_before,old_body,new_body);
   IF (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM meta_before
     OR obj_description(target,'pg_proc') IS DISTINCT FROM comment_before THEN
    RAISE EXCEPTION 'R05_DISCOVERY_METADATA_DRIFT' USING ERRCODE='55000';
   END IF;
  END IF;
 END LOOP;
END
$r05_discovery$;
