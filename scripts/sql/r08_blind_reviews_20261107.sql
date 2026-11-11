-- R08: bilateral blind review publication and 14-day completion-bound window.
-- Canonical DEV leqcwgzvjsxugfgzdmth, reviewed Product master section 177.
-- Two private typed helpers; nine existing bodies. No table, receipt/hash, RLS,
-- event payload, moderation, closure, world/block rule or historical row change.
DO $r08_blind_reviews$
DECLARE
 expected jsonb := '{"public.rpc_submit_agreement_review":{"body_md5":"ff68b552c4f972e5d58a632672bc359e","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)"},"public.rpc_submit_agreement_review_v2":{"body_md5":"75a88570ff847b97a7d71b0854acf171","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_submit_agreement_review_v2(uuid,uuid,jsonb,jsonb,uuid,jsonb)"},"public.rpc_get_my_agreement_review":{"body_md5":"75a8b78ec8a5e6334f42366b4461c14c","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_get_my_agreement_review(uuid)"},"public.rpc_get_my_agreement_review_v2":{"body_md5":"60fb54e25317d6c2873321e66588dbeb","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_get_my_agreement_review_v2(uuid)"},"private.account_reputation":{"body_md5":"f03e558ff56a31a0b49e394714b628cd","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"private.account_reputation(uuid)"},"public.rpc_list_received_reviews_v1":{"body_md5":"9462ed163b1e4a465c68ad72d18f0e3d","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_received_reviews_v1(integer,text)"},"public.rpc_list_review_comments_v1":{"body_md5":"0712dcb3bfb25ec782f40c0fe47f17c3","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_review_comments_v1(uuid,integer,jsonb)"},"public.rpc_home_attention":{"body_md5":"1703b04e248759a19cbcc539621ed906","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_home_attention()"},"public.rpc_list_my_agreements_page":{"body_md5":"02c73cc4db95c2198f54888d7a377003","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)"},"private.guard_review_immutable":{"body_md5":"f883b4ed1be3dfa5401f98f9bdfe1960","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"v","result":"trigger","signature":"private.guard_review_immutable()"},"private.guard_review_comment_mutation":{"body_md5":"5280b99f20c4a7be695d7e16402b3f43","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"trigger","signature":"private.guard_review_comment_mutation()"},"private.closure_redaction_relations_v5":{"body_md5":"102e417ab6d52ab0eec421a8bda5c0c4","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"i","result":"text[]","signature":"private.closure_redaction_relations_v5()"},"private.closure_redaction_scope_v5":{"body_md5":"81dbe706544b14990da7fe2bebb6bbb2","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"i","result":"text","signature":"private.closure_redaction_scope_v5(text)"},"private.review_receipt":{"body_md5":"7058b3cc23f853edaea9cb21cdb865b1","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"s","result":"jsonb","signature":"private.review_receipt(private.agreement_reviews,boolean)"},"private.review_tags_valid":{"body_md5":"69ca0f79f5869c13bcfaa392cc0ac6fa","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"i","result":"boolean","signature":"private.review_tags_valid(text[])"},"private.review_tag_catalog":{"body_md5":"2b2ccb8e1c2672d091c3e319e4b1ea49","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":false,"strict":false,"volatility":"i","result":"text[]","signature":"private.review_tag_catalog()"},"public.rpc_get_account_reputation":{"body_md5":"4166221185edf108338898ba04f5e48a","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_get_account_reputation(uuid)"},"public.rpc_get_public_profile":{"body_md5":"9ecc0b69096f1167d02e0bb7b9656bc0","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"jsonb","signature":"public.rpc_get_public_profile(uuid)"},"private.received_reviews_detail_v1":{"body_md5":"990523c10a4e40152068570cdb71371d","owner":"postgres","acl":"{postgres=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"s","result":"text","signature":"private.received_reviews_detail_v1()"},"public.rpc_confirm_completion":{"body_md5":"658006c318c3847ab7a9f80706ef3003","owner":"postgres","acl":"{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"jsonb","signature":"public.rpc_confirm_completion(uuid)"},"public.rpc_tick_auto_completion":{"body_md5":"b617890420e11846dbe528ffc4d800d7","owner":"postgres","acl":"{postgres=X/postgres,service_role=X/postgres}","config":["search_path=pg_catalog"],"definer":true,"strict":false,"volatility":"v","result":"integer","signature":"public.rpc_tick_auto_completion()"}}'::jsonb;
 observed jsonb;
 prior_attributes jsonb;
 after_attributes jsonb;
 old_search_path text := current_setting('search_path');
BEGIN
 PERFORM set_config('search_path','pg_catalog',true);
 SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 IF observed IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R08_REVIEW_SOURCE_OR_ACL_DRIFT' USING errcode='55000';END IF;
 IF to_regprocedure('private.agreement_review_deadline_v1(uuid)') IS NOT NULL
 OR to_regprocedure('private.agreement_review_published_v1(uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'R08_REVIEW_HELPER_ALREADY_EXISTS' USING errcode='55000';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='private.agreement_reviews'::regclass
   AND t.tgname='pre_v3_review_immutable' AND t.tgenabled='O'
   AND t.tgfoid='private.guard_review_immutable()'::regprocedure AND t.tgtype=27)
 OR EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN('private.agreement_reviews'::regclass,'private.agreement_review_comments_v1'::regclass)
   AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR c.relacl::text IS DISTINCT FROM '{postgres=arwdDxtm/postgres}')) THEN
  RAISE EXCEPTION 'R08_REVIEW_IMMUTABILITY_OR_PRIVACY_DRIFT' USING errcode='55000';END IF;
 SELECT jsonb_object_agg(e.key,to_jsonb(p)-'prosrc') INTO prior_attributes FROM jsonb_each(expected)e
 JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 EXECUTE $deadline$CREATE FUNCTION private.agreement_review_deadline_v1(p_agreement_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
 -- Fourteen elapsed days from authoritative current-version completion.
 -- No Agreement/update/message date is a substitute for missing completion.
 select x.completed_at+interval '336 hours'
 from public.agreements a
 join public.agreement_execution x on x.agreement_id=a.id and x.agreement_version=a.current_version
 where a.id=p_agreement_id and a.status='COMPLETED' and x.state='COMPLETED'
  and x.completed_at is not null and isfinite(x.completed_at)
  and x.completed_at<=statement_timestamp();
$function$;
$deadline$;
 EXECUTE $published$CREATE FUNCTION private.agreement_review_published_v1(p_review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
 -- Review stars are immutable, DELETE is forbidden, and account closure keeps
 -- their rows. A later comment hide/redaction cannot undo bilateral publication.
 -- Account/profile closure, world and block gates remain in the existing readers.
 select coalesce((
  select deadline.at_time is not null and (
    statement_timestamp()>=deadline.at_time or exists(
      select 1 from private.agreement_reviews counterpart
       where counterpart.agreement_id=r.agreement_id
        and counterpart.reviewer_account_id=r.target_account_id
        and counterpart.target_account_id=r.reviewer_account_id))
  from private.agreement_reviews r
  join public.agreements a on a.id=r.agreement_id
  cross join lateral(select private.agreement_review_deadline_v1(a.id) as at_time) deadline
  where r.id=p_review_id
   and r.reviewer_account_id in(a.requester_account_id,a.worker_account_id)
   and r.target_account_id=case when r.reviewer_account_id=a.requester_account_id
     then a.worker_account_id else a.requester_account_id end
 ),false);
$function$;
$published$;
 REVOKE ALL ON FUNCTION private.agreement_review_deadline_v1(uuid),private.agreement_review_published_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
 EXECUTE $review0$
CREATE OR REPLACE FUNCTION public.rpc_submit_agreement_review(p_agreement_id uuid, p_target_account_id uuid, p_rating jsonb, p_tags jsonb, p_client_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;
 rating_value numeric; tags_value text[]; h text; target_role text; review_deadline timestamptz;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_agreement_id is null or p_target_account_id is null or p_target_account_id=u or p_client_request_id is null
 or jsonb_typeof(p_rating) is distinct from 'number' or length(p_rating::text)>30 then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 rating_value:=(p_rating#>>'{}')::numeric;
 if rating_value not between 1 and 5 or trunc(rating_value)<>rating_value then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 if jsonb_typeof(p_tags) is distinct from 'array' then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 if jsonb_array_length(p_tags)>3 or exists(select 1 from jsonb_array_elements(p_tags) t
  where jsonb_typeof(t.value)<>'string' or not (t.value#>>'{}'=any(private.review_tag_catalog()))) then
  raise exception 'REVIEW_TAGS_INVALID' using errcode='22023';
 end if;
 tags_value:=array(select t.value#>>'{}' from jsonb_array_elements(p_tags) t order by (t.value#>>'{}') collate "C");
 if not private.review_tags_valid(tags_value) then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 h:=encode(extensions.digest(jsonb_build_object('agreementId',p_agreement_id,'target',p_target_account_id,
  'rating',rating_value::integer,'tags',to_jsonb(tags_value))::text,'sha256'),'hex');
 -- Same successful command remains an immutable read, even after a later block.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-command:'||u::text||':'||p_client_request_id::text,9120));
 select * into r from private.agreement_reviews where reviewer_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return private.review_receipt(r,true);
 end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_target_account_id<>(case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end) then
  raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501';
 end if;
 -- A successful immutable request replay above remains readable after expiry.
 -- New reviews require the actual current-version completion timestamp.
 review_deadline:=private.agreement_review_deadline_v1(a.id);
 if review_deadline is null then
  raise exception 'REVIEW_NOT_COMPLETED' using errcode='55000';
 end if;
 if statement_timestamp()>=review_deadline then
  raise exception 'REVIEW_WINDOW_CLOSED' using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-agreement:'||a.id::text||':'||u::text,9120));
 if exists(select 1 from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u) then
  raise exception 'REVIEW_ALREADY_SUBMITTED' using errcode='55000';
 end if;
 -- A block cannot remove the counterpart's completed-work review entitlement.
 -- P8 suppresses ordinary deliveries, including this event, for blocked pairs.
 insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash)
 values(a.id,u,p_target_account_id,rating_value::integer,tags_value,p_client_request_id,h) returning * into r;
 perform private.audit_marketplace(u,'AGREEMENT_REVIEW_SUBMITTED','AGREEMENT',a.id,a.current_version,jsonb_build_object('reviewId',r.id));
 target_role:=case when u=a.requester_account_id then 'WORKER' else 'REQUESTER' end;
 perform private.emit_event(p_target_account_id,target_role,'REVIEW_RECEIVED','AGREEMENT',a.id,a.current_version,
  'Nova ocena','Dobili ste ocenu za završen Dogovor.','agreement-review:'||r.id::text,'NORMAL','{}'::jsonb,null);
 return private.review_receipt(r,false);
end;
$function$
$review0$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_submit_agreement_review','body_md5'],to_jsonb('e33d97a04f2948175a74148cd8c525af'::text));
 EXECUTE $review1$
CREATE OR REPLACE FUNCTION public.rpc_submit_agreement_review_v2(p_agreement_id uuid, p_target_account_id uuid, p_rating jsonb, p_tags jsonb, p_client_request_id uuid, p_comment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;
 rating_value numeric; tags_value text[]; h text; target_role text; review_deadline timestamptz;
 comment_value text; comment_sha text; stored_comment text; stored_sha text;
begin
 -- D12: the legacy review command (same auth, validation order, locks, eligibility, star hash, audit row and REVIEW_RECEIVED event, byte for byte in behaviour) plus ONE optional comment
 -- that is stored in the SAME transaction as the stars and never later. The legacy function stays untouched and keeps serving every installed build.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_agreement_id is null or p_target_account_id is null or p_target_account_id=u or p_client_request_id is null
 or jsonb_typeof(p_rating) is distinct from 'number' or length(p_rating::text)>30 then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 rating_value:=(p_rating#>>'{}')::numeric;
 if rating_value not between 1 and 5 or trunc(rating_value)<>rating_value then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 if jsonb_typeof(p_tags) is distinct from 'array' then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 if jsonb_array_length(p_tags)>3 or exists(select 1 from jsonb_array_elements(p_tags) t
  where jsonb_typeof(t.value)<>'string' or not (t.value#>>'{}'=any(private.review_tag_catalog()))) then
  raise exception 'REVIEW_TAGS_INVALID' using errcode='22023';
 end if;
 tags_value:=array(select t.value#>>'{}' from jsonb_array_elements(p_tags) t order by (t.value#>>'{}') collate "C");
 if not private.review_tags_valid(tags_value) then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 -- The star hash keeps the legacy formula exactly (so every stored hash and every replay through either function stays compatible); the comment is bound by its own digest in its own row.
 h:=encode(extensions.digest(jsonb_build_object('agreementId',p_agreement_id,'target',p_target_account_id,
  'rating',rating_value::integer,'tags',to_jsonb(tags_value))::text,'sha256'),'hex');
 comment_value:=private.review_comment_input_v1(p_comment);
 comment_sha:=case when comment_value is null then null else encode(extensions.digest(convert_to(comment_value,'UTF8'),'sha256'),'hex') end;
 -- Same successful command remains an immutable read, even after a later block.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-command:'||u::text||':'||p_client_request_id::text,9120));
 select * into r from private.agreement_reviews where reviewer_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  -- A comment that differs from the stored one (or one added to a stored star-only review) is another command under the same id.
  select c.comment,c.comment_sha256 into stored_comment,stored_sha from private.agreement_review_comments_v1 c where c.review_id=r.id;
  if stored_sha is distinct from comment_sha then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return private.review_receipt(r,true)||jsonb_build_object('comment',stored_comment);
 end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_target_account_id<>(case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end) then
  raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501';
 end if;
 -- A successful immutable request replay above remains readable after expiry.
 -- New reviews require the actual current-version completion timestamp.
 review_deadline:=private.agreement_review_deadline_v1(a.id);
 if review_deadline is null then
  raise exception 'REVIEW_NOT_COMPLETED' using errcode='55000';
 end if;
 if statement_timestamp()>=review_deadline then
  raise exception 'REVIEW_WINDOW_CLOSED' using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-agreement:'||a.id::text||':'||u::text,9120));
 if exists(select 1 from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u) then
  raise exception 'REVIEW_ALREADY_SUBMITTED' using errcode='55000';
 end if;
 -- A block cannot remove the counterpart's completed-work review entitlement (stars and comment alike; a refusal would reveal the block).
 -- P8 suppresses ordinary deliveries, including this event, for blocked pairs. The comment is hidden from readers while the pair is blocked, at read time.
 insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash)
 values(a.id,u,p_target_account_id,rating_value::integer,tags_value,p_client_request_id,h) returning * into r;
 if comment_value is not null then
  insert into private.agreement_review_comments_v1(review_id,author_account_id,target_account_id,comment,comment_sha256,created_at)
  values(r.id,r.reviewer_account_id,r.target_account_id,comment_value,comment_sha,r.created_at);
 end if;
 perform private.audit_marketplace(u,'AGREEMENT_REVIEW_SUBMITTED','AGREEMENT',a.id,a.current_version,jsonb_build_object('reviewId',r.id));
 target_role:=case when u=a.requester_account_id then 'WORKER' else 'REQUESTER' end;
 perform private.emit_event(p_target_account_id,target_role,'REVIEW_RECEIVED','AGREEMENT',a.id,a.current_version,
  'Nova ocena','Dobili ste ocenu za zavr'||chr(353)||'en Dogovor.','agreement-review:'||r.id::text,'NORMAL','{}'::jsonb,null);
 return private.review_receipt(r,false)||jsonb_build_object('comment',comment_value);
end;
$function$
$review1$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_submit_agreement_review_v2','body_md5'],to_jsonb('4dae51d1a5b14b9d76c4431495c138d1'::text));
 EXECUTE $review2$
CREATE OR REPLACE FUNCTION public.rpc_get_my_agreement_review(p_agreement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 select * into r from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u;
 own_review:=case when found then private.review_receipt(r,false) else null end;
 return jsonb_build_object('accountId',u,'agreementId',a.id,
 'targetAccountId',case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
 'eligible',coalesce(own_review is null and not private.closure_account_restricted(u)
   and statement_timestamp()<private.agreement_review_deadline_v1(a.id),false),
 'review',own_review,'tagCatalog',jsonb_build_object('version','PRE_V3_REVIEW_TAGS_V1','maxTags',3,'tags',to_jsonb(private.review_tag_catalog())),
 'authoritative',true);
end;
$function$
$review2$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_get_my_agreement_review','body_md5'],to_jsonb('50ac52d8051ab4bed9c8cc212e6b0eac'::text));
 EXECUTE $review3$
CREATE OR REPLACE FUNCTION public.rpc_get_my_agreement_review_v2(p_agreement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb; own_comment text;
begin
 -- D12: the legacy context (same participant gate, same eligibility incl. the closure restriction, same tag catalog) plus the author's OWN comment inside the review and the comment policy.
 -- The presence of THIS function is the capability a new client tests; an older server answers PGRST202 and the client falls back to the legacy pair.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 select * into r from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u;
 if found then
  select c.comment into own_comment from private.agreement_review_comments_v1 c where c.review_id=r.id;
  own_review:=private.review_receipt(r,false)||jsonb_build_object('comment',own_comment);
 end if;
 return jsonb_build_object('accountId',u,'agreementId',a.id,
 'targetAccountId',case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
 'eligible',coalesce(own_review is null and not private.closure_account_restricted(u)
   and statement_timestamp()<private.agreement_review_deadline_v1(a.id),false),
 'review',own_review,'tagCatalog',jsonb_build_object('version','PRE_V3_REVIEW_TAGS_V1','maxTags',3,'tags',to_jsonb(private.review_tag_catalog())),
 'commentPolicy',jsonb_build_object('supported',true,'maxLength',500,'version','REVIEW_COMMENT_V1'),
 'authoritative',true);
end;
$function$
$review3$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_get_my_agreement_review_v2','body_md5'],to_jsonb('c506ccaee6d97781a25d4a70dc333157'::text));
 EXECUTE $review4$
CREATE OR REPLACE FUNCTION private.account_reputation(account_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select jsonb_build_object('accountId',account_id,'reviewCount',count(*),
 'averageRating',case when count(*)=0 then null else round(avg(rating),2) end,
 'state',case when count(*)=0 then 'NO_REVIEWS' else 'RATED' end,'authoritative',true)
 from private.agreement_reviews r where r.target_account_id=account_id
  and private.agreement_review_published_v1(r.id);
$function$
$review4$;
 expected:=jsonb_set(expected,ARRAY['private.account_reputation','body_md5'],to_jsonb('b0567136e7c969834c31c3c697717692'::text));
 EXECUTE $review5$
CREATE OR REPLACE FUNCTION public.rpc_list_received_reviews_v1(p_limit integer DEFAULT 20, p_after text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer;
  v_after_at timestamptz;
  v_after_id uuid;
  v_mode text;
  v_page jsonb;
  v_items jsonb;
  v_more boolean;
  v_total bigint;
  v_listed bigint;
begin
  -- PROFILE-TRUST (2026-10-07): the CALLER's received reviews, newest first, keyset paged (createdAt, reviewId), at most 50 a page.
  -- Every item is the caller's own Dogovor (agreementId, taskTitle). Which reviews are listed one by one is the owner's open
  -- decision (private.received_reviews_detail_v1(), default COMMENTED_ONLY: the accepted D12 default keeps star-only reviews
  -- aggregate-only); totalCount and notListedCount make the list add up to the public reviewCount.
  -- The comment follows the D12 reader rules (public.rpc_list_review_comments_v1) for the reviewed person as viewer, with the owner's
  -- decision A09 (2026-10-02): a hidden (moderated) comment, an author under a closure restriction, an author in another world and an
  -- author whose profile is not ACTIVE show no comment and no face; a comment whose AUTHOR blocked the caller IS shown with the
  -- author's face masked (agreementId stays, so it can be reported); a comment by someone the CALLER blocked is not shown and the
  -- face is masked. Only bilaterally published reviews enter this list or its totals.
  -- Comment moderation/visibility never edits the immutable published stars.
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if private.closure_account_restricted(v_actor) then raise exception 'ACCOUNT_CLOSING' using errcode = '42501'; end if;
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  if p_after is not null then
    if p_after !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z[|][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'INVALID_PAGE' using errcode = '22023';
    end if;
    begin
      v_after_at := split_part(p_after, '|', 1)::timestamptz;
      v_after_id := split_part(p_after, '|', 2)::uuid;
    exception when data_exception then
      raise exception 'INVALID_PAGE' using errcode = '22023';
    end;
  end if;
  v_mode := private.received_reviews_detail_v1();
  with base as (
    select rv.id, rv.created_at, rv.rating, rv.tags, rv.agreement_id,
      rv.reviewer_account_id = ag.requester_account_id as by_requester,
      n.title,
      ap.id as author_profile_id, ap.display_name as author_name, ap.avatar_path as author_avatar,
      coalesce(ap.profile_status = 'ACTIVE' and ap.kind in ('REQUESTER', 'WORKER'), false) as author_active,
      cm.review_id is not null as has_comment, cm.comment, cm.hidden_at,
      exists(select 1 from private.account_blocks b where b.active
              and b.blocker_account_id = rv.reviewer_account_id and b.blocked_account_id = v_actor) as author_blocked_me,
      exists(select 1 from private.account_blocks b where b.active
              and b.blocker_account_id = v_actor and b.blocked_account_id = rv.reviewer_account_id) as i_blocked_author,
      private.closure_account_restricted(rv.reviewer_account_id) as author_restricted,
      private.accounts_same_world(v_actor, rv.reviewer_account_id) as same_world
    from private.agreement_reviews rv
    join public.agreements ag on ag.id = rv.agreement_id
    join public.needs n on n.id = ag.need_id
    left join public.app_profiles ap
      on ap.id = case when rv.reviewer_account_id = ag.requester_account_id then ag.requester_profile_id else ag.worker_profile_id end
     and ap.account_id = rv.reviewer_account_id
    left join private.agreement_review_comments_v1 cm
      on cm.review_id = rv.id and cm.author_account_id = rv.reviewer_account_id and cm.target_account_id = rv.target_account_id
    where rv.target_account_id = v_actor
      and private.agreement_review_published_v1(rv.id)
  ), decided as (
    select b.*,
      (b.author_active and not b.author_restricted and b.same_world and not b.author_blocked_me and not b.i_blocked_author) as face_visible,
      (b.has_comment and b.hidden_at is null and b.author_active and not b.author_restricted and b.same_world
        and not b.i_blocked_author) as comment_visible
    from base b
  ), listed as (
    select d.* from decided d where v_mode = 'ALL' or d.comment_visible
  ), page as (
    select l.* from listed l
     where v_after_at is null or (l.created_at, l.id) < (v_after_at, v_after_id)
     order by l.created_at desc, l.id desc
     limit v_limit + 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'reviewId', p.id,
        'rating', p.rating,
        'tags', to_jsonb(p.tags),
        'createdAt', p.created_at,
        'agreementId', p.agreement_id,
        'taskTitle', p.title,
        'receivedAs', case when p.by_requester then 'WORKER' else 'REQUESTER' end,
        'reviewer', case when p.face_visible
          then jsonb_build_object('profileId', p.author_profile_id, 'role', case when p.by_requester then 'REQUESTER' else 'WORKER' end,
                                  'displayName', nullif(btrim(p.author_name), ''), 'avatarPath', p.author_avatar, 'masked', false)
          else jsonb_build_object('profileId', null, 'role', case when p.by_requester then 'REQUESTER' else 'WORKER' end,
                                  'displayName', null, 'avatarPath', null, 'masked', true) end,
        'comment', case when p.comment_visible then p.comment end,
        'cursor', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || p.id::text)
        order by p.created_at desc, p.id desc), '[]'::jsonb) from page p),
    (select count(*) from decided),
    (select count(*) from listed)
  into v_page, v_total, v_listed;
  v_more := jsonb_array_length(v_page) > v_limit;
  if v_more then v_page := v_page - v_limit; end if;
  select coalesce(jsonb_agg(e.item - 'cursor' order by e.ord), '[]'::jsonb) into v_items
    from jsonb_array_elements(v_page) with ordinality e(item, ord);
  return jsonb_build_object(
    'schema', 'RECEIVED_REVIEWS_V1',
    'mode', v_mode,
    'items', v_items,
    'hasMore', v_more,
    'nextAfter', case when v_more then v_page->(v_limit - 1)->>'cursor' end,
    'limit', v_limit,
    'totalCount', v_total,
    'notListedCount', v_total - v_listed,
    'asOf', statement_timestamp(),
    'authoritative', true);
end;
$function$
$review5$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_list_received_reviews_v1','body_md5'],to_jsonb('fb06cbe102ff971cb2d3733bcd31d784'::text));
 EXECUTE $review6$
CREATE OR REPLACE FUNCTION public.rpc_list_review_comments_v1(p_profile_id uuid, p_limit integer DEFAULT 20, p_after jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v_actor uuid:=auth.uid(); v_profile public.app_profiles; v_limit integer; v_after_at timestamptz; v_after_id uuid; v_items jsonb; v_more boolean;
begin
 -- D12: the gated reader of the written comments ABOUT the person whose public profile is open. One paged, account-level list (a review is account-level reputation, both roles pooled);
 -- only bilaterally published reviews that carry a visible comment appear (a star-only review has no text row, but the public count and average still include it, so for a small count the rating of a star-only review can be inferred by subtraction from the
 -- listed ratings: an owner-visible consequence, README_D12_CANDIDATE.md); stars, the count and the average are never changed by anything here.
 -- DESIGN DEFAULT D-DEC-7 (the owner accepted the defaults of the design): ONE account-level list usable from both profile kinds, so the same reviewIds and texts appear under the REQUESTER and the WORKER profile of one person and each item names the role
 -- of its author: an observer who has seen both faces can LINK them by comparing lists. A role-scoped list is a function-only change (add: and the target role of the Agreement equals v_profile.kind) that needs no certificate move; it is NOT implemented here.
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_profile_id is null then raise exception 'PROFILE_ID_REQUIRED' using errcode='22023'; end if;
 v_limit:=least(greatest(coalesce(p_limit,20),1),50);
 if p_after is not null and jsonb_typeof(p_after)<>'null' then
  if jsonb_typeof(p_after)<>'object' or jsonb_typeof(p_after->'createdAt') is distinct from 'string' or jsonb_typeof(p_after->'reviewId') is distinct from 'string' then
   raise exception 'INVALID_PAGE' using errcode='22023';
  end if;
  begin
   v_after_at:=(p_after->>'createdAt')::timestamptz; v_after_id:=(p_after->>'reviewId')::uuid;
  exception when data_exception then raise exception 'INVALID_PAGE' using errcode='22023';
  end;
 end if;
 -- The gate stack of rpc_get_public_profile, in the same order and with the same safe failure: an ACTIVE profile only, closure-restricted viewer or subject, a blocked pair and another world all read as "nothing here".
 select p.* into v_profile from public.app_profiles p where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in('REQUESTER','WORKER');
 if not found then return null; end if;
 if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
 if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
 if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;
 -- Read-time gating of every row: a hidden comment, an author under a closure restriction, a pair VIEWER/author that is blocked either way (the viewer-versus-subject pair is gated above), another world, or an author profile that is not ACTIVE is not listed.
 -- DELIBERATELY NO viewer-independent block gate: a block between the author and the reviewed person must NOT remove the comment for third viewers, otherwise either party could censor or re-publish the text for everybody by toggling a block (the author edit/delete path
 -- the owner forbade, through a side door). It still hides the text from the one person who blocked its author, because that person is the VIEWER here. Hiding for everyone is the audited moderation HIDE only.
 -- KNOWN CONSEQUENCE (owner-visible, NOT decided here): the block is symmetric, so when the AUTHOR blocks the reviewed person (or blocked them before writing) that person is the viewer of a blocked pair and no longer sees the comment
 -- about them (nor its agreementId, so they cannot report it from here), is not notified, and every third viewer still sees it; the block costs the author nothing and the only remedy is the audited service-role HIDE. Options: README_D12_CANDIDATE.md.
 -- No write-time refusal exists for any of this (it would reveal a block); the author's profile is the face of the Agreement role in which the review was written. The only place an account id can appear is inside avatarPath, exactly as rpc_get_public_profile returns it.
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.review_id desc),'[]'::jsonb) into v_items from (
  select c.created_at,c.review_id,
   jsonb_build_object('reviewId',c.review_id,'rating',rv.rating,'comment',c.comment,'createdAt',c.created_at,
    'agreementId',case when v_actor=c.target_account_id then rv.agreement_id else null end,
    'author',jsonb_build_object('profileId',ap.id,'role',ap.kind,'displayName',nullif(btrim(ap.display_name),''),'avatarPath',ap.avatar_path)) as item
  from private.agreement_review_comments_v1 c
  join private.agreement_reviews rv on rv.id=c.review_id
  join public.agreements ag on ag.id=rv.agreement_id
  join public.app_profiles ap on ap.id=case when ag.requester_account_id=c.author_account_id then ag.requester_profile_id else ag.worker_profile_id end
   and ap.account_id=c.author_account_id
  where c.target_account_id=v_profile.account_id and c.hidden_at is null
   and private.agreement_review_published_v1(rv.id)
   and ap.profile_status='ACTIVE' and ap.kind in('REQUESTER','WORKER')
   and not private.closure_account_restricted(c.author_account_id)
   and not private.safety_pair_blocked(v_actor,c.author_account_id)
   and private.accounts_same_world(v_actor,c.author_account_id)
   and (v_after_at is null or (c.created_at,c.review_id)<(v_after_at,v_after_id))
  order by c.created_at desc,c.review_id desc
  limit v_limit+1
 ) x;
 v_more:=jsonb_array_length(v_items)>v_limit;
 if v_more then v_items:=v_items-v_limit; end if;
 return jsonb_build_object('profileId',v_profile.id,'items',v_items,'hasMore',v_more,
  'nextAfter',case when v_more then jsonb_build_object('createdAt',v_items->(v_limit-1)->'createdAt','reviewId',v_items->(v_limit-1)->'reviewId') else null end,
  'authoritative',true);
end;
$function$
$review6$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_list_review_comments_v1','body_md5'],to_jsonb('7ed72f6c90a12f0adcdfc2d1aebe283f'::text));
 EXECUTE $review7$
CREATE OR REPLACE FUNCTION public.rpc_home_attention()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_restricted boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  -- Match the restrictive direct-read fence, including its denial for a closed account.
  -- Definer is required for own applications on non-public tasks, just like the existing readers.
  -- Never accept a caller-supplied account, and never grant private-schema access to the client.
  if not public.rpc_storage_account_open() then
    raise exception 'ACCOUNT_NOT_OPEN' using errcode = '42501';
  end if;
  v_restricted := private.closure_account_restricted(v_uid);

  with own_needs as materialized (
    select n.id, n.title, n.status, n.created_at,
      greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) as remaining,
      -- PKG-035: attention means an application the owner can currently select, not history.
      public.selectable_application_count(n)::bigint as application_count
    from public.needs n where n.requester_account_id = v_uid
      and n.status not in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
  ), own_applications as materialized (
    select r.id, r.need_id, n.title, r.submitted_at,
      private.my_application_state(r.status, r.submitted_against_need_revision, n.revision, n.status,
        exists(select 1 from public.agreements a where a.selected_response_id = r.id and a.status <> 'CANCELLED')) as state
    from public.marketplace_responses r join public.needs n on n.id = r.need_id
    where r.worker_account_id = v_uid and r.status <> 'DRAFT'
  ), flagged_applications as (
    select o.*, state = 'STALE_REVIEW_REQUIRED' as requires_stale_review,
      state in ('STALE_REVIEW_REQUIRED','SELECTED') as attention_required
    from own_applications o
  ), own_agreements as materialized (
    select a.id, a.need_id, n.title, a.created_at, a.requester_account_id,
      coalesce(ae.state, a.status) as state, ae.problem_opened_at is not null as problem_opened
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')
  ), rating_due as materialized (
    -- EX-04 S3 (RC-03): the finished Dogovori that wait for MY rating, by the answer of rpc_get_my_agreement_review(...).eligible, in one bounded pass.
    select a.id from public.agreements a
      join public.agreement_execution ae on ae.agreement_id = a.id and ae.state = 'COMPLETED'
    where v_uid in (a.requester_account_id, a.worker_account_id) and a.status = 'COMPLETED' and not v_restricted
      and statement_timestamp()<private.agreement_review_deadline_v1(a.id)
      and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid)
  ), attention as materialized (
    select 1 as priority, 'AGREEMENT_CONFIRM_COMPLETION'::text as reason,
      a.id as subject_id, a.need_id as task_id, a.id as agreement_id, null::uuid as application_id,
      a.title as task_title, null::bigint as application_count, a.created_at as sort_at
    from own_agreements a where a.state = 'AWAITING_REQUESTER' and a.requester_account_id = v_uid
    union all
    select 2, 'AGREEMENT_OPEN_PROBLEM', a.id, a.need_id, a.id, null::uuid, a.title, null::bigint, a.created_at
    from own_agreements a where a.problem_opened
    union all
    select 3, case when a.state = 'STALE_REVIEW_REQUIRED' or a.requires_stale_review
        then 'APPLICATION_STALE' else 'APPLICATION_ATTENTION' end,
      a.id, a.need_id, null::uuid, a.id, a.title, null::bigint, a.submitted_at
    from flagged_applications a
    where a.state in ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')
      and (a.state = 'STALE_REVIEW_REQUIRED' or a.requires_stale_review or a.attention_required)
    union all
    select 4, 'TASK_APPLICATIONS', n.id, n.id, null::uuid, null::uuid, n.title, n.application_count, n.created_at
    from own_needs n where n.status <> 'DRAFT' and n.remaining > 0 and n.application_count > 0
  ), preview as (
    select * from attention
    order by priority, sort_at desc nulls last,
      case when priority = 3 then subject_id end asc,
      case when priority <> 3 then subject_id end desc
    limit 3
  ), totals as (
    select (select count(*) from attention) as attention_count,
      (select count(*) from own_agreements) as agreement_count,
      (select count(*) from own_needs) as need_count,
      (select count(*) from own_applications where state in
        ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')) as application_count,
      (select count(*) from rating_due) as ratings_due,
      (select case when count(*) = 1 then (array_agg(id))[1] end from rating_due) as rating_due_agreement_id
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'asOf', statement_timestamp(),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'reason', reason, 'subjectId', subject_id, 'taskId', task_id,
      'agreementId', agreement_id, 'applicationId', application_id,
      'taskTitle', task_title, 'applicationCount', application_count, 'sortAt', sort_at
    ) order by priority, sort_at desc nulls last,
      case when priority = 3 then subject_id end asc,
      case when priority <> 3 then subject_id end desc), '[]'::jsonb) from preview),
    'counts', jsonb_build_object(
      'attention', t.attention_count, 'attentionMore', greatest(0, t.attention_count - 3),
      'activeAgreements', t.agreement_count, 'agreementsMore', greatest(0, t.agreement_count - 2),
      'ownActiveTasks', t.need_count, 'activeApplications', t.application_count,
      'activities', t.need_count + t.application_count,
      'activitiesMore', greatest(0, t.need_count + t.application_count - 5)),
    'ratings', jsonb_build_object('due', t.ratings_due, 'dueAgreementId', t.rating_due_agreement_id)
  ) into v_result from totals t;
  return v_result;
end
$function$
$review7$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_home_attention','body_md5'],to_jsonb('f3bc12de53c96fb50f011350c6cb9c9d'::text));
 EXECUTE $review8$
CREATE OR REPLACE FUNCTION public.rpc_list_my_agreements_page(p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
  v_restricted boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  -- EX-04 S3 (RC-03): whether MY rating of a finished Dogovor is still due is part of the page, so the client never has to ask once per Dogovor. It is exactly the answer of
  -- rpc_get_my_agreement_review(...).eligible: no review of mine yet, my account is not under a closure restriction, and the Dogovor and its execution are COMPLETED.
  v_restricted := private.closure_account_restricted(v_uid);
  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items
  from (
    select a.created_at, a.id,
      jsonb_build_object(
        'id', a.id, 'sortAt', a.created_at,
        'currentVersion', a.current_version,
        'status', coalesce(ae.state, a.status),
        'agreementStatus', a.status,
        'title', n.title,
        'approximateArea', n.approximate_area,
        'approximateCity', n.approximate_city,
        'requiredSlots', n.required_slots,
        'startsAt', n.starts_at,
        'terms', av.terms,
        'requesterAccountId', a.requester_account_id,
        'workerAccountId', a.worker_account_id, 'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,
        'requesterName', rp.display_name,
        'workerName', wp.display_name,
        'executionMode', ae.mode,
        'requesterDeadlineAt', ae.requester_deadline_at,
        'problemOpened', (ae.problem_opened_at is not null),
        'myPhoneShared', exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_by_account_id = v_uid
             and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())),
        'theirPhone', case
          when a.status = 'CONFIRMED' and exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id and g.channel = 'PHONE' and g.granted_to_account_id = v_uid
               and g.status = 'GRANTED'
             and private.safety_grant_valid(g.granted_by_account_id, g.granted_to_account_id, g.granted_at) and (g.expires_at is null or g.expires_at > statement_timestamp())
          ) then (
            select nullif(btrim(acc.phone), '') from public.app_accounts acc
             where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end)
          else null
        end,
        'pendingChange', (
          select jsonb_build_object('id', c.id, 'proposedByMe', c.proposed_by_account_id = v_uid, 'createdAt', c.created_at)
            from public.agreement_change_proposals c
           where c.agreement_id = a.id and c.status = 'PENDING'
           order by c.created_at desc, c.id desc
           limit 1),
        'createdAt', a.created_at,
        'ratingDue', coalesce(a.status = 'COMPLETED' and ae.state = 'COMPLETED' and not v_restricted
          and statement_timestamp()<private.agreement_review_deadline_v1(a.id)
          and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid), false)
      ) as payload
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and (p_scope = 'ALL' or (p_scope = 'ACTIVE') = (coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')))
      and (p_before_at is null or (a.created_at, a.id) < (p_before_at, p_before_id))
    order by a.created_at desc, a.id desc
    limit p_limit + 1
  ) x;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'asOf', statement_timestamp());
end
$function$
$review8$;
 expected:=jsonb_set(expected,ARRAY['public.rpc_list_my_agreements_page','body_md5'],to_jsonb('0f14c3a0a462096f5c3641fbd5629f43'::text));
 SELECT jsonb_object_agg(e.key,jsonb_build_object(
    'signature',e.value->>'signature','body_md5',md5(p.prosrc),
    'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'config',p.proconfig,
    'definer',p.prosecdef,'strict',p.proisstrict,'volatility',p.provolatile,'result',pg_get_function_result(p.oid)))
    INTO observed FROM jsonb_each(expected) e
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 IF observed IS DISTINCT FROM expected THEN RAISE EXCEPTION 'R08_REVIEW_POSTIMAGE_MISMATCH' USING errcode='55000';END IF;
 SELECT jsonb_object_agg(e.key,to_jsonb(p)-'prosrc') INTO after_attributes FROM jsonb_each(expected)e
 JOIN pg_proc p ON p.oid=to_regprocedure(e.value->>'signature');
 IF after_attributes IS DISTINCT FROM prior_attributes THEN
  RAISE EXCEPTION 'R08_REVIEW_METADATA_CHANGED' USING errcode='55000';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.agreement_review_deadline_v1(uuid)'::regprocedure) IS DISTINCT FROM 'a86bf830d7e536e75d1a6c680e4d2876'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.agreement_review_published_v1(uuid)'::regprocedure) IS DISTINCT FROM 'e222c4e0a1831c00200b0e30fac7b1bf'
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN('private.agreement_review_deadline_v1(uuid)'::regprocedure,'private.agreement_review_published_v1(uuid)'::regprocedure)
   AND (pg_get_userbyid(p.proowner)<>'postgres' OR NOT p.prosecdef OR p.provolatile<>'s'
     OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}')) THEN
  RAISE EXCEPTION 'R08_REVIEW_HELPER_POSTIMAGE_OR_ACL_MISMATCH' USING errcode='55000';END IF;
 PERFORM set_config('search_path',old_search_path,true);
END;
$r08_blind_reviews$;
