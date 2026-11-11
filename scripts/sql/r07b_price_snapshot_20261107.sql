-- R07b: reviewed RSD unit survives submit -> immutable version -> selection -> Agreement.
-- Forward candidate for canonical DEV leqcwgzvjsxugfgzdmth, captured 2026-11-07.
-- Execute only via an explicitly selected DEV connection after SQL/runtime review.
-- No historical data/receipt/backfill, no table grants/RLS or existing signature changes.
-- Adds one owner-only read RPC for uncertain submit receipts; it performs no writes.
-- Full catalog preimage is adjacent; all changed functions retain OID/owner/ACL.
-- Existing ambiguous rows require the same explicit application review (UPDATE),
-- while prior submit/selection receipts and accepted Agreement history stay intact.
DO $r07_price_snapshot$
DECLARE
  expected jsonb := '{"private.assert_application_price_v5":{"body_md5":"5dd05b9273c447e8619ae58df5efa4f4","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"i","result":"void","signature":"private.assert_application_price_v5(public.needs,integer,integer)"},"public.rpc_ai_open_need_edit_conversation_v2":{"body_md5":"e3cec3356f53eb5e65917c46b956706e","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_ai_open_need_edit_conversation_v2(uuid)"},"public.rpc_list_my_applications":{"body_md5":"e6a807cf612c137140e1976b1e07f3b6","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_my_applications()"},"public.rpc_list_my_applications_page":{"body_md5":"9cf6798388c0f560ba19bb28a5add4ee","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)"},"public.rpc_list_need_candidates":{"body_md5":"56b4096cdadbd3bb79f80bc231f796ce","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_need_candidates(uuid)"},"public.rpc_list_need_candidates_page":{"body_md5":"9661845e4e6dc993fa719ed8783a307c","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)"},"public.rpc_resolve_stale_response_after_need_edit":{"body_md5":"bd4a46fe5badbfc1e2d80312104c6782","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)"},"public.rpc_select_response":{"body_md5":"334b57ba4f9df8482a312878386e274c","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=public, pg_temp"],"definer":true,"strict":false,"volatility":"v","result":"uuid","signature":"public.rpc_select_response(uuid,integer,uuid,integer,text,text)"},"public.rpc_submit_response":{"body_md5":"fb25cde4aed03cb63168e5d3a548143e","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)"},"private.own_application_rows":{"body_md5":"b9b233487beec679b2602d20efceff65","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"TABLE(application_id uuid, sort_at timestamp with time zone, need_id uuid, current_need_revision integer, submitted_against_need_revision integer, current_version integer, raw_response_status text, price_rsd integer, covered_slots integer, scope_note text, submitted_at timestamp with time zone, title text, description text, raw_need_status text, approximate_city text, approximate_area text, starts_at timestamp with time zone, ends_at timestamp with time zone, schedule_kind text, execution_location_mode text, task_timezone text, price_mode text, price_basis text, required_slots integer, agreement_id uuid, application_state text, application_rank integer)","signature":"private.own_application_rows(uuid)"},"public.rpc_propose_agreement_change_v2":{"body_md5":"cf577eafb406dac9c7ab17042f201749","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"uuid","signature":"public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)"},"public.rpc_respond_agreement_change":{"body_md5":"a89309f3578c27ba1d9d9007a466c88e","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_respond_agreement_change(uuid,boolean)"}}'::jsonb;
  observed jsonb;
  prior_attributes jsonb;
  after_attributes jsonb;
  old_search_path text := current_setting('search_path');
BEGIN
  PERFORM set_config('search_path','pg_catalog',true);
  IF to_regprocedure('public.rpc_read_response_submit_result(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'R07B_RECEIPT_READER_ALREADY_EXISTS' USING errcode='55000';
  END IF;
  SELECT (SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    FROM jsonb_each(expected) e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature')) INTO observed;
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R07B_SOURCE_OR_ACL_DRIFT' USING errcode='55000';
  END IF;
  IF (SELECT count(*) FROM pg_attribute a WHERE a.attrelid IN
      ('public.marketplace_responses'::regclass,'public.marketplace_response_versions'::regclass)
      AND a.attname='price_basis' AND a.atttypid='text'::regtype AND NOT a.attnotnull
      AND NOT a.attisdropped AND NOT a.atthasdef AND a.attgenerated='') <> 2 THEN
    RAISE EXCEPTION 'R07B_PRICE_SCHEMA_DRIFT' USING errcode='55000';
  END IF;
  SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'prosrc') INTO prior_attributes
    FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION private.assert_application_price_v5(n public.needs, p_covered_slots integer, p_price_rsd integer)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
begin
  if p_price_rsd is null or p_price_rsd <= 0 then
    raise exception using errcode='22023', message='INVALID_PRICE';
  end if;

  if n.mode = 'MY_PRICE' then
    if n.requester_price_rsd is null or n.requester_price_rsd <= 0 then
      raise exception using errcode='P0001', message='FIXED_PRICE_NOT_READY';
    end if;

    if n.price_basis is null then
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    elsif n.price_basis = 'PER_PERSON' then
      if p_price_rsd <> n.requester_price_rsd::bigint * p_covered_slots then
        raise exception using
          errcode='22023',
          message='FIXED_PRICE_MISMATCH',
          detail=format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s',
                        n.requester_price_rsd, p_covered_slots,
                        n.requester_price_rsd::bigint * p_covered_slots, p_price_rsd);
      end if;
    elsif n.price_basis = 'TOTAL' then
      if p_price_rsd::numeric is distinct from
         round(n.requester_price_rsd::numeric * p_covered_slots / n.required_slots) then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH',
          detail=format('basis=TOTAL,total=%s,required=%s,covered=%s,sent=%s',
            n.requester_price_rsd,n.required_slots,p_covered_slots,p_price_rsd);
      end if;
    elsif n.price_basis = 'HOURLY' then
      -- R07b: an hourly amount is one person's rate for one hour.
      -- Headcount and duration remain independent accepted facts.
      if p_price_rsd <> n.requester_price_rsd then
        raise exception using errcode='22023', message='FIXED_PRICE_MISMATCH';
      end if;
    else
      raise exception using errcode='22023', message='UNKNOWN_PRICE_BASIS';
    end if;
  end if;

end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_ai_open_need_edit_conversation_v2(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_need public.needs%rowtype;
  v_sensitive public.need_sensitive%rowtype;
  v_geo jsonb;
  v_conditions text[]:='{}'::text[];
  v_conversation_id uuid;
  v_key text;
  v_type text;
  v_value jsonb;
  v_display text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null then raise exception 'NEED_ID_REQUIRED' using errcode='22004'; end if;

  -- Returning an existing row must retain the closure boundary of INSERT.
  perform private.closure_assert_open(v_uid);

  select * into v_need from public.needs where id=p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id<>v_uid then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.status not in ('DRAFT','PUBLISHED','SELECTION') then raise exception 'NEED_NOT_EDITABLE_PUBLIC_STATE' using errcode='P0001'; end if;

  if exists(select 1 from public.agreements a where a.need_id=v_need.id)
     or exists(select 1 from public.need_selections s where s.need_id=v_need.id)
     or exists(select 1 from public.marketplace_responses r where r.need_id=v_need.id and r.status='SELECTED') then
    raise exception 'NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR' using errcode='P0001';
  end if;

  perform 1 from public.need_geography where need_id=v_need.id for share;
  perform 1 from public.need_requirement_details where need_id=v_need.id for share;
  select * into v_sensitive from public.need_sensitive where need_id=v_need.id for share;
  select g.public_topology into v_geo from public.need_geography g where g.need_id=v_need.id;
  select coalesce(d.critical_conditions,'{}'::text[]) into v_conditions
    from public.need_requirement_details d where d.need_id=v_need.id;
  if not found then v_conditions:='{}'::text[]; end if;

  if v_geo is null then
    if v_need.execution_location_mode='REMOTE' then
      v_geo:=jsonb_build_object('mode','REMOTE','start',null,'end',null,'waypoints','[]'::jsonb,'serviceArea',null);
    else
      raise exception 'NEED_EDIT_GEOGRAPHY_NOT_READY' using errcode='P0001';
    end if;
  end if;
  perform private.validate_need_v2_fact('need.task_geography',v_geo);

  -- A repeated open is recovery of the same current edit, not a new AI job.
  -- Existing legacy duplicates with real messages outrank empty seeded copies.
  -- The task lock serializes openers. NOWAIT avoids a need/conversation lock
  -- inversion with a simultaneous turn/review; contention must not create a copy.
  select c.id into v_conversation_id
    from public.ai_conversations c
   where c.account_id=v_uid and c.bound_need_id=v_need.id
     and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
     and c.status='OPEN' and c.completed_at is null and c.retention_abandoned_at is null
     and c.need_edit_base_fingerprint is not null
     and c.need_edit_base_fingerprint=private.need_edit_base_marker(v_need.id)
     and not exists (
       select 1 from private.ai_task_reviews r
       join private.ai_task_review_commands command on command.review_id=r.id
       where r.conversation_id=c.id
     )
   order by (select max(m.sequence_no) from public.ai_messages m
             where m.conversation_id=c.id and m.account_id=v_uid) desc nulls last,
            c.created_at desc,c.id desc
   limit 1 for update of c nowait;
  if v_conversation_id is not null then
    return jsonb_build_object('conversationId',v_conversation_id,'needId',v_need.id,
      'revision',v_need.revision,'status',v_need.status,'authoritative',true);
  end if;

  insert into public.ai_conversations(account_id,purpose,status,bound_need_id,fact_schema_version)
  values(v_uid,'NEED_INTAKE','OPEN',v_need.id,'NEED_FACT_V2')
  returning id into v_conversation_id;

  for v_key,v_type in
    select fact_key,value_type from private.need_fact_registry
     where schema_version='NEED_FACT_V2'
     order by fact_key
  loop
    v_value:=null;
    v_display:=null;

    case v_key
      when 'need.title' then v_value:=to_jsonb(v_need.title); v_display:=v_need.title;
      when 'need.description' then v_value:=to_jsonb(v_need.description); v_display:=v_need.description;
      when 'need.category' then v_value:=to_jsonb(v_need.category); v_display:=v_need.category;
      when 'need.price_mode' then v_value:=to_jsonb(v_need.mode); v_display:=v_need.mode;
      when 'need.price_rsd' then
        if v_need.requester_price_rsd is not null then v_value:=to_jsonb(v_need.requester_price_rsd); v_display:=v_need.requester_price_rsd::text||' RSD'; end if;
      when 'need.schedule_kind' then v_value:=to_jsonb(v_need.schedule_kind); v_display:=v_need.schedule_kind;
      when 'need.starts_at' then
        if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at); v_display:=to_jsonb(v_need.starts_at)#>>'{}'; end if;
      when 'need.ends_at' then
        if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at); v_display:=to_jsonb(v_need.ends_at)#>>'{}'; end if;
      when 'need.response_deadline' then
        if v_need.response_deadline is not null then
          v_value:=jsonb_build_object('kind','AT','at',to_jsonb(v_need.response_deadline)#>>'{}');
          v_display:='Prijave do '||(to_jsonb(v_need.response_deadline)#>>'{}');
        end if;
      when 'need.price_basis' then
        -- PKG-027e: an edit keeps what the price is for; without this the edit writer clears it.
        if v_need.mode='MY_PRICE' and v_need.price_basis is not null then
          v_value:=to_jsonb(v_need.price_basis);
          v_display:=case v_need.price_basis when 'HOURLY' then 'Po osobi po satu' when 'PER_PERSON' then 'Po osobi' else 'Ukupno' end;
        end if;
      when 'need.people_needed' then v_value:=to_jsonb(v_need.required_slots); v_display:=v_need.required_slots::text;
      when 'need.required_skills' then v_value:=to_jsonb(coalesce(v_need.required_skills,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_skills,'{}'::text[]),', ');
      when 'need.required_tools' then v_value:=to_jsonb(coalesce(v_need.required_tools,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_tools,'{}'::text[]),', ');
      when 'need.required_vehicles' then v_value:=to_jsonb(coalesce(v_need.required_vehicles,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_vehicles,'{}'::text[]),', ');
      when 'need.required_licenses' then v_value:=to_jsonb(coalesce(v_need.required_licenses,'{}'::text[])); v_display:=array_to_string(coalesce(v_need.required_licenses,'{}'::text[]),', ');
      when 'need.minimum_experience_years' then
        if v_need.minimum_experience_years is not null then v_value:=to_jsonb(v_need.minimum_experience_years); v_display:=v_need.minimum_experience_years::text; end if;
      when 'need.verified_identity_required' then v_value:=to_jsonb(coalesce(v_need.verified_identity_required,false)); v_display:=case when coalesce(v_need.verified_identity_required,false) then 'Da' else 'Ne' end;
      when 'need.task_country_code' then
        if v_need.task_country_code is not null then v_value:=to_jsonb(v_need.task_country_code); v_display:=v_need.task_country_code; end if;
      when 'need.task_geography' then v_value:=v_geo; v_display:=coalesce(v_geo->'start'->>'label',v_geo->'serviceArea'->>'label',v_geo->>'mode');
      when 'need.handoff' then
        if v_need.execution_location_mode='REMOTE' then
          select d.handoff into v_value from public.need_requirement_details d where d.need_id=v_need.id;
          v_display:=private.taxonomy_handoff_display_v1(v_value);
        end if;
      when 'need.critical_conditions' then
        select array_remove(v_conditions,'Predaja: '||private.taxonomy_handoff_display_v1(d.handoff))
          into v_conditions from public.need_requirement_details d where d.need_id=v_need.id;
        v_value:=to_jsonb(coalesce(v_conditions,'{}'::text[])); v_display:=array_to_string(v_conditions,', ');
      when 'need.public_photo_paths' then v_value:=to_jsonb(coalesce(v_need.public_photo_paths,'{}'::text[])); v_display:=case when cardinality(coalesce(v_need.public_photo_paths,'{}'::text[]))=0 then 'Bez fotografija' else cardinality(v_need.public_photo_paths)::text||' fotografija' end;
      when 'need.exact_address' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.exact_address),'') is not null then v_value:=to_jsonb(v_sensitive.exact_address); v_display:=v_sensitive.exact_address; end if;
      when 'need.access_notes' then
        if v_sensitive.need_id is not null and nullif(btrim(v_sensitive.access_notes),'') is not null then v_value:=to_jsonb(v_sensitive.access_notes); v_display:=v_sensitive.access_notes; end if;
      else null;
    end case;

    if v_value is not null and v_value<>'null'::jsonb then
      perform private.validate_need_v2_fact(v_key,v_value);
      insert into public.ai_structured_facts(
        account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
        confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,
        fact_schema_version,value_type,display_value
      ) values (
        v_uid,v_conversation_id,v_need.id,v_key,v_value,'CONFIRMED','SYSTEM_DERIVED','NEED_DRAFT',
        1,null,v_uid,statement_timestamp(),'NEED_FACT_V2',v_type,
        coalesce(nullif(left(v_display,1000),''),'—')
      );
    end if;
  end loop;

  -- Clone the already-confirmed private value last, after its public binding facts.
  -- Preserve the original human's provenance; do not manufacture a new confirmation.
  if v_sensitive.resolved_location is not null then
    if private.resolved_location_record_valid(v_sensitive.resolved_location,v_need.task_country_code,v_geo,
      v_sensitive.exact_address,v_uid) is distinct from true then
      raise exception 'LOCATION_BINDING_CHANGED' using errcode='22023'; end if;
    insert into public.ai_structured_facts(account_id,conversation_id,subject_need_id,fact_key,fact_value,status,source,scope,
      confidence,evidence_excerpt,confirmed_by_user_id,confirmed_at,fact_schema_version,value_type,display_value)
    values(v_uid,v_conversation_id,v_need.id,'need.resolved_location',v_sensitive.resolved_location->'value','CONFIRMED','EXPLICIT_USER_ANSWER','NEED_DRAFT',
      1,null,(v_sensitive.resolved_location->>'confirmedByAccountId')::uuid,(v_sensitive.resolved_location->>'confirmedAt')::timestamptz,
      'NEED_FACT_V2','OBJECT','Potvrđene tačke: '||jsonb_array_length(v_sensitive.resolved_location#>'{value,points}')::text);
  end if;

  return jsonb_build_object(
    'conversationId',v_conversation_id,
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'authoritative',true
  );
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_list_my_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  with own_rows as (
    select
      r.id as application_id,
      r.need_id,
      n.revision as current_need_revision,
      r.submitted_against_need_revision,
      r.current_version,
      r.status as raw_response_status,
      r.price_rsd,
      r.price_basis as application_price_basis,
      snap.pricing_mode as application_price_mode,
      r.covered_slots,
      r.scope_note,
      r.submitted_at,
      n.title,
      n.description,
      n.status as raw_need_status,
      n.approximate_city,
      n.approximate_area,
      n.starts_at,
      (
        select a.id
          from public.agreements a
         where a.selected_response_id = r.id
         order by a.created_at desc, a.id desc
         limit 1
      ) as agreement_id
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
    left join private.response_application_snapshots snap on snap.response_id=r.id and snap.response_version=r.current_version
    where r.worker_account_id = v_actor
      and r.status <> 'DRAFT'
  ), state_rows as (
    select
      o.*,
      case
        -- PKG-029b (deep read 7.49): an application whose Agreement was cancelled is no longer chosen.
        when (o.agreement_id is not null and not exists (select 1 from public.agreements ag
                where ag.id = o.agreement_id and ag.status = 'CANCELLED'))
             or o.raw_response_status = 'SELECTED'
          then 'SELECTED'
        when o.raw_response_status = 'WITHDRAWN'
          then 'WITHDRAWN'
        when (o.application_price_basis is null and o.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') and o.raw_need_status in ('PUBLISHED','SELECTION'))
             or o.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
             or o.submitted_against_need_revision is distinct from o.current_need_revision
          then 'STALE_REVIEW_REQUIRED'
        when o.raw_response_status in ('NOT_SELECTED','EXPIRED')
             or o.raw_need_status not in ('PUBLISHED','SELECTION')
          then 'CLOSED'
        when o.raw_response_status = 'VIEWED'
          then 'VIEWED'
        when o.raw_response_status = 'SHORTLISTED'
          then 'SHORTLISTED'
        when o.raw_response_status in ('SUBMITTED','DELIVERED')
          then 'SUBMITTED'
        else 'CLOSED'
      end as application_state
    from own_rows o
  ), mapped as (
    select st.*, (st.application_state = 'STALE_REVIEW_REQUIRED'
        or (st.application_state = 'SELECTED' and exists (select 1 from public.agreements a
          left join public.agreement_execution ae on ae.agreement_id = a.id
          where a.id = st.agreement_id and a.status in ('CONFIRMED','SUPERSEDED')
            and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))) as attention_required
    from state_rows st
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'applicationId', m.application_id,
        'needId', m.need_id,
        'needRevision', m.current_need_revision,
        'submittedNeedRevision', m.submitted_against_need_revision,
        'version', m.current_version,
        'state', m.application_state,
        'title', m.title,
        'description', m.description,
        'approximateCity', nullif(btrim(m.approximate_city), ''),
        'approximateArea', nullif(btrim(m.approximate_area), ''),
        'startsAt', m.starts_at,
        'priceRsd', m.price_rsd,
        'applicationPriceBasis', m.application_price_basis,
        'applicationPriceMode', m.application_price_mode,
        'currency', 'RSD',
        'priceReviewRequired', m.application_price_basis is null and m.application_state='STALE_REVIEW_REQUIRED',
        'coveredSlots', m.covered_slots,
        'scopeNote', coalesce(m.scope_note, ''),
        'agreementId', m.agreement_id,
        'requiresStaleReview', m.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', m.attention_required,
        'canWithdraw',
          m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and m.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and m.submitted_against_need_revision = m.current_need_revision
          and m.raw_need_status in ('PUBLISHED','SELECTION')
          and m.agreement_id is null,
        'submittedAt', m.submitted_at
      )
      order by
        case
          when m.attention_required then 0
          when m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1
          else 2
        end,
        m.submitted_at desc nulls last,
        m.application_id
    ),
    '[]'::jsonb
  )
  into v_result
  from mapped m;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);

  return v_result;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_list_my_applications_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_before_rank integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
  v_counts jsonb;
  v_scope_rank integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_at is null) <> (p_before_id is null) or (p_before_at is null) <> (p_before_rank is null)
     or (p_before_rank is not null and p_before_rank not in (0, 1, 2)) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ATTENTION','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  -- ATTENTION = what waits for the applicant (rank 0), ACTIVE = a still-open application (rank 1), HISTORY = the rest (rank 2): the three sections of the screen.
  v_scope_rank := case p_scope when 'ATTENTION' then 0 when 'ACTIVE' then 1 when 'HISTORY' then 2 end;
  if p_before_rank is not null and v_scope_rank is not null and p_before_rank <> v_scope_rank then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  -- EX-04 S2 (B10 Moje prijave). The order is the one rpc_list_my_applications() has always had: what waits for me first, then the open ones, then the rest, each
  -- newest submission first, the id as the last tie-breaker. The keyset carries all three values of that order (rank, sortAt, id), so a page boundary can fall anywhere,
  -- inside a tie or between two sections, and no application is skipped or repeated for a reason of the order itself.
  with own as materialized (
    select o.*, r.price_basis as application_price_basis, snap.pricing_mode as application_price_mode
    from private.own_application_rows(v_actor) o
    join public.marketplace_responses r on r.id=o.application_id
    left join private.response_application_snapshots snap on snap.response_id=r.id and snap.response_version=r.current_version
  ), page as (
    select o.* from own o
    where (v_scope_rank is null or o.application_rank = v_scope_rank)
      and (p_before_at is null
           or o.application_rank > p_before_rank
           or (o.application_rank = p_before_rank and (o.sort_at < p_before_at or (o.sort_at = p_before_at and o.application_id > p_before_id))))
    order by o.application_rank, o.sort_at desc, o.application_id
    limit p_limit + 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId', p.application_id, 'id', p.application_id, 'sortAt', p.sort_at,
        'needId', p.need_id, 'needRevision', p.current_need_revision,
        'submittedNeedRevision', p.submitted_against_need_revision, 'version', p.current_version,
        'state', p.application_state, 'title', p.title, 'description', p.description,
        'approximateCity', nullif(btrim(p.approximate_city), ''), 'approximateArea', nullif(btrim(p.approximate_area), ''),
        'startsAt', p.starts_at, 'endsAt', p.ends_at, 'scheduleKind', p.schedule_kind,
        'executionLocationMode', p.execution_location_mode, 'taskTimezone', p.task_timezone,
        'priceMode', p.price_mode, 'priceBasis', p.price_basis, 'requiredSlots', p.required_slots,
        'priceRsd', p.price_rsd, 'applicationPriceBasis', p.application_price_basis,
        'applicationPriceMode', p.application_price_mode, 'currency', 'RSD',
        'priceReviewRequired', p.application_price_basis is null and p.application_state='STALE_REVIEW_REQUIRED', 'coveredSlots', p.covered_slots,
        'scopeNote', coalesce(p.scope_note, ''), 'agreementId', p.agreement_id,
        'requiresStaleReview', p.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', p.application_rank = 0,
        'canWithdraw',
          p.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and p.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and p.submitted_against_need_revision = p.current_need_revision
          and p.raw_need_status in ('PUBLISHED','SELECTION')
          and p.agreement_id is null,
        'submittedAt', p.submitted_at
      ) order by p.application_rank, p.sort_at desc, p.application_id), '[]'::jsonb) from page p),
    -- The four counts of the tabs ride with the first page; a later page does not pay for them again.
    case when p_before_at is null then (select jsonb_build_object(
        'total', count(*),
        'attention', count(*) filter (where o.application_rank = 0),
        'active', count(*) filter (where o.application_rank = 1),
        'finished', count(*) filter (where o.application_rank = 2)) from own o) end
  into v_items, v_counts;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'applicationId')::uuid)) order by ord), '[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'counts', v_counts,
    'asOf', statement_timestamp());
end
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_list_need_candidates(p_need_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;

  select n.* into v_need
  from public.needs n
  where n.id = p_need_id;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception using errcode='42501', message='NOT_REQUESTER';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
  into v_selected_slots
  from public.need_selections s
  where s.need_id = p_need_id
    and s.status = 'SELECTED';

  v_remaining_slots := greatest(coalesce(v_need.required_slots,1) - v_selected_slots, 0);

  with candidate_rows as (
    select
      r.id as response_id,
      r.worker_profile_id,
      r.status as raw_response_status,
      r.current_version,
      r.submitted_against_need_revision,
      r.submitted_at,
      v.need_revision as version_need_revision,
      v.content_hash,
      v.price_rsd,
      v.price_basis as application_price_basis,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.pricing_mode as application_price_mode,
      snap.worker_team_capacity,
      snap.worker_skills,
      snap.worker_tools,
      snap.worker_licenses,
      snap.worker_vehicles,
      p.profile_status as current_profile_status,
      p.display_name as current_display_name,
      p.city as current_city,
      p.skills as current_skills,
      p.team_capacity as current_team_capacity,
      public.rpc_get_public_profile(r.worker_profile_id) as public_profile,
      exists(
        select 1
        from public.agreements a
        where a.selected_response_id = r.id
      ) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
    left join public.app_profiles p
      on p.id = r.worker_profile_id
     and p.kind = 'WORKER'
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), classified as (
    select
      c.*,
      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id) states on states.response_id=c.response_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'responseId', c.response_id,
        'workerProfileId', c.worker_profile_id,
        'needRevision', v_need.revision,
        'responseNeedRevision', c.version_need_revision,
        'version', c.current_version,
        'contentHash', c.content_hash,
        'state', c.candidate_state,
        'canSelect', c.candidate_state = 'SELECTABLE' and coalesce(c.application_price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),false),
          'priceReviewRequired', c.application_price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
        'priceRsd', c.price_rsd,
          'applicationPriceBasis', c.application_price_basis,
          'applicationPriceMode', c.application_price_mode,
          'currency', 'RSD',
        'coveredSlots', c.covered_slots,
        'remainingSlots', v_remaining_slots,
        'proposedStartAt', c.proposed_start_at,
        'proposedEndAt', c.proposed_end_at,
        'scopeNote', coalesce(c.scope_note,''),
        'publicProfile', c.public_profile,
        'applicationEvidence', case
          when c.snapshot_schema is null then jsonb_build_object(
            'schema','LEGACY_UNPROVEN',
            'teamCapacity',null,
            'skills',null,
            'tools',null,
            'licenses',null,
            'vehicles',null
          )
          else jsonb_build_object(
            'schema',c.snapshot_schema,
            'teamCapacity',c.worker_team_capacity,
            'skills',to_jsonb(c.worker_skills),
            'tools',to_jsonb(c.worker_tools),
            'licenses',to_jsonb(c.worker_licenses),
            'vehicles',to_jsonb(c.worker_vehicles)
          )
        end
      )
      order by c.submitted_at asc nulls last, c.response_id
    ),
    '[]'::jsonb
  )
  into v_result
  from classified c;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'responseId')::uuid)) order by ord), '[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);
  select coalesce(jsonb_agg(item || case when item->>'calendarConflict'='true' then '{"canSelect":false}'::jsonb else '{}'::jsonb end order by ord),'[]'::jsonb)
  into v_result from jsonb_array_elements(v_result) with ordinality as entries(item,ord);

  return v_result;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_list_need_candidates_page(p_need_id uuid, p_limit integer DEFAULT 30, p_after_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_items jsonb;
  v_has_more boolean;
  v_total bigint;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_after_at is null) <> (p_after_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  select n.* into v_need
  from public.needs n
  where n.id = p_need_id;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception using errcode='42501', message='NOT_REQUESTER';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
  into v_selected_slots
  from public.need_selections s
  where s.need_id = p_need_id
    and s.status = 'SELECTED';

  v_remaining_slots := greatest(coalesce(v_need.required_slots,1) - v_selected_slots, 0);

  -- EX-04 S4 (A11). The same candidate document rpc_list_need_candidates returns, in its order (submission, then id), one keyset page at a time. The keys of the whole set are read
  -- with no function call; the state, the public profile and the evidence are computed for the candidates of THIS page only, so the work of a page does not grow with the task's applications.
  with keys as materialized (
    select r.id as response_id, coalesce(r.submitted_at, r.created_at) as sort_at
    from public.marketplace_responses r
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), page as materialized (
    select k.response_id, k.sort_at
    from keys k
    where p_after_at is null or (k.sort_at, k.response_id) > (p_after_at, p_after_id)
    order by k.sort_at, k.response_id
    limit p_limit + 1
  ), shown as materialized (
    select pg.response_id, pg.sort_at
    from page pg
    order by pg.sort_at, pg.response_id
    limit p_limit
  ), candidate_rows as (
    select
      r.id as response_id,
      sh.sort_at,
      r.worker_profile_id,
      r.current_version,
      v.need_revision as version_need_revision,
      v.content_hash,
      v.price_rsd,
      v.price_basis as application_price_basis,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.pricing_mode as application_price_mode,
      snap.worker_team_capacity,
      snap.worker_skills,
      snap.worker_tools,
      snap.worker_licenses,
      snap.worker_vehicles
    from shown sh
    join public.marketplace_responses r on r.id = sh.response_id
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
  ), classified as (
    select
      c.*,
      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id, (select array_agg(sh.response_id) from shown sh)) states on states.response_id = c.response_id
  )
  select
    (select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'responseId', c.response_id,
          'workerProfileId', c.worker_profile_id,
          'needRevision', v_need.revision,
          'responseNeedRevision', c.version_need_revision,
          'version', c.current_version,
          'contentHash', c.content_hash,
          'state', c.candidate_state,
          'canSelect', c.candidate_state = 'SELECTABLE' and coalesce(c.application_price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),false),
          'priceReviewRequired', c.application_price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
          'priceRsd', c.price_rsd,
          'applicationPriceBasis', c.application_price_basis,
          'applicationPriceMode', c.application_price_mode,
          'currency', 'RSD',
          'coveredSlots', c.covered_slots,
          'remainingSlots', v_remaining_slots,
          'proposedStartAt', c.proposed_start_at,
          'proposedEndAt', c.proposed_end_at,
          'scopeNote', coalesce(c.scope_note,''),
          'publicProfile', public.rpc_get_public_profile(c.worker_profile_id),
          'applicationEvidence', case
            when c.snapshot_schema is null then jsonb_build_object(
              'schema','LEGACY_UNPROVEN',
              'teamCapacity',null,
              'skills',null,
              'tools',null,
              'licenses',null,
              'vehicles',null
            )
            else jsonb_build_object(
              'schema',c.snapshot_schema,
              'teamCapacity',c.worker_team_capacity,
              'skills',to_jsonb(c.worker_skills),
              'tools',to_jsonb(c.worker_tools),
              'licenses',to_jsonb(c.worker_licenses),
              'vehicles',to_jsonb(c.worker_vehicles)
            )
          end,
          'sortAt', c.sort_at
        )
        order by c.sort_at, c.response_id
      ),
      '[]'::jsonb) from classified c),
    (select count(*) from page) > p_limit,
    -- The total rides with the first page; a later page does not pay for it again.
    case when p_after_at is null then (select count(*) from keys) end
  into v_items, v_has_more, v_total;

  -- CAL01: boolean only, behind the existing owner-scoped reader; no foreign agreement details.
  select coalesce(jsonb_agg(item || jsonb_build_object('calendarConflict',
    private.application_calendar_conflict_v1((item->>'responseId')::uuid)) order by ord), '[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);
  select coalesce(jsonb_agg(item || case when item->>'calendarConflict'='true' then '{"canSelect":false}'::jsonb else '{}'::jsonb end order by ord),'[]'::jsonb)
  into v_items from jsonb_array_elements(v_items) with ordinality as entries(item,ord);

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'counts', case when p_after_at is null then jsonb_build_object('total', v_total) end,
    'asOf', statement_timestamp());
end
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_resolve_stale_response_after_need_edit(p_response_id uuid, p_expected_response_version integer, p_expected_need_revision integer, p_client_request_id text, p_action text, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_action text := upper(btrim(coalesce(p_action,'')));
  v_request_hash text;
  v_existing private.response_revision_resolution_commands%rowtype;
  v_need_id uuid;
  v_need public.needs%rowtype;
  v_response public.marketplace_responses%rowtype;
  v_match jsonb;
  v_profile public.app_profiles;
  v_selected_slots integer;
  v_remaining_slots integer;
  v_new_version integer;
  v_covered integer;
  v_price integer;
  v_start timestamptz;
  v_end timestamptz;
  v_note text;
  v_content_hash text;
  v_result jsonb;
  v_price_review boolean := false;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_response_id is null or p_expected_response_version is null or p_expected_response_version < 1
     or p_expected_need_revision is null or p_expected_need_revision < 1 then
    raise exception 'RESPONSE_VERSION_NEED_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023'; end if;
  if v_action not in ('KEEP','UPDATE','WITHDRAW') then raise exception 'STALE_RESPONSE_ACTION_INVALID' using errcode='22023'; end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'responseId', p_response_id,
        'expectedResponseVersion', p_expected_response_version,
        'expectedNeedRevision', p_expected_need_revision,
        'action', v_action,
        'coveredSlots', p_covered_slots,
        'priceRsd', p_price_rsd,
        'proposedStartAt', p_proposed_start_at,
        'proposedEndAt', p_proposed_end_at,
        'scopeNote', coalesce(p_scope_note,'')
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4405));

  select * into v_existing
    from private.response_revision_resolution_commands c
   where c.worker_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
    return v_existing.result || jsonb_build_object('idempotentReplay', true);
  end if;

  select r.need_id into v_need_id from public.marketplace_responses r where r.id = p_response_id;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_need from public.needs n where n.id = v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_response from public.marketplace_responses r where r.id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;

  if v_response.worker_account_id <> v_actor then raise exception 'RESPONSE_NOT_OWNED' using errcode='42501'; end if;
  if v_response.current_version <> p_expected_response_version then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  if v_need.revision <> p_expected_need_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='PT409'; end if;
  -- A missing immutable unit needs an explicit review even when the task
  -- revision did not change. This is a read state, never a data backfill.
  v_price_review := v_response.price_basis is null
    and v_response.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED')
    and v_response.submitted_against_need_revision <= v_need.revision;
  if v_response.status <> 'STALE_REVIEW_REQUIRED' and not v_price_review then
    raise exception 'RESPONSE_NOT_AWAITING_REVIEW' using errcode='P0001';
  end if;
  if v_response.submitted_against_need_revision >= v_need.revision and not v_price_review then
    raise exception 'RESPONSE_ALREADY_CURRENT' using errcode='P0001';
  end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then raise exception 'NEED_NOT_OPEN' using errcode='P0001'; end if;
  if exists (select 1 from public.agreements a where a.selected_response_id = v_response.id) then
    raise exception 'RESPONSE_ALREADY_SELECTED' using errcode='P0001';
  end if;

  if v_action = 'WITHDRAW' then
    update public.notification_deliveries d set state='EXPIRED'
      from public.user_activity_events e
      where d.event_id=e.id and e.entity_type='RESPONSE' and e.entity_id=v_response.id
        and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE');
    update public.marketplace_responses
       set status = 'WITHDRAWN', withdrawn_at = statement_timestamp(), selected_at = null
     where id = v_response.id
     returning * into v_response;

    perform private.emit_event(v_need.requester_account_id,'REQUESTER','RESPONSE_WITHDRAWN',
      'RESPONSE',v_response.id,v_response.current_version,
      'Prijava je povučena','Prijava za tvoj zadatak je povučena.',
      'response-withdrawn:'||v_response.id::text||':'||v_response.current_version::text,
      'NORMAL',jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision),null);
    if (v_need.response_deadline is null or v_need.response_deadline > statement_timestamp())
       and public.fn_need_covered_slots(v_need.id) < v_need.required_slots then
      perform private.enqueue_dispatch(v_need.id,statement_timestamp());
    end if;

    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_response.current_version,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  else
    -- PKG-033: reconfirmation is an application to today's task, not a bypass.
    -- Withdrawal stays possible without a ready profile or matching world.
    if not private.accounts_same_world(v_need.requester_account_id, v_actor) then
      raise exception 'NEED_NOT_FOUND' using errcode='P0002';
    end if;
    if v_need.response_deadline is not null and v_need.response_deadline <= statement_timestamp() then
      raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode='22023';
    end if;
    -- KEEP/UPDATE is a new application to the current task. WITHDRAW and
    -- committed idempotent replays remain outside this admission check.
    if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
      raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
        hint='Vreme za ovaj zadatak je isteklo.';
    end if;
    select * into v_profile from public.app_profiles p
      where p.id = v_response.worker_profile_id for update;
    if not found or v_profile.account_id <> v_actor or v_profile.kind <> 'WORKER' then
      raise exception 'PROFILE_NOT_OWNED_BY_ACCOUNT' using errcode='42501';
    end if;
    if v_profile.profile_status is distinct from 'ACTIVE'
       or char_length(btrim(coalesce(v_profile.display_name,''))) < 2
       or char_length(btrim(coalesce(v_profile.city,''))) < 2
       or cardinality(coalesce(v_profile.skills,'{}')) < 1 then
      raise exception 'WORKER_PROFILE_NOT_READY' using errcode='P0001';
    end if;
    select coalesce(sum(s.covered_slots),0)::integer into v_selected_slots
      from public.need_selections s where s.need_id=v_need.id and s.status='SELECTED';
    v_remaining_slots := greatest(0, v_need.required_slots-v_selected_slots);
    if v_remaining_slots < 1 then raise exception 'NEED_FULL' using errcode='P0001'; end if;

    if v_action = 'KEEP' then
      -- KEEP never interprets an unknown unit or agrees to a changed unit.
      -- UPDATE is a fresh, user-reviewed version of the same application.
      if v_response.price_basis is null then
        raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
      elsif v_response.price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end) then
        raise exception 'APPLICATION_PRICE_BASIS_CHANGED' using errcode='PT409';
      end if;
      v_covered := v_response.covered_slots;
      v_price := v_response.price_rsd;
      v_start := v_response.proposed_start_at;
      v_end := v_response.proposed_end_at;
      v_note := v_response.scope_note;
    else
      v_covered := p_covered_slots;
      v_price := p_price_rsd;
      v_start := p_proposed_start_at;
      v_end := p_proposed_end_at;
      v_note := coalesce(p_scope_note,'');
    end if;

    if v_covered is null or v_covered < 1 then
      raise exception 'INVALID_COVERED_SLOTS' using errcode='22023';
    end if;
    -- WPP01: no personal-profile team limit; keep the task remaining-slot bound.
    if v_covered > v_remaining_slots then
      raise exception 'NEED_REMAINING_CAPACITY_EXCEEDED' using errcode='22023';
    end if;
    perform private.assert_application_price_v5(v_need, v_covered, v_price);
    if (v_start is null) <> (v_end is null)
       or (v_start is not null and v_end is not null and v_start >= v_end) then
      raise exception 'INVALID_PROPOSED_INTERVAL' using errcode='22023';
    end if;
    if char_length(coalesce(v_note,'')) > 1200 then raise exception 'SCOPE_NOTE_TOO_LONG' using errcode='22023'; end if;
    if v_start is null and v_need.schedule_kind='FIXED_WINDOW'
      and (v_need.starts_at is null or not isfinite(v_need.starts_at)
        or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
      raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
    end if;
    v_match := private.match_detail_for_calendar_interval(v_need.id, v_response.worker_profile_id,
      coalesce(v_start,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
      coalesce(v_end,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
    if not coalesce((v_match->>'responseAllowed')::boolean,false) then
      raise exception 'WORKER_NOT_ELIGIBLE' using errcode='P0001', detail=coalesce((v_match->'hardBlockers')::text,'[]');
    end if;

  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', v_need.revision,
    'pricingMode', v_need.mode,
    'applicationPriceBasis', (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'priceRsd', v_price,
    'coveredSlots', v_covered,
    'proposedStartAt', v_start,
    'proposedEndAt', v_end,
    'scopeNote', coalesce(btrim(v_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

    v_new_version := v_response.current_version + 1;

    update public.marketplace_responses
       set current_version = v_new_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = v_need.revision,
           covered_slots = v_covered,
           price_rsd = v_price,
           price_basis = (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
           proposed_start_at = v_start,
           proposed_end_at = v_end,
           scope_note = coalesce(v_note,''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null,
           selected_at = null
     where id = v_response.id
     returning * into v_response;

    insert into public.marketplace_response_versions(
      response_id, version, need_revision, covered_slots, price_rsd, price_basis,
      proposed_start_at, proposed_end_at, scope_note, content_hash
    ) values (
      v_response.id, v_new_version, v_need.revision, v_covered, v_price, (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
      v_start, v_end, coalesce(v_note,''), v_content_hash
    );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_response.id, v_new_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, v_covered,
    v_need.required_slots, v_selected_slots, v_remaining_slots,
    v_need.mode, v_need.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );


    v_result := jsonb_build_object(
      'responseId', v_response.id,
      'needId', v_need.id,
      'needRevision', v_need.revision,
      'version', v_new_version,
      'contentHash', v_content_hash,
      'applicationPriceBasis', (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
      'currency', 'RSD',
      'pricingMode', v_need.mode,
      'priceRsd', v_price,
      'coveredSlots', v_covered,
      'status', v_response.status,
      'action', v_action,
      'idempotentReplay', false,
      'authoritative', true
    );
  end if;

  perform private.audit_marketplace(
    v_actor,
    case when v_action='WITHDRAW' then 'STALE_RESPONSE_WITHDRAWN' else 'STALE_RESPONSE_RECONFIRMED' end,
    'RESPONSE',
    v_response.id,
    v_response.current_version,
    jsonb_build_object('needId',v_need.id,'needRevision',v_need.revision,'action',v_action)
  );

  insert into private.response_revision_resolution_commands(
    worker_account_id, client_request_id, request_hash, response_id, result
  ) values (v_actor, v_request_id, v_request_hash, v_response.id, v_result);

  return v_result;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_select_response(p_need_id uuid, p_need_revision integer, p_response_id uuid, p_response_version integer, p_content_hash text, p_client_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  v_need public.needs%rowtype;
  v_resp public.marketplace_responses%rowtype;
  v_ver public.marketplace_response_versions%rowtype;
  v_price_snapshot private.response_application_snapshots%rowtype;
  v_requested_ver public.marketplace_response_versions%rowtype;
  v_profile public.app_profiles%rowtype;
  v_command private.selection_commands%rowtype;
  v_policy private.connection_policy_versions%rowtype;
  v_selection_id uuid;
  v_agreement_id uuid;
  v_covered integer;
  v_terms jsonb;
  v_match jsonb;
  v_request_hash text;
  v_legacy_selected_by uuid;
  v_legacy_need_revision integer;
  v_legacy_response_id uuid;
  v_legacy_covered_slots integer;
  v_legacy_agreement_id uuid;
  v_legacy_response_version integer;
  v_legacy_content_hash text;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode = '22023';
  end if;

  select * into v_requested_ver
    from public.marketplace_response_versions
   where response_id = p_response_id
     and version = p_response_version;

  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'requesterAccountId', uid,
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'responseId', p_response_id,
    'responseVersion', p_response_version,
    'contentHash', p_content_hash,
    'coveredSlots', v_requested_ver.covered_slots
  )::text, 'UTF8')), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(uid::text || ':' || p_client_request_id, 7242)
  );

  select * into v_command
    from private.selection_commands c
   where c.requester_account_id = uid
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_command.agreement_id;
  end if;

  -- Pre-P0D-02/P0D-03 historical rows remain authoritative and are not
  -- retroactively charged or given fabricated activation receipts.
  select s.selected_by_account_id,
         s.need_revision,
         s.response_id,
         s.covered_slots,
         a.id,
         nullif(av.terms->>'response_version','')::integer,
         av.content_hash
    into v_legacy_selected_by,
         v_legacy_need_revision,
         v_legacy_response_id,
         v_legacy_covered_slots,
         v_legacy_agreement_id,
         v_legacy_response_version,
         v_legacy_content_hash
    from public.need_selections s
    join public.agreements a on a.selection_id = s.id
    left join public.agreement_versions av
      on av.agreement_id = a.id and av.version = 1
   where s.need_id = p_need_id
     and s.client_request_id = p_client_request_id;

  if found then
    if v_legacy_selected_by <> uid then
      raise exception 'NOT_REQUESTER' using errcode = '42501';
    end if;
    if v_legacy_need_revision <> p_need_revision
       or v_legacy_response_id is distinct from p_response_id
       or (v_requested_ver.response_id is not null
           and v_legacy_covered_slots <> v_requested_ver.covered_slots)
       or (v_legacy_response_version is not null
           and v_legacy_response_version <> p_response_version)
       or (v_legacy_content_hash is not null
           and v_legacy_content_hash <> p_content_hash) then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return v_legacy_agreement_id;
  end if;

  select * into v_need from public.needs where id = p_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_need.requester_account_id <> uid then raise exception 'NOT_REQUESTER' using errcode = '42501'; end if;
  if v_need.status not in ('PUBLISHED','SELECTION') then
    raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status; end if;

  if v_need.response_deadline is not null
     and v_need.response_deadline <= statement_timestamp() then
    raise exception 'RESPONSE_WINDOW_EXPIRED' using errcode = 'P0001', hint = 'Rok za prijave je istekao.';
  end if;

  -- Existing agreements and idempotent selection receipts returned above.
  -- Only a NEW selection is refused after the actual task-time boundary.
  if not private.need_search_time_admitted_v1(v_need.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if v_need.revision <> p_need_revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'need_revision',
      hint = 'Potreba je izmenjena. Pogledajte prijave ponovo.'; end if;

  select * into v_resp from public.marketplace_responses where id = p_response_id for update;
  if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_resp.need_id <> p_need_id then raise exception 'RESPONSE_NEED_MISMATCH' using errcode = 'P0001'; end if;
  if v_resp.status not in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
    raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status; end if;

  if v_resp.current_version <> p_response_version then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_version',
      hint = 'Uskocer je izmenio prijavu. Proverite je ponovo.'; end if;

  select * into v_ver from public.marketplace_response_versions
   where response_id = p_response_id and version = p_response_version;
  if not found then raise exception 'RESPONSE_VERSION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_ver.content_hash <> p_content_hash then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'content_hash',
      hint = 'Uslovi prijave su izmenjeni.'; end if;
  if v_ver.need_revision <> v_need.revision then
    raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = 'response_need_revision'; end if;

  select * into v_profile
    from public.app_profiles p
   where p.id = v_resp.worker_profile_id
   for share;

  if not found
     or v_profile.kind <> 'WORKER'
     or v_profile.account_id <> v_resp.worker_account_id
     or v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or (char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)
     or cardinality(v_profile.skills) < 1 then
    raise exception 'WORKER_PROFILE_NOT_READY' using errcode = 'P0001',
      hint = 'Uskocer vise nema vazeci spreman profil za izbor.';
  end if;

  -- WPP01: accept the people committed by this offer, subject to the
  -- existing task remaining-slot, calendar and price checks below.

  if (v_ver.proposed_start_at is null)<>(v_ver.proposed_end_at is null) then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
    and (v_need.starts_at is null or not isfinite(v_need.starts_at)
      or (v_need.ends_at is not null and (not isfinite(v_need.ends_at) or v_need.starts_at>=v_need.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- An old start-only task cannot be selected after its precise beginning.
  if v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is null
     and v_need.starts_at is not null and v_need.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, v_resp.worker_profile_id,
    coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception 'WORKER_NO_LONGER_ELIGIBLE' using errcode = 'P0001',
      detail = coalesce((v_match->'hardBlockers')::text,'[]'),
      hint = 'Uskocer vise ne ispunjava uslove Potrebe.';
  end if;

  -- Start-only selection must still reject an existing confirmed Dogovor
  -- that blocks the precise declared start. One microsecond is only a
  -- point-overlap probe, NOT a booked duration or task finish.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and
     private.worker_calendar_conflict(v_resp.worker_profile_id,v_need.starts_at,
       v_need.starts_at+interval '1 microsecond',null) then
    raise exception 'WORKER_CALENDAR_CONFLICT' using errcode='P0001';
  end if;
  v_covered := public.fn_need_covered_slots(p_need_id);
  if v_covered + v_resp.covered_slots > v_need.required_slots then
    raise exception 'OVERFILL' using errcode = 'P0001', hint = 'Ta prijava pokriva vise mesta nego sto je preostalo.'; end if;

  -- PKG-033: historical/reconfirmed offers cannot bypass today's fixed-price rule at selection.
  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);
  -- Selection consumes the reviewed immutable application, never a guess
  -- from today's task. Committed old selection receipts already replayed.
  if v_ver.price_basis is null or v_resp.price_basis is null then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  elsif v_ver.price_basis is distinct from (case when v_need.mode='MY_PRICE' and v_need.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end)
     or v_resp.price_basis is distinct from v_ver.price_basis then
    raise exception 'APPLICATION_PRICE_BASIS_CHANGED' using errcode='PT409';
  end if;
  select * into v_price_snapshot from private.response_application_snapshots
    where response_id=v_ver.response_id and response_version=v_ver.version;
  if not found or v_price_snapshot.pricing_mode is distinct from v_need.mode
     or v_price_snapshot.covered_slots is distinct from v_ver.covered_slots
     or v_price_snapshot.need_required_slots is distinct from v_need.required_slots then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  end if;

  select * into v_policy
    from private.connection_policy_versions
   where policy_key='REQUESTER_SELECTION_V1' and version=1;
  if not found
     or v_policy.beneficiary_role <> 'REQUESTER'
     or v_policy.activation_reason <> 'SELECTION'
     or v_policy.charge_mode <> 'PROMOTIONAL_FREE'
     or v_policy.unit_basis <> 'HEADCOUNT'
     or v_policy.platform_cost_rsd <> 0 then
    raise exception 'CONNECTION_POLICY_NOT_READY' using errcode='55000';
  end if;

  insert into public.need_selections(
    need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
    response_id,worker_account_id,worker_profile_id,selection_mode,status
  ) values (
    p_need_id,v_need.revision,uid,p_client_request_id,v_resp.covered_slots,
    p_response_id,v_resp.worker_account_id,v_resp.worker_profile_id,
    case when v_need.mode='FASTEST' then 'AUTO_FILL' else 'REQUESTER_SELECTS' end,
    'SELECTED'
  ) returning id into v_selection_id;

  v_terms := jsonb_build_object(
    'price_rsd',v_ver.price_rsd,'priceBasis',v_ver.price_basis,'currency','RSD',
    'pricingMode',v_price_snapshot.pricing_mode,
    'required_slots',v_price_snapshot.need_required_slots,'covered_slots',v_ver.covered_slots,
    -- Agreement calendar terms stay an honest complete pair or BOTH NULL.
    -- A declared start-only moment stays authoritative on the task; it is
    -- not a fabricated booking in private.agreement_calendar_interval().
    'proposed_start_at',coalesce(v_ver.proposed_start_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.starts_at end),
    'proposed_end_at',coalesce(v_ver.proposed_end_at,case when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then v_need.ends_at end),
    'schedule_source',case when v_ver.proposed_start_at is not null then 'APPLICATION_PROPOSAL'
      when v_need.schedule_kind='FIXED_WINDOW' and v_need.ends_at is not null then 'NEED_FIXED_WINDOW' else 'UNSCHEDULED' end,
    'scope_note',v_ver.scope_note,'need_revision',v_need.revision,
    'response_version',v_ver.version
  );
  -- Snapshot the requested exact start separately from the calendar reservation.
  -- Calendar interval uses ONLY a complete proposed_start_at/proposed_end_at pair.
  if v_ver.proposed_start_at is null and v_need.schedule_kind='FIXED_WINDOW'
     and v_need.ends_at is null and v_need.starts_at is not null then
    v_terms:=v_terms||jsonb_build_object('declared_start_at',v_need.starts_at);
  end if;

  insert into public.agreements(
    need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
    worker_account_id,worker_profile_id,current_version,status
  ) values (
    p_need_id,v_selection_id,p_response_id,v_need.requester_account_id,v_need.requester_profile_id,
    v_resp.worker_account_id,v_resp.worker_profile_id,1,'CONFIRMED'
  ) returning id into v_agreement_id;

  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,created_by_account_id
  ) values (v_agreement_id,1,'CONFIRMED',v_terms,v_ver.content_hash,uid);

  insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
  values (
    v_agreement_id,1,
    -- PKG-029b (deep read 12.7): remote or physical follows the place; the schedule decides only for a task
    -- written before the place had a mode.
    case when coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')
      then 'REMOTE' else 'PHYSICAL' end,
    'CONFIRMED'
  );

  insert into private.connection_activations(
    requester_account_id,beneficiary_account_id,client_request_id,request_hash,
    policy_key,policy_version,policy_snapshot,activation_reason,
    need_id,need_revision,selection_id,agreement_id,response_id,response_version,
    response_content_hash,worker_account_id,worker_profile_id,units,platform_cost_rsd,state
  ) values (
    uid,uid,p_client_request_id,v_request_hash,
    v_policy.policy_key,v_policy.version,v_policy.policy_snapshot,'SELECTION',
    p_need_id,p_need_revision,v_selection_id,v_agreement_id,p_response_id,p_response_version,
    p_content_hash,v_resp.worker_account_id,v_resp.worker_profile_id,v_ver.covered_slots,0,'SATISFIED'
  );

  update public.marketplace_responses
     set status='SELECTED',selected_at=statement_timestamp()
   where id=p_response_id;

  perform set_config('uskoci.need_lifecycle','SELECT',true);
  update public.needs
     set status=case when v_covered+v_resp.covered_slots >= v_need.required_slots
                     then 'ACTIVE' else 'SELECTION' end
   where id=p_need_id;

  insert into private.selection_commands(
    requester_account_id,client_request_id,request_hash,
    need_id,need_revision,response_id,response_version,
    response_content_hash,covered_slots,selection_id,agreement_id
  ) values (
    uid,p_client_request_id,v_request_hash,
    p_need_id,p_need_revision,p_response_id,p_response_version,
    p_content_hash,v_ver.covered_slots,v_selection_id,v_agreement_id
  );

  -- N02: domain event shares the Selection/Agreement/activation transaction.
  -- Preferences, suppression and channel dedupe remain owned by emit_event.
  perform private.emit_event(
    v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED',
    'RESPONSE', v_resp.id, v_ver.version,
    'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
    'response_selected:' || v_selection_id::text,
    'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)
  );

  return v_agreement_id;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_submit_response(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  n public.needs;
  v_profile public.app_profiles;
  v_resp public.marketplace_responses;
  v_command private.response_submit_commands;
  v_match jsonb;
  v_content_hash text;
  v_request_hash text;
  v_result jsonb;
  v_version integer;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
begin
  if u is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  if p_client_request_id is null
     or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception using errcode='22023', message='INVALID_CLIENT_REQUEST_ID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(u::text || ':' || p_client_request_id, 7241)
  );

  -- Bind only the semantic client command. Server-derived profile/Need snapshot
  -- intentionally does not enter the request hash, so a retry after a committed
  -- response replays the exact first result even if current context later moves.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  -- Shared mutation lock order remains Need first.
  select * into n
    from public.needs
   where id = p_need_id
   for update;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  if not private.accounts_same_world(n.requester_account_id, u) then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;

  select * into v_command
    from private.response_submit_commands c
   where c.worker_account_id = u
     and c.client_request_id = p_client_request_id
   for update;

  if found then
    if v_command.request_hash <> v_request_hash then
      raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_command.result || jsonb_build_object('idempotentReplay', true);
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    raise exception using errcode='22023', message='NEED_NOT_OPEN';
  end if;

  if n.requester_account_id = u then
    raise exception using errcode='42501', message='OWN_NEED';
  end if;

  if n.response_deadline is not null
     and n.response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='RESPONSE_WINDOW_EXPIRED';
  end if;

  -- New work uses the same actual task-time boundary as search/dispatch.
  -- Replay already returned above; evaluate after the Need lock was acquired.
  if not private.need_search_time_admitted_v1(n.id,clock_timestamp()) then
    raise exception 'NEED_EXECUTION_WINDOW_EXPIRED' using errcode='PT409',
      hint='Vreme za ovaj zadatak je isteklo.';
  end if;

  if n.revision is distinct from p_need_revision then
    raise exception using errcode='P0001', message='STALE_REVIEW_REQUIRED';
  end if;

  -- Lock the current Worker profile after the Need. ACTIVE alone is not enough
  -- for legacy rows: P0C-02 rechecks the exact RU-1 minimum readiness facts.
  select * into v_profile
    from public.app_profiles p
   where p.id = p_worker_profile_id
   for update;

  if not found
     or v_profile.account_id <> u
     or v_profile.kind <> 'WORKER' then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if v_profile.profile_status <> 'ACTIVE'
     or char_length(btrim(v_profile.display_name)) < 2
     or (char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)
     or cardinality(v_profile.skills) < 1 then
    raise exception using errcode='P0001', message='WORKER_PROFILE_NOT_READY';
  end if;

  select coalesce(sum(s.covered_slots), 0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = n.id
     and s.status = 'SELECTED';

  v_remaining_slots := greatest(0, n.required_slots - v_selected_slots);

  if v_remaining_slots < 1 then
    raise exception using errcode='P0001', message='NEED_FULL';
  end if;

  if p_covered_slots is null or p_covered_slots < 1 then
    raise exception using errcode='22023', message='INVALID_COVERED_SLOTS';
  end if;

  -- WPP01: people are committed per offer; the personal profile is not a team limit.
  -- Existing remaining-slot and pricing checks below remain authoritative.

  if p_covered_slots > v_remaining_slots then
    raise exception using
      errcode='22023',
      message='NEED_REMAINING_CAPACITY_EXCEEDED',
      detail=format('covered=%s,remaining=%s', p_covered_slots, v_remaining_slots);
  end if;

  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);

  if (p_proposed_start_at is null) <> (p_proposed_end_at is null)
     or (
       p_proposed_start_at is not null
       and p_proposed_end_at is not null
       and p_proposed_start_at >= p_proposed_end_at
     ) then
    raise exception using errcode='22023', message='INVALID_PROPOSED_INTERVAL';
  end if;

  if exists (
    select 1
      from public.marketplace_responses r
     where r.need_id = p_need_id
       and r.worker_account_id = u
       and (
         r.status = 'SELECTED'
         or exists (
           select 1
             from public.agreements a
            where a.selected_response_id = r.id
              and a.status in ('CONFIRMED','SUPERSEDED','COMPLETED')
         )
       )
  ) then
    raise exception using errcode='P0001', message='RESPONSE_ALREADY_SELECTED';
  end if;

  if p_proposed_start_at is null and n.schedule_kind='FIXED_WINDOW'
    and (n.starts_at is null or not isfinite(n.starts_at)
      or (n.ends_at is not null and (not isfinite(n.ends_at) or n.starts_at>=n.ends_at))) then
    raise exception 'NEED_FIXED_INTERVAL_INVALID' using errcode='22023';
  end if;
  -- Start-only appointment cannot accept a new offer after its start while lifecycle tick catches up.
  if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
     and n.starts_at is not null and n.starts_at<=statement_timestamp() then
    raise exception 'FIXED_WINDOW_START_PASSED' using errcode='22023';
  end if;
  v_match := private.match_detail_for_calendar_interval(p_need_id, p_worker_profile_id,
    coalesce(p_proposed_start_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.starts_at end),
    coalesce(p_proposed_end_at,case when n.schedule_kind='FIXED_WINDOW' and n.ends_at is not null then n.ends_at end));
  if not coalesce((v_match->>'responseAllowed')::boolean, false) then
    raise exception using
      errcode='P0001',
      message='WORKER_NOT_ELIGIBLE',
      detail=coalesce((v_match->'hardBlockers')::text, '[]');
  end if;

  select * into v_resp
    from public.marketplace_responses r
   where r.need_id = p_need_id
     and r.worker_account_id = u
     and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
   order by r.created_at desc
   limit 1
   for update;

  -- Content identity includes the server-derived self-declared capability/team
  -- snapshot. It is not public trust/verification and is never copied into the
  -- global public profile DTO.
  v_content_hash := encode(sha256(convert_to(jsonb_build_object(
    'needRevision', n.revision,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'priceRsd', p_price_rsd,
    'coveredSlots', p_covered_slots,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(btrim(p_scope_note), ''),
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'workerTeamCapacity', v_profile.team_capacity,
    'workerSkills', to_jsonb(v_profile.skills),
    'workerTools', '[]'::jsonb,
    'workerLicenses', to_jsonb(v_profile.licenses),
    'workerVehicles', '[]'::jsonb
  )::text, 'UTF8')), 'hex');

  if v_resp.id is null then
    insert into public.marketplace_responses (
      need_id, worker_account_id, worker_profile_id, response_kind, status,
      submitted_against_need_revision, current_version, covered_slots,
      price_rsd, price_basis, proposed_start_at, proposed_end_at, scope_note, submitted_at
    ) values (
      p_need_id, u, p_worker_profile_id, 'OFFER', 'SUBMITTED', n.revision, 1,
      p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end), p_proposed_start_at, p_proposed_end_at,
      coalesce(p_scope_note, ''), statement_timestamp()
    )
    returning * into v_resp;
    v_version := 1;
  else
    v_version := v_resp.current_version + 1;
    update public.marketplace_responses
       set current_version = v_version,
           status = 'SUBMITTED',
           submitted_against_need_revision = n.revision,
           covered_slots = p_covered_slots,
           price_rsd = p_price_rsd,
           price_basis = (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
           proposed_start_at = p_proposed_start_at,
           proposed_end_at = p_proposed_end_at,
           scope_note = coalesce(p_scope_note, ''),
           submitted_at = statement_timestamp(),
           withdrawn_at = null
     where id = v_resp.id
     returning * into v_resp;
  end if;

  insert into public.marketplace_response_versions (
    response_id, version, need_revision, covered_slots, price_rsd, price_basis,
    proposed_start_at, proposed_end_at, scope_note, content_hash
  ) values (
    v_resp.id, v_version, n.revision, p_covered_slots, p_price_rsd, (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    p_proposed_start_at, p_proposed_end_at, coalesce(p_scope_note, ''),
    v_content_hash
  );

  insert into private.response_application_snapshots (
    response_id, response_version, snapshot_schema,
    worker_profile_id, worker_team_capacity, covered_slots,
    need_required_slots, need_selected_slots_before_submit,
    need_remaining_slots_before_submit, pricing_mode, requester_price_rsd,
    worker_skills, worker_tools, worker_licenses, worker_vehicles
  ) values (
    v_resp.id, v_version, 'APPLICATION_V1_SELF_DECLARED',
    v_profile.id, v_profile.team_capacity, p_covered_slots,
    n.required_slots, v_selected_slots, v_remaining_slots,
    n.mode, n.requester_price_rsd,
    v_profile.skills, '{}'::text[], v_profile.licenses, '{}'::text[]
  );

  update public.opportunity_deliveries
     set status = 'RESPONDED',
         responded_at = statement_timestamp()
   where need_id = p_need_id
     and need_revision = n.revision
     and worker_account_id = u
     and status in ('READY','SEEN');

  v_result := jsonb_build_object(
    'responseId', v_resp.id,
    'applicationId', v_resp.id,
    'version', v_version,
    'needRevision', n.revision,
    'contentHash', v_content_hash,
    'status', v_resp.status,
    'pricingMode', n.mode,
    'applicationPriceBasis', (case when n.mode='MY_PRICE' and n.price_basis='HOURLY' then 'HOURLY' else 'TOTAL' end),
    'currency', 'RSD',
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'snapshotSchema', 'APPLICATION_V1_SELF_DECLARED',
    'authoritative', true,
    'idempotentReplay', false
  );

  insert into private.response_submit_commands (
    worker_account_id, client_request_id, request_hash,
    response_id, response_version, result
  ) values (
    u, p_client_request_id, v_request_hash,
    v_resp.id, v_version, v_result
  );

  -- PRE-V3: persisted version trigger owns Application semantic events.

  return v_result;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION private.own_application_rows(p_account uuid)
 RETURNS TABLE(application_id uuid, sort_at timestamp with time zone, need_id uuid, current_need_revision integer, submitted_against_need_revision integer, current_version integer, raw_response_status text, price_rsd integer, covered_slots integer, scope_note text, submitted_at timestamp with time zone, title text, description text, raw_need_status text, approximate_city text, approximate_area text, starts_at timestamp with time zone, ends_at timestamp with time zone, schedule_kind text, execution_location_mode text, task_timezone text, price_mode text, price_basis text, required_slots integer, agreement_id uuid, application_state text, application_rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  -- EX-04 S2 (B10): the ONE builder of "my applications". Every column of rpc_list_my_applications() and of the page, plus the facts of the task that the card needs
  -- (full term, execution mode, price mode and basis, people), the one state function, the one rank. The page and the counts read it, so a count can never differ from the list.
  select r.id, coalesce(r.submitted_at, r.created_at), r.need_id, n.revision, r.submitted_against_need_revision, r.current_version, r.status,
         r.price_rsd, r.covered_slots, r.scope_note, r.submitted_at,
         n.title, n.description, n.status, n.approximate_city, n.approximate_area, n.starts_at, n.ends_at, n.schedule_kind, n.execution_location_mode, n.task_timezone,
         n.mode, n.price_basis, n.required_slots,
         ag.id, st.state,
         case when (st.state = 'STALE_REVIEW_REQUIRED'
        or (st.state = 'SELECTED' and exists (select 1 from public.agreements a
          left join public.agreement_execution ae on ae.agreement_id = a.id
          where a.id = ag.id and a.status in ('CONFIRMED','SUPERSEDED')
            and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))) then 0 when st.state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1 else 2 end
  from public.marketplace_responses r
  join public.needs n on n.id = r.need_id
  left join lateral (select a.id from public.agreements a where a.selected_response_id = r.id order by a.created_at desc, a.id desc limit 1) ag on true
  cross join lateral (select private.my_application_state(
    case when r.price_basis is null and r.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
      and n.status in ('PUBLISHED','SELECTION') then 'STALE_REVIEW_REQUIRED' else r.status end,
    r.submitted_against_need_revision, n.revision, n.status,
    ag.id is not null and not exists (select 1 from public.agreements x where x.id = ag.id and x.status = 'CANCELLED')) as state) st
  where r.worker_account_id = p_account and r.status <> 'DRAFT'
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_propose_agreement_change_v2(p_agreement_id uuid, p_expected_version integer, p_patch jsonb, p_reason text, p_client_request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_current public.agreement_versions%rowtype;
  v_existing public.agreement_change_proposals%rowtype;
  v_terms jsonb;
  v_hash text;
  v_id uuid;
  v_start timestamptz; v_end timestamptz;
  v_old_start timestamptz; v_old_end timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'CHANGE_PATCH_REQUIRED' using errcode='22023';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'VERSION_REQUIRED' using errcode='22023';
  end if;
  if coalesce(btrim(p_client_request_id),'') = '' then
    raise exception 'CLIENT_REQUEST_ID_REQUIRED' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k
    where k not in ('price_rsd','currency','proposed_start_at','proposed_end_at','scope_note')) then
    raise exception 'UNSUPPORTED_CHANGE_FIELD' using errcode='22023';
  end if;

  if char_length(p_client_request_id)>200 or char_length(coalesce(p_reason,''))>4000
    or octet_length(p_patch::text)>65536 then
    raise exception 'CHANGE_INPUT_TOO_LARGE' using errcode='22023';
  end if;
  if (p_patch?'proposed_start_at')<>(p_patch?'proposed_end_at') then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  perform 1 from public.needs where id=(select ag.need_id from public.agreements ag
    where ag.id=p_agreement_id and v_uid in (ag.requester_account_id,ag.worker_account_id)) for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='P0002'; end if;
  select * into v_agreement from public.agreements where id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode='42501';
  end if;

  select * into v_existing from public.agreement_change_proposals
   where agreement_id=p_agreement_id and proposed_by_account_id=v_uid and client_request_id=p_client_request_id;
  if found then
    if v_existing.base_version is distinct from p_expected_version then
      raise exception 'CHANGE_REQUEST_ID_REUSED' using errcode='22023';
    end if;
  else
    if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
    if v_agreement.current_version <> p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  end if;
  -- A replay uses the original immutable base even after another change or
  -- terminal transition. This never writes or reopens the Agreement.
  select * into v_current from public.agreement_versions
   where agreement_id=p_agreement_id and version=p_expected_version;
  if not found then raise exception 'AGREEMENT_VERSION_NOT_FOUND' using errcode='P0002'; end if;
  v_terms := v_current.terms || p_patch;

  -- Match the existing positive int4 price_rsd and non-null text scope owner.
  -- No additional monetary, reason-length or scope-length policy is invented.
  if jsonb_typeof(v_terms->'price_rsd') is distinct from 'number' then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (v_terms->>'price_rsd')::numeric <= 0 or (v_terms->>'price_rsd')::numeric > 2147483647
     or trunc((v_terms->>'price_rsd')::numeric) <> (v_terms->>'price_rsd')::numeric then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (p_patch?'scope_note' and jsonb_typeof(p_patch->'scope_note') is distinct from 'string')
    or (coalesce(v_terms->'scope_note','null'::jsonb)<>'null'::jsonb and jsonb_typeof(v_terms->'scope_note') is distinct from 'string')
    or char_length(v_terms->>'scope_note')>4000 then
    raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023';
  end if;
  if v_terms ? 'currency' and (jsonb_typeof(v_terms->'currency') is distinct from 'string'
     or v_terms->>'currency' is distinct from 'RSD') then
    raise exception 'CHANGE_CURRENCY_INVALID' using errcode='22023';
  end if;
  select starts_at,ends_at into v_start,v_end from private.agreement_calendar_interval(v_terms);

  if v_existing.id is not null then
    select starts_at,ends_at into v_old_start,v_old_end
      from private.agreement_calendar_interval(v_existing.proposed_terms);
    if (v_terms-array['proposed_start_at','proposed_end_at','currency'])
         is distinct from (v_existing.proposed_terms-array['proposed_start_at','proposed_end_at','currency'])
       or coalesce(v_existing.proposed_terms->>'currency','RSD') <> 'RSD'
       or (v_existing.proposed_terms ? 'currency' and jsonb_typeof(v_existing.proposed_terms->'currency') is distinct from 'string')
       or v_start is distinct from v_old_start or v_end is distinct from v_old_end
       or nullif(btrim(p_reason),'') is distinct from v_existing.reason then
      raise exception 'CHANGE_REQUEST_ID_REUSED' using errcode='22023';
    end if;
    return v_existing.id;
  end if;

  -- A new monetary proposal must have a known accepted unit. Old replay
  -- receipts returned above; rejection/withdrawal remains independently valid.
  if coalesce(v_current.terms->>'priceBasis','') not in ('TOTAL','HOURLY') then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  end if;
  if jsonb_typeof(v_current.terms->'covered_slots') is distinct from 'number'
     or (v_current.terms->>'covered_slots')::numeric not between 1 and 50
     or trunc((v_current.terms->>'covered_slots')::numeric)<>(v_current.terms->>'covered_slots')::numeric then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
  end if;

  if not exists(select 1 from public.agreement_execution ex where ex.agreement_id=v_agreement.id
    and ex.agreement_version=v_agreement.current_version and ex.state='CONFIRMED' and ex.worker_marked_done_at is null) then
    raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001';
  end if;

  if exists(select 1 from public.agreement_change_proposals where agreement_id=v_agreement.id and status='PENDING') then
    raise exception 'AGREEMENT_CHANGE_PENDING' using errcode='P0001';
  end if;
  v_hash := encode(extensions.digest(convert_to(v_terms::text,'UTF8'),'sha256'),'hex');
  insert into public.agreement_change_proposals(
    agreement_id,base_version,proposed_terms,content_hash,reason,client_request_id,proposed_by_account_id
  ) values (
    p_agreement_id,v_agreement.current_version,v_terms,v_hash,nullif(btrim(p_reason),''),p_client_request_id,v_uid
  ) returning id into v_id;
  perform private.emit_event(
    case when v_uid=v_agreement.requester_account_id then v_agreement.worker_account_id else v_agreement.requester_account_id end,
    case when v_uid=v_agreement.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CHANGE_PROPOSED','AGREEMENT',v_agreement.id,v_agreement.current_version,
    'Predložena je izmena Dogovora','Pogledajte predlog i odgovorite u Dogovoru.',
    'agreement_change_proposed:'||v_id::text,'NORMAL',jsonb_build_object('proposal_id',v_id)
  );
  return v_id;
end;
$function$

$r07_definition$;
  EXECUTE $r07_definition$
CREATE OR REPLACE FUNCTION public.rpc_respond_agreement_change(p_proposal_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_proposal public.agreement_change_proposals%rowtype;
  v_agreement public.agreements%rowtype;
  v_agreement_id uuid;
  v_base_terms jsonb;
  v_terms jsonb;
  v_new_version integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_accept is null then raise exception 'DECISION_REQUIRED' using errcode='22004'; end if;

  -- Discover without locking. Every decision then locks Agreement -> proposal,
  -- including rejection/replay, so sibling acceptances cannot form a cycle.
  select agreement_id into v_agreement_id from public.agreement_change_proposals where id=p_proposal_id;
  if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
  perform 1 from public.needs where id=(select ag.need_id from public.agreements ag
    where ag.id=v_agreement_id and v_uid in (ag.requester_account_id,ag.worker_account_id)) for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='P0002'; end if;
  select * into v_agreement from public.agreements where id=v_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then raise exception 'NOT_PARTY' using errcode='42501'; end if;
  select * into v_proposal from public.agreement_change_proposals
    where id=p_proposal_id and agreement_id=v_agreement.id for update;
  if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid = v_proposal.proposed_by_account_id then raise exception 'PROPOSER_CANNOT_RESPOND' using errcode='42501'; end if;

  if v_proposal.status = 'ACCEPTED' and p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_proposal.base_version+1,'authoritative',true);
  elsif v_proposal.status = 'REJECTED' and not p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_proposal.base_version,'authoritative',true);
  elsif v_proposal.status <> 'PENDING' then
    raise exception 'PROPOSAL_NOT_PENDING' using errcode='P0001', detail=v_proposal.status;
  end if;
  if not exists(select 1 from public.agreement_execution ex where ex.agreement_id=v_agreement.id
    and ex.agreement_version=v_agreement.current_version and ex.state='CONFIRMED' and ex.worker_marked_done_at is null) then
    raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001';
  end if;

  if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if v_agreement.current_version <> v_proposal.base_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  if not p_accept then
    update public.agreement_change_proposals
       set status='REJECTED', responded_by_account_id=v_uid, responded_at=statement_timestamp()
     where id=v_proposal.id;
    perform private.emit_event(
      v_proposal.proposed_by_account_id,
      case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
      'AGREEMENT_CHANGE_REJECTED','AGREEMENT',v_agreement.id,v_agreement.current_version,
      'Predlog izmene nije prihvaćen','Važeći uslovi Dogovora ostaju nepromenjeni.',
      'agreement_change_rejected:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
    );
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_proposal.base_version,'authoritative',true);
  end if;

  -- Revalidate stored proposals too: older pending rows were not type-checked.
  -- Invalid historical data remains immutable and can still be rejected.
  v_terms := v_proposal.proposed_terms;
  select terms into v_base_terms from public.agreement_versions
    where agreement_id=v_agreement.id and version=v_proposal.base_version;
  if not found then raise exception 'AGREEMENT_VERSION_NOT_FOUND' using errcode='P0002'; end if;
  -- Rejected proposals and already committed outcomes returned above.
  -- A new acceptance cannot assign a meaning to a legacy unknown unit.
  if coalesce(v_base_terms->>'priceBasis','') not in ('TOTAL','HOURLY') then
    raise exception 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED' using errcode='PT409';
  end if;
  if v_terms->>'priceBasis' is distinct from v_base_terms->>'priceBasis' then
    raise exception 'APPLICATION_PRICE_BASIS_CHANGED' using errcode='PT409';
  end if;
  if jsonb_typeof(v_base_terms->'covered_slots') is distinct from 'number'
     or (v_base_terms->>'covered_slots')::numeric not between 1 and 50
     or trunc((v_base_terms->>'covered_slots')::numeric)<>(v_base_terms->>'covered_slots')::numeric
     or v_terms->'covered_slots' is distinct from v_base_terms->'covered_slots' then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
  end if;
  if coalesce(v_terms->'scope_note','null'::jsonb)='null'::jsonb and coalesce(v_base_terms->'scope_note','null'::jsonb)<>'null'::jsonb then raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_terms) is distinct from 'object' or
     (v_terms-array['price_rsd','currency','proposed_start_at','proposed_end_at','scope_note']) is distinct from
     (v_base_terms-array['price_rsd','currency','proposed_start_at','proposed_end_at','scope_note']) then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
  end if;
  if jsonb_typeof(v_terms->'price_rsd') is distinct from 'number' then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (v_terms->>'price_rsd')::numeric <= 0 or (v_terms->>'price_rsd')::numeric > 2147483647
     or trunc((v_terms->>'price_rsd')::numeric) <> (v_terms->>'price_rsd')::numeric then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (coalesce(v_terms->'scope_note','null'::jsonb)<>'null'::jsonb and jsonb_typeof(v_terms->'scope_note') is distinct from 'string')
    or char_length(v_terms->>'scope_note')>4000 then
    raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023';
  end if;
  if v_terms ? 'currency' and (jsonb_typeof(v_terms->'currency') is distinct from 'string'
     or v_terms->>'currency' is distinct from 'RSD') then
    raise exception 'CHANGE_CURRENCY_INVALID' using errcode='22023';
  end if;
  perform 1 from private.agreement_calendar_interval(v_terms);
  if encode(extensions.digest(convert_to(v_terms::text,'UTF8'),'sha256'),'hex') is distinct from v_proposal.content_hash then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
  end if;

  v_new_version := v_agreement.current_version + 1;
  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,supersedes_version,created_by_account_id
  ) values (
    v_agreement.id,v_new_version,'CONFIRMED',v_proposal.proposed_terms,v_proposal.content_hash,
    v_agreement.current_version,v_proposal.proposed_by_account_id
  );
  update public.agreement_versions set status='SUPERSEDED'
   where agreement_id=v_agreement.id and version=v_agreement.current_version;
  update public.agreements set current_version=v_new_version, updated_at=statement_timestamp()
   where id=v_agreement.id;
  update public.agreement_execution set agreement_version=v_new_version, updated_at=statement_timestamp()
   where agreement_id=v_agreement.id;
  update public.agreement_change_proposals
     set status='ACCEPTED', responded_by_account_id=v_uid, responded_at=statement_timestamp()
   where id=v_proposal.id;
  update public.agreement_change_proposals
     set status='SUPERSEDED', responded_at=coalesce(responded_at,statement_timestamp())
   where agreement_id=v_agreement.id and id<>v_proposal.id and status='PENDING';
  perform private.emit_event(
    v_proposal.proposed_by_account_id,
    case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
    'AGREEMENT_VERSION_CHANGED','AGREEMENT',v_agreement.id,v_new_version,
    'Izmena Dogovora je prihvaćena','Pogledajte važeće uslove u Dogovoru.',
    'agreement_version_changed:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
  );
  return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_new_version,'authoritative',true);
end;
$function$

$r07_definition$;
  EXECUTE $r07_receipt_reader$
CREATE OR REPLACE FUNCTION public.rpc_read_response_submit_result(p_need_id uuid, p_need_revision integer, p_worker_profile_id uuid, p_covered_slots integer, p_price_rsd integer, p_proposed_start_at timestamp with time zone, p_proposed_end_at timestamp with time zone, p_scope_note text, p_client_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  u uuid := auth.uid();
  v_request_hash text;
  v_command private.response_submit_commands%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_client_request_id is null or char_length(btrim(p_client_request_id)) not between 8 and 200 then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode='22023';
  end if;
  -- The exact submit command hash, without reading today's task or profile.
  -- This owner-only receipt lookup never attempts the uncertain write again.
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'needId', p_need_id,
    'needRevision', p_need_revision,
    'workerProfileId', p_worker_profile_id,
    'coveredSlots', p_covered_slots,
    'priceRsd', p_price_rsd,
    'proposedStartAt', p_proposed_start_at,
    'proposedEndAt', p_proposed_end_at,
    'scopeNote', coalesce(p_scope_note, '')
  )::text, 'UTF8')), 'hex');
  select * into v_command from private.response_submit_commands
    where worker_account_id=u and client_request_id=p_client_request_id;
  if not found then
    return jsonb_build_object('found',false,'authoritative',true,'result',null);
  end if;
  if v_command.request_hash <> v_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
  end if;
  return jsonb_build_object('found',true,'authoritative',true,
    'result',v_command.result||jsonb_build_object('idempotentReplay',true));
end;
$function$;

$r07_receipt_reader$;
  REVOKE ALL ON FUNCTION public.rpc_read_response_submit_result(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text) FROM PUBLIC, anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION public.rpc_read_response_submit_result(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text) TO authenticated, service_role;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.rpc_read_response_submit_result(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)')
    AND md5(p.prosrc)='f7e9160f6467549680dfc7633315c41c' AND p.prosecdef AND p.provolatile='s'
    AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND pg_get_userbyid(p.proowner)='postgres'
    AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
    AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    AND has_function_privilege('service_role',p.oid,'EXECUTE')
    AND NOT EXISTS(SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0)) THEN
    RAISE EXCEPTION 'R07B_RECEIPT_READER_POSTCHECK_FAILED' USING errcode='55000';
  END IF;
  expected := '{"private.assert_application_price_v5":{"body_md5":"2b4fef19b3fc70d57dca3144a63ca5e4","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"i","result":"void","signature":"private.assert_application_price_v5(public.needs,integer,integer)"},"public.rpc_ai_open_need_edit_conversation_v2":{"body_md5":"0e5211a136ad2be3afe25fde5f777ef6","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_ai_open_need_edit_conversation_v2(uuid)"},"public.rpc_list_my_applications":{"body_md5":"c10facf02e711f85373458edc3cde10c","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_my_applications()"},"public.rpc_list_my_applications_page":{"body_md5":"28e460ff8b0f140bc9b41d50fc8a7640","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)"},"public.rpc_list_need_candidates":{"body_md5":"4096a29c4ef6dbaeb987a58a9c9dba32","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_need_candidates(uuid)"},"public.rpc_list_need_candidates_page":{"body_md5":"11b6ca6fa48ac74b76c6e7cd09c25c3c","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)"},"public.rpc_resolve_stale_response_after_need_edit":{"body_md5":"fb8132db33279190478b5be0480721fa","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)"},"public.rpc_select_response":{"body_md5":"02934f7831db821a7b33fd6d40289b9a","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=public, pg_temp"],"definer":true,"strict":false,"volatility":"v","result":"uuid","signature":"public.rpc_select_response(uuid,integer,uuid,integer,text,text)"},"public.rpc_submit_response":{"body_md5":"398e85c4420da9c4765ae0ff6197a59e","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)"},"private.own_application_rows":{"body_md5":"3bb9a8c4150504f84b6657dd7a17aec4","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"TABLE(application_id uuid, sort_at timestamp with time zone, need_id uuid, current_need_revision integer, submitted_against_need_revision integer, current_version integer, raw_response_status text, price_rsd integer, covered_slots integer, scope_note text, submitted_at timestamp with time zone, title text, description text, raw_need_status text, approximate_city text, approximate_area text, starts_at timestamp with time zone, ends_at timestamp with time zone, schedule_kind text, execution_location_mode text, task_timezone text, price_mode text, price_basis text, required_slots integer, agreement_id uuid, application_state text, application_rank integer)","signature":"private.own_application_rows(uuid)"},"public.rpc_propose_agreement_change_v2":{"body_md5":"29c046b3e56c64d20e38d4144001201f","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"uuid","signature":"public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)"},"public.rpc_respond_agreement_change":{"body_md5":"40bf812611f9bfb18524411c92b86641","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_respond_agreement_change(uuid,boolean)"}}'::jsonb;
  SELECT (SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    FROM jsonb_each(expected) e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature')) INTO observed;
  IF observed IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'R07B_POSTIMAGE_MISMATCH' USING errcode='55000';
  END IF;
  SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'prosrc') INTO after_attributes
    FROM jsonb_each(expected) e JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
  IF after_attributes IS DISTINCT FROM prior_attributes THEN
    RAISE EXCEPTION 'R07B_FUNCTION_METADATA_CHANGED' USING errcode='55000';
  END IF;
  PERFORM set_config('search_path',old_search_path,true);
END;
$r07_price_snapshot$;
