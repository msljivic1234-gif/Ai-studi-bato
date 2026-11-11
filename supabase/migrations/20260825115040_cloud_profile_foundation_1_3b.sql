BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.metadata_text_array(value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(item), ARRAY[]::text[])
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END
  ) AS item;
$$;

CREATE TABLE IF NOT EXISTS public.app_accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  active_mode text NOT NULL DEFAULT 'requester',
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_accounts_mode_check CHECK (active_mode IN ('requester','worker'))
);

CREATE TABLE IF NOT EXISTS public.app_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.app_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_path text,
  account_type text NOT NULL DEFAULT 'INDIVIDUAL',
  profile_status text NOT NULL DEFAULT 'ACTIVE',
  years_experience integer NOT NULL DEFAULT 0,
  portfolio jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  radius_km integer NOT NULL DEFAULT 15,
  available_now boolean NOT NULL DEFAULT false,
  team_capacity integer NOT NULL DEFAULT 1,
  tools text[] NOT NULL DEFAULT ARRAY[]::text[],
  licenses text[] NOT NULL DEFAULT ARRAY[]::text[],
  vehicles text[] NOT NULL DEFAULT ARRAY[]::text[],
  exclusions text[] NOT NULL DEFAULT ARRAY[]::text[],
  minimum_fee_rsd integer NOT NULL DEFAULT 0,
  rating_requester numeric(3,2),
  rating_worker numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_profiles_kind_check CHECK (kind IN ('REQUESTER','WORKER')),
  CONSTRAINT app_profiles_account_type_check CHECK (account_type IN ('INDIVIDUAL','TEAM','COMPANY')),
  CONSTRAINT app_profiles_status_check CHECK (profile_status IN ('DRAFT','ACTIVE','SUSPENDED','CLOSED')),
  CONSTRAINT app_profiles_years_check CHECK (years_experience BETWEEN 0 AND 80),
  CONSTRAINT app_profiles_radius_check CHECK (radius_km BETWEEN 1 AND 200),
  CONSTRAINT app_profiles_capacity_check CHECK (team_capacity BETWEEN 1 AND 50),
  CONSTRAINT app_profiles_minimum_fee_check CHECK (minimum_fee_rsd BETWEEN 0 AND 10000000),
  UNIQUE(account_id, kind)
);

CREATE TABLE IF NOT EXISTS public.profile_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  label text NOT NULL DEFAULT '',
  availability_state text NOT NULL DEFAULT 'AVAILABLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_availability_window_range_check CHECK (ends_at > starts_at),
  CONSTRAINT profile_availability_window_state_check CHECK (availability_state IN ('AVAILABLE','UNAVAILABLE'))
);

CREATE TABLE IF NOT EXISTS public.profile_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.app_profiles(id) ON DELETE CASCADE,
  weekdays smallint[] NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  label text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_availability_rule_weekdays_check CHECK (
    cardinality(weekdays) BETWEEN 1 AND 7
    AND weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  ),
  CONSTRAINT profile_availability_rule_time_check CHECK (end_time > start_time),
  CONSTRAINT profile_availability_rule_dates_check CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_app_profiles_account_kind ON public.app_profiles(account_id, kind);
CREATE INDEX IF NOT EXISTS idx_profile_windows_profile_time ON public.profile_availability_windows(profile_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_profile_rules_profile_dates ON public.profile_availability_rules(profile_id, active, starts_on, ends_on);

DROP TRIGGER IF EXISTS app_accounts_set_updated_at ON public.app_accounts;
CREATE TRIGGER app_accounts_set_updated_at
BEFORE UPDATE ON public.app_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS app_profiles_set_updated_at ON public.app_profiles;
CREATE TRIGGER app_profiles_set_updated_at
BEFORE UPDATE ON public.app_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profile_windows_set_updated_at ON public.profile_availability_windows;
CREATE TRIGGER profile_windows_set_updated_at
BEFORE UPDATE ON public.profile_availability_windows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profile_rules_set_updated_at ON public.profile_availability_rules;
CREATE TRIGGER profile_rules_set_updated_at
BEFORE UPDATE ON public.profile_availability_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_uskoci_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_name text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(NEW.email,''), '@', 1), 'USKOČI korisnik');
  profile_city text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'city'), ''), 'Novi Sad');
  profile_phone text := COALESCE(NULLIF(trim(NEW.phone), ''), NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), '');
  initial_mode text := CASE WHEN NEW.raw_user_meta_data->>'mode' = 'worker' THEN 'worker' ELSE 'requester' END;
  initial_skills text[] := public.metadata_text_array(NEW.raw_user_meta_data->'skills');
BEGIN
  INSERT INTO public.app_accounts(id,email,full_name,city,phone,active_mode,onboarding_complete)
  VALUES(NEW.id,COALESCE(NEW.email,''),profile_name,profile_city,profile_phone,initial_mode,false)
  ON CONFLICT(id) DO UPDATE SET
    email=EXCLUDED.email,
    full_name=CASE WHEN public.app_accounts.full_name='' THEN EXCLUDED.full_name ELSE public.app_accounts.full_name END,
    city=CASE WHEN public.app_accounts.city='' THEN EXCLUDED.city ELSE public.app_accounts.city END,
    phone=CASE WHEN public.app_accounts.phone='' THEN EXCLUDED.phone ELSE public.app_accounts.phone END;

  INSERT INTO public.app_profiles(account_id,kind,display_name,city,headline,bio,radius_km,available_now)
  VALUES(NEW.id,'REQUESTER',profile_name,profile_city,'Tražim pouzdanu pomoć uz jasan dogovor.','Novi član USKOČI zajednice.',10,false)
  ON CONFLICT(account_id,kind) DO NOTHING;

  INSERT INTO public.app_profiles(account_id,kind,display_name,city,headline,bio,skills,radius_km,available_now)
  VALUES(NEW.id,'WORKER',profile_name,profile_city,'Spreman da uskočim kada se dogovor jasno postavi.','Dostupan za poslove koji odgovaraju profilu i kalendaru.',initial_skills,15,false)
  ON CONFLICT(account_id,kind) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_uskoci_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.app_accounts
  SET email=COALESCE(NEW.email,email),
      phone=COALESCE(NULLIF(trim(NEW.phone),''),phone)
  WHERE id=NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_uskoci_auth_user_created ON auth.users;
CREATE TRIGGER on_uskoci_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_uskoci_auth_user_created();

DROP TRIGGER IF EXISTS on_uskoci_auth_user_updated ON auth.users;
CREATE TRIGGER on_uskoci_auth_user_updated
AFTER UPDATE OF email, phone ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_uskoci_auth_user_updated();

ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_availability_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_accounts_select_own ON public.app_accounts;
CREATE POLICY app_accounts_select_own ON public.app_accounts
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);
DROP POLICY IF EXISTS app_accounts_update_own ON public.app_accounts;
CREATE POLICY app_accounts_update_own ON public.app_accounts
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS app_profiles_select_own ON public.app_profiles;
CREATE POLICY app_profiles_select_own ON public.app_profiles
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = account_id);
DROP POLICY IF EXISTS app_profiles_insert_own ON public.app_profiles;
CREATE POLICY app_profiles_insert_own ON public.app_profiles
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = account_id);
DROP POLICY IF EXISTS app_profiles_update_own ON public.app_profiles;
CREATE POLICY app_profiles_update_own ON public.app_profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = account_id)
WITH CHECK ((SELECT auth.uid()) = account_id);

DROP POLICY IF EXISTS profile_windows_select_own ON public.profile_availability_windows;
CREATE POLICY profile_windows_select_own ON public.profile_availability_windows
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS profile_windows_insert_own ON public.profile_availability_windows;
CREATE POLICY profile_windows_insert_own ON public.profile_availability_windows
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid()) AND p.kind='WORKER'
));
DROP POLICY IF EXISTS profile_windows_update_own ON public.profile_availability_windows;
CREATE POLICY profile_windows_update_own ON public.profile_availability_windows
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid()) AND p.kind='WORKER'
));
DROP POLICY IF EXISTS profile_windows_delete_own ON public.profile_availability_windows;
CREATE POLICY profile_windows_delete_own ON public.profile_availability_windows
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
));

DROP POLICY IF EXISTS profile_rules_select_own ON public.profile_availability_rules;
CREATE POLICY profile_rules_select_own ON public.profile_availability_rules
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
));
DROP POLICY IF EXISTS profile_rules_insert_own ON public.profile_availability_rules;
CREATE POLICY profile_rules_insert_own ON public.profile_availability_rules
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid()) AND p.kind='WORKER'
));
DROP POLICY IF EXISTS profile_rules_update_own ON public.profile_availability_rules;
CREATE POLICY profile_rules_update_own ON public.profile_availability_rules
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid()) AND p.kind='WORKER'
));
DROP POLICY IF EXISTS profile_rules_delete_own ON public.profile_availability_rules;
CREATE POLICY profile_rules_delete_own ON public.profile_availability_rules
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.app_profiles p
  WHERE p.id=profile_id AND p.account_id=(SELECT auth.uid())
));

GRANT SELECT, UPDATE ON public.app_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_availability_windows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_availability_rules TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('profile-media','profile-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET
  public=false,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_media_select_own ON storage.objects;
CREATE POLICY profile_media_select_own ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS profile_media_insert_own ON storage.objects;
CREATE POLICY profile_media_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS profile_media_update_own ON storage.objects;
CREATE POLICY profile_media_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id='profile-media' AND owner_id=(SELECT auth.uid())::text)
WITH CHECK (bucket_id='profile-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS profile_media_delete_own ON storage.objects;
CREATE POLICY profile_media_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='profile-media' AND owner_id=(SELECT auth.uid())::text);

CREATE OR REPLACE FUNCTION public.my_cloud_profile_bundle()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'account', (SELECT to_jsonb(a) FROM public.app_accounts a WHERE a.id=(SELECT auth.uid())),
    'profiles', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY CASE p.kind WHEN 'REQUESTER' THEN 0 ELSE 1 END) FROM public.app_profiles p WHERE p.account_id=(SELECT auth.uid())), '[]'::jsonb),
    'availabilityWindows', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.starts_at) FROM public.profile_availability_windows w JOIN public.app_profiles p ON p.id=w.profile_id WHERE p.account_id=(SELECT auth.uid())), '[]'::jsonb),
    'availabilityRules', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.starts_on,r.start_time) FROM public.profile_availability_rules r JOIN public.app_profiles p ON p.id=r.profile_id WHERE p.account_id=(SELECT auth.uid())), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.my_cloud_profile_bundle() TO authenticated;

COMMIT;