-- R06 bounded reconciliation: READ ONLY, aggregate/metadata output only.
-- Canonical DEV: leqcwgzvjsxugfgzdmth.
-- Does not call reserve/release/settlement/provider procedures, read message
-- bodies, expose account/operation IDs, or infer zero cost from missing usage.
WITH command_links AS (
  SELECT r.operation_id, 'NEED'::text AS surface, n.state, n.provider_dispatched
  FROM private.ai_test_reservations_v5 r
  JOIN private.ai_need_turn_commands n ON n.account_id=r.account_id AND n.client_request_id=r.operation_id
  WHERE r.settled_microusd IS NULL
  UNION ALL
  SELECT r.operation_id, 'WORKER', w.state, w.provider_dispatched
  FROM private.ai_test_reservations_v5 r
  JOIN private.worker_ai_turns w ON w.account_id=r.account_id AND w.client_request_id=r.operation_id
  WHERE r.settled_microusd IS NULL
  UNION ALL
  SELECT r.operation_id, 'QA', q.state, q.provider_dispatched
  FROM private.ai_test_reservations_v5 r
  JOIN private.qa_ai_commands q ON q.account_id=r.account_id AND q.id=r.operation_id
  WHERE r.settled_microusd IS NULL
  UNION ALL
  SELECT r.operation_id, 'PUBLICATION_REVIEW', v.state, NULL::boolean
  FROM private.ai_test_reservations_v5 r
  JOIN private.ai_task_review_commands v ON v.account_id=r.account_id AND v.attempt_id=r.operation_id
  WHERE r.settled_microusd IS NULL
), unknown_groups AS (
  SELECT r.kind, coalesce(l.surface,'NO_CURRENT_COMMAND_LINK') AS surface, l.state, l.provider_dispatched,
    count(*) AS count, sum(r.max_cost_microusd) AS hold_microusd,
    min(r.created_at) AS oldest, max(r.created_at) AS newest
  FROM private.ai_test_reservations_v5 r LEFT JOIN command_links l USING(operation_id)
  WHERE r.settled_microusd IS NULL
  GROUP BY r.kind,l.surface,l.state,l.provider_dispatched
), settlement_groups AS (
  SELECT r.kind,r.settlement_basis,count(*) AS count,
    sum(r.settled_microusd) AS settled_microusd,
    sum(r.max_cost_microusd) AS allocated_microusd,count(u.operation_id) AS usage_count,
    sum(private.ai_test_price_microusd(u.prompt_tokens,u.output_tokens))
      FILTER(WHERE u.operation_id IS NOT NULL) AS usage_priced_microusd
  FROM private.ai_test_reservations_v5 r LEFT JOIN private.ai_test_usage_v5 u USING(operation_id)
  GROUP BY r.kind,r.settlement_basis
), missing_measured_usage AS (
  SELECT count(*) AS count,sum(r.settled_microusd) AS settled_microusd,
    min(r.created_at) AS oldest,max(r.created_at) AS newest,
    count(*) FILTER(WHERE a.id IS NULL) AS auth_row_absent,
    count(*) FILTER(WHERE a.id IS NOT NULL AND a.deleted_at IS NOT NULL) AS auth_row_soft_deleted,
    count(*) FILTER(WHERE a.id IS NOT NULL AND a.deleted_at IS NULL) AS auth_row_live
  FROM private.ai_test_reservations_v5 r
  LEFT JOIN private.ai_test_usage_v5 u USING(operation_id)
  LEFT JOIN auth.users a ON a.id=r.account_id
  WHERE r.settlement_basis='MEASURED' AND u.operation_id IS NULL
), recent_usage AS (
  SELECT '2026-11-07_UTC'::text AS sample,count(*) AS count,
    sum(private.ai_test_price_microusd(prompt_tokens,output_tokens)) AS total_microusd,
    round(avg(private.ai_test_price_microusd(prompt_tokens,output_tokens)),2) AS mean_microusd,
    min(private.ai_test_price_microusd(prompt_tokens,output_tokens)) AS min_microusd,
    max(private.ai_test_price_microusd(prompt_tokens,output_tokens)) AS max_microusd,
    sum(prompt_tokens) AS prompt_tokens,sum(output_tokens) AS output_tokens,sum(total_tokens) AS total_tokens
  FROM private.ai_test_usage_v5 WHERE recorded_at>='2026-11-07T00:00:00Z'
    AND recorded_at<'2026-11-08T00:00:00Z'
), function_metadata AS (
  SELECT signature,md5(p.prosrc) AS body_md5,pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS definer,
    p.proconfig AS settings,p.proacl::text AS acl,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
  FROM unnest(ARRAY[
    'public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)',
    'public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer)',
    'public.rpc_ai_test_release_unused_reservation_service(uuid)',
    'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)',
    'private.ai_test_price_microusd(integer,integer)',
    'private.ai_test_stt_price_microusd(bigint,integer)'
  ]) signature JOIN pg_proc p ON p.oid=to_regprocedure(signature)
)
SELECT jsonb_build_object(
  'checked_at',clock_timestamp(),
  'budget',(SELECT to_jsonb(b) FROM private.ai_test_budget_v5 b WHERE singleton),
  'reservations',(SELECT jsonb_build_object(
    'count',count(*),'distinct_operations',count(DISTINCT operation_id),
    'unknown_count',count(*) FILTER(WHERE settled_microusd IS NULL),
    'unknown_hold_microusd',coalesce(sum(max_cost_microusd) FILTER(WHERE settled_microusd IS NULL),0),
    'settled_microusd',coalesce(sum(settled_microusd),0),
    'ledger_exposure_microusd',sum(coalesce(settled_microusd,max_cost_microusd)),
    'earliest',min(created_at),'latest',max(created_at)
    ) FROM private.ai_test_reservations_v5),
  'usage',(SELECT jsonb_build_object(
    'count',count(*),'distinct_operations',count(DISTINCT operation_id),
    'internal_priced_microusd',sum(private.ai_test_price_microusd(prompt_tokens,output_tokens)),
    'prompt_tokens',sum(prompt_tokens),'output_tokens',sum(output_tokens),'total_tokens',sum(total_tokens),
    'earliest',min(recorded_at),'latest',max(recorded_at)
    ) FROM private.ai_test_usage_v5),
  'usage_consistency',(SELECT jsonb_build_object(
    'orphan_usage',count(*) FILTER(WHERE r.operation_id IS NULL),
    'account_mismatches',count(*) FILTER(WHERE u.account_id<>r.account_id),
    'unsettled_with_usage',count(*) FILTER(WHERE r.settled_microusd IS NULL),
    'nonmeasured_with_usage',count(*) FILTER(WHERE r.settlement_basis IS DISTINCT FROM 'MEASURED'),
    'amount_mismatches',count(*) FILTER(WHERE r.settled_microusd IS DISTINCT FROM private.ai_test_price_microusd(u.prompt_tokens,u.output_tokens)),
    'usage_above_reservation',count(*) FILTER(WHERE private.ai_test_price_microusd(u.prompt_tokens,u.output_tokens)>r.max_cost_microusd)
    ) FROM private.ai_test_usage_v5 u LEFT JOIN private.ai_test_reservations_v5 r USING(operation_id)),
  'settlement_groups',(SELECT jsonb_agg(g ORDER BY kind,settlement_basis) FROM settlement_groups g),
  'unknown_command_groups',(SELECT jsonb_agg(g ORDER BY kind,surface,state,provider_dispatched) FROM unknown_groups g),
  'multiple_command_links',(SELECT count(*) FROM(
    SELECT operation_id FROM command_links GROUP BY operation_id HAVING count(*)>1) g),
  'current_explicit_nondispatched_links',(SELECT count(*) FROM command_links WHERE provider_dispatched=false),
  'missing_measured_usage',(SELECT to_jsonb(m) FROM missing_measured_usage m),
  'recent_usage',(SELECT to_jsonb(u) FROM recent_usage u),
  'allowlist',(SELECT jsonb_build_object('total',count(*),
    'active',count(*) FILTER(WHERE retired_at IS NULL)) FROM private.ai_test_accounts_v5),
  'functions',(SELECT jsonb_agg(m ORDER BY signature) FROM function_metadata m),
  'relevant_constraints',(SELECT jsonb_agg(jsonb_build_object(
    'relation',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))
    ORDER BY c.conrelid::regclass::text,c.conname)
    FROM pg_constraint c WHERE c.conrelid IN(
      'private.ai_test_budget_v5'::regclass,'private.ai_test_reservations_v5'::regclass,'private.ai_test_usage_v5'::regclass)
    AND (c.contype IN('p','u','f') OR c.conname='ai_test_budget_v5_ceiling_microusd_check'))
) AS evidence;

