-- R05: read-only execution of the existing calendar patch/normalizer with
-- synthetic owned-candidate data. No profile, conversation, rule or window is
-- saved. This is a writer-contract proof, not an ordinary-user or Gemini E2E.
with fixture as materialized (
  select 'a1500000-0000-4000-8000-000000000001'::uuid as profile_id,
    'a1500000-0000-4000-8000-000000000002'::uuid as account_id,
    $base${
      "displayName":"R05 synthetic fixture",
      "bio":"Lektura.",
      "skills":["Lektura"],
      "availability":{
        "timezone":"Europe/Belgrade","availableNow":false,
        "rules":[{"id":"a1500000-0000-4000-8000-000000000011","weekdays":[1,3],
          "startTime":"10:00","endTime":"12:00","startsOn":"2026-11-01","endsOn":null,
          "label":"Existing rule","active":true}],
        "windows":[
          {"id":"a1500000-0000-4000-8000-000000000012","startsAt":"2026-11-07T08:00:00+01:00",
            "endsAt":"2026-11-07T22:00:00+01:00","state":"AVAILABLE","label":"Old dated window"},
          {"id":"a1500000-0000-4000-8000-000000000013","startsAt":"2026-11-12T11:00:00+01:00",
            "endsAt":"2026-11-12T12:00:00+01:00","state":"UNAVAILABLE","label":"Unrelated exception"}
        ]
      }
    }$base$::jsonb as doc
), base as materialized (
  select *, private.normalize_worker_ai_availability(profile_id,account_id,doc->'availability') as before_av from fixture
), scenarios(name,patch) as (values
  ('empty_lists',$j${"availability":{"ruleChanges":[],"windowsUpsert":[],"windowIdsRemove":[]}}$j$::jsonb),
  ('new_daily',$j${"availability":{"ruleChanges":[{"ruleId":null,"weekdays":[0,1,2,3,4,5,6],
    "value":{"startTime":"08:00","endTime":"22:00","startsOn":"2026-11-07","endsOn":null,"label":"Daily","active":true}}],
    "windowsUpsert":[],"windowIdsRemove":[]}}$j$::jsonb),
  ('change_monday',$j${"availability":{"ruleChanges":[{"ruleId":"a1500000-0000-4000-8000-000000000011","weekdays":[1],
    "value":{"startTime":"08:00","endTime":"22:00","startsOn":"2026-11-07","endsOn":null,"label":"Monday","active":true}}],
    "windowsUpsert":[],"windowIdsRemove":[]}}$j$::jsonb),
  ('daily_and_dated_removal',$j${"availability":{"ruleChanges":[{"ruleId":null,"weekdays":[0,1,2,3,4,5,6],
    "value":{"startTime":"08:00","endTime":"22:00","startsOn":"2026-11-07","endsOn":null,"label":"Daily","active":true}}],
    "windowsUpsert":[],"windowIdsRemove":["a1500000-0000-4000-8000-000000000012"]}}$j$::jsonb),
  ('tomorrow_exception',$j${"availability":{"ruleChanges":[],"windowsUpsert":[{"id":null,
    "startsAt":"2026-11-08T08:00:00+01:00","endsAt":"2026-11-08T22:00:00+01:00","state":"UNAVAILABLE","label":"Tomorrow"}],
    "windowIdsRemove":[]}}$j$::jsonb),
  ('now_only',$j${"availability":{"availableNow":true,"ruleChanges":[],"windowsUpsert":[],"windowIdsRemove":[]}}$j$::jsonb),
  ('weekend',$j${"availability":{"ruleChanges":[{"ruleId":null,"weekdays":[0,6],
    "value":{"startTime":"10:00","endTime":"14:00","startsOn":"2026-11-07","endsOn":null,"label":"Weekend","active":true}}],
    "windowsUpsert":[],"windowIdsRemove":[]}}$j$::jsonb)
), applied as materialized (
  select name,doc,before_av,private.worker_ai_patch(doc,patch,profile_id,account_id,false) as result
    from base cross join scenarios
), checks as (
  select name,
    result-array['availability']=doc-array['availability'] as unrelated_profile_unchanged,
    result#>>'{availability,timezone}'='Europe/Belgrade' as timezone_preserved,
    case name
      when 'empty_lists' then result->'availability'=before_av
      when 'new_daily' then result#>'{availability,windows}'=before_av->'windows'
        and result#>'{availability,rules}' @> (before_av->'rules')
        and jsonb_array_length(result#>'{availability,rules}')=2
        and exists(select 1 from jsonb_array_elements(result#>'{availability,rules}') x
          where x->'weekdays'='[0,1,2,3,4,5,6]' and x->>'startTime'='08:00:00'
            and x->>'endTime'='22:00:00' and x->'endsOn'='null' and x->'active'='true')
        and result#>'{availability,availableNow}'='false'
      when 'change_monday' then result#>'{availability,windows}'=before_av->'windows'
        and jsonb_array_length(result#>'{availability,rules}')=2
        and exists(select 1 from jsonb_array_elements(result#>'{availability,rules}') x
          where x->>'id'='a1500000-0000-4000-8000-000000000011' and x->'weekdays'='[3]'
            and x->>'startTime'='10:00:00' and x->>'endTime'='12:00:00')
        and exists(select 1 from jsonb_array_elements(result#>'{availability,rules}') x
          where x->'weekdays'='[1]' and x->>'startTime'='08:00:00' and x->>'endTime'='22:00:00')
      when 'daily_and_dated_removal' then jsonb_array_length(result#>'{availability,windows}')=1
        and result#>>'{availability,windows,0,id}'='a1500000-0000-4000-8000-000000000013'
        and result#>'{availability,rules}' @> (before_av->'rules')
        and exists(select 1 from jsonb_array_elements(result#>'{availability,rules}') x
          where x->'weekdays'='[0,1,2,3,4,5,6]' and x->>'startTime'='08:00:00' and x->>'endTime'='22:00:00')
      when 'tomorrow_exception' then result#>'{availability,rules}'=before_av->'rules'
        and result#>'{availability,windows}' @> (before_av->'windows')
        and jsonb_array_length(result#>'{availability,windows}')=3
        and exists(select 1 from jsonb_array_elements(result#>'{availability,windows}') x
          where x->>'state'='UNAVAILABLE' and (x->>'startsAt')::timestamptz='2026-11-08T08:00:00+01:00'::timestamptz
            and (x->>'endsAt')::timestamptz='2026-11-08T22:00:00+01:00'::timestamptz)
        and result#>'{availability,availableNow}'='false'
      when 'now_only' then result#>'{availability,rules}'=before_av->'rules'
        and result#>'{availability,windows}'=before_av->'windows'
        and result#>'{availability,availableNow}'='true'
      when 'weekend' then result#>'{availability,windows}'=before_av->'windows'
        and result#>'{availability,rules}' @> (before_av->'rules')
        and exists(select 1 from jsonb_array_elements(result#>'{availability,rules}') x
          where x->'weekdays'='[0,6]' and x->>'startTime'='10:00:00' and x->>'endTime'='14:00:00')
      else false
    end as intended_delta_only
  from applied
)
select *, unrelated_profile_unchanged and timezone_preserved and intended_delta_only as pass
  from checks order by name;
