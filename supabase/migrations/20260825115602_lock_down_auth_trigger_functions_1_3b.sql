BEGIN;
REVOKE ALL ON FUNCTION public.handle_uskoci_auth_user_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_uskoci_auth_user_updated() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_uskoci_auth_user_created() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_uskoci_auth_user_updated() TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.metadata_text_array(jsonb) FROM PUBLIC, anon, authenticated;
COMMIT;